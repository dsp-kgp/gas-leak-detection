#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <math.h> // Required for pow() function for variance calculation

// --- UPDATE YOUR WIFI CREDENTIALS ---
const char* ssid = "adhithya";
const char* password = "adhithya365";

// --- MQTT BROKER DETAILS ---
const char* mqtt_server = "test.mosquitto.org";
const char* mqtt_topic = "worker-1/data";

// --- GPIO PIN DEFINITIONS ---
const int ledPin = 2;
const int sensorPin = 34; // Common analog pin for ESP32

// --- DATA COLLECTION PARAMETERS ---
const int NUM_SAMPLES = 100;
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
    if (client.connect("ESP32_Sensor_Processor")) { // Use a unique client ID
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
  // sensorPin is an analog input, no need to set pinMode for it on ESP32

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
  digitalWrite(ledPin, HIGH); // Turn on LED to indicate collection is in progress

  double sum = 0;
  int minValue = 4095; // Initialize min to the max possible ADC value
  int maxValue = 0;    // Initialize max to the min possible ADC value

  for (int i = 0; i < NUM_SAMPLES; i++) {
    int current_reading = analogRead(sensorPin);
    samples[i] = current_reading; // Store the reading in our array

    sum += current_reading;
    if (current_reading < minValue) {
      minValue = current_reading;
    }
    if (current_reading > maxValue) {
      maxValue = current_reading;
    }
    delay(2); // Wait 2ms between each sample
  }
  digitalWrite(ledPin, LOW); // Turn off LED when collection is done
  Serial.println("Data collection finished.");

  // --- 2. Statistical Calculation ---
  double mean = sum / NUM_SAMPLES;

  // Calculate variance
  double sumOfSquares = 0.0;
  for (int i = 0; i < NUM_SAMPLES; i++) {
    sumOfSquares += pow(samples[i] - mean, 2);
  }
  // Use (NUM_SAMPLES - 1) for sample variance, which is standard
  double variance = sumOfSquares / (NUM_SAMPLES - 1);

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

  // Wait for 3 seconds before starting the next collection cycle
  delay(3000);
}