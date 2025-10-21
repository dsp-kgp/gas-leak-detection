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
const char* subscribe_topic = "worker-1/data";
const char* publish_topic = "master/backend/collection";

// --- DHT SENSOR CONFIGURATION ---
#define DHTPIN D2      // Pin D2 on ESP8266 is GPIO 4
#define DHTTYPE DHT11  // Change to DHT22 if you are using a DHT22

// --- INITIALIZE CLIENTS AND SENSOR ---
WiFiClient espClient;
PubSubClient client(espClient);
DHT dht(DHTPIN, DHTTYPE);

/**
 * @brief This function is called whenever a message is received on a subscribed topic.
 * It now parses the incoming JSON and merges it with local sensor data.
 * @param topic The topic the message was received on.
 * @param payload The message payload (expected to be JSON).
 * @param length The length of the payload.
 */
void callback(char* topic, byte* payload, unsigned int length) {
  Serial.println("--------------------");
  Serial.print("Message arrived on topic: ");
  Serial.println(topic);

  // --- 1. Parse the incoming JSON payload from the ESP32 ---
  StaticJsonDocument<256> incomingDoc;
  DeserializationError error = deserializeJson(incomingDoc, payload, length);

  // Check for parsing errors
  if (error) {
    Serial.print("deserializeJson() failed: ");
    Serial.println(error.c_str());
    return; // Exit if the payload is not valid JSON
  }

  Serial.println("Successfully parsed incoming JSON:");
  serializeJsonPretty(incomingDoc, Serial); // Print the received data for debugging
  Serial.println();

  // --- 2. Read local sensor data ---
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();

  // Check if sensor readings are valid
  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("Failed to read from DHT sensor!");
    return; // Exit if sensor fails
  }

  Serial.print("Local Sensor Read -> Humidity: ");
  Serial.print(humidity);
  Serial.print("%, Temperature: ");
  Serial.print(temperature);
  Serial.println(" °C");

  // --- 3. Create a new, combined JSON payload ---
  StaticJsonDocument<384> outgoingDoc; // Use a larger buffer for the combined data

  // Copy all key-value pairs from the incoming JSON
  for (JsonPair kv : incomingDoc.as<JsonObject>()) {
    outgoingDoc[kv.key()] = kv.value();
  }
  
  // Add the local sensor data to the new JSON document
  outgoingDoc["humidity"] = humidity;
  outgoingDoc["temp"] = temperature;

  // Serialize the combined JSON document to a string
  char jsonBuffer[384];
  serializeJson(outgoingDoc, jsonBuffer);

  // --- 4. Publish the combined payload ---
  client.publish(publish_topic, jsonBuffer);
  Serial.print("Published combined JSON to '");
  Serial.print(publish_topic);
  Serial.print("': ");
  Serial.println(jsonBuffer);
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
 * @brief Reconnects to the MQTT broker and subscribes to the topic.
 */
void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    if (client.connect("ESP8266_DHT_Aggregator")) { // Changed client ID for clarity
      Serial.println("connected");
      // Subscribe to the worker topic
      client.subscribe(subscribe_topic);
      Serial.print("Subscribed to: ");
      Serial.println(subscribe_topic);
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(74880); // **IMPORTANT: Baud rate updated to 115200**
  dht.begin();
  
  setup_wifi();
  client.setServer(mqtt_server, 1883);
  client.setCallback(callback); // Set the function to run when a message is received
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();
}