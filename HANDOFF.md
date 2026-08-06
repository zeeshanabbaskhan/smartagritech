# Elsa Chatbot — Deployment & Live Integration Guide

**From:** Muhammad Hannan Faisal (`m-hannanfaisal`)  
**Branch:** `feature/voice-chatbot` on `zeeshanabbaskhan/smartagritech`  
**Handoff date:** 2026-08-06  

This document is for whoever is taking over embedding the chatbot into the live dashboard and connecting it to real sensor data. Everything below reflects the current state of the work — read this before touching anything.

---

## 1. What's Already Built (and Where)

- **Standalone Chatbot Widget:** `/chatbot` at the repo root — a self-contained React + Vite application. Branded as **"Elsa"**, styled to match the live client dashboard portal (`http://51.38.88.130:8080`) — amber primary accent `#F59E0B` (hover `#D97706`), dark slate/navy surface `#0B0F19`, Inter font (`Inter, sans-serif`), rounded corners (`12px` panel / `8px` inputs & buttons), and flat card styles.
- **Backend Endpoint:** `chatbot/server/index.js` (`POST /api/chatbot/query`) running on port 5175, with tool-calling orchestrated by `chatbot/server/aiEngine.js` using Groq (`llama-3.3-70b-versatile`) or Gemini (`gemini-1.5-flash`) function calling.
- **Query Tools Implemented:**
  - **EMS Status & Data Tools (`chatbot/server/chatbotTools.js`):**
    1. `getOrgSummary`: Overview of organization device counts, online/offline status, and gateway counts.
    2. `listDevicesForOrg`: Lists devices for an organization, optionally filtered by status (ONLINE/OFFLINE).
    3. `getDeviceStatus`: Details specific device status, connected gateway, and last-seen timestamp.
    4. `getVariableValue`: Queries latest real-time sensor reading (VoltageA, PowerFactor, Current, etc.) for a device.
    5. `getActiveAlarms`: Lists active or resolved alarms for an organization with threshold breach details.
    6. `getEnergyConsumption`: Calculates total energy usage (kWh) over a given number of recent days.
    7. `getGatewayStatus`: Reports online/offline status and connected device counts for organization gateways.
    8. `getUserDevices`: Retrieves all devices accessible to a specific user context.
  - **Billing & Cost-Analysis Tools (`chatbot/server/billingTools.js`):**
    1. `getMonthlyBill`: Total kWh, PKR cost, and per-device breakdown for current/past months.
    2. `compareMonthlyBills`: Month-to-date vs same period last month (+10.4% trend detection).
    3. `getTopConsumingDevices`: Ranked devices by total PKR cost & % share (e.g. Cold Storage #1 at 19.5%).
    4. `getDailyConsumptionBreakdown`: Highest usage days (e.g. Aug 3 peak at PKR 3,939.96).
    5. `forecastMonthlyBill`: Projected full month bill based on current daily average.
    6. `getPowerFactorImpact`: Factual power factor alarm reporting without LLM number fabrication.
    7. `simulateConsumptionReduction`: Simulates PKR savings from X% usage reduction on a specific device.
    8. `getBudgetPlan`: Automatic 20% sequential cut plan to hit a target PKR monthly budget.
- **Dummy Dataset:** `/data/chatbot/` — 60 days of realistic interval history (720 rows across 12 devices covering July & August 2026), seeded via `data/chatbot/scripts/extend-billing-history.js` and loaded in-memory via `chatbot/server/dataLoader.js`.
- **Client-Safe Error Handling:** All backend errors are intercepted in `chatbot/server/index.js` and mapped to generic, friendly responses in Elsa's voice (e.g. *"I'm a little busy right now — please try again in a moment."*). Technical stack traces, HTTP status codes, provider names, and API keys are logged server-side only.
- **Tested & Confirmed:** Verified end-to-end with browser text + Web Speech API voice input/output and 13+ real billing and status queries with 100% numeric accuracy against underlying data.

---

## 2. ⚠️ Before You Deploy This Anywhere — Critical Items

### a) Remove the Dev-Only Auth Bypass
The backend currently has a **temporary dev-only bypass** in `chatbot/server/index.js` (lines 49–53) where `POST /api/chatbot/query` does not enforce JWT authentication middleware (`protect`).

> **CRITICAL WARNING:** This MUST be replaced with real session/token validation before this endpoint is exposed to real users. If this flag is left enabled in production, any unauthenticated user could query the chatbot endpoint and access cross-account organizational device, alarm, and billing data without authorization.

### b) Configure Production AI API Keys
The current setup uses dev-tier API keys stored in `chatbot/server/.env`.
Do not reuse dev keys in production. Obtain a dedicated production-tier key (`GROQ_API_KEY` or `GEMINI_API_KEY`) with higher rate limits (RPM/RPD) before routing client traffic to it.

```env
# Example production env configuration in chatbot/server/.env
AI_PROVIDER=groq
GROQ_API_KEY=gsk_your_production_key_here
PORT=5175
CLIENT_URL=https://your-production-dashboard.com
```

---

## 3. How to Run It Locally

**Backend Server (Port 5175):**
```bash
cd chatbot/server
npm install
node index.js
```

**Standalone Chatbot Widget (Port 5174):**
```bash
cd chatbot
npm install
npm run dev
```
Open `http://localhost:5174` in Chrome/Edge for text + voice testing.

**Re-seeding 60-Day Billing Dummy Data:**
```bash
node data/chatbot/scripts/extend-billing-history.js
```

---

## 4. How to Embed It into the Real Dashboard

The widget is currently standalone to allow isolated development and testing. To integrate into the main dashboard:

1. Copy the widget files from `/chatbot/src/` into `web_frontend/src/components/chatbot/`:
   - `ChatbotWidget.jsx`, `useChatbot.js`, `useVoice.js`, `aiService.js`, and `index.css`.
2. Import and render `<ChatbotWidget />` inside `web_frontend/src/components/layout/DashboardLayout.jsx` (or main layout wrapper) so it appears on all authenticated dashboard pages.
3. Update `aiService.js`'s `SERVER_URL` to point to your deployed backend API URL.
4. Wire the backend endpoint into the main EMS backend (`ems/ems-backend`) with the `protect` auth middleware so queries inherit the logged-in user's organization scope (`req.user.organizationId`).

---

## 5. How to Connect Real Sensor Data (Instead of Dummy Data)

All chatbot tools query these schema structures directly:
`IntervalHistory`, `DeviceConfigVariable`, `DeviceVariableAlarmHistory`, `Device`, `Organization`.

> **LIVE DATA ASSUMPTION:** If the live sensor pipeline from the lab server writes into these same tables via the existing schema, no chatbot tool code changes are needed — only stop running the dummy seed scripts. If live data uses a different pipeline or table structure, this must be verified and mapped in `chatbotTools.js` and `billingTools.js` before deployment.

---

## 6. Explicitly Out of Scope for Delivered Work

- Embedding the widget into `web_frontend` layout.
- Connecting to live lab server sensor data streams.
- Production deployment / CI-CD pipeline setup.
- Production-scale API rate limiting / cost monitoring.

---

## 7. Questions / Contact

Muhammad Hannan Faisal —  
GitHub: `m-hannanfaisal`  
Branch: `feature/voice-chatbot`
