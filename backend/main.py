import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import accidents
from routers.ws_router import router as ws_router
from models.db import create_tables, get_db, seed_responders

app = FastAPI(
    title="Road Accident Alert System",
    description="Real-time accident reporting with AI triage and WebSocket alerts",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(accidents.router)
app.include_router(ws_router)

@app.on_event("startup")
def startup():
    create_tables()
    db = next(get_db())
    seed_responders(db)
    print("✅ Road Accident Alert System running")
    print("GEMINI_API_KEY present:", bool(os.getenv("GEMINI_API_KEY")))

@app.get("/")
def root():
    return {
        "message": "Road Accident Alert System API",
        "docs": "/docs",
        "websockets": {
            "dashboard": "ws://localhost:8000/ws/dashboard",
            "responder": "ws://localhost:8000/ws/responder/{id}"
        },
        "endpoints": {
            "report_accident": "POST /accidents/report",
            "active_accidents": "GET /accidents/active",
            "stats": "GET /accidents/stats",
            "update_status": "PATCH /accidents/{id}/status"
        }
    }

@app.get("/health")
def health():
    return {"status": "ok"}
