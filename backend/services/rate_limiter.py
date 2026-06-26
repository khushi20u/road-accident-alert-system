"""
Rate Limiter — Layer 1 of False Report Prevention

Strategy: In-memory store (dict) tracking requests per IP.
Max 3 reports per IP per hour.

KEY INTERVIEW TALKING POINT:
Why in-memory over Redis?
→ For a single-server deployment, in-memory is perfectly fine and zero-dependency.
→ At scale (multiple servers), we'd switch to Redis so all servers share the same
  rate limit state. That's a 1-line change: swap the dict for redis.incr().
→ Shows you understand the trade-off without over-engineering for current scale.
"""

from collections import defaultdict
from datetime import datetime, timedelta

# ip_address → list of timestamps of recent reports
_request_log: dict[str, list[datetime]] = defaultdict(list)

MAX_REPORTS_PER_HOUR = 3
WINDOW = timedelta(hours=1)


def is_rate_limited(ip: str) -> tuple[bool, str]:
    """
    Check if an IP has exceeded the rate limit.
    Returns (is_limited, message)
    """
    now = datetime.utcnow()

    # Clean up old timestamps outside the 1-hour window
    _request_log[ip] = [
        ts for ts in _request_log[ip]
        if now - ts < WINDOW
    ]

    count = len(_request_log[ip])

    if count >= MAX_REPORTS_PER_HOUR:
        oldest = _request_log[ip][0]
        reset_in = int((oldest + WINDOW - now).total_seconds() / 60)
        return True, f"Rate limit exceeded. You can submit again in {reset_in} minutes."

    return False, ""


def record_request(ip: str):
    """Record a new report submission for this IP."""
    _request_log[ip].append(datetime.utcnow())


def get_remaining(ip: str) -> int:
    """How many reports this IP can still submit this hour."""
    now = datetime.utcnow()
    _request_log[ip] = [ts for ts in _request_log[ip] if now - ts < WINDOW]
    return max(0, MAX_REPORTS_PER_HOUR - len(_request_log[ip]))