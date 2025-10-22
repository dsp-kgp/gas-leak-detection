import os
import json
import datetime
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, Request, status as http_status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, Float, DateTime, String, ForeignKey, Boolean
from sqlalchemy.orm import sessionmaker, Session, relationship
from sqlalchemy.ext.declarative import declarative_base
from pydantic import BaseModel, Field
import paho.mqtt.client as mqtt
import joblib
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

# --- Environment and Database Configuration ---
load_dotenv() #
DATABASE_URL = os.getenv("DATABASE_URL") #
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable not set") #

engine = create_engine(DATABASE_URL) #
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine) #
Base = declarative_base() #

# --- MQTT Broker Configuration ---
MQTT_BROKER = "test.mosquitto.org" #
MQTT_PORT = 1883 #
MQTT_SUBSCRIBE_TOPICS = [ # Topics the backend listens to
    ("master/backend/collection", 0),
    ("master/backend/prediction", 0)
]
MQTT_TOPIC_COLLECTION = "master/backend/collection" # Data for labeling/training
MQTT_TOPIC_PREDICTION = "master/backend/prediction" # Data for live prediction

# --- Constants ---
MODEL_FILENAME = "gas_leak_model.joblib" # File to save/load the trained model

# --- Database Model (Sensor Data - potentially unlabeled) ---
class SensorData(Base):
    """Stores raw aggregated sensor data, intended for labeling or analysis."""
    __tablename__ = "sensor_data" #

    id = Column(Integer, primary_key=True, index=True) #
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True) # Added index
    worker_1_mean = Column(Float, nullable=True) #
    worker_1_min = Column(Integer, nullable=True) #
    worker_1_max = Column(Integer, nullable=True) #
    worker_1_variance = Column(Float, nullable=True) #
    worker_2_mean = Column(Float, nullable=True) #
    worker_2_min = Column(Integer, nullable=True) #
    worker_2_max = Column(Integer, nullable=True) #
    worker_2_variance = Column(Float, nullable=True) #
    worker_3_mean = Column(Float, nullable=True) #
    worker_3_min = Column(Integer, nullable=True) #
    worker_3_max = Column(Integer, nullable=True) #
    worker_3_variance = Column(Float, nullable=True) #
    humidity = Column(Float, nullable=True) #
    temp = Column(Float, nullable=True) #
    # Label column, updated via API
    is_leak = Column(Boolean, nullable=True, index=True, default=False) # Default to False

# --- Database Model (Prediction Results) ---
class PredictionResult(Base):
    """Stores the results of the gas leak prediction model."""
    __tablename__ = "predictions" # Table name for predictions

    id = Column(Integer, primary_key=True, index=True)
    prediction_timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True) # Timestamp of prediction
    status = Column(String, index=True) # SAFE, WARNING, DANGER
    probability = Column(Float) # Confidence score (0.0 to 1.0)
    # Optional: Link back to sensor data if needed
    # sensor_data_raw = Column(JSONB, nullable=True) # Store the raw input that led to prediction

# Create tables if they don't exist
Base.metadata.create_all(bind=engine) #

# --- Pydantic Models (for API validation and response) ---
class SensorDataResponse(BaseModel): # For sending SensorData out via API
    id: int #
    timestamp: datetime.datetime #
    worker_1_mean: float | None = None #
    worker_1_min: int | None = None #
    worker_1_max: int | None = None #
    worker_1_variance: float | None = None #
    worker_2_mean: float | None = None #
    worker_2_min: int | None = None #
    worker_2_max: int | None = None #
    worker_2_variance: float | None = None #
    worker_3_mean: float | None = None #
    worker_3_min: int | None = None #
    worker_3_max: int | None = None #
    worker_3_variance: float | None = None #
    humidity: float | None = None #
    temp: float | None = None #
    is_leak: bool | None = None # Include the label

    class Config:
        from_attributes = True # Allow creating from ORM objects

class PredictionResponse(BaseModel): # For sending PredictionResult out via API
    id: int
    prediction_timestamp: datetime.datetime
    status: str
    probability: float

    class Config:
        from_attributes = True

class TrainingStatusResponse(BaseModel): # For /train-model and /model-status responses
    message: str
    model_exists: bool = False

class LabelUpdateRequest(BaseModel): # For receiving label updates via API
    is_leak: bool # Expecting {"is_leak": true} or {"is_leak": false}

# --- FastAPI Application Setup ---
app = FastAPI(title="IoT Gas Leak Backend") # Updated title

# CORS Middleware: Allows frontend (running on different port) to access the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "*"], # Allow your frontend origin and potentially others
    allow_credentials=True, #
    allow_methods=["*", "PUT", "PATCH"], # Allow all standard methods + PUT/PATCH for updates
    allow_headers=["*"], #
)

# --- Database Session Dependency ---
# Provides a DB session to API endpoints
def get_db(): #
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close() # Ensure session is closed

# --- Global variable for the ML model ---
ml_pipeline = None

# --- ML Model Loading ---
def load_model():
    """Loads the trained model from disk if it exists."""
    global ml_pipeline
    if os.path.exists(MODEL_FILENAME):
        try:
            ml_pipeline = joblib.load(MODEL_FILENAME)
            print(f"✅ Successfully loaded model from {MODEL_FILENAME}")
        except Exception as e:
            print(f"⚠️ Error loading model '{MODEL_FILENAME}': {e}")
            ml_pipeline = None
    else:
        print(f"ℹ️ Model file '{MODEL_FILENAME}' not found. Prediction will use placeholder logic.")
        ml_pipeline = None

# --- ML Prediction Logic ---
# Features used by the model (MUST match training script)
FEATURE_NAMES = [
    'worker_1_mean', 'worker_1_min', 'worker_1_max', 'worker_1_variance',
    'worker_2_mean', 'worker_2_min', 'worker_2_max', 'worker_2_variance',
    'worker_3_mean', 'worker_3_min', 'worker_3_max', 'worker_3_variance',
    'humidity', 'temp',
    'spatial_variance', 'max_all_sensors', 'avg_all_sensors' # Engineered features
]

def run_ml_prediction(data_dict: dict) -> tuple[str, float]:
    """
    Performs feature engineering and runs prediction using the loaded ML model or a placeholder.
    Returns (status_string, probability_float).
    """
    global ml_pipeline

    # 1. Engineer Features (ensure consistency with training)
    w_means = [ data_dict.get(f, 0) or 0 for f in ['worker_1_mean', 'worker_2_mean', 'worker_3_mean'] ]
    # Handle case where means might be None or 0
    data_dict['spatial_variance'] = np.var(w_means) if any(w_means) else 0.0
    data_dict['max_all_sensors'] = np.max(w_means) if any(w_means) else 0.0
    data_dict['avg_all_sensors'] = np.mean(w_means) if any(w_means) else 0.0

    # 2. Prepare Input DataFrame (handle missing values)
    input_data = {feat: [data_dict.get(feat, 0) or 0] for feat in FEATURE_NAMES} # Default missing to 0
    input_df = pd.DataFrame(input_data)

    # 3. Predict using loaded pipeline (if available)
    if ml_pipeline is not None:
        try:
            # Predict probability for each class: [P(class_0), P(class_1)]
            probabilities = ml_pipeline.predict_proba(input_df)[0]
            leak_probability = probabilities[1] # Probability of leak (class 1)

            # Determine status based on probability threshold (adjust as needed)
            if leak_probability > 0.7:  # High confidence leak
                status = "DANGER"
            elif leak_probability > 0.4: # Medium confidence leak
                status = "WARNING"
            else: # Low confidence leak
                status = "SAFE"

            print(f"🧠 Model Prediction - Status: {status}, Probability: {leak_probability:.4f}")
            return status, float(leak_probability) # Ensure float

        except Exception as e:
            print(f"⚠️ Error during model prediction: {e}. Falling back to placeholder.")
            # Fallback if prediction fails for any reason
            return run_placeholder_prediction(data_dict)
    else:
        # Fallback if model isn't loaded
        return run_placeholder_prediction(data_dict)

def run_placeholder_prediction(data_dict: dict) -> tuple[str, float]:
    """Simple rule-based placeholder if no ML model is loaded."""
    # This uses the already calculated engineered features in data_dict
    max_sensor = data_dict.get('max_all_sensors', 0)
    spatial_var = data_dict.get('spatial_variance', 0)

    if max_sensor > 850 or (spatial_var > 15000 and max_sensor > 500):
        return "DANGER", 0.95
    elif max_sensor > 600:
        return "WARNING", 0.60
    else:
        return "SAFE", 0.05

# --- Background Model Training Task ---
def train_model_task():
    """Fetches LABELED data, trains, evaluates, and saves the model pipeline."""
    global ml_pipeline
    print("\n⏳ Starting background model training task...")
    db: Session | None = None # Ensure db is defined for finally block
    try:
        db = SessionLocal()
        # 1. Fetch ALL labeled/unlabeled data (adjust query if needed, e.g., filter by timestamp)
        # We need both is_leak=True and is_leak=False examples
        data_query = db.query(SensorData).filter(SensorData.is_leak != None).order_by(SensorData.timestamp).all()

        if not data_query or len(data_query) < 20: # Need a reasonable amount of data
            print("❌ Not enough labeled data found in 'sensor_data' table for training (need at least 20 rows).")
            return

        # 2. Convert to DataFrame
        df = pd.DataFrame([vars(s) for s in data_query])
        df = df.drop(columns=['id', '_sa_instance_state'], errors='ignore') # Clean up SQLAlchemy state

        # 3. Ensure Labels Exist and Convert
        if TARGET_COLUMN not in df.columns:
             print(f"❌ ERROR: Target column '{TARGET_COLUMN}' missing. Training aborted.")
             return
        df = df.dropna(subset=[TARGET_COLUMN]) # Remove rows where label is explicitly NULL
        df[TARGET_COLUMN] = df[TARGET_COLUMN].astype(int) # Convert True/False/1/0 to integer

        # Check for both classes
        label_counts = df[TARGET_COLUMN].value_counts()
        print("\n📊 Label Distribution for Training:")
        print(label_counts)
        if len(label_counts) < 2 or 1 not in label_counts or 0 not in label_counts:
             print(f"❌ ERROR: Training requires examples of both '{TARGET_COLUMN}=0' and '{TARGET_COLUMN}=1'. Found: {list(label_counts.index)}. Aborting.")
             return

        # 4. Feature Engineering (MUST MATCH PREDICTION)
        print("🛠️ Performing feature engineering...")
        df['spatial_variance'] = df[['worker_1_mean', 'worker_2_mean', 'worker_3_mean']].var(axis=1, skipna=True).fillna(0)
        df['max_all_sensors'] = df[['worker_1_mean', 'worker_2_mean', 'worker_3_mean']].max(axis=1, skipna=True).fillna(0)
        df['avg_all_sensors'] = df[['worker_1_mean', 'worker_2_mean', 'worker_3_mean']].mean(axis=1, skipna=True).fillna(0)
        # --- Add TEMPORAL features here if desired (e.g., using .diff()) ---

        # 5. Prepare data for model (Handle NaNs in features)
        X = df[FEATURE_NAMES].fillna(0) # Fill any missing sensor readings with 0
        y = df[TARGET_COLUMN]

        # 6. Temporal Train/Test Split (Important!)
        print("🔪 Splitting data temporally (80% train, 20% test)...")
        split_index = int(len(X) * 0.8)
        X_train, X_test = X.iloc[:split_index], X.iloc[split_index:]
        y_train, y_test = y.iloc[:split_index], y.iloc[split_index:]

        if X_train.empty or X_test.empty:
            print("❌ Not enough data for a meaningful train/test split after filtering.")
            return

        print(f"   Train set size: {len(X_train)}")
        print(f"   Test set size: {len(X_test)}")

        # 7. Define and Train Model Pipeline
        print("⚙️ Defining model pipeline (StandardScaler + RandomForest)...")
        pipeline = Pipeline([
            ('scaler', StandardScaler()), # Scale features
            ('classifier', RandomForestClassifier( # Train RandomForest
                n_estimators=100,          # More trees generally better, but slower
                random_state=42,           # For reproducibility
                class_weight='balanced',   # Crucial for imbalanced datasets
                n_jobs=-1                  # Use all CPU cores
             ))
        ])

        print("🚀 Training the model pipeline...")
        pipeline.fit(X_train, y_train)
        print("✅ Training complete.")

        # 8. Evaluate Model on Test Set
        print("\n📈 Evaluating model on the unseen test set...")
        y_pred_test = pipeline.predict(X_test)
        print("\n📋 Classification Report (Test Set):")
        # Ensure target names match your classes (0 and 1)
        print(classification_report(y_test, y_pred_test, target_names=['No Leak (0)', 'Leak (1)'], zero_division=0))

        # 9. Save the Trained Pipeline
        print(f"\n💾 Saving the trained pipeline to {MODEL_FILENAME}...")
        joblib.dump(pipeline, MODEL_FILENAME)
        print(f"✅ Model pipeline saved successfully.")

        # 10. Reload the newly trained model for immediate use
        load_model()

    except Exception as e:
        print(f"❌ An error occurred during training: {e}")
    finally:
        if db:
            db.close() # Ensure DB session is closed


# --- MQTT Client Logic ---
def on_connect(client, userdata, flags, rc):
    """Callback when MQTT connection is established."""
    if rc == 0:
        print("🔌 Connected to MQTT Broker!")
        res, _ = client.subscribe(MQTT_SUBSCRIBE_TOPICS) # Subscribe to list
        if res == mqtt.MQTT_ERR_SUCCESS:
            print(f"👂 Subscribed to topics: {[t[0] for t in MQTT_SUBSCRIBE_TOPICS]}")
        else:
            print(f"⚠️ Failed to subscribe to topics, error code: {res}")
    else:
        print(f"❌ Failed to connect to MQTT, return code {rc}")

def on_message(client, userdata, msg):
    """Callback when an MQTT message is received on a subscribed topic."""
    topic = msg.topic
    print(f"\n📬 Message received on topic '{topic}'")
    db: Session | None = None
    try:
        payload_dict = json.loads(msg.payload.decode('utf-8'))
        # print("   Payload:", payload_dict) # Uncomment for detailed debugging

        db = SessionLocal() # Get DB session

        # --- Handle Data Collection Topic ---
        if topic == MQTT_TOPIC_COLLECTION:
            # Remove label if accidentally sent from master, default to False
            payload_dict.pop('is_leak', None)
            db_data = SensorData(**payload_dict)
            db_data.is_leak = False # Explicitly set as not a leak
            db.add(db_data)
            db.commit()
            db.refresh(db_data)
            print(f"   💾 Saved data for collection (ID: {db_data.id})")

        # --- Handle Data Prediction Topic ---
        elif topic == MQTT_TOPIC_PREDICTION:
            # Run prediction logic
            status, probability = run_ml_prediction(payload_dict)

            # Save the prediction result
            db_prediction = PredictionResult(
                status=status,
                probability=probability
                # Optional: Store raw data too: sensor_data_raw=payload_dict
            )
            db.add(db_prediction)
            db.commit()
            db.refresh(db_prediction)
            print(f"   🎯 Saved prediction result (ID: {db_prediction.id}, Status: {status}, Prob: {probability:.3f})")

        else:
            print(f"   ⚠️ Received message on unhandled topic: {topic}")

    except json.JSONDecodeError:
        print("   ❌ Error: Could not decode JSON from payload.")
    except Exception as e:
        print(f"   ❌ An error occurred processing message: {e}")
        if db:
            db.rollback() # Rollback DB changes on error
    finally:
        if db:
            db.close() # Always close session

# --- FastAPI Lifespan Events ---
@app.on_event("startup")
async def startup_event():
    """Actions to perform when FastAPI starts."""
    global client
    print("🚀 FastAPI application startup...")
    load_model() # Attempt to load existing model
    print("🧠 Initialized ML model state.")
    print("🔄 Setting up MQTT client...")
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1) # Specify callback API version
    client.on_connect = on_connect
    client.on_message = on_message
    try:
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        client.loop_start() # Start MQTT network loop in background thread
        print(f"🌀 MQTT client loop started, connecting to {MQTT_BROKER}...")
    except Exception as e:
        print(f"❌ Failed to connect MQTT client on startup: {e}")


@app.on_event("shutdown")
async def shutdown_event():
    """Actions to perform when FastAPI shuts down."""
    print("🛑 FastAPI application shutdown...")
    if 'client' in globals() and client.is_connected():
        client.loop_stop()
        client.disconnect()
        print("🔌 MQTT client disconnected.")
    else:
        print("ℹ️ MQTT client was not connected.")

# --- API Endpoints ---

@app.get("/", include_in_schema=False)
async def read_root():
    return {"message": "Welcome to the Gas Leak Detection API"}

@app.get("/fetchdata", response_model=list[SensorDataResponse], summary="Get Raw Sensor Data")
def read_unlabeled_sensor_data(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Retrieves recent raw sensor data records intended for labeling/analysis."""
    all_data = db.query(SensorData).order_by(SensorData.timestamp.desc()).offset(skip).limit(limit).all()
    print(f"Fetched {len(all_data)} raw data records.")
    return all_data # Returns empty list [] if none found

@app.get("/latest-prediction", response_model=PredictionResponse | None, summary="Get Latest Prediction")
def get_latest_stored_prediction(db: Session = Depends(get_db)):
    """Retrieves the most recent prediction result stored in the database."""
    latest_prediction = db.query(PredictionResult).order_by(PredictionResult.prediction_timestamp.desc()).first()
    if latest_prediction:
        print(f"Fetched latest prediction ID: {latest_prediction.id}")
    else:
        print("No predictions found in database.")
    return latest_prediction # Returns null if none found

@app.get("/fetchpredictions", response_model=list[PredictionResponse], summary="Get Prediction History")
def read_prediction_history(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Retrieves a list of recent prediction results."""
    all_predictions = db.query(PredictionResult).order_by(PredictionResult.prediction_timestamp.desc()).offset(skip).limit(limit).all()
    print(f"Fetched {len(all_predictions)} prediction history records.")
    return all_predictions # Returns empty list [] if none found

@app.post("/train-model", response_model=TrainingStatusResponse, status_code=http_status.HTTP_202_ACCEPTED, summary="Trigger Model Training")
async def trigger_training(background_tasks: BackgroundTasks):
    """
    Triggers the model training process in the background using data from the 'sensor_data' table.
    Requires LABELED data (is_leak=True/False) to be present.
    """
    print("▶️ Received request to train model via API.")
    # Add the long-running task to FastAPI's background tasks
    background_tasks.add_task(train_model_task)
    return {"message": "Model training started in background. Check backend logs for progress.", "model_exists": os.path.exists(MODEL_FILENAME)}

@app.get("/model-status", response_model=TrainingStatusResponse, summary="Check Model Status")
async def get_model_status():
    """Checks if a trained model file exists on the server."""
    exists = os.path.exists(MODEL_FILENAME)
    message = "✅ Trained model file found." if exists else "⚠️ No trained model file found. Please train the model."
    print(f"Checked model status: {'Exists' if exists else 'Not Found'}")
    return {"message": message, "model_exists": exists}

@app.patch("/label-data/{record_id}", response_model=SensorDataResponse, summary="Update Data Label")
async def update_data_label(record_id: int, label_update: LabelUpdateRequest, db: Session = Depends(get_db)):
    """
    Updates the 'is_leak' label (True/False) for a specific raw sensor data record.
    """
    db_record = db.query(SensorData).filter(SensorData.id == record_id).first()

    if not db_record:
        print(f"❌ Label update failed: Record ID {record_id} not found.")
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=f"Record with id {record_id} not found")

    # Only update if the label is actually changing
    if db_record.is_leak == label_update.is_leak:
        print(f"ℹ️ Label for record ID {record_id} is already {label_update.is_leak}. No change made.")
        return db_record # Return existing record without commit

    print(f"📝 Attempting to update label for record ID {record_id} to is_leak={label_update.is_leak}...")
    db_record.is_leak = label_update.is_leak
    try:
        db.commit() # Save changes to DB
        db.refresh(db_record) # Refresh object with DB state
        print(f"✅ Successfully updated label for record ID {record_id}.")
        return db_record
    except Exception as e:
        db.rollback() # Undo changes on error
        print(f"❌ Error updating label for record ID {record_id}: {e}")
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database error during label update.")