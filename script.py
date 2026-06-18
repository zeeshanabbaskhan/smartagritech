import json
import os
from datetime import datetime
from urllib import error, request

import paho.mqtt.client as mqtt

# MQTT Broker Settings
BROKER_IP = os.getenv("MQTT_BROKER_IP", "10.3.20.218")
BROKER_PORT = int(os.getenv("MQTT_BROKER_PORT", "1883"))
TOPIC = os.getenv("MQTT_TOPIC", "SMM/Soil_Data")

# EMS ingest settings (set these in environment for production use)
EMS_BASE_URL = os.getenv("EMS_BASE_URL", "http://localhost:5000/api")
EMS_INGEST_API_KEY = os.getenv("EMS_INGEST_API_KEY", "")
EMS_DEVICE_ID = os.getenv("EMS_DEVICE_ID", "")
EMS_SLAVE_ID = os.getenv("EMS_SLAVE_ID", "")


def build_readings(sensor_data):
    readings = []
    if "M" in sensor_data:
        readings.append({"variableName": "SoilMoisture", "value": float(sensor_data["M"]), "unit": "%"})
    if "B" in sensor_data:
        readings.append({"variableName": "BatteryLevel", "value": float(sensor_data["B"]), "unit": "%"})
    if "TX" in sensor_data:
        readings.append({"variableName": "TxCounter", "value": float(sensor_data["TX"]), "unit": "count"})
    return readings


def forward_to_ems(sensor_data):
    if not EMS_INGEST_API_KEY or not EMS_DEVICE_ID:
        print("Skipping EMS forward (set EMS_INGEST_API_KEY and EMS_DEVICE_ID)")
        return

    readings = build_readings(sensor_data)
    if not readings:
        print("Skipping EMS forward (no numeric readings to send)")
        return

    ingest_body = {
        "deviceId": EMS_DEVICE_ID,
        "readings": readings,
    }
    if EMS_SLAVE_ID:
        ingest_body["slaveId"] = EMS_SLAVE_ID

    payload = json.dumps(ingest_body).encode("utf-8")
    ingest_url = f"{EMS_BASE_URL.rstrip('/')}/ingest"
    req = request.Request(
        ingest_url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "x-api-key": EMS_INGEST_API_KEY,
        },
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=8) as resp:
            response_data = resp.read().decode("utf-8")
            print(f"Forwarded to EMS ({resp.status}): {response_data}")
    except error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        print(f"EMS ingest HTTP error {e.code}: {body}")
    except Exception as e:
        print(f"EMS ingest failed: {e}")


def on_connect(client, userdata, flags, reason_code, properties):
    if reason_code.is_failure:
        print(f"[{datetime.now()}] Connection failed: {reason_code}")
        return
    print(f"[{datetime.now()}] Connected successfully")
    client.subscribe(TOPIC)
    print(f"Subscribed to: {TOPIC}")


def on_message(client, userdata, msg):
    try:
        print("\n--------------------------------")
        print("Time   :", datetime.now())
        print("Topic  :", msg.topic)

        payload = msg.payload.decode("utf-8")
        try:
            data = json.loads(payload)
            print("Received JSON Data:")
            print(json.dumps(data, indent=4))
            forward_to_ems(data)
        except json.JSONDecodeError:
            print("Received Data:")
            print(payload)
    except Exception as e:
        print("Error:", e)


print("Starting MQTT Client...")
print(f"Broker: {BROKER_IP}:{BROKER_PORT} | Topic: {TOPIC}")
if EMS_DEVICE_ID:
    print(f"EMS target device: {EMS_DEVICE_ID}")
else:
    print("EMS target device not set (EMS_DEVICE_ID)")

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
client.on_connect = on_connect
client.on_message = on_message

client.connect(BROKER_IP, BROKER_PORT, 60)
client.loop_forever()
