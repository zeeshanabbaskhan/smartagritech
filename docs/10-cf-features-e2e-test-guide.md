# CF Features — End-to-End Test Guide

**Purpose:** Step-by-step manual QA for all CF features added to Smart AgriTech EMS (web + backend).  
**Related docs:** [09 — CF features implementation](./09-cf-features-implementation.md)  
**Audience:** QA, developers, demo reviewers

Use this guide as a checklist. Mark each case **Pass / Fail / Blocked** and note environment details at the top of your run.

---

## Table of contents

1. [Test run sheet](#1-test-run-sheet)
2. [Prerequisites](#2-prerequisites)
3. [Accounts & URLs](#3-accounts--urls)
4. [Pre-flight checks](#4-pre-flight-checks)
5. [Test data setup](#5-test-data-setup)
6. [Access Groups E2E](#6-access-groups-e2e)
7. [Device Groups E2E](#7-device-groups-e2e)
8. [Facilities hierarchy & device linking E2E](#8-facilities-hierarchy--device-linking-e2e)
9. [Power Flow mind map E2E](#9-power-flow-mind-map-e2e)
10. [Custom Dashboard Builder E2E](#10-custom-dashboard-builder-e2e)
11. [Live widgets, cost, refresh E2E](#11-live-widgets-cost-refresh-e2e)
12. [ACL & security E2E](#12-acl--security-e2e)
13. [API smoke tests (optional)](#13-api-smoke-tests-optional)
14. [Role matrix checklist](#14-role-matrix-checklist)
15. [Regression / negative cases](#15-regression--negative-cases)
16. [Sign-off](#16-sign-off)
17. [Troubleshooting](#17-troubleshooting)

---

## 1. Test run sheet

| Field | Value |
|-------|-------|
| Tester | |
| Date | |
| Build / commit | |
| Backend URL | e.g. `http://localhost:5000` |
| Frontend URL | e.g. `http://localhost:5173` |
| Org under test | |
| Devices with live telemetry? | Yes / No |
| Overall result | Pass / Fail |

---

## 2. Prerequisites

### 2.1 Environment

1. PostgreSQL reachable via `DATABASE_URL`
2. Redis optional but recommended (latest metrics / power-flow loads)
3. CF tables applied:

```bash
cd ems/ems-backend
npx prisma generate
npx prisma db execute --file prisma/add_cf_features.sql
npm run dev
```

4. Frontend:

```bash
cd web_frontend
npm install
npm run dev
```

5. Ideally **≥ 2 devices** in one org, with recent readings (`ActivePower` / `PowerConsumption`).  
   Optional: `npm run simulate:production` (or your ingest/simulator) so Power Flow and widgets show non-zero values.

### 2.2 Features covered by this guide

| # | Feature | Primary role |
|---|---------|--------------|
| A | Access Groups | Org Admin (+ verify as User) |
| B | Device Groups | Org Admin |
| C | Facilities + device link | Org Admin |
| D | Power Flow mind map | Org Admin |
| E | Custom dashboards | Org Admin, User, (Admin) |
| F | Live widgets / slab cost / refresh | All dashboard roles |
| G | Device ACL (Access Group ∪ DeviceUser) | User |

---

## 3. Accounts & URLs

Default seeded users (confirm against your DB/seed):

| Role | Email | Password (typical seed) | Portal |
|------|-------|-------------------------|--------|
| Super Admin | `superadmin@ems.com` | `Admin@123456` | `/admin/...` |
| Org Admin | `orgadmin@ems.com` | `Admin@123456` | `/org/...` |
| User | `user@ems.com` | `Admin@123456` | `/user/...` |

> If passwords differ in your environment, record them in the test run sheet.

### Key UI routes

| Feature | Org Admin | Super Admin | User |
|---------|-----------|-------------|------|
| Access Groups | `/org/access-groups` | `/admin/access-groups` | — |
| Device Groups | `/org/device-groups` | `/admin/device-groups` | — |
| Facilities | `/org/settings` (Facility section) | — | — |
| Power Flow | `/org` (Org Dashboard) | — | — |
| Custom Dashboards | `/org/custom-dashboard` | `/admin/custom-dashboard` | `/user/custom-dashboard` |
| Devices | `/org/devices` | `/admin/devices` | Device selectors / detail |

---

## 4. Pre-flight checks

| ID | Step | Expected | Result |
|----|------|----------|--------|
| PF-01 | Open frontend login | Login page loads | |
| PF-02 | Login as Org Admin | Redirect to `/org` dashboard | |
| PF-03 | Sidebar shows **Access Groups**, **Device Groups**, **Custom Dashboards** | Links present | |
| PF-04 | Backend health / login API works | No 5xx on login | |
| PF-05 | Org has ≥ 1 device | Device list not empty | |
| PF-06 | Open browser Network tab | API base points to correct backend | |

---

## 5. Test data setup

Do this once before feature tests. Record names used.

### 5.1 Identify devices

| Alias | Device name | Device ID | Notes |
|-------|-------------|-----------|-------|
| D1 | | | Prefer ONLINE + telemetry |
| D2 | | | Prefer different from D1 |
| D3 (optional) | | | For negative ACL tests |

### 5.2 Identify users

| Alias | Email | Role |
|-------|-------|------|
| OA | orgadmin@… | ORG_ADMIN |
| U1 | user@… | USER (will get access group) |
| U2 (optional) | another user | USER **not** in access group |

### 5.3 Suggested naming for this run

| Entity | Suggested name |
|--------|----------------|
| Access group | `E2E Access Lab` |
| Device group A | `E2E Kitchen Load` |
| Device group B | `E2E HVAC Load` |
| Facility building | `E2E Building A` |
| Facility floor | `E2E Floor 1` |
| Custom dashboard | `E2E Live Board` |

---

## 6. Access Groups E2E

**Login as:** Org Admin → **Access Groups** (`/org/access-groups`)

### 6.1 Create

| ID | Steps | Expected | Result |
|----|-------|----------|--------|
| AG-01 | Click create / add group | Form opens | |
| AG-02 | Enter name `E2E Access Lab` | Name accepted | |
| AG-03 | Select devices **D1** (and optionally D2) | Devices listed as selected | |
| AG-04 | Select user **U1** | User listed as selected | |
| AG-05 | Save | Group appears in list with device/user counts | |

### 6.2 Update

| ID | Steps | Expected | Result |
|----|-------|----------|--------|
| AG-06 | Edit group; remove D2 if present; keep D1 | Save succeeds | |
| AG-07 | Add/remove a user and save | Membership updates on reload | |

### 6.3 Verify as User (ACL — critical)

| ID | Steps | Expected | Result |
|----|-------|----------|--------|
| AG-08 | Logout; login as **U1** | User portal loads | |
| AG-09 | Open Devices / device selectors available to U1 | **Only** devices in Access Group (and any DeviceUser assignments) appear | |
| AG-10 | Open a permitted device detail / dashboard charts | Telemetry loads (200) | |
| AG-11 | (If possible) Call or open a device **not** in group | Device missing from list **or** API `403`/`404` | |

### 6.4 Delete

| ID | Steps | Expected | Result |
|----|-------|----------|--------|
| AG-12 | Login as Org Admin; delete `E2E Access Lab` | Group removed | |
| AG-13 | Login as U1 again (if U1 had no DeviceUser) | Previously group-only devices no longer visible | |

> **Tip:** For AG-13, either re-create the group after delete tests, or use a dedicated throwaway group so later tests still have ACL data. Prefer: finish ACL tests, then recreate `E2E Access Lab` for the rest of the day.

---

## 7. Device Groups E2E

**Login as:** Org Admin → **Device Groups** (`/org/device-groups`)

| ID | Steps | Expected | Result |
|----|-------|----------|--------|
| DG-01 | Create `E2E Kitchen Load`; assign **D1** | Group saved | |
| DG-02 | Create `E2E HVAC Load`; assign **D2** (or D1 if only one device) | Group saved | |
| DG-03 | Edit description / devices; save | Updates persist after refresh | |
| DG-04 | List shows device counts | Counts match selections | |
| DG-05 | Deactivate or delete a throwaway group (optional) | Soft/hard delete behaves as UI states | |

**Pass criteria:** Groups exist for Power Flow tests in §9.

---

## 8. Facilities hierarchy & device linking E2E

**Login as:** Org Admin → **Settings** (`/org/settings`) → Facility Hierarchy

### 8.1 Build hierarchy

| ID | Steps | Expected | Result |
|----|-------|----------|--------|
| FH-01 | Enter Building: `E2E Building A` | Field accepts value | |
| FH-02 | Enter Floor: `E2E Floor 1` | Field accepts value | |
| FH-03 | Optionally Department: `E2E Dept Ops` | Field accepts value | |
| FH-04 | Click **Save Changes** on Facility card | Toast success; tree reloads from API | |

### 8.2 Link devices

| ID | Steps | Expected | Result |
|----|-------|----------|--------|
| FH-05 | In **Link devices to facilities**, select `E2E Building A` (or Floor) | Node selectable | |
| FH-06 | Check **D1** | Checkbox stays checked | |
| FH-07 | Select Floor node; check **D2** (if available) | Link stored on that node | |
| FH-08 | Save facility section again | After reload, checkboxes still match | |

### 8.3 Consume links in dashboards

| ID | Steps | Expected | Result |
|----|-------|----------|--------|
| FH-09 | Open Custom Dashboard editor; use facility context filters | Buildings/floors from hierarchy appear | |
| FH-10 | Widget with **group by** facility children | Bars/pie show child names; values reflect linked devices when telemetry exists | |

---

## 9. Power Flow mind map E2E

**Login as:** Org Admin → **Dashboard** (`/org`)

| ID | Steps | Expected | Result |
|----|-------|----------|--------|
| PF-01 | Scroll to **Power Flow** card | Mind map renders (sources → load → groups) | |
| PF-02 | Confirm device groups appear as branches | `E2E Kitchen Load` / `E2E HVAC Load` visible | |
| PF-03 | With live telemetry + Redis/DB values | Group **kW** not stuck at `0.00` for devices that have `ActivePower` | |
| PF-04 | Source cards show Grid / Solar / Generator | Values present; solar may be 0 if no `ExportPower` | |
| PF-05 | Edit a source value (if editable) and save | Toast/success; reload keeps or re-derives per rules | |
| PF-06 | Click through to device groups path (if link shown) | Navigates to `/org/device-groups` | |
| PF-07 | Refresh page | Power Flow loads again without error | |

**Blocked if:** No telemetry — document as Blocked, still verify UI structure and groups list.

---

## 10. Custom Dashboard Builder E2E

### 10.1 Org Admin — create & edit

**Login as:** Org Admin → **Custom Dashboards** (`/org/custom-dashboard`)

| ID | Steps | Expected | Result |
|----|-------|----------|--------|
| CD-01 | Open list page | Empty state or existing list | |
| CD-02 | Create dashboard `E2E Live Board`; optionally set default device D1 | Dashboard created; editor opens | |
| CD-03 | Add widget: **Stat** / Active Power | Tile on grid | |
| CD-04 | Add widget: **Area** / Energy Consumption | Chart tile | |
| CD-05 | Add widget: **Table** | Device rows | |
| CD-06 | Add widget: **Alarms** | Alarm list or empty state | |
| CD-07 | Drag/resize tiles | Layout persists after **Save** | |
| CD-08 | Open widget settings; set target device D1; time range Today | Settings save | |
| CD-09 | Set visibility **Shared** (if available); save | Listed for User later | |
| CD-10 | Reload editor by URL | Layout + widgets restored from API | |

### 10.2 Widget catalog coverage (spot-check)

Add at least one of each major type on a scratch dashboard or the same board:

| ID | Widget type | Metric suggestion | Result |
|----|-------------|-------------------|--------|
| CD-11 | Line | Voltage | |
| CD-12 | Bar | Current | |
| CD-13 | Pie | Energy or comparison | |
| CD-14 | Gauge | Power Factor | |
| CD-15 | Heatmap | Active Power (needs device) | |
| CD-16 | Text / Markdown | Notes | |
| CD-17 | Multiseries | Power + PF | |

### 10.3 User portal

| ID | Steps | Expected | Result |
|----|-------|----------|--------|
| CD-18 | Login as User → `/user/custom-dashboard` | Sees own + **Shared** dashboards | |
| CD-19 | Open shared `E2E Live Board` | Widgets render (ACL may limit devices) | |
| CD-20 | Create a **private** user dashboard | Only that user sees it | |
| CD-21 | Confirm User **cannot** open Access Groups / Device Groups in nav | Links absent | |

### 10.4 Super Admin spot-check

| ID | Steps | Expected | Result |
|----|-------|----------|--------|
| CD-22 | Login Super Admin → `/admin/custom-dashboard` | List/create works | |
| CD-23 | Access Groups / Device Groups under `/admin/...` | CRUD works for chosen org (if org scoped) | |

### 10.5 Delete

| ID | Steps | Expected | Result |
|----|-------|----------|--------|
| CD-24 | Delete a throwaway dashboard | Removed from list | |

---

## 11. Live widgets, cost, refresh E2E

Use `E2E Live Board` with target device **D1** that has recent data.

| ID | Steps | Expected | Result |
|----|-------|----------|--------|
| LV-01 | Stat/Gauge shows numeric value (not forever spinner) | Value or clear empty state | |
| LV-02 | Time series widgets show points for Today / Week / Month | Chart not empty when aggregate exists | |
| LV-03 | Switch widget/dashboard time range to **Year** | Request uses long window (`365d`); chart renders or empty gracefully | |
| LV-04 | Metric **Energy Cost** | Value = energy × slab average (or fallback rate) | |
| LV-05 | Metric **Carbon Emissions** | Scales with energy | |
| LV-06 | Wait ~30 seconds without reload | Widget data refreshes (polling) | |
| LV-07 | With sockets enabled, push new reading | Chart/stat updates without full page reload | |
| LV-08 | Clear target device; org-level table/online metrics | Still shows device list based metrics | |
| LV-09 | Group-by facility with linked devices | Comparison values track linked device loads | |

**How to confirm cost uses slabs:** Org/User → Slab Rates; note average rate; compare cost widget ≈ kWh × rate.

---

## 12. ACL & security E2E

| ID | Steps | Expected | Result |
|----|-------|----------|--------|
| SEC-01 | User U1 only in Access Group with D1 | Device list = D1 (+ DeviceUser devices) | |
| SEC-02 | U1 opens AI Analytics / Energy for D1 | Data loads | |
| SEC-03 | U1 requests sensor history for foreign device ID (DevTools) | `403` or `404` | |
| SEC-04 | U1 opens Anomalies | Only alarms for accessible devices | |
| SEC-05 | Org Admin still sees all org devices | Unrestricted within org | |
| SEC-06 | User cannot PUT `/custom-dashboards/power-flow` | `403` | |
| SEC-07 | User cannot POST `/access-groups` | `403` | |

---

## 13. API smoke tests (optional)

Replace `TOKEN` and IDs. Base: `http://localhost:5000/api` (or your prefix).

```bash
# Login
curl -s -X POST "$API/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"orgadmin@ems.com","password":"Admin@123456"}'

# Access groups
curl -s "$API/access-groups?limit=20" -H "Authorization: Bearer $TOKEN"

# Device groups
curl -s "$API/device-groups?limit=20" -H "Authorization: Bearer $TOKEN"

# Facilities
curl -s "$API/facilities" -H "Authorization: Bearer $TOKEN"

# Custom dashboards
curl -s "$API/custom-dashboards?limit=20" -H "Authorization: Bearer $TOKEN"

# Power flow (live loads)
curl -s "$API/custom-dashboards/power-flow" -H "Authorization: Bearer $TOKEN"

# Year aggregate
curl -s "$API/sensor-data/aggregate?deviceId=$D1&variableName=ActivePower&timeRange=365d" \
  -H "Authorization: Bearer $TOKEN"
```

| ID | Check | Expected | Result |
|----|-------|----------|--------|
| API-01 | Login returns token | `success` | |
| API-02 | Power flow JSON has `groups[].load` / `loadKw` | Numbers | |
| API-03 | Facilities nodes include `deviceIds` after linking | Array | |
| API-04 | `365d` aggregate | `200` + data array | |
| API-05 | User token + forbidden device | `403` | |

---

## 14. Role matrix checklist

| Capability | Super Admin | Org Admin | User | Pass? |
|------------|:-----------:|:---------:|:----:|:-----:|
| Access Groups CRUD | ☐ | ☐ | ✗ nav | |
| Device Groups CRUD | ☐ | ☐ | ✗ nav | |
| Facility edit + device link | — | ☐ | ✗ | |
| Power Flow view | — | ☐ | ✗ | |
| Power Flow edit sources | ☐/☐ | ☐ | ✗ | |
| Custom dashboards CRUD | ☐ | ☐ | ☐ | |
| See shared dashboards | ☐ | ☐ | ☐ | |
| Live widgets | ☐ | ☐ | ☐ | |
| ACL-limited devices | — | — | ☐ | |

---

## 15. Regression / negative cases

| ID | Steps | Expected | Result |
|----|-------|----------|--------|
| NEG-01 | Create access group with empty name | Validation error | |
| NEG-02 | Save facility with no levels | Harmless empty / org-only tree | |
| NEG-03 | Open dashboard widget with no device + no org devices | Empty state message, not crash | |
| NEG-04 | Break backend; reload Power Flow | Error UI / retry, no white screen | |
| NEG-05 | Rapid create/delete dashboards | No duplicate key UI errors | |
| NEG-06 | Two browsers: Org edits access group; User refreshes | Membership takes effect | |

---

## 16. Sign-off

| Area | Pass | Fail | Blocked | Notes |
|------|:----:|:----:|:-------:|-------|
| Access Groups | | | | |
| Device Groups | | | | |
| Facilities | | | | |
| Power Flow | | | | |
| Custom Dashboards | | | | |
| Live widgets | | | | |
| ACL / security | | | | |
| API smoke | | | | |

**Tester signature:** _______________________ **Date:** ___________

**Known issues / follow-ups:**

-

---

## 17. Troubleshooting

| Symptom | Likely cause | What to do |
|---------|--------------|------------|
| Power Flow loads always `0` | No Redis latest / no `ActivePower` | Check ingest; Redis; device config variables |
| Widgets spin forever | API error / CORS / wrong base URL | Network tab; fix `VITE_` API URL |
| User sees all org devices | Not using ACL build / old backend | Restart backend; confirm `deviceAccess.js` deployed |
| Facility links lost after save | Hierarchy rebuilt without save of links | Save after linking; avoid renaming mid-link without save |
| Year chart empty | No long-history data | Accept empty; confirm `365d` not 400 |
| Access group save fails | CF tables missing | Run `prisma/add_cf_features.sql` |
| `403` on facilities replace | Logged in as User | Use Org Admin |
| PDF/docs outdated | N/A for app test | Ignore for E2E app QA |

### Recommended demo order (happy path)

1. Org Admin: Device Groups → Facilities + link devices  
2. Org Admin: Access Group for User + D1  
3. Org Admin: Power Flow on `/org`  
4. Org Admin: Custom dashboard with live widgets  
5. User: confirm device ACL + shared dashboard  
6. Optional API curls for power-flow + aggregate  

---

## Appendix A — Quick curl login helper

```bash
export API=http://localhost:5000/api
export TOKEN=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"orgadmin@ems.com","password":"Admin@123456"}' \
  | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
echo "TOKEN length: ${#TOKEN}"
```

> Adjust JSON field name (`accessToken` / `token`) to match your auth response shape.

## Appendix B — Minimal telemetry check

On device detail or Data Center, confirm recent variables:

- `ActivePower` (kW) — Power Flow + many widgets  
- `PowerConsumption` — energy / cost / carbon  
- `ExportPower` — solar source derivation  

Without these, UI tests can still Pass for structure; mark live-value cases **Blocked**.
