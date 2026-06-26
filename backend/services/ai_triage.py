import google.generativeai as genai
from dotenv import load_dotenv
import os
import json
import base64

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

text_model = genai.GenerativeModel("gemini-1.5-flash")
vision_model = genai.GenerativeModel("gemini-1.5-flash")

def analyze_accident(description: str, image_data: bytes = None) -> dict:
    """
    Core AI triage function.
    Takes text description + optional image → returns structured severity analysis.
    
    This is the KEY interview talking point:
    - We never let AI make the final call alone
    - Conservative thresholds: when uncertain → escalate to CRITICAL
    - Graph-grounded: AI output feeds directly into responder dispatch
    """

    base_prompt = f"""
    You are an emergency triage AI for road accidents. Analyze this accident report and return ONLY a JSON object.
    
    Accident description: "{description}"
    
    Return ONLY this JSON (no markdown, no explanation):
    {{
        "severity": "low" | "medium" | "critical",
        "severity_score": <float 0.0 to 1.0>,
        "estimated_casualties": <integer, 0 if unknown>,
        "summary": "<2 sentence summary of the situation>",
        "recommended_response": "<what responders should bring/do>",
        "requires_ambulance": <true|false>,
        "requires_police": <true|false>,
        "requires_fire": <true|false>,
        "confidence": <float 0.0 to 1.0>
    }}
    
    Triage rules:
    - If ANY mention of fire, entrapment, multiple vehicles, highway → severity = critical
    - If unconscious/bleeding/injury mentioned → severity = critical  
    - If uncertain → always escalate severity (conservative threshold)
    - severity_score: low=0.0-0.3, medium=0.3-0.7, critical=0.7-1.0
    """

    try:
        if image_data:
            # Vision analysis — Gemini can see the accident photo
            image_part = {
                "inline_data": {
                    "mime_type": "image/jpeg",
                    "data": base64.b64encode(image_data).decode("utf-8")
                }
            }
            response = vision_model.generate_content([base_prompt, image_part])
        else:
            response = text_model.generate_content(base_prompt)

        raw = response.text.strip().replace("```json", "").replace("```", "").strip()
        result = json.loads(raw)

        # Safety override: if confidence < 0.5, always escalate to critical
        # This is a KEY interview point — AI humility / responsible AI
        if result.get("confidence", 1.0) < 0.5:
            result["severity"] = "critical"
            result["severity_score"] = max(result.get("severity_score", 0.5), 0.7)
            result["recommended_response"] = "LOW CONFIDENCE — dispatch all available units. " + result.get("recommended_response", "")

        return result

    except Exception as e:
        print(f"Gemini triage error: {e}")
        # Fail safe: if AI fails, default to CRITICAL so responders always go
        return {
            "severity": "critical",
            "severity_score": 1.0,
            "estimated_casualties": 0,
            "summary": "AI analysis unavailable. Treating as critical for safety.",
            "recommended_response": "Dispatch all units — AI triage failed, manual assessment needed.",
            "requires_ambulance": True,
            "requires_police": True,
            "requires_fire": False,
            "confidence": 0.0
        }

def generate_alert_message(accident_data: dict, ai_analysis: dict) -> str:
    """Generate a concise alert message for responders."""
    prompt = f"""
    Generate a short emergency alert (under 50 words) for first responders.
    
    Location: {accident_data.get('location_description', 'Unknown location')}
    Severity: {ai_analysis.get('severity', 'unknown').upper()}
    Summary: {ai_analysis.get('summary', '')}
    Required: {ai_analysis.get('recommended_response', '')}
    
    Format: "🚨 [SEVERITY] ALERT: [what happened] at [location]. [What to bring]. ETA requested."
    """
    try:
        response = text_model.generate_content(prompt)
        return response.text.strip()
    except:
        return f"🚨 {ai_analysis.get('severity', 'UNKNOWN').upper()} ACCIDENT ALERT at {accident_data.get('location_description', 'unknown location')}. Respond immediately."