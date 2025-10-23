#include <ESP8266WiFi.h> //
#include <PubSubClient.h> //
#include <ArduinoJson.h> //
#include <Adafruit_Sensor.h> //
#include "DHT.h" //

// --- UPDATE YOUR WIFI CREDENTIALS ---
const char* ssid = "adhithya"; //
const char* password = "adhithya365"; //

// --- MQTT BROKER DETAILS ---
const char* mqtt_server = "test.mosquitto.org"; //
const char* publish_topic_collection = "master/backend/collection"; // Topic for storing raw data
const char* publish_topic_prediction = "master/backend/prediction"; // Topic for running prediction

// --- Subscribe topics ---
const char* subscribe_topic_1 = "worker-1/data"; //
const char* subscribe_topic_2 = "worker-2/data"; // Added
const char* subscribe_topic_3 = "worker-3/data"; // Added

// --- DHT SENSOR CONFIGURATION ---
#define DHTPIN D2      // Pin D2 on ESP8266 is GPIO 4
#define DHTTYPE DHT11  // Change to DHT22 if needed

// --- INPUT PIN to decide mode ---
// Connect D3 to GND for Collection Mode.
// Leave D3 floating (or connect to 3.3V via a resistor) for Prediction Mode.
#define MODE_PIN D3    // Example using D3 (GPIO0)

// --- INITIALIZE CLIENTS AND SENSOR ---
WiFiClient espClient; //
PubSubClient client(espClient); //
DHT dht(DHTPIN, DHTTYPE); //

// --- Buffer to aggregate data ---
StaticJsonDocument<512> outgoingDoc; // Increased size for 3 workers + env
bool received_w1 = false;
bool received_w2 = false;
bool received_w3 = false;


/**
 * @brief Callback when MQTT message arrives. Caches data, adds local sensor readings,
 * checks mode pin, and publishes aggregated data to the appropriate topic.
 */
void callback(char* topic, byte* payload, unsigned int length) { //
  Serial.println("--------------------");
  Serial.print("Message arrived on topic: "); //
  Serial.println(topic);

  // Parse incoming JSON
  StaticJsonDocument<256> incomingDoc; //
  DeserializationError error = deserializeJson(incomingDoc, payload, length); //

  if (error) {
    Serial.print("deserializeJson() failed: ");
    Serial.println(error.c_str()); //
    return;
  }
  // Optional: Print parsed data
  // Serial.println("Parsed incoming JSON:");
  // serializeJsonPretty(incomingDoc, Serial);
  // Serial.println();

  // Store data in the outgoing buffer based on topic
  bool data_cached = false;
  if (strcmp(topic, subscribe_topic_1) == 0) {
    outgoingDoc["worker_1_mean"] = incomingDoc["mean"];
    outgoingDoc["worker_1_min"] = incomingDoc["min"];
    outgoingDoc["worker_1_max"] = incomingDoc["max"];
    outgoingDoc["worker_1_variance"] = incomingDoc["variance"];
    received_w1 = true;
    data_cached = true;
    Serial.println("Cached Worker 1 data.");
  } else if (strcmp(topic, subscribe_topic_2) == 0) {
    outgoingDoc["worker_2_mean"] = incomingDoc["mean"];
    outgoingDoc["worker_2_min"] = incomingDoc["min"];
    outgoingDoc["worker_2_max"] = incomingDoc["max"];
    outgoingDoc["worker_2_variance"] = incomingDoc["variance"];
    received_w2 = true;
    data_cached = true;
    Serial.println("Cached Worker 2 data.");
  } else if (strcmp(topic, subscribe_topic_3) == 0) {
    outgoingDoc["worker_3_mean"] = incomingDoc["mean"];
    outgoingDoc["worker_3_min"] = incomingDoc["min"];
    outgoingDoc["worker_3_max"] = incomingDoc["max"];
    outgoingDoc["worker_3_variance"] = incomingDoc["variance"];
    received_w3 = true;
    data_cached = true;
    Serial.println("Cached Worker 3 data.");
  }

  // If we just cached data AND now have all three, proceed to publish
  if (data_cached && received_w1 && received_w2 && received_w3) {
    Serial.println("All worker data received. Reading local sensors...");

    // Read local DHT sensor
    float humidity = dht.readHumidity(); //
    float temperature = dht.readTemperature(); //

    if (isnan(humidity) || isnan(temperature)) { //
      Serial.println("Failed to read DHT sensor! Publishing without temp/humidity.");
      // Set null or omit? Let's omit by not adding them to JSON.
      // outgoingDoc["humidity"] = nullptr; // Or JsonNull
      // outgoingDoc["temp"] = nullptr;
    } else {
      Serial.print("Local Sensor -> Humidity: "); Serial.print(humidity);
      Serial.print("%, Temp: "); Serial.print(temperature); Serial.println(" C"); //
      outgoingDoc["humidity"] = humidity; // Add to JSON
      outgoingDoc["temp"] = temperature; //
    }

    // Check MODE_PIN to determine target topic
    int mode = digitalRead(MODE_PIN);
    const char* target_topic;
    if (mode == LOW) { // Grounded = Collection Mode
      target_topic = publish_topic_collection;
      Serial.println("Mode Pin LOW -> Publishing for Collection.");
    } else { // Floating or High = Prediction Mode
      target_topic = publish_topic_prediction;
      Serial.println("Mode Pin HIGH/Floating -> Publishing for Prediction.");
    }

    // Serialize and publish
    char jsonBuffer[512]; // Use buffer size matching StaticJsonDocument
    serializeJson(outgoingDoc, jsonBuffer); //
    client.publish(target_topic, jsonBuffer); // Publish to selected topic
    Serial.print("Published aggregated JSON to '"); Serial.print(target_topic);
    Serial.print("': "); Serial.println(jsonBuffer); //

    // Reset flags and buffer for the next aggregation cycle
    received_w1 = false;
    received_w2 = false;
    received_w3 = false;
    outgoingDoc.clear(); // Important: Clear the document
    Serial.println("Buffer cleared, waiting for next cycle.");
  } else if (data_cached) {
      Serial.println("Waiting for data from other workers...");
  }
}

/**
 * @brief Connects to Wi-Fi.
 */
void setup_wifi() { //
  delay(10);
  Serial.println(); Serial.print("Connecting to "); Serial.println(ssid); //
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); } //
  Serial.println("\nWiFi connected"); Serial.print("IP address: "); Serial.println(WiFi.localIP()); //
}

/**
 * @brief Reconnects to MQTT and subscribes to worker topics.
 */
void reconnect() { //
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    if (client.connect("ESP8266_Master_Aggregator")) { // Unique ID
      Serial.println("connected");
      // Subscribe to all worker topics
      client.subscribe(subscribe_topic_1); //
      client.subscribe(subscribe_topic_2); // Added
      client.subscribe(subscribe_topic_3); // Added
      Serial.print("Subscribed to: "); Serial.println(subscribe_topic_1);
      Serial.print("Subscribed to: "); Serial.println(subscribe_topic_2);
      Serial.print("Subscribed to: "); Serial.println(subscribe_topic_3);
    } else {
      Serial.print("failed, rc="); Serial.print(client.state()); //
      Serial.println(" try again in 5 seconds");
      delay(5000); //
    }
  }
}

void setup() {
  Serial.begin(115200); // Use 115200 baud rate
  dht.begin(); // Initialize DHT sensor

  // Initialize the MODE_PIN as INPUT with internal pull-up resistor
  // This means: LOW if connected to GND, HIGH if left floating.
  pinMode(MODE_PIN, INPUT_PULLUP);
  Serial.print("Mode Pin (D3/GPIO0) initial state: ");
  Serial.println(digitalRead(MODE_PIN) == HIGH ? "HIGH/Floating (Prediction)" : "LOW (Collection)");


  setup_wifi();
  client.setServer(mqtt_server, 1883); //
  client.setCallback(callback); // Set function for incoming messages
}

void loop() {
  if (!client.connected()) {
    reconnect(); //
  }
  client.loop(); // Essential for MQTT client to handle network traffic & callbacks
  // No delay needed here, loop runs continuously checking MQTT
}