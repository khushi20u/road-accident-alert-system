import math
from sqlalchemy.orm import Session
from models.database import Responder

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate distance between two GPS coordinates in kilometers.
    Using Haversine formula — great interview talking point over PostGIS for simplicity.
    """
    R = 6371  # Earth radius in km
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    return R * 2 * math.asin(math.sqrt(a))

def estimate_response_time(distance_km: float, responder_type: str) -> int:
    """Estimate response time in minutes based on distance and type."""
    speeds = {
        "ambulance": 60,   # km/h in urban
        "police": 70,
        "hospital": None,  # hospitals don't move
        "fire": 50
    }
    speed = speeds.get(responder_type)
    if not speed:
        return None
    return round((distance_km / speed) * 60)

def find_nearest_responders(
    accident_lat: float,
    accident_lon: float,
    ai_analysis: dict,
    db: Session,
    radius_km: float = 50.0
) -> list:
    """
    Find nearest relevant responders based on:
    1. GPS distance (Haversine)
    2. What AI triage says is needed (ambulance/police/fire)
    3. Availability
    
    KEY interview point: Why Haversine over PostGIS?
    → PostGIS is overkill for <1000 responders; Haversine is O(n) but n is small.
    → At scale, we'd switch to PostGIS spatial index for O(log n) queries.
    """
    all_responders = db.query(Responder).filter(Responder.is_available == "true").all()
    
    needed_types = ["hospital"]  # always include hospitals
    if ai_analysis.get("requires_ambulance"):
        needed_types.append("ambulance")
    if ai_analysis.get("requires_police"):
        needed_types.append("police")
    if ai_analysis.get("requires_fire"):
        needed_types.append("fire")

    results = []
    for responder in all_responders:
        if responder.type not in needed_types:
            continue
        
        distance = haversine_distance(
            accident_lat, accident_lon,
            responder.latitude, responder.longitude
        )
        
        if distance > radius_km:
            continue
        
        results.append({
            "id": responder.id,
            "name": responder.name,
            "type": responder.type,
            "contact": responder.contact,
            "latitude": responder.latitude,
            "longitude": responder.longitude,
            "distance_km": round(distance, 2),
            "estimated_response_minutes": estimate_response_time(distance, responder.type),
            "city": responder.city
        })

    # Sort by distance — closest first
    results.sort(key=lambda x: x["distance_km"])
    
    # Return top 3 of each type
    by_type = {}
    for r in results:
        t = r["type"]
        if t not in by_type:
            by_type[t] = []
        if len(by_type[t]) < 3:
            by_type[t].append(r)

    flattened = [r for group in by_type.values() for r in group]
    flattened.sort(key=lambda x: x["distance_km"])
    return flattened