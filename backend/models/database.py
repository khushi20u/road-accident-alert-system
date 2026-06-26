from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
import enum

Base = declarative_base()

class SeverityLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    CRITICAL = "critical"

class AccidentStatus(str, enum.Enum):
    REPORTED = "reported"
    RESPONDING = "responding"
    RESOLVED = "resolved"

class Accident(Base):
    __tablename__ = "accidents"

    id = Column(Integer, primary_key=True, index=True)
    
    # Location
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    location_description = Column(String(500))
    
    # Incident details
    description = Column(Text, nullable=False)
    severity = Column(Enum(SeverityLevel), default=SeverityLevel.MEDIUM)
    status = Column(Enum(AccidentStatus), default=AccidentStatus.REPORTED)
    
    # AI analysis
    ai_severity_score = Column(Float)           # 0.0 - 1.0
    ai_summary = Column(Text)                   # Gemini generated summary
    estimated_casualties = Column(Integer)
    recommended_response = Column(Text)         # What responders should bring
    
    # Media
    image_url = Column(String(500))
    
    # Reporter info (anonymous)
    reporter_id = Column(String(100))           # random UUID, no PII
    
    # Timestamps
    reported_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    resolved_at = Column(DateTime, nullable=True)

class Responder(Base):
    __tablename__ = "responders"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    type = Column(String(50))                   # 'hospital', 'ambulance', 'police'
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    contact = Column(String(100))
    is_available = Column(String(10), default="true")
    city = Column(String(100))