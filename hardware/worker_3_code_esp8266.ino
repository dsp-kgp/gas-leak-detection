#include <ESP8266WiFi.h> // --- CHANGED FOR ESP8266 ---
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <math.h> // Required for pow() function for variance calculation

// --- UPDATE YOUR WIFI CREDENTIALS ---
const char* ssid = "adhithya";
const char* password = "adhithya365";

// --- MQTT BROKER DETAILS ---
const char* mqtt_server = "test.mosquitto.org";
const char* mqtt_topic = "worker-3/data";

// --- GPIO PIN DEFINITIONS (MODIFIED) ---
const int ledPin = LED_BUILTIN; // --- CHANGED FOR ESP8266 --- (Usually GPIO2, D4 on NodeMCU)
const int sensorPin = A0;      // --- CHANGED FOR ESP8266 --- (The only analog pin)

// --- SENSOR & DATA COLLECTION PARAMETERS (MODIFIED) ---
const long PREHEAT_TIME_MS = 120000;  // 2 minutes (120,000 ms). Increase to 5-10 mins for better results.
const int NUM_SAMPLES = 10;
const int SAMPLING_INTERVAL_MS = 200; // Take a sample every 200ms. (10 * 200ms = 2 second sample window)
const int LOOP_DELAY_MS = 3000;       // Wait 3 seconds between publishing new data

int samples[NUM_SAMPLES]; // Array to store the collected data points

// Initialize WiFi and MQTT clients
WiFiClient espClient;
PubSubClient client(espClient);

/**
 * @brief Connects the device to the specified Wi-Fi network.
 */
void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}

/**
 * @brief Reconnects to the MQTT broker if the connection is lost.
 */
void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    // --- CHANGED FOR ESP8266 --- (Unique client ID)
    if (client.connect("ESP8266_Sensor_Processor")) { 
      Serial.println("connected");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(ledPin, OUTPUT);
  // sensorPin (A0) is an analog input, no need to set pinMode

  // --- NEW: SENSOR PRE-HEAT ---
  Serial.println("MQ-2 Sensor pre-heating. This will take a few minutes...");
  Serial.print("Pre-heating for ");
  Serial.print(PREHEAT_TIME_MS / 1000);
  Serial.println(" seconds.");
  
  // --- CHANGED FOR ESP8266 --- (LED is active-LOW, so LOW turns it ON)
  digitalWrite(ledPin, LOW); 
  long startTime = millis();
  while (millis() - startTime < PREHEAT_TIME_MS) {
    // Print a dot every 10 seconds to show progress
    Serial.print(".");
    delay(10000); 
  }
  // --- CHANGED FOR ESP8266 --- (HIGH turns it OFF)
  digitalWrite(ledPin, HIGH); 
  Serial.println("\nSensor pre-heat complete. Starting main loop.");
  // --- END NEW ---

  setup_wifi();
  client.setServer(mqtt_server, 1883);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  // --- 1. Data Collection ---
  Serial.println("Starting data collection...");
  // --- CHANGED FOR ESP8266 --- (LOW turns it ON)
  digitalWrite(ledPin, LOW); 

  double sum = 0;
  // --- CHANGED FOR ESP8266 --- (10-bit ADC: 0-1023)
  int minValue = 1023; // Initialize min to the max possible ADC value
  int maxValue = 0;    // Initialize max to the min possible ADC value

  for (int i = 0; i < NUM_SAMPLES; i++) {
    int current_reading = analogRead(sensorPin);
    Serial.println(current_reading);
    samples[i] = current_reading; // Store the reading in our array

    sum += current_reading;
    if (current_reading < minValue) {
      minValue = current_reading;
    }
    if (current_reading > maxValue) {
      maxValue = current_reading;
    }
    
    // --- MODIFIED: Wait for the specified interval ---
    delay(SAMPLING_INTERVAL_MS); 
  }
  // --- CHANGED FOR ESP8266 --- (HIGH turns it OFF)
  digitalWrite(ledPin, HIGH);
  Serial.println("Data collection finished.");

  // --- 2. Statistical Calculation ---
  double mean = sum / NUM_SAMPLES;

  // Calculate variance
  double sumOfSquares = 0.0;
  for (int i = 0; i < NUM_SAMPLES; i++) {
    sumOfSquares += pow(samples[i] - mean, 2);
  }
  
  // Use (NUM_SAMPLES - 1) for sample variance. Check for division by zero if NUM_SAMPLES is 1.
  double variance = 0.0;
  if (NUM_SAMPLES > 1) {
    variance = sumOfSquares / (NUM_SAMPLES - 1);
  }

  Serial.println("Calculated Statistics:");
  Serial.print("  Mean: "); Serial.println(mean);
  Serial.print("  Min: "); Serial.println(minValue);
  Serial.print("  Max: "); Serial.println(maxValue);
  Serial.print("  Variance: "); Serial.println(variance);

  // --- 3. Create JSON Payload and Publish ---
  StaticJsonDocument<256> doc; // Create a JSON document
  doc["mean"] = mean;
  doc["min"] = minValue;
  doc["max"] = maxValue;
  doc["variance"] = variance;

  char jsonBuffer[256];
  serializeJson(doc, jsonBuffer); // Convert JSON object to string

  client.publish(mqtt_topic, jsonBuffer);
  Serial.print("Published JSON to '");
  Serial.print(mqtt_topic);
  Serial.print("': ");
  Serial.println(jsonBuffer);
  Serial.println("--------------------");

  // --- MODIFIED: Wait using the new constant ---
  delay(LOOP_DELAY_MS);
}

/*
 * Basic ESP8266 code for reading the MQ-2 Gas Sensor
 * Reads the analog value from the sensor's AO pin
 * and prints it to the Serial Monitor.
 */

// Define the GPIO pin connected to the sensor's AO pin
// The ESP8266 has one analog pin, A0.
// const int MQ2_ANALOG_PIN = A0;

// // Variable to store the sensor value
// int sensorValue = 0;

// void setup() {
//   // Initialize Serial Monitor at 115200 baud rate
//   Serial.begin(115200);

//   // Wait for Serial Monitor to be ready (optional, but good practice)
//   delay(1000); 
  
//   Serial.println("MQ-2 Analog Read Test (ESP8266)");
//   Serial.println("---------------------");

//   // ESP8266 default is 10-bit (0-1023)
// }

// void loop() {
//   // Read the analog value from the sensor
//   // This value will be between 0 (0V) and 1023 (3.3V)
//   sensorValue = analogRead(MQ2_ANALOG_PIN);

//   // Print the raw sensor value to the Serial Monitor
//   Serial.print("Raw Analog Value: ");
//   Serial.println(sensorValue);

//   // Add a delay before the next reading
//   delay(2000); // Wait for 2 seconds
// }