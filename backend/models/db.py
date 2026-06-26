from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models.database import Base
from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def create_tables():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def seed_responders(db):
    """Seed some sample hospitals/ambulances for demo purposes."""
    from models.database import Responder
    
    if db.query(Responder).count() > 0:
        return  # already seeded
    
    responders = [
        Responder(name="AIIMS Bhopal", type="hospital", latitude=23.1815, longitude=77.3411, contact="0755-2960000", city="Bhopal"),
        Responder(name="Hamidia Hospital", type="hospital", latitude=23.2599, longitude=77.4126, contact="0755-2540222", city="Bhopal"),
        Responder(name="City Ambulance Unit 1", type="ambulance", latitude=23.2500, longitude=77.4000, contact="108", city="Bhopal"),
        Responder(name="City Ambulance Unit 2", type="ambulance", latitude=23.1700, longitude=77.3900, contact="108", city="Bhopal"),
        Responder(name="MP Police Control Room", type="police", latitude=23.2300, longitude=77.4200, contact="100", city="Bhopal"),
        Responder(name="Jabalpur Hospital", type="hospital", latitude=23.1815, longitude=79.9864, contact="0761-2600000", city="Jabalpur"),
        Responder(name="Jabalpur Ambulance", type="ambulance", latitude=23.1700, longitude=79.9500, contact="108", city="Jabalpur"),
    ]
    db.add_all(responders)
    db.commit()
    print("✅ Seeded responders")