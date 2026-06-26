from fastapi import WebSocket
from typing import Dict
import json

class ConnectionManager:
    """
    Manages WebSocket connections for real-time accident alerts.
    
    KEY interview talking point:
    WHY WebSockets over polling?
    → Polling (every 5s): 720 requests/hour per client, high server load, 5s delay
    → WebSockets: 1 persistent connection, instant push, <100ms latency
    → For emergency alerts, 5 seconds can mean life or death
    
    HOW it works:
    → Responders connect to /ws/responder/{responder_id}
    → Public dashboard connects to /ws/dashboard
    → When accident reported → server pushes to ALL connected clients instantly
    """

    def __init__(self):
        # responder_id → WebSocket
        self.responder_connections: Dict[str, WebSocket] = {}
        # All dashboard viewers
        self.dashboard_connections: list[WebSocket] = []

    async def connect_responder(self, websocket: WebSocket, responder_id: str):
        await websocket.accept()
        self.responder_connections[responder_id] = websocket
        print(f"Responder {responder_id} connected. Total: {len(self.responder_connections)}")

    async def connect_dashboard(self, websocket: WebSocket):
        await websocket.accept()
        self.dashboard_connections.append(websocket)
        print(f"Dashboard connected. Total viewers: {len(self.dashboard_connections)}")

    def disconnect_responder(self, responder_id: str):
        self.responder_connections.pop(responder_id, None)

    def disconnect_dashboard(self, websocket: WebSocket):
        if websocket in self.dashboard_connections:
            self.dashboard_connections.remove(websocket)

    async def alert_responders(self, responder_ids: list[int], alert_data: dict):
        """Push alert to specific responders (nearest ones found by geo service)."""
        message = json.dumps({"type": "NEW_ACCIDENT_ALERT", "data": alert_data})
        disconnected = []
        
        for rid in responder_ids:
            ws = self.responder_connections.get(str(rid))
            if ws:
                try:
                    await ws.send_text(message)
                except Exception:
                    disconnected.append(str(rid))
        
        # Clean up dead connections
        for rid in disconnected:
            self.responder_connections.pop(rid, None)

    async def broadcast_to_dashboard(self, event_data: dict):
        """Push all new accidents/updates to the live public dashboard."""
        message = json.dumps(event_data)
        disconnected = []
        
        for ws in self.dashboard_connections:
            try:
                await ws.send_text(message)
            except Exception:
                disconnected.append(ws)
        
        for ws in disconnected:
            self.dashboard_connections.remove(ws)

# Singleton — shared across all routers
manager = ConnectionManager()