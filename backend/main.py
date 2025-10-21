import os
import json
import datetime
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, Float, DateTime
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.declarative import declarative_base
from pydantic import BaseModel
import paho.mqtt.client as mqtt

# --- Environment and Database Configuration ---
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable not set")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- MQTT Broker Configuration ---
MQTT_BROKER = "test.mosquitto.org"
MQTT_PORT = 1883
MQTT_TOPIC = "master/backend/collection"

# --- Database Model (Updated to match MQTT payload) ---
class SensorData(Base):
    """
    This class defines the structure of the 'sensor_data' table in the database,
    matching the combined data from your IoT devices.
    """
    __tablename__ = "sensor_data"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    worker_1_mean = Column(Float, nullable=True)
    worker_1_min = Column(Integer, nullable=True)
    worker_1_max = Column(Integer, nullable=True)
    worker_1_variance = Column(Float, nullable=True)
    worker_2_mean = Column(Float, nullable=True)
    worker_2_min = Column(Integer, nullable=True)
    worker_2_max = Column(Integer, nullable=True)
    worker_2_variance = Column(Float, nullable=True)
    worker_3_mean = Column(Float, nullable=True)
    worker_3_min = Column(Integer, nullable=True)
    worker_3_max = Column(Integer, nullable=True)
    worker_3_variance = Column(Float, nullable=True)
    humidity = Column(Float, nullable=True)
    temp = Column(Float, nullable=True)

# Create the table in the database if it doesn't exist
Base.metadata.create_all(bind=engine)

# --- Pydantic Models (Data Validation for API Response) ---
class SensorDataResponse(BaseModel):
    """
    Defines the data structure for data being sent out from the API.
    """
    id: int
    timestamp: datetime.datetime
    worker_1_mean: float | None = None
    worker_1_min: int | None = None
    worker_1_max: int | None = None
    worker_1_variance: float | None = None
    worker_2_mean: float | None = None
    worker_2_min: int | None = None
    worker_2_max: int | None = None
    worker_2_variance: float | None = None
    worker_3_mean: float | None = None
    worker_3_min: int | None = None
    worker_3_max: int | None = None
    worker_3_variance: float | None = None
    humidity: float | None = None
    temp: float | None = None

    class Config:
        from_attributes = True # Helps Pydantic work with ORM models like SQLAlchemy

# --- FastAPI Application Setup ---
app = FastAPI(title="IoT Sensor Backend")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Database Session Dependency ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- MQTT Client Logic ---
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("Connected to MQTT Broker!")
        client.subscribe(MQTT_TOPIC)
        print(f"Subscribed to topic: {MQTT_TOPIC}")
    else:
        print(f"Failed to connect, return code {rc}\n")

def on_message(client, userdata, msg):
    print(f"Message received on topic {msg.topic}")
    db = None # Initialize db to None for robust error handling
    try:
        # 1. Decode and parse the JSON payload
        payload = json.loads(msg.payload.decode())
        print("Payload:", payload)

        # 2. Get a new database session
        db = SessionLocal()

        # 3. Create a new SensorData record
        # This works because your payload keys match the SensorData model
        db_data = SensorData(**payload)

        # 4. Add, commit, and close the session
        db.add(db_data)
        db.commit()
        db.refresh(db_data)
        print(f"Successfully added data to DB with ID: {db_data.id}")

    except json.JSONDecodeError:
        print("Error: Could not decode JSON from payload.")
    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        if db:
            db.close()

# --- FastAPI Events for MQTT Lifecycle ---
@app.on_event("startup")
async def startup_event():
    global client
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message
    client.connect(MQTT_BROKER, MQTT_PORT, 60)
    client.loop_start() # Starts a background thread to handle MQTT network traffic

@app.on_event("shutdown")
async def shutdown_event():
    client.loop_stop()
    client.disconnect()
    print("MQTT client disconnected.")

# --- API Endpoints ---
@app.get("/fetchdata", response_model=list[SensorDataResponse])
def read_all_sensor_data(skip: int = 0, limit: int = 1000, db: Session = Depends(get_db)):
    """
    Endpoint to retrieve all sensor data points from the database.
    - Path: /fetchdata
    - Method: GET
    """
    # Fetch the most recent records first
    all_data = db.query(SensorData).order_by(SensorData.timestamp.desc()).offset(skip).limit(limit).all()
    if not all_data:
        raise HTTPException(status_code=404, detail="No data found")
    return all_data