#!/usr/bin/env python3

import paho.mqtt.client as mqtt
import requests
import logging
import json

# === Configuration ===
MQTT_BROKER = "localhost"
MQTT_PORT = 1883
MQTT_TOPIC = "/UploadTopic"

MQTT_USERNAME = "mosquitto_admin"
MQTT_PASSWORD = "LeHyp5Flith"

#POST_URL = "https://www.ems.expertsoftsolution.com/api/data/AddMqttData"  # Replace with your endpoint
POST_URL = "https://www.cfsmartems.com/api/test/post"  # Replace with your endpoint

# === Logging Setup ===
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("mqtt_to_http.log"),
        logging.StreamHandler()
    ]
)

# === MQTT Callbacks ===
def on_connect(client, userdata, flags, reason_code, properties=None):
    if reason_code == 0:
        logging.info("Connected to MQTT broker")
        client.subscribe(MQTT_TOPIC)
        logging.debug(f"Subscribed to topic: {MQTT_TOPIC}")
    else:
        logging.error(f"Failed to connect, return code {reason_code}")

def on_message(client, userdata, msg):
    try:
        payload = msg.payload.decode("utf-8")
        logging.debug(f"Topic: {msg.topic} | Payload: {payload}")

        data = {
            "topic": msg.topic,
            "payload": payload
        }

        response = requests.post(POST_URL, json=data, timeout=5)
        logging.info(f"Data posted to {POST_URL} - Status: {response.status_code}")
    except Exception as e:
        logging.error(f"Error processing message: {e}")

# === Main Execution ===
def main():
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, protocol=mqtt.MQTTv311)
    client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
    client.on_connect = on_connect
    client.on_message = on_message

    try:
        logging.info(f"Connecting to MQTT broker at {MQTT_BROKER}:{MQTT_PORT}")
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        client.loop_forever()
    except Exception as e:
        logging.critical(f"Critical failure connecting to broker: {e}")

if __name__ == "__main__":
    main()