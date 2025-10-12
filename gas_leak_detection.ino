// Intelligent Gas Leakage Detector - ESP32 Core 3.x Compatible Version
// Sends data to a FastAPI backend over WiFi.

#include <Arduino.h>
// Required libraries for WiFi and HTTP communication
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// --- WIFI & SERVER CONFIGURATION (Update with your details) ---
const char* ssid = "Dsp_6124";        // <<< IMPORTANT: Enter your WiFi network name here
const char* password = "Dsp@2510"; // <<< IMPORTANT: Enter your WiFi password here

// <<< MODIFIED LINE >>>
// Updated the server URL to your public Render backend endpoint.
// Note the use of "https" as Render services are secure by default.
const char* serverUrl = "https://gas-leak-detection-backend.onrender.com/senddata";


// --- PIN DEFINITIONS (Grouped on one side of the board) ---
const int gasPin = 34;      // Sensor analog output → GPIO34 (ADC)
const int buzzerPin = 25;   // Buzzer → GPIO25
const int ledRed = 26;      // Red LED → GPIO26
const int ledGreen = 27;    // Green LED → GPIO27

// --- TUNING PARAMETERS (CRITICAL: Calibrate these for your sensor!) ---
const int WINDOW = 30;          // 30 samples * 0.5s = 15s window
const float K_STD = 3.0;        // Std deviation multiplier for spike detection
const int SLOPE_THRESHOLD = 10; // Min slope (units/sample) for "slow leak"
const int ABS_THRESHOLD = 3000; // Absolute threshold for immediate alarm

// --- ESP32 Tone (Buzzer) Setup ---
const int buzzerResolution = 8;     // bits
const int buzzerFrequency = 2000;   // Hz

// --- Global Variables ---
int readings[WINDOW];
int idx = 0;
bool bufferFilled = false;
bool isAlarmActive = false;

// --- Helper Functions ---
void addReading(int v) {
  readings[idx] = v;
  idx++;
  if (idx >= WINDOW) {
    idx = 0;
    if (!bufferFilled) {
        Serial.println("\n--- Buffer is now full. Detection logic is active. ---\n");
    }
    bufferFilled = true;
  }
}

void computeMeanStd(int &meanOut, float &stdOut) {
  int count = bufferFilled ? WINDOW : idx;
  if (count == 0) {
    meanOut = 0;
    stdOut = 0.0;
    return;
  }

  long sum = 0;
  for (int i = 0; i < count; i++)
    sum += readings[i];
  meanOut = sum / count;

  double var = 0.0;
  for (int i = 0; i < count; i++) {
    double d = readings[i] - meanOut;
    var += d * d;
  }
  var = var / max(1, count);
  stdOut = sqrt(var);
}

int getOldest() {
  if (!bufferFilled)
    return readings[0];
  int oldestIndex = idx;
  return readings[oldestIndex];
}

int getNewest() {
  // Correctly gets the most recently added value
  int newestIndex = (idx - 1 + WINDOW) % WINDOW;
  return readings[newestIndex];
}

void triggerAlarm(const char *reason) {
  if (!isAlarmActive) {
      Serial.print("\n!!! ALARM TRIGGERED !!! Reason: ");
      Serial.println(reason);
  }
  isAlarmActive = true;
  digitalWrite(ledRed, HIGH);
  digitalWrite(ledGreen, LOW);
  ledcWriteTone(buzzerPin, buzzerFrequency);
}

void clearAlarm() {
  if (isAlarmActive) {
      Serial.println("--- ALARM CLEARED. System returning to normal. ---\n");
  }
  isAlarmActive = false;
  digitalWrite(ledRed, LOW);
  digitalWrite(ledGreen, HIGH);
  ledcWriteTone(buzzerPin, 0);
}


// Function to connect to WiFi
void setupWiFi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi connected!");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}

// Function to send data to the server
// Function to send data to the server with enhanced debugging
void sendDataToServer(int raw, int mean, float stddev, float slope) {
    // Check if WiFi is connected
    if (WiFi.status() == WL_CONNECTED) {
        // DEBUG: Announce the start of the HTTP transaction
        Serial.println("\n--- [HTTP] Preparing to send data... ---");

        HTTPClient http;
        
        // DEBUG: Print the target URL
        Serial.printf("[HTTP] Beginning connection to: %s\n", serverUrl);
        http.begin(serverUrl);
        http.addHeader("Content-Type", "application/json");

        // Create a JSON document
        StaticJsonDocument<256> doc;
        doc["raw"] = raw;
        doc["mean"] = mean;
        doc["stddev"] = stddev;
        doc["slope"] = slope;

        // Serialize JSON document to a string
        String jsonPayload;
        serializeJson(doc, jsonPayload);
        
        // DEBUG: Print the JSON payload that will be sent
        Serial.print("[HTTP] JSON Payload: ");
        Serial.println(jsonPayload);

        // Send the POST request
        Serial.println("[HTTP] Sending POST request...");
        int httpResponseCode = http.POST(jsonPayload);

        // DEBUG: More detailed handling of the response code
        if (httpResponseCode == 200) {
            Serial.println("[HTTP] POST successful (Code 200 OK).");
            String response = http.getString();
            Serial.print("[HTTP] Server response: ");
            Serial.println(response);
        } else if (httpResponseCode > 0) {
            // This handles server-side errors like 404, 500, etc.
            Serial.printf("[HTTP] POST failed, server returned code: %d\n", httpResponseCode);
            String response = http.getString(); // Get the error message from the server
            Serial.println("[HTTP] Server error message:");
            Serial.println(response);
        } else {
            // This handles client-side errors (e.g., connection failed)
            Serial.printf("[HTTP] POST failed, error: %s\n", http.errorToString(httpResponseCode).c_str());
        }

        http.end(); // Free resources
        // DEBUG: Announce the end of the transaction
        Serial.println("--- [HTTP] Transaction finished. ---");

    } else {
        Serial.println("WiFi Disconnected. Cannot send data.");
    }
}


void setup() {
  Serial.begin(115200);

  // Connect to WiFi
  setupWiFi();

  pinMode(ledRed, OUTPUT);
  pinMode(ledGreen, OUTPUT);
  digitalWrite(ledGreen, HIGH);

  ledcAttach(buzzerPin, buzzerFrequency, buzzerResolution);

  for (int i = 0; i < WINDOW; i++)
    readings[i] = 0;

  Serial.println("\n--- Intelligent Gas Detector Initializing ---");
  Serial.println("--- System Parameters ---");
  Serial.print("  > Window Size: "); Serial.print(WINDOW); Serial.println(" samples");
  Serial.print("  > Sample Interval: "); Serial.println("500 ms");
  Serial.print("  > Detection Window: "); Serial.print(WINDOW * 500 / 1000.0); Serial.println(" seconds");
  Serial.print("  > Absolute Threshold: "); Serial.println(ABS_THRESHOLD);
  Serial.print("  > Spike StDev Multiplier (K_STD): "); Serial.println(K_STD);
  Serial.print("  > Slow Leak Slope Threshold: "); Serial.println(SLOPE_THRESHOLD);
  Serial.println("-------------------------");
  Serial.print("Waiting for initial buffer to fill...");
  delay(1000);
}

void loop() {
  // 1. Read sensor
  int val = analogRead(gasPin);
  addReading(val);

  // 2. Compute statistics
  int meanVal;
  float stdVal;
  computeMeanStd(meanVal, stdVal);

  // 3. Estimate slope
  float slope = 0.0;
  if (bufferFilled) {
    int oldest = getOldest();
    int newest = getNewest();
    slope = (float)(newest - oldest) / (WINDOW - 1);
  }

  // 4. Print for debugging and send data
  if (!bufferFilled) {
      Serial.print("Filling buffer... [");
      Serial.print(idx); Serial.print("/"); Serial.print(WINDOW);
      Serial.print("] Raw: "); Serial.println(val);
  } else {
      Serial.print("Raw: "); Serial.print(val);
      Serial.print(" | Mean: "); Serial.print(meanVal);
      Serial.print(" | StdDev: "); Serial.print(stdVal, 2);
      Serial.print(" | Slope: "); Serial.println(slope, 2);
      
      // Send the calculated data to the server
      sendDataToServer(val, meanVal, stdVal, slope);
  }

  // 5. Check for alarm conditions
  bool alarmConditionMet = false;
  if (val >= ABS_THRESHOLD) {
    triggerAlarm("Above absolute threshold!");
    alarmConditionMet = true;
  } else if (bufferFilled && val > meanVal + K_STD * stdVal && stdVal > 5) {
    triggerAlarm("Spike detected!");
    alarmConditionMet = true;
  } else if (bufferFilled && slope > SLOPE_THRESHOLD) {
    triggerAlarm("Slow increasing trend (leak)!");
    alarmConditionMet = true;
  }

  if (!alarmConditionMet) {
    clearAlarm();
  }

  delay(500);
}