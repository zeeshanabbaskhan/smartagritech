# EMS Chatbot Sample Dataset

Synthetic sample data shaped like the EMS Prisma models (`ems/ems-backend/prisma/schema.prisma`). Use it to test org/user dashboard chatbot RAG, tool-calling, and Q&A without dumping full sensor history.

**Source:** Synthetic (no live DB). Values follow `ems/ems-backend/utils/readingProfiles.js` ranges. IDs are stable UUIDs (deterministic hashes) so relationships stay consistent across regenerations.

**As-of timestamp:** `2026-08-06T10:00:00.000Z` (see `manifest.json`).

## Quick start for chatbot testing

1. **Easiest ingest:** Load `chatbot_facts.csv` — each row has a natural-language `text` field plus structured columns. Ideal for embeddings / RAG.
2. **Structured tools:** Load the normalized CSVs below and answer by filtering/joining on `organizationId`, `deviceId`, `variableName`, etc.
3. **Regenerate:** From repo root:
   ```bash
   node data/chatbot/scripts/generate-sample-data.js
   ```

## Files & row counts

| File | Rows (approx) | Covers |
|------|---------------|--------|
| `organizations.csv` | 3 | Orgs (2 ACTIVE, 1 INACTIVE) |
| `users.csv` | 4 | Org admins + users (no password hashes) |
| `gateways.csv` | 6 | Gateways with ONLINE / OFFLINE / GATEWAY_ALARM |
| `devices.csv` | 12 | Devices linked to orgs + gateways |
| `device_users.csv` | 8 | User ↔ device assignments |
| `device_config_slaves.csv` | 12 | Config slaves (`Main Meter`) |
| `device_config_variables.csv` | 216 | Current values for 18 variables × 12 devices |
| `alarm_settings.csv` | 4 | Active alarm configs |
| `alarm_histories.csv` | 10 | Recent `device_variable_alarm_histories` |
| `alarm_history_notifications.csv` | 6 | Push/email notification log |
| `sensor_readings_sample.csv` | 80 | Limited JSON readings (8 devices × 10 timestamps) |
| `sensor_reading_values_sample.csv` | 640 | Flattened reading values |
| `interval_histories.csv` | 84 | Daily energy/cost (12 devices × 7 days) |
| `chatbot_facts.csv` | ~500+ | Denormalized facts for RAG |
| `manifest.json` | — | Inventory + generation metadata |

Exact counts are in `manifest.json` after generation.

## Example questions this dataset supports

- How many devices are online for Greenfield Energy Co?
- What is VoltageA on Energy Meter 001?
- List recent ACTIVE / UNPROCESSED alarms.
- Energy consumption (kWh) and tariff for Riverdale Manufacturing last 3 days.
- Which gateways are offline?
- What is the power factor on Press Line Meter A?
- Devices assigned to bilal.ahmed@greenfield-energy.example

## Notable entities

| Org | Devices (examples) |
|-----|--------------------|
| Greenfield Energy Co | Energy Meter 001–005, HVAC Meter North |
| Riverdale Manufacturing | Press Line Meter A/B, Compressor Bank Meter, Warehouse Main Meter, Cold Storage Meter |
| Demo Inactive Org | (no devices — edge case) |

Variables match EMS energy-monitor profile: `VoltageA/B/C`, `CurrentA/B/C`, `ActivePower`, `PowerFactor`, `PowerConsumption`, `Frequency`, imbalance/THD metrics, `TotalCost`, etc.

## Column notes

- Extra denormalized columns (`organizationName`, `deviceName`, `gatewayName`) are included for readability; core IDs match Prisma field names.
- `sensor_readings_sample.readings` is a JSON object (same idea as Prisma `SensorReading.readings`).
- `users.csv` intentionally omits `passwordHash`.
- Timestamps are ISO-8601 UTC.

## Live DB export (optional)

If you later have a local `DATABASE_URL` in `ems/ems-backend/.env`, you can replace this dataset with a limited Prisma export (e.g. last N readings per device). Do **not** commit `.env` or real credentials. Keep samples anonymized and capped (this folder is meant to stay manageable for chatbot testing).
