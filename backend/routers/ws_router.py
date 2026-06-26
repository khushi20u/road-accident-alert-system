from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from websocket.manager import manager

router = APIRouter(tags=["websocket"])

@router.websocket("/ws/dashboard")
async def dashboard_ws(websocket: WebSocket):
    """
    Public dashboard connects here to receive live accident updates.
    Every new accident report → instant push to all dashboard viewers.
    """
    await manager.connect_dashboard(websocket)
    try:
        while True:
            # Keep connection alive — dashboard is receive-only
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_dashboard(websocket)

@router.websocket("/ws/responder/{responder_id}")
async def responder_ws(websocket: WebSocket, responder_id: str):
    """
    Responders (hospitals, ambulances) connect here.
    They receive alerts ONLY when they are the nearest to an accident.
    """
    await manager.connect_responder(websocket, responder_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Responders can send acknowledgments back
            await manager.broadcast_to_dashboard({
                "type": "RESPONDER_ACK",
                "data": {"responder_id": responder_id, "message": data}
            })
    except WebSocketDisconnect:
        manager.disconnect_responder(responder_id)