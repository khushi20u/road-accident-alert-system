"""
Confidence Checker — Layer 2 of False Report Prevention

Flags suspicious reports BEFORE alerting responders.
A flagged report is saved to DB but held for verification
rather than immediately dispatching responders.

KEY INTERVIEW TALKING POINT:
"We never let AI be the sole gatekeeper. If confidence is low,
we hold the alert and require a second signal — either higher
AI confidence on retry, or a manual review. The fail-safe
always errs toward human oversight, not automation."

Suspicious signals:
1. Description too short (< 10 words) — not enough info
2. Gemini confidence < 0.5 — AI itself isn't sure
3. Description contains known spam patterns
4. Severity mismatch — description sounds minor but AI says critical
"""

SPAM_PATTERNS = [
    "test", "testing", "fake", "hello", "abc", "123",
    "dummy", "sample", "trial", "checking"
]

MIN_DESCRIPTION_WORDS = 10
MIN_CONFIDENCE_THRESHOLD = 0.5


def check_report_validity(description: str, ai_analysis: dict) -> dict:
    """
    Analyze a report for suspicious signals.
    Returns a validity assessment with flags and recommended action.
    """
    flags = []
    word_count = len(description.strip().split())

    # Flag 1: Description too short
    if word_count < MIN_DESCRIPTION_WORDS:
        flags.append(f"Description too short ({word_count} words, minimum {MIN_DESCRIPTION_WORDS})")

    # Flag 2: Low AI confidence
    confidence = ai_analysis.get("confidence", 1.0)
    if confidence < MIN_CONFIDENCE_THRESHOLD:
        flags.append(f"Low AI confidence ({round(confidence * 100)}%)")

    # Flag 3: Spam patterns detected
    desc_lower = description.lower()
    detected_spam = [p for p in SPAM_PATTERNS if p in desc_lower]
    if detected_spam:
        flags.append(f"Suspicious keywords detected: {', '.join(detected_spam)}")

    # Flag 4: Severity mismatch
    # If description has no urgency words but AI says critical → suspicious
    urgency_words = ["unconscious", "fire", "bleeding", "trapped", "critical",
                     "severe", "crash", "collision", "injured", "dead", "dying"]
    has_urgency = any(w in desc_lower for w in urgency_words)
    if ai_analysis.get("severity") == "critical" and not has_urgency and word_count < 15:
        flags.append("Severity mismatch: critical severity but no urgency indicators in description")

    # Determine action based on flags
    is_suspicious = len(flags) > 0
    should_alert = not is_suspicious  # only auto-alert if clean

    # If ONLY one minor flag (short description but high confidence) → still alert
    # This avoids blocking legitimate brief reports
    if len(flags) == 1 and "too short" in flags[0] and confidence >= 0.7:
        should_alert = True
        is_suspicious = False
        flags = []

    return {
        "is_suspicious": is_suspicious,
        "should_alert_responders": should_alert,
        "flags": flags,
        "flag_count": len(flags),
        "action": "held_for_review" if is_suspicious else "auto_dispatched",
        "message": (
            "Report flagged for review. Responders will be alerted after verification."
            if is_suspicious else
            "Report verified. Responders alerted immediately."
        )
    }