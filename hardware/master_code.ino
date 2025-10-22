#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Adafruit_Sensor.h>
#include "DHT.h"

// --- UPDATE YOUR WIFI CREDENTIALS ---
const char* ssid = "adhithya";
const char* password = "adhithya365";

// --- MQTT BROKER DETAILS ---
const char* mqtt_server = "test.mosquitto.org";
// --- MODIFIED: Define BOTH publish topics ---
const char* publish_topic_collection = "master/backend/collection"; // For storing unlabeled data
const char* publish_topic_prediction = "master/backend/prediction"; // For immediate prediction

// --- Subscribe topics (Unchanged) ---
const char* subscribe_topic_1 = "worker-1/data";
const char* subscribe_topic_2 = "worker-2/data";
const char* subscribe_topic_3 = "worker-3/data";

// --- DHT SENSOR CONFIGURATION ---
#define DHTPIN D2      // Pin D2 on ESP8266 is GPIO 4
#define DHTTYPE DHT11  // Change to DHT22 if you are using a DHT22

// --- NEW: INPUT PIN to decide mode ---
#define MODE_PIN D3    // Example: Use Pin D3 (GPIO0). Connect to GND for Collection, leave floating/connect to 3.3V for Prediction.
                       // Add a pull-up resistor if leaving floating.

// --- INITIALIZE CLIENTS AND SENSOR ---
WiFiClient espClient;
PubSubClient client(espClient);
DHT dht(DHTPIN, DHTTYPE);

// --- Buffer & Flags (Unchanged) ---
StaticJsonDocument<512> outgoingDoc;
bool received_w1 = false;
bool received_w2 = false;
bool received_w3 = false;


/**
 * @brief This function is called whenever a message is received on a subscribed topic.
 * Caches incoming data, adds local sensor data when complete, and publishes
 * to a specific topic based on the MODE_PIN state.
 * @param topic The topic the message was received on.
 * @param payload The message payload (expected to be JSON).
 * @param length The length of the payload.
 */
void callback(char* topic, byte* payload, unsigned int length) {
  Serial.println("--------------------");
  Serial.print("Message arrived on topic: ");
  Serial.println(topic);

  // --- 1. Parse the incoming JSON payload ---
  StaticJsonDocument<256> incomingDoc;
  DeserializationError error = deserializeJson(incomingDoc, payload, length);

  if (error) {
    Serial.print("deserializeJson() failed: ");
    Serial.println(error.c_str());
    return;
  }

  // --- 2. Store the data in our outgoing JSON buffer ---
  if (strcmp(topic, subscribe_topic_1) == 0) {
    outgoingDoc["worker_1_mean"] = incomingDoc["mean"];
    outgoingDoc["worker_1_min"] = incomingDoc["min"];
    outgoingDoc["worker_1_max"] = incomingDoc["max"];
    outgoingDoc["worker_1_variance"] = incomingDoc["variance"];
    received_w1 = true;
    Serial.println("Cached Worker 1 data.");

  } else if (strcmp(topic, subscribe_topic_2) == 0) {
    outgoingDoc["worker_2_mean"] = incomingDoc["mean"];
    outgoingDoc["worker_2_min"] = incomingDoc["min"];
    outgoingDoc["worker_2_max"] = incomingDoc["max"];
    outgoingDoc["worker_2_variance"] = incomingDoc["variance"];
    received_w2 = true;
    Serial.println("Cached Worker 2 data.");

  } else if (strcmp(topic, subscribe_topic_3) == 0) {
    outgoingDoc["worker_3_mean"] = incomingDoc["mean"];
    outgoingDoc["worker_3_min"] = incomingDoc["min"];
    outgoingDoc["worker_3_max"] = incomingDoc["max"];
    outgoingDoc["worker_3_variance"] = incomingDoc["variance"];
    received_w3 = true;
    Serial.println("Cached Worker 3 data.");
  }

  // --- 3. Check if all workers have reported in ---
  if (received_w1 && received_w2 && received_w3) {
    Serial.println("All worker data received. Adding local sensors and deciding publish topic...");

    // --- 4. Read local sensor data ---
    float humidity = dht.readHumidity();
    float temperature = dht.readTemperature();

    if (isnan(humidity) || isnan(temperature)) {
      Serial.println("Failed to read from DHT sensor! Publishing without it.");
      // Still publish, but temp/humidity will be null
    } else {
      Serial.print("Local Sensor Read -> Humidity: ");
      Serial.print(humidity);
      Serial.print("%, Temperature: ");
      Serial.print(temperature);
      Serial.println(" °C");
      outgoingDoc["humidity"] = humidity;
      outgoingDoc["temp"] = temperature;
    }

    // --- 5. Check the MODE_PIN ---
    int mode = digitalRead(MODE_PIN);
    const char* target_topic;

    // Assuming LOW = Collection Mode, HIGH (or floating with pull-up) = Prediction Mode
    if (mode == LOW) {
      target_topic = publish_topic_collection;
      Serial.println("Mode Pin LOW: Publishing for Data Collection.");
    } else {
      target_topic = publish_topic_prediction;
      Serial.println("Mode Pin HIGH/Floating: Publishing for Prediction.");
    }

    // Serialize the combined JSON document to a string
    char jsonBuffer[512];
    serializeJson(outgoingDoc, jsonBuffer);

    // --- 6. Publish the combined payload to the chosen topic ---
    client.publish(target_topic, jsonBuffer);
    Serial.print("Published combined JSON to '");
    Serial.print(target_topic);
    Serial.print("': ");
    Serial.println(jsonBuffer);

    // --- 7. Reset for the next cycle ---
    received_w1 = false;
    received_w2 = false;
    received_w3 = false;
    outgoingDoc.clear();
  }
}

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
 * @brief Reconnects to the MQTT broker and subscribes to all topics.
 */
void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    if (client.connect("ESP8266_Master_Aggregator")) {
      Serial.println("connected");
      client.subscribe(subscribe_topic_1);
      client.subscribe(subscribe_topic_2);
      client.subscribe(subscribe_topic_3);
      Serial.print("Subscribed to: ");
      Serial.println(subscribe_topic_1);
      Serial.print("Subscribed to: ");
      Serial.println(subscribe_topic_2);
      Serial.print("Subscribed to: ");
      Serial.println(subscribe_topic_3);
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200); // Use standard baud rate
  dht.begin();

  // --- NEW: Initialize the MODE_PIN as INPUT (with internal pull-up if needed) ---
  pinMode(MODE_PIN, INPUT_PULLUP); // Use INPUT_PULLUP if connecting the pin to GND for LOW, leave floating for HIGH
  // If using an external pull-up resistor and connecting to 3.3V for HIGH, use: pinMode(MODE_PIN, INPUT);

  setup_wifi();
  client.setServer(mqtt_server, 1883);
  client.setCallback(callback);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();
}