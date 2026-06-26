"""
Community Verification — Layer 3 of False Report Prevention

When a report is flagged as suspicious by Layer 2 (confidence checker),
it enters a "pending verification" state instead of auto-dispatching.

Nearby users (within 5km) see the unverified report on the map
and can tap "Confirm — I see this accident too."

Once CONFIRMATIONS_NEEDED users confirm → report escalates:
  - Status changes to verified
  - Responders get dispatched immediately
  - Dashboard gets a WebSocket push

KEY INTERVIEW TALKING POINTS:
1. "This is the same trust model as Waze — crowdsourced incident verification"
2. "We prevent a single bad actor from flooding responders with fake reports"
3. "Confirmation is proximity-gated — you must be within 5km to confirm,
    so you can't confirm an accident in Delhi while sitting in Mumbai"
4. "It's a human-in-the-loop system — AI triages, humans verify edge cases"
"""

from collections import defaultdict

CONFIRMATIONS_NEEDED = 2
CONFIRMATION_RADIUS_KM = 5.0

# accident_id → set of confirming reporter_ids (prevents double-confirming)
_confirmations: dict[int, set[str]] = defaultdict(set)


def add_confirmation(accident_id: int, confirmer_id: str) -> dict:
    """
    Record a community confirmation for a flagged report.
    Returns current confirmation status.
    """
    _confirmations[accident_id].add(confirmer_id)
    count = len(_confirmations[accident_id])
    verified = count >= CONFIRMATIONS_NEEDED

    return {
        "accident_id": accident_id,
        "confirmation_count": count,
        "confirmations_needed": CONFIRMATIONS_NEEDED,
        "is_verified": verified,
        "message": (
            f"Report verified by community! Dispatching responders now."
            if verified else
            f"Confirmation recorded ({count}/{CONFIRMATIONS_NEEDED}). "
            f"Need {CONFIRMATIONS_NEEDED - count} more to dispatch responders."
        )
    }


def get_confirmation_count(accident_id: int) -> int:
    return len(_confirmations.get(accident_id, set()))


def is_verified(accident_id: int) -> bool:
    return get_confirmation_count(accident_id) >= CONFIRMATIONS_NEEDED


def is_within_radius(
    user_lat: float, user_lon: float,
    accident_lat: float, accident_lon: float
) -> bool:
    """
    Proximity gate — user must be within CONFIRMATION_RADIUS_KM
    of the accident to confirm it.
    Uses Haversine (same as geo_service).
    """
    import math
    R = 6371
    lat1, lon1, lat2, lon2 = map(math.radians, [user_lat, user_lon, accident_lat, accident_lon])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    distance = R * 2 * math.asin(math.sqrt(a))
    return distance <= CONFIRMATION_RADIUS_KM