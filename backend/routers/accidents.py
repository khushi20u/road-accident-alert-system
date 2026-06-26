from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException, Request
from sqlalchemy.orm import Session
from models.db import get_db
from models.database import Accident, SeverityLevel, AccidentStatus
from services.ai_triage import analyze_accident, generate_alert_message
from services.geo_service import find_nearest_responders
from services.rate_limiter import is_rate_limited, record_request, get_remaining
from services.confidence_checker import check_report_validity
from services.community_verify import add_confirmation, is_within_radius, get_confirmation_count
from websocket.manager import manager
from pydantic import BaseModel
from typing import Optional
import uuid

router = APIRouter(prefix="/accidents", tags=["accidents"])


@router.post("/report")
async def report_accident(
    request: Request,
    description: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    location_description: str = Form(""),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    """
    Main endpoint with 2-layer false report prevention:
    Layer 1 — Rate limiting (max 3 reports/hour per IP)
    Layer 2 — Confidence scoring (flags suspicious reports)
    """

    # ── Layer 1: Rate Limiting ─────────────────────────────────────────────
    client_ip = request.client.host
    limited, limit_message = is_rate_limited(client_ip)

    if limited:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "rate_limited",
                "message": limit_message,
                "remaining_reports": 0
            }
        )

    # Record this request
    record_request(client_ip)
    remaining = get_remaining(client_ip)

    # ── AI Triage ──────────────────────────────────────────────────────────
    image_data = None
    if image:
        image_data = await image.read()

    ai_analysis = analyze_accident(description, image_data)

    # ── Layer 2: Confidence Scoring ────────────────────────────────────────
    validity = check_report_validity(description, ai_analysis)

    # ── Find Nearest Responders ────────────────────────────────────────────
    nearest = []
    if validity["should_alert_responders"]:
        nearest = find_nearest_responders(latitude, longitude, ai_analysis, db)

    responder_ids = [r["id"] for r in nearest]

    # ── Save to DB ─────────────────────────────────────────────────────────
    accident = Accident(
        latitude=latitude,
        longitude=longitude,
        location_description=location_description,
        description=description,
        severity=SeverityLevel(ai_analysis["severity"]),
        ai_severity_score=ai_analysis["severity_score"],
        ai_summary=ai_analysis["summary"],
        estimated_casualties=ai_analysis["estimated_casualties"],
        recommended_response=ai_analysis["recommended_response"],
        reporter_id=str(uuid.uuid4()),
        # If suspicious, mark as unverified
        status=AccidentStatus.REPORTED if validity["should_alert_responders"] else AccidentStatus.REPORTED,
    )
    db.add(accident)
    db.commit()
    db.refresh(accident)

    # ── WebSocket Push (only if not suspicious) ────────────────────────────
    if validity["should_alert_responders"]:
        alert_message = generate_alert_message(
            {"location_description": location_description},
            ai_analysis
        )
        alert_payload = {
            "accident_id": accident.id,
            "severity": ai_analysis["severity"],
            "severity_score": ai_analysis["severity_score"],
            "summary": ai_analysis["summary"],
            "location": location_description,
            "latitude": latitude,
            "longitude": longitude,
            "recommended_response": ai_analysis["recommended_response"],
            "alert_message": alert_message,
            "nearest_responders": nearest,
            "reported_at": accident.reported_at.isoformat()
        }
        await manager.alert_responders(responder_ids, alert_payload)
        await manager.broadcast_to_dashboard({
            "type": "NEW_ACCIDENT",
            "data": alert_payload
        })

    return {
        "success": True,
        "accident_id": accident.id,
        "ai_analysis": ai_analysis,
        "nearest_responders": nearest,
        "alert_sent_to": len(responder_ids),
        "remaining_reports_this_hour": remaining,

        # Validity info shown to reporter
        "validity": {
            "action": validity["action"],
            "message": validity["message"],
            "flags": validity["flags"],
            "is_suspicious": validity["is_suspicious"]
        }
    }


class ConfirmRequest(BaseModel):
    confirmer_id: str       # anonymous UUID from frontend
    user_lat: float
    user_lon: float

@router.post("/{accident_id}/confirm")
async def confirm_accident(accident_id: int, body: ConfirmRequest, db: Session = Depends(get_db)):
    """
    Layer 3 — Community verification endpoint.
    
    Flow:
    1. Check user is within 5km of accident (proximity gate)
    2. Record their confirmation
    3. If confirmations_needed reached → dispatch responders + WebSocket push
    """
    accident = db.query(Accident).filter(Accident.id == accident_id).first()
    if not accident:
        raise HTTPException(status_code=404, detail="Accident not found")

    # Proximity gate — must be within 5km to confirm
    within_range = is_within_radius(
        body.user_lat, body.user_lon,
        accident.latitude, accident.longitude
    )
    if not within_range:
        raise HTTPException(
            status_code=400,
            detail="You must be within 5km of the accident to confirm it."
        )

    # Record confirmation
    result = add_confirmation(accident_id, body.confirmer_id)

    # If now verified → dispatch responders
    if result["is_verified"]:
        ai_analysis = {
            "severity": accident.severity.value,
            "severity_score": accident.ai_severity_score or 0.7,
            "requires_ambulance": True,
            "requires_police": True,
            "requires_fire": False,
            "summary": accident.ai_summary,
            "recommended_response": accident.recommended_response,
        }
        nearest = find_nearest_responders(
            accident.latitude, accident.longitude, ai_analysis, db
        )
        responder_ids = [r["id"] for r in nearest]

        alert_payload = {
            "accident_id": accident.id,
            "severity": accident.severity.value,
            "summary": accident.ai_summary,
            "location": accident.location_description,
            "latitude": accident.latitude,
            "longitude": accident.longitude,
            "recommended_response": accident.recommended_response,
            "alert_message": f"🚨 COMMUNITY VERIFIED: {accident.ai_summary}",
            "nearest_responders": nearest,
            "reported_at": accident.reported_at.isoformat(),
            "verified_by_community": True,
            "confirmation_count": result["confirmation_count"]
        }

        await manager.alert_responders(responder_ids, alert_payload)
        await manager.broadcast_to_dashboard({
            "type": "NEW_ACCIDENT",
            "data": alert_payload
        })
        await manager.broadcast_to_dashboard({
            "type": "REPORT_VERIFIED",
            "data": {"accident_id": accident_id, "confirmation_count": result["confirmation_count"]}
        })

    return {
        **result,
        "proximity_check": "passed"
    }

@router.get("/{accident_id}/confirmations")
def get_confirmations(accident_id: int):
    """Get current confirmation count for a flagged report."""
    return {
        "accident_id": accident_id,
        "confirmation_count": get_confirmation_count(accident_id),
        "confirmations_needed": 2,
        "is_verified": get_confirmation_count(accident_id) >= 2
    }

@router.get("/active")
def get_active_accidents(db: Session = Depends(get_db)):
    accidents = db.query(Accident).filter(
        Accident.status != AccidentStatus.RESOLVED
    ).order_by(Accident.reported_at.desc()).limit(50).all()

    return [{
        "id": a.id,
        "latitude": a.latitude,
        "longitude": a.longitude,
        "severity": a.severity,
        "summary": a.ai_summary,
        "status": a.status,
        "location": a.location_description,
        "reported_at": a.reported_at.isoformat() if a.reported_at else None,
        "estimated_casualties": a.estimated_casualties,
        "recommended_response": a.recommended_response
    } for a in accidents]


class StatusUpdate(BaseModel):
    status: str


@router.patch("/{accident_id}/status")
async def update_status(accident_id: int, body: StatusUpdate, db: Session = Depends(get_db)):
    accident = db.query(Accident).filter(Accident.id == accident_id).first()
    if not accident:
        raise HTTPException(status_code=404, detail="Accident not found")

    accident.status = AccidentStatus(body.status)
    db.commit()

    await manager.broadcast_to_dashboard({
        "type": "STATUS_UPDATE",
        "data": {"accident_id": accident_id, "status": body.status}
    })
    return {"success": True, "accident_id": accident_id, "new_status": body.status}


@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    total = db.query(Accident).count()
    critical = db.query(Accident).filter(Accident.severity == SeverityLevel.CRITICAL).count()
    resolved = db.query(Accident).filter(Accident.status == AccidentStatus.RESOLVED).count()
    active = db.query(Accident).filter(Accident.status != AccidentStatus.RESOLVED).count()
    return {
        "total_reported": total,
        "critical": critical,
        "resolved": resolved,
        "active": active,
        "response_rate": round((resolved / total * 100), 1) if total > 0 else 0
    }