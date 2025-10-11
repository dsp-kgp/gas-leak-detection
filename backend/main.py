import os
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, Float, DateTime, String
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel
import datetime

# --- Environment and Database Configuration ---

# Load environment variables from .env file
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable not set")

# SQLAlchemy setup
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- FastAPI Application Setup ---
app = FastAPI(title="IoT Sensor API")

#---- Cross Origin Resource Sharing (CORS) Configuration ----#
CORS_ORIGINS = ["http://localhost:5173","*"]
# Allow all origins for simplicity; adjust in production for security
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# --- Database Model (Table Schema) ---

class SensorData(Base):
    """
    This class defines the structure of the 'sensor_data' table in the database.
    """
    __tablename__ = "sensor_data"

    id = Column(Integer, primary_key=True, index=True)
    raw = Column(Integer)
    mean = Column(Float)
    stddev = Column(Float)
    slope = Column(Float)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

# Create the table in the database if it doesn't exist
Base.metadata.create_all(bind=engine)


# --- Pydantic Models (Data Validation) ---

class SensorDataCreate(BaseModel):
    """
    Defines the expected data structure for incoming sensor data via the API.
    """
    raw: int
    mean: float
    stddev: float
    slope: float

class SensorDataResponse(SensorDataCreate):
    """
    Defines the data structure for data being sent out from the API.
    Includes the ID and timestamp.
    """
    id: int
    timestamp: datetime.datetime

    class Config:
        orm_mode = True # Helps Pydantic work with ORM models like SQLAlchemy

# --- Database Session Dependency ---

# --- Dependency for Database Session ---

def get_db():
    """
    This function creates and yields a new database session for each request.
    It ensures the session is always closed, even if an error occurs.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- API Endpoints ---

@app.post("/senddata", response_model=SensorDataResponse)
def create_sensor_data(data: SensorDataCreate, db: Session = Depends(get_db)):
    """
    Endpoint to receive sensor data and store it in the database.
    - Path: /senddata
    - Method: POST
    - Body: { "raw": 0, "mean": 710, "stddev": 1225.73, "slope": -118.62 }
    """
    db_data = SensorData(**data.dict())
    db.add(db_data)
    db.commit()
    db.refresh(db_data)
    return db_data

@app.get("/fetchall", response_model=list[SensorDataResponse])
def read_sensor_data(skip: int = 0, limit: int = 1000, db: Session = Depends(get_db)):
    """
    Endpoint to retrieve all sensor data points from the database.
    - Path: /fetchall
    - Method: GET
    """
    # Fetch the most recent records first
    all_data = db.query(SensorData).order_by(SensorData.timestamp.desc()).offset(skip).limit(limit).all()
    return all_data

@app.get("/")
def read_root():
    return {"message": "Welcome to the IoT Sensor Data API"}
