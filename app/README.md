# EmbedAIoT — Flutter IoT Dashboard

> **Version:** 1.0.0+1 &nbsp;|&nbsp; **Platform:** Flutter / Dart &nbsp;|&nbsp; **Min SDK:** Dart ^3.11.5 &nbsp;|&nbsp; **Status:** All pages complete, no API integration yet

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack & Dependencies](#2-tech-stack--dependencies)
3. [Project Structure](#3-project-structure)
4. [Color System & Theme](#4-color-system--theme)
5. [Entry Point & App Bootstrap](#5-entry-point--app-bootstrap)
6. [Navigation Architecture](#6-navigation-architecture)
7. [Dummy Data Layer](#7-dummy-data-layer)
8. [Pages — Full Reference](#8-pages--full-reference)
   - 8.1 [Login Page](#81-login-page)
   - 8.2 [Main Shell (Bottom Nav)](#82-main-shell-bottom-nav)
   - 8.3 [Home Tab — Dashboard](#83-home-tab--dashboard)
   - 8.4 [Devices Tab — Device List](#84-devices-tab--device-list)
   - 8.5 [Device Detail Page](#85-device-detail-page)
   - 8.6 [Menu Tab](#86-menu-tab)
   - 8.7 [Organisation Page (5 Tabs)](#87-organisation-page-5-tabs)
   - 8.8 [Schedule Page](#88-schedule-page)
   - 8.9 [Slab Rates Page](#89-slab-rates-page)
   - 8.10 [Interval History Page](#810-interval-history-page)
   - 8.11 [Alarm Templates Page](#811-alarm-templates-page)
   - 8.12 [Notifications Page](#812-notifications-page)
   - 8.13 [AI Analytics Overview](#813-ai-analytics-overview)
   - 8.14 [Voltage Imbalance Page](#814-voltage-imbalance-page)
   - 8.15 [Current Imbalance Page](#815-current-imbalance-page)
   - 8.16 [Power Factor Page](#816-power-factor-page)
   - 8.17 [Energy Consumption Page](#817-energy-consumption-page)
   - 8.18 [Anomalies Page](#818-anomalies-page)
   - 8.19 [Subscription Page](#819-subscription-page)
   - 8.20 [Products Page](#820-products-page)
9. [Shared Widgets](#9-shared-widgets)
10. [Org Helpers Library](#10-org-helpers-library)
11. [CRUD Modal Pattern](#11-crud-modal-pattern)
12. [Table Scroll Fix](#12-table-scroll-fix)
13. [Dummy Data Reference](#13-dummy-data-reference)
14. [Assets](#14-assets)
15. [Known Lint Notices](#15-known-lint-notices)
16. [API Integration Roadmap](#16-api-integration-roadmap)

---

## 1. Overview

**EmbedAIoT** is a mobile IoT energy-monitoring dashboard built in Flutter. It is designed for industrial sites (warehouses, factories, pump stations) that use smart energy meters connected via IoT gateways. The app provides:

- Real-time energy metrics (voltage, current, power factor, THD, frequency)
- AI-powered analytics with anomaly detection and predictions
- Full device lifecycle management (add, edit, delete, view details)
- Organisation management (users, gateways, device templates, alarm contacts)
- Scheduling, slab-rate tariff management, and interval history
- Alarm template configuration and notification management
- Subscription plan management and product catalog

**Current state:** All pages are implemented with dummy data. Every button opens its modal or confirmation dialog. No live API calls are made — the entire app runs offline. The only remaining task before production is replacing `DummyData` references with real API calls.

---

## 2. Tech Stack & Dependencies

| Dependency | Version | Purpose |
|---|---|---|
| flutter | sdk | UI framework |
| cupertino_icons | ^1.0.8 | iOS-style icons |
| http | ^1.2.0 | HTTP client (ready for API integration) |
| flutter_lints | ^6.0.0 | Lint rules |

Flutter **Material 3** is used throughout (`useMaterial3: true`).

---

## 3. Project Structure

```
lib/
├── main.dart                           # App entry point
├── app_theme.dart                      # Global color constants & text styles
├── data/
│   └── dummy_data.dart                # All static dummy data (no state)
├── widgets/
│   ├── metric_card.dart               # Reusable metric card with mini chart
│   ├── chart_painters.dart            # Custom canvas painters (bar + line)
│   ├── time_filter_chips.dart         # Time range filter chip row
│   └── app_drawer.dart               # Legacy drawer (superseded by bottom nav)
└── pages/
    ├── login_page.dart                # Login screen with circuit-board background
    ├── main_shell.dart                # Bottom nav shell (3 tabs, 3 navigators)
    ├── home_page.dart                 # Legacy home (unused, replaced by main_shell)
    ├── schedule_page.dart             # Schedule CRUD table
    ├── slab_rates_page.dart           # Slab rates CRUD table
    ├── interval_history_page.dart     # Interval history CRUD table
    ├── alarm_template_page.dart       # Alarm template CRUD table
    ├── notifications_page.dart        # Alarm notifications list + delete
    ├── subscription_page.dart         # Subscription plan cards + upgrade
    ├── products_page.dart             # Product catalog grid + search
    ├── dashboard/
    │   ├── dashboard_page.dart        # Main metrics dashboard (10 metric cards)
    │   └── detail_page.dart           # Legacy detail page
    ├── devices/
    │   ├── devices_page.dart          # Device list with search & filter
    │   └── device_detail_page.dart    # Per-device detail (4-tab SliverAppBar)
    ├── menu/
    │   └── menu_page.dart             # Menu hub (4 grouped sections, 18 items)
    ├── org/
    │   ├── org_helpers.dart           # Shared public modal/table widgets
    │   ├── organization_page.dart     # 5-tab org management page
    │   ├── users_page.dart            # Users CRUD tab
    │   ├── gateways_page.dart         # Gateways CRUD tab
    │   ├── device_templates_page.dart # Device templates CRUD tab
    │   └── alarm_contacts_page.dart   # Alarm contacts CRUD tab
    └── ai_analytics/
        ├── ai_analytics_page.dart     # AI analytics overview
        ├── voltage_imbalance_page.dart
        ├── current_imbalance_page.dart
        ├── power_factor_page.dart
        ├── energy_consumption_page.dart
        └── anomalies_page.dart
```

---

## 4. Color System & Theme

Defined in `lib/app_theme.dart`. Imported and used as constants throughout the entire app.

| Constant | Hex Value | Usage |
|---|---|---|
| `kNavy` | `#0D1B3E` | Primary brand color, AppBars, headings, nav bar active |
| `kBg` | `#F2F4F8` | Page backgrounds, input field fill |
| `kBlue` | `#4A90D9` | Accent, links, info states, chart color |
| `kGreen` | `#34A853` | Success, online status, active badge, save snackbar |
| `kOrange` | `#E8A820` | Warnings, voltage imbalance alerts |
| `kRed` | `#E53935` | Errors, delete actions, offline status, critical alarms |
| `kCard` | `Colors.white` | Card backgrounds |

**Text styles:**

```dart
kTitleStyle    // fontSize: 20, fontWeight: w700, color: kNavy
kSubtitleStyle // fontSize: 13, color: #8A9BBE (muted blue-grey)
```

---

## 5. Entry Point & App Bootstrap

**`lib/main.dart`**

```
runApp(MyApp)
  └── MaterialApp
        title:                    'EmbedAIoT'
        debugShowCheckedModeBanner: false
        theme:                    Material3, seedColor: kNavy (#0D1B3E)
        home:                     LoginPage
```

The app starts at `LoginPage`. After successful login (2-second simulated delay), it navigates via `Navigator.pushReplacement` to `MainShell`, clearing the login page from the back stack.

---

## 6. Navigation Architecture

### Bottom Navigation Shell

`MainShell` uses an `IndexedStack` with **3 independent nested `Navigator`s** — one per tab. Each tab owns its own `GlobalKey<NavigatorState>`.

```
MainShell (Scaffold + PopScope)
├── IndexedStack
│   ├── Tab 0 (_HomeRoot)
│   │     └── DashboardPage
│   │           └── [AI Analytics sub-pages via push]
│   ├── Tab 1 (DevicesPage)
│   │     └── DeviceDetailPage (pushed on card tap)
│   └── Tab 2 (MenuPage)
│         └── [Any sub-page via push: Org, Schedule, AI, etc.]
└── BottomNavigationBar (3 items)
```

**Tab switching behaviour:**
- Selecting a different tab preserves the stack state of all tabs (`IndexedStack` keeps all alive)
- Tapping the **active tab again** calls `popUntil(isFirst)` on that tab's navigator — returns to the root
- The OS back button is intercepted by `PopScope(canPop: false)`. It pops within the current tab's navigator if possible; otherwise it does nothing (app stays open)

**Route pushing pattern:**
```dart
Navigator.push(context, MaterialPageRoute(builder: (_) => SomePage()));
```
This uses the tab's nested navigator, keeping the navigation inside the correct tab.

### Deep-linking within tabs

`OrganizationPage` accepts an `initialTab` parameter. Menu items use this to open the Org page directly on a specific tab (e.g., tapping "Users" opens Org page on tab index 1):

```dart
_push(context, const OrganizationPage(initialTab: 1)); // Users tab
_push(context, const OrganizationPage(initialTab: 2)); // Gateways tab
```

---

## 7. Dummy Data Layer

**`lib/data/dummy_data.dart`** — Pure Dart class with only `static const` fields. Zero mutable state. Safe to reference from any widget.

All CRUD pages copy relevant lists into local `State` on `initState()` so in-session add/edit/delete works without modifying the original `const` list:

```dart
late List<Map<String, dynamic>> _items;

@override
void initState() {
  super.initState();
  _items = DummyData.someList.map((e) => Map<String, dynamic>.from(e)).toList();
}
```

---

## 8. Pages — Full Reference

---

### 8.1 Login Page

**File:** `lib/pages/login_page.dart`

**Purpose:** App entry screen with email/password authentication.

**Background:** `_BackgroundDecoration` uses `CustomPaint` with `_CircuitPainter`. The painter draws:
- 3 L-shaped circuit traces in the top-left corner
- 1 rounded-rect component (PCB chip shape) top-right
- 3 horizontal traces with junction nodes on the right side
- 1 isolated node bottom-left
- All strokes at 10% navy opacity, dots at 14% opacity

**Form layout (top to bottom):**
1. 60px top spacer
2. Logo image — fills 24% of screen height, `BoxFit.fill`
3. Email field — `TextInputType.emailAddress`, validates: non-empty + contains `@`
4. Password field — obscured, eye icon toggle, validates: non-empty + length ≥ 6
5. "Forgot password?" right-aligned `TextButton` (no-op)
6. **Sign In** button (56px height, navy, elevation 6)
   - Shows `CircularProgressIndicator` during `_loading = true`
   - On success: 2s delay → `pushReplacement(MainShell)`
7. **Create Account** outlined button (56px, no-op)
8. Footer: `© 2025 EmbedAIoT · Smarter Solutions`

**State variables:** `_loading` (bool), `_obscurePassword` (bool)

---

### 8.2 Main Shell (Bottom Nav)

**File:** `lib/pages/main_shell.dart`

**Key classes:**

| Class | Role |
|---|---|
| `MainShell` | Root `StatefulWidget` — holds `_tabIndex` + 3 `GlobalKey<NavigatorState>` |
| `_TabNavigator` | Thin `Navigator` wrapper keyed to one tab |
| `_HomeRoot` | Home tab's root scaffold: AppBar + `DashboardPage` body |
| `_ProfileSheet` | Bottom sheet shown on person icon tap |
| `_ProfileTile` | Single `ListTile` row inside profile sheet |

**Bottom navigation items:**

| Index | Inactive Icon | Active Icon | Label | Root |
|---|---|---|---|---|
| 0 | `home_outlined` | `home` | Home | `_HomeRoot` |
| 1 | `devices_outlined` | `devices` | Devices | `DevicesPage` |
| 2 | `grid_view_outlined` | `grid_view` | Menu | `MenuPage` |

**Home AppBar:**
- Logo image (30px height) + "EmbedAIoT" title
- Bell icon → pushes `NotificationsPage` using the home navigator
- Person icon → opens `_ProfileSheet` modal

**Profile Sheet:**
- Drag handle
- `CircleAvatar` radius 36, navy background, white "ZA" initials
- Name: Zeeshan Abbas
- Email: zeeshan@embedaiot.com
- Role badge: "Manager · EmbedAIoT" (kBlue, rounded)
- Account Settings tile (no-op, closes sheet)
- Help & Support tile (no-op, closes sheet)
- Sign Out tile (red icon) → `pushNamedAndRemoveUntil('/', ...)` — returns to login

---

### 8.3 Home Tab — Dashboard

**File:** `lib/pages/dashboard/dashboard_page.dart`

**Purpose:** Real-time summary of all monitored energy metrics.

**Layout** (single `SingleChildScrollView` column, 16px padding):

**Row 1 — Device/Slave selectors:**
Two `_DropdownField` widgets side by side. These are display-only styled containers (no actual `DropdownButton`) showing the current device and slave names from `DummyData`.

**Row 2 — Download Data button:**
Full-width `ElevatedButton.icon` in kBlue. Currently a no-op placeholder.

**Metric cards (10 total):**

| # | Title | Value | Chart | Tap |
|---|---|---|---|---|
| 1 | ⚡ Total Power Consumption | 18.43 kWh | `MiniBarChart` (kBlue) | → EnergyConsumptionPage |
| 2 | ⚡ Total Export Power | 0.00 kWh | `MiniBarChart` (kBlue) | — |
| 3 | ⚡ Voltage Imbalance (%) | 27.25 | `MiniLineChart` (kOrange) | → VoltageImbalancePage |
| 4 | ⚖ Current Imbalance | 58.83 | `MiniLineChart` (kGreen) | → CurrentImbalancePage |
| 5 | 🔋 Real Time Power Factor | 0.94 | `MiniLineChart` (kBlue) | → PowerFactorPage |
| 6 | 📈 Predicted Consumption | 20.27 | `MiniLineChart` (kBlue, unfilled) | — |
| 7 | ⚠ Anomalies Detected | 42 + type list | Custom `extra` widget | → AnomaliesPage |
| 8 | 📶 THD-V | 0.00 % | `MiniBarChart` (kBlue) | — |
| 9 | 📶 THD-I | 0.00 % | `MiniBarChart` (kBlue) | — |
| 10 | 🔄 Frequency | 0.00 Hz | `MiniBarChart` (kBlue) | — |

Cards 8 and 9 (THD-V, THD-I) are placed side by side in a `Row`.

The Anomalies card uses `MetricCard.extra` to show a `RichText` with count in red, then a list of each anomaly type with counts.

---

### 8.4 Devices Tab — Device List

**File:** `lib/pages/devices/devices_page.dart`

**State:** `String _filter` (All/Online/Offline), `String _search`

**Filtering logic:**
```dart
DummyData.devices.where((d) =>
  (_filter == 'All' || d['status'] == _filter) &&
  (_search.isEmpty || name.contains(search) || gateway.contains(search))
)
```

**AppBar:** Navy, "Devices" title, `+` icon → Add Device modal

**Summary chips bar** (navy background strip):
- Total: white chip with navy text
- Online: green chip
- Offline: red chip

**Search + filter bar** (white background):
- `TextField` with search icon, `kBg` fill, no border
- Filter chip row: All / Online / Offline — active chip is navy filled, inactive is grey

**`_DeviceCard` anatomy:**

```
Container (white, rounded-14, shadow)
├── Header bar (grey-50 or navy-tinted background)
│   ├── Device icon (40×40 rounded-10)
│   ├── Device name + serial number
│   └── Status badge (dot + label, green/red pill)
└── Body padding
    ├── Info grid row 1: Gateway | Template
    ├── Info grid row 2: Slave | Last Seen
    ├── [Online only] Metrics bar: Power kWh | PF | Anomalies
    └── Action row
        ├── "View Details" outlined button → DeviceDetailPage
        ├── Edit icon button (blue bg) → _DeviceFormModal
        └── Delete icon button (red bg) → AlertDialog
```

**`_DeviceFormModal` fields:**
- Device Name (required `TextFormField`)
- Serial Number (`TextFormField`)
- IP Address (`TextFormField`)
- Gateway (`DropdownButtonFormField`: Gateway-01/02/03)
- Template (`DropdownButtonFormField`: 4 templates)
- Status (`DropdownButtonFormField`: Online/Offline)
- Cancel + "Save Device" buttons

**Delete `AlertDialog`:**
- Title: "Delete Device"
- Body: "Are you sure you want to delete `{name}`? This action cannot be undone."
- Buttons: Cancel (grey) + Delete (red)

---

### 8.5 Device Detail Page

**File:** `lib/pages/devices/device_detail_page.dart`

**Constructor:** `DeviceDetailPage({required Map<String, dynamic> device})`

**Top-level scroll structure:** `NestedScrollView` with `SliverAppBar(expandedHeight: 200)`

**Expanded header (`_DeviceHeader`):**
- Device icon (60px), name, serial number
- Online/Offline badge + "Last seen: ..." text
- Background: navy gradient when online, grey gradient when offline

**AppBar actions:**
- Edit icon → bottom sheet edit form
- Options icon (⋮) → bottom sheet with: Alarm Settings, Schedule, Download Data, Restart Device, Delete Device

**4 tabs:**

**Overview tab:**
- 4 stat mini-cards in 2×2 grid: Power (kWh), Power Factor, Anomalies, Status
- Device info section: IP Address, Serial No, Gateway, Template, Slave (icon + label rows)
- Connection banner: green "Connected · Live Data" (online) or red offline warning

**Metrics tab:**
- `MetricCard` widgets for all electrical readings from `DummyData`:
  - Voltage A, B, C (Phase voltages)
  - Line voltages A-B, B-C, C-A
  - Current A, B, C
  - Active, Reactive, Apparent Power
  - Power Factor, Frequency
  - THD-V and THD-I per phase

**Analytics tab:**
- Navigation cards for: Voltage Imbalance, Current Imbalance, Power Factor, Energy Consumption, Anomalies
- Each card shows current value and arrow

**Schedule tab:**
- Mini list of upcoming schedule tasks
- "Manage All Schedules" outlined button → `SchedulePage`

---

### 8.6 Menu Tab

**File:** `lib/pages/menu/menu_page.dart`

**Purpose:** Central navigation hub for all management features.

**Structure:** `ListView` with 4 `_MenuSection` groups + footer

**`_MenuSection`:** Section title (uppercase grey letter-spaced) + white rounded-14 card holding items separated by 1px dividers indented at 60px.

**`_MenuItem`:** 
- 40×40 colored icon container (`color.withValues(alpha: 0.1)`)
- Label (14px, bold, navy)
- Subtitle (11px, grey)
- Optional red count badge (`badge` parameter)
- Chevron arrow (grey)

**Complete menu map:**

**ORGANISATION** (navy/blue/green/orange/red icons):
- Organisation → `OrganizationPage(initialTab: 0)`
- Users → `OrganizationPage(initialTab: 1)`
- Gateways → `OrganizationPage(initialTab: 2)`
- Device Templates → `OrganizationPage(initialTab: 3)`
- Alarm Contacts → `OrganizationPage(initialTab: 4)`

**DEVICE MANAGEMENT** (blue/green/navy/orange/red icons):
- Schedule → `SchedulePage`
- Slab Rates → `SlabRatesPage`
- Interval History → `IntervalHistoryPage`
- Alarm Templates → `AlarmTemplatePage`
- Notifications → `NotificationsPage` *(badge: "6")*

**AI ANALYTICS** (navy/orange/blue/green/navy/red icons):
- AI Analytics → `AiAnalyticsPage`
- Voltage Imbalance → `VoltageImbalancePage`
- Current Imbalance → `CurrentImbalancePage`
- Power Factor → `PowerFactorPage`
- Energy Consumption → `EnergyConsumptionPage`
- Anomalies → `AnomaliesPage`

**ACCOUNT** (blue/green icons):
- Subscription → `SubscriptionPage`
- Products → `ProductsPage`

**Footer:** `EmbedAIoT v1.0.0  ·  © 2025 Smarter Solutions` (grey, centered)

---

### 8.7 Organisation Page (5 Tabs)

**File:** `lib/pages/org/organization_page.dart`  
**Tab files:** `users_page.dart`, `gateways_page.dart`, `device_templates_page.dart`, `alarm_contacts_page.dart`

**Constructor:** `OrganizationPage({int initialTab = 0})`

Allows any of the 5 tabs to be targeted directly from the Menu.

**Tab bar:** Scrollable `TabBar` with navy indicator

---

**Tab 0 — Profile:**
- Gradient banner: navy → dark navy, org name, plan badge, "6/20 Devices" progress bar
- 5 editable `TextFormField`s: Name, Email, Phone, Address, Website
- Read-only info grid: Industry / Timezone / Currency
- "Save Changes" navy button → snackbar

---

**Tab 1 — Users** (`UsersTab`):
- Stat chips: Total / Active / Inactive
- Table columns: `Name | Email | Role | Status | Last Login | Ops`
- Column widths: 120, 170, 80, 75, 145, 64
- Role badge colors: Admin→red, Manager→navy, Operator→blue, Viewer→grey
- Status badge: Active→green, Inactive→grey
- `_UserFormModal` fields: Full Name (req), Email (req + `@`), Role dropdown, Status dropdown
- Delete confirmation dialog
- FAB: "Add User"
- Dummy data: 5 users from `DummyData.users`

---

**Tab 2 — Gateways** (`GatewaysTab`):
- Stat chips: Total / Online / Offline
- Table columns: `Name | IP Address | Location | Devices | Status | Last Seen | Ops`
- Column widths: 110, 125, 135, 70, 75, 145, 64
- Status badge: Online→green, Offline→red
- `_GatewayFormModal` fields: Gateway Name (req), IP Address, Location, Serial Number, Status dropdown
- FAB: "Add Gateway"
- Dummy data: 3 gateways from `DummyData.gateways`

---

**Tab 3 — Device Templates** (`DeviceTemplatesTab`):
- Stat chips: Templates / Total Variables
- Table columns: `Name | Protocol | Slaves | Variables | Updated | Ops`
- Column widths: 160, 110, 70, 85, 110, 64
- Protocol badge: blue pill
- `_TemplateFormModal` fields: Template Name (req), Protocol dropdown, Slaves count, Variables count
- FAB: "Add Template"
- Dummy data: 4 templates from `DummyData.deviceTemplates`

---

**Tab 4 — Alarm Contacts** (`AlarmContactsTab`):
- Stat chips: Total / Active / Inactive
- Table columns: `Name | Email | Phone | Method | Status | Ops`
- Column widths: 130, 180, 145, 110, 75, 64
- Method badge colors: Email→blue, SMS→green, Email+SMS→navy
- `_ContactFormModal` fields: Full Name (req), Email (req + `@`), Phone, Notification Method dropdown, Status dropdown
- FAB: "Add Contact"
- Dummy data: 3 contacts from `DummyData.alarmContacts`

---

### 8.8 Schedule Page

**File:** `lib/pages/schedule_page.dart`

**State:** `List<Map<String, dynamic>> _items` (mutable, 5 pre-loaded rows)

**AppBar:** Navy, "Schedule" title, "Add" button (white on navy) → `_ScheduleFormModal`

**Table columns:** `Slave | Variable | Action | Time | Repeat | Status | Ops`  
**Column widths:** 85, 110, 90, 80, 90, 75, 72

**Add/Edit modal fields:**
- Slave (dropdown: Slave-01/02/03)
- Variable (dropdown: Active Power, Reactive Power, Voltage A, Current A, Power Factor)
- Action (dropdown: Turn On, Turn Off, Restart, Alert)
- Time (`TextFormField`, required, hint: "08:00")
- Repeat (dropdown: Daily, Weekly, Monthly, Once)
- Status (dropdown: Active, Inactive)

**Status badge:** Active→green, Inactive→grey pill

**Pre-loaded rows (5):**
1. Slave-01 / Active Power / Turn On / 08:00 / Daily / Active
2. Slave-02 / Reactive Power / Alert / 22:00 / Daily / Active
3. Slave-01 / Voltage A / Restart / 00:00 / Weekly / Inactive
4. Slave-03 / Current A / Turn Off / 23:30 / Daily / Active
5. Slave-02 / Power Factor / Alert / 06:00 / Monthly / Active

---

### 8.9 Slab Rates Page

**File:** `lib/pages/slab_rates_page.dart`

**State:** `List<Map<String, dynamic>> _items` (mutable, 5 pre-loaded rows)

**AppBar:** Navy, "Slab Rates" title, "Add" button

**Table columns:** `Slave | Unit From | Unit To | Rate | On-Peak | Off-Peak | Ops`  
**Column widths:** 85, 85, 85, 80, 80, 80, 72

**Add/Edit modal fields:**
- Slave (dropdown: Slave-01/02/03)
- Unit From (number, required)
- Unit To (number, required)
- Rate PKR/unit (number)
- On-Peak Rate
- Off-Peak Rate

**Pre-loaded rows (5):**
- 0–100 units / PKR 5.00 / 7.00 / 4.00
- 101–200 units / PKR 8.00 / 10.00 / 6.50
- 201–300 units / PKR 12.00 / 15.00 / 9.00
- 301–400 units / PKR 16.00 / 20.00 / 13.00
- 401–500 units / PKR 20.00 / 25.00 / 17.00

---

### 8.10 Interval History Page

**File:** `lib/pages/interval_history_page.dart`

**State:** `List<Map<String, dynamic>> _items` (mutable, 5 pre-loaded rows)

**AppBar:** Navy, "Interval History" title, "Add" button

**Table columns:** `Variable | Slave | Total Units | Tariff | Date From | Date To | Ops`  
**Column widths:** 110, 85, 100, 80, 110, 110, 72

**Add/Edit modal fields:**
- Slave (dropdown: Slave-01/02/03)
- Variable (dropdown: Voltage A, Current B, Power Factor, THD-V, Frequency)
- Total Units (number, required)
- Tariff PKR (number)
- Date From (text, required, hint: 2025-06-01)
- Date To (text, hint: 2025-06-07)

**Pre-loaded rows (5):**
- Voltage A / Slave-01 / 455.47 / PKR 12.50 / 2025-06-01 → 2025-06-07
- Current B / Slave-02 / 320.12 / PKR 13.00 / 2025-06-01 → 2025-06-07
- Power Factor / Slave-01 / 180.55 / PKR 11.50 / 2025-06-08 → 2025-06-10
- THD-V / Slave-03 / 92.30 / PKR 14.00 / 2025-06-08 → 2025-06-10
- Frequency / Slave-02 / 210.80 / PKR 12.00 / 2025-06-10 → 2025-06-10

---

### 8.11 Alarm Templates Page

**File:** `lib/pages/alarm_template_page.dart`

**State:** `List<Map<String, dynamic>> _items` (mutable, 5 pre-loaded rows)

**AppBar:** Navy, "Alarm Templates" title, "Add" button

**Table columns:** `Trigger Name | Template | Variable | Condition | Threshold | Severity | Updated | Ops`  
**Column widths:** 140, 120, 120, 80, 85, 80, 130, 72

**Severity badge colors:** Critical→red, Warning→orange, Info→blue

**Add/Edit modal fields:**
- Trigger Name (text, required)
- Template Name (text, required)
- Variable (dropdown: 11 options including all phases + special readings)
- Condition (dropdown: `>`, `<`, `>=`, `<=`, `==`)
- Threshold (number, required)
- Severity (dropdown: Critical, Warning, Info)

**Pre-loaded rows (5):**
- Overvoltage Alert / High Voltage / Voltage A > 250 / Critical
- Low Power Factor / PF Warning / Power Factor < 0.85 / Warning
- Overload Warning / Overload Tmpl / Current A > 60 / Critical
- Voltage Imbalance / Imbalance Alert / Voltage Imbalance > 25 / Warning
- THD Threshold / THD Exceeded / THD-V > 5 / Info

---

### 8.12 Notifications Page

**File:** `lib/pages/notifications_page.dart`

**State:** `List<Map<String, dynamic>> _items` (mutable, 6 pre-loaded rows)

**AppBar:**
- Title: "Alarm Notifications" + red count badge when items exist
- Action: "Clear All" red button (visible only when list non-empty) → `AlertDialog` confirming bulk delete

**Stat bar** (white strip):
- Total (navy dot), Critical (red dot), Warning (orange dot) — counts update as items are deleted

**Table columns:** `Severity | Trigger Name | Device | Description | Time | Ops`  
**Column widths:** 80, 145, 95, 210, 135, 50

The Ops column only has a delete icon (no edit — notifications are read-only, only deletable).

**Severity badges:** Critical→red pill, Warning→orange pill, Info→blue pill

**Empty state:** Large bell icon + "No notifications" + subtitle text

**Per-row delete:** `_ConfirmDelete` `AlertDialog` with trigger name in body text

**Pre-loaded rows (6):**
1. Overvoltage Alert / Device-01 / Critical / 2025-06-08 08:12
2. Low Power Factor / Device-01 / Warning / 2025-06-08 10:45
3. Overload Warning / Device-02 / Critical / 2025-06-09 07:30
4. Voltage Imbalance / Device-01 / Warning / 2025-06-09 09:15
5. THD Threshold / Device-03 / Info / 2025-06-09 11:00
6. Overload Warning / Device-02 / Critical / 2025-06-09 14:22

---

### 8.13 AI Analytics Overview

**File:** `lib/pages/ai_analytics/ai_analytics_page.dart`

**Purpose:** High-level summary linking to the 5 detailed AI metric pages.

Shows a card for each AI topic — current value, trend icon, and a tap-to-navigate action.

---

### 8.14 Voltage Imbalance Page

**File:** `lib/pages/ai_analytics/voltage_imbalance_page.dart`

**Data sources:**
- `DummyData.aiVoltageImbalance` — 27.20%
- `DummyData.voltageAnomalies` — 5 overvoltage events with timestamps
- `DummyData.voltageOverTime` — 25-point trend data (V)
- `DummyData.predictedVoltage` — 13-point prediction series
- `DummyData.hourlyLabels` — X-axis labels

**Content:**
- Summary value card (large number, threshold indicator)
- `TimeFilterChips` (Live / 1H / 6H / 24H / 7D / 30D)
- Anomaly event table: time + type for each event
- Voltage-over-time line chart (custom `CustomPainter`)
- Predicted voltage line chart

---

### 8.15 Current Imbalance Page

**File:** `lib/pages/ai_analytics/current_imbalance_page.dart`

**Data sources:**
- `DummyData.aiCurrentImbalance` — 45.69%
- `DummyData.currentAnomalies` — 5 overload events
- `DummyData.currentOverTime` — 25-point trend
- `DummyData.predictedCurrent` — 13-point prediction

---

### 8.16 Power Factor Page

**File:** `lib/pages/ai_analytics/power_factor_page.dart`

**Data sources:**
- `DummyData.aiPowerFactor` — 0.90
- `DummyData.powerFactorAnomalies` — 5 low-PF events
- `DummyData.powerFactorOverTime` — 25-point trend (0.85–0.92 range)
- `DummyData.predictedPowerFactor` — 14-point prediction

---

### 8.17 Energy Consumption Page

**File:** `lib/pages/ai_analytics/energy_consumption_page.dart`

**Data sources:**
- `DummyData.aiTotalConsumption` — 255.91 kWh
- `DummyData.predictedConsumptionChart` — 13-point forecast
- `DummyData.dailySaving / weeklySaving / monthlySaving`
- `DummyData.dailyDetail / weeklyDetail / monthlyDetail`

**Content:** Total consumption card, savings comparison rows (Daily/Weekly/Monthly as negative % in red = higher actual vs predicted), forecast chart

---

### 8.18 Anomalies Page

**File:** `lib/pages/ai_analytics/anomalies_page.dart`

**Data sources:**
- `DummyData.aiTotalAnomalies` — 109 total
- `DummyData.aiOvervoltageCount` — 81 (Overvoltage)
- `DummyData.aiLowPFCount` — 16 (Low Power Factor)
- `DummyData.aiOverloadCount` — 12 (Overload)
- `DummyData.anomaliesTimeline` — 25-point bar chart data

**Content:** Total count card, breakdown by type with percentages, timeline bar chart

---

### 8.19 Subscription Page

**File:** `lib/pages/subscription_page.dart`

**State:** `String? _selectedPlan`, `bool _annual`

**Sections:**

**Current Plan Banner:**
- Gradient card (navy gradient)
- Shows: Plan name (Professional), "Next billing: 2025-07-11", Active green badge
- Workspace Premium icon

**Billing Toggle:**
- Animated switch widget (44×24px): grey→green when annual toggled on
- Monthly label (navy when active) ↔ Annual label (green when active)
- "20% OFF" green badge appears when annual is on
- Annual pricing = `(monthlyPrice * 0.8).round()`
- Strikethrough original price shown when annual is selected

**Plan Cards (`_PlanCard`):**
Three cards from `DummyData.subscriptionPlans`:

| Plan | Monthly | Annual | Devices |
|---|---|---|---|
| Basic | PKR 5,000 | PKR 4,000 | 5 |
| Professional | PKR 12,000 | PKR 9,600 | 20 |
| Enterprise | Custom | Custom | Unlimited |

Card features:
- Animated border (2px navy when selected, 1.2px blue when popular, grey otherwise)
- "Popular" blue badge (Professional)
- "Current" green badge (Professional — current plan)
- Feature checklist with green check icons
- "Select Plan" / "Selected" button (not shown on current plan)

**Upgrade flow:**
- Selecting a non-current plan shows a full-width "Upgrade to {name}" navy button
- Tapping → `AlertDialog` confirmation → snackbar success → `_selectedPlan = null`

---

### 8.20 Products Page

**File:** `lib/pages/products_page.dart`

**State:** `TextEditingController _search`, `String _filter`, `String _query`

**Filter categories:** All / Hardware / Software / Bundle

**Filtering:**
```dart
products.where((p) =>
  (_query.isEmpty || name.contains(query) || desc.contains(query)) &&
  (_filter == 'All' || p['category'] == _filter)
)
```

**Grid:** `SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, childAspectRatio: 0.72)`

**`_ProductCard` layout:**
```
Container (white, rounded-14, shadow)
├── Top image area (110px height, category-colored bg)
│   ├── Category icon (52px, 50% opacity)
│   └── Category badge (top-right pill)
└── Detail section (padding 12)
    ├── Product name (bold, 2-line max)
    ├── Description (grey, 2-line truncated)
    ├── Price (bold, left) + Cart button (right)
    └── [8px bottom spacer]
```

**Cart button:** Toggles between `Icons.add_shopping_cart_outlined` (navy bg) and `Icons.check` (green bg). Shows snackbar on toggle.

**Category icon/color mapping:**
- Hardware → `Icons.memory_outlined`, navy
- Software → `Icons.code_outlined`, kBlue
- Bundle → `Icons.inventory_2_outlined`, kGreen
- Other → `Icons.devices_outlined`, navy

---

## 9. Shared Widgets

### `MetricCard` — `lib/widgets/metric_card.dart`

White card with navy title, large value display, optional mini chart, optional tap action.

**Props:**

| Prop | Type | Required | Description |
|---|---|---|---|
| `title` | `String` | yes | Card header text |
| `value` | `String` | yes | Main numeric value |
| `unit` | `String` | yes | Unit label shown after value |
| `chart` | `Widget?` | no | `MiniBarChart` or `MiniLineChart` |
| `onTap` | `VoidCallback?` | no | If set, adds a "View Details →" footer link |
| `extra` | `Widget?` | no | Custom body widget (used for Anomalies card) |
| `showTimeFilter` | `bool` | no | Adds `TimeFilterChips` below value (default false) |

---

### `MiniBarChart` — `lib/widgets/chart_painters.dart`

Compact bar chart rendered via `CustomPainter`.

**Props:** `data` (List<double>), `color` (Color), `height` (double)

Bars auto-scale: `barHeight = (value / maxValue) * availableHeight`

---

### `MiniLineChart` — `lib/widgets/chart_painters.dart`

Compact line chart with optional area fill.

**Props:** `data` (List<double>), `color` (Color), `height` (double), `filled` (bool, default true)

When `filled: true`, draws a gradient fill from line to baseline.

---

### `TimeFilterChips` — `lib/widgets/time_filter_chips.dart`

Horizontal scrollable chip row for AI analytics time range selection.

**Chips:** Live / 1H / 6H / 24H / 7D / 30D

Active chip: navy fill + white text. Inactive: outlined + grey text. Stateful — tracks `_selected` index.

---

## 10. Org Helpers Library

**File:** `lib/pages/org/org_helpers.dart`

All names are **public** (no `_` prefix) so they can be imported across the separate org page files.

### `orgSnack(String msg, {bool error = false}) → SnackBar`

Creates a floating snackbar with `kGreen` (or `kRed` if `error: true`) background, 8px border radius.

### `StatChip`

Row showing a count + label. Used in the summary strip at the top of each org tab.

```dart
StatChip('Online', 4, kGreen)  // → "4  Online"
```

### `ModalShell`

Bottom sheet container widget:
- White background, `BorderRadius.vertical(top: Radius.circular(20))`
- Padding respects `viewInsets.bottom` (keyboard-safe)
- Drag handle (40×4px grey pill)
- Title row with close `IconButton`
- `SingleChildScrollView` wrapping the child

### `ModalField`

Labeled `TextFormField`:
- Label text above field (12px, bold, navy)
- Input: `kBg` fill, no border, 10px radius, navy focus border
- Accepts: `hint`, `keyboard` (TextInputType), `validator`, `maxLines`

### `ModalDropdown`

Labeled `DropdownButtonFormField<String>`:
- Same visual style as `ModalField`
- Accepts: `label`, `value`, `items` (List<String>), `onChanged`

### `ModalActions`

Two-button row:
- Cancel: outlined, grey foreground
- Save: navy filled, white foreground, "Save" label with w600

### `TableCard`

Full-page table widget with the correct dual-scroll fix. Accepts:
- `cols` — column name list
- `widths` — column width list
- `header` — pre-built header widget (from `tableHeader()`)
- `rows` — list of row widgets (each is `Column([Divider, _row(...)])`)
- `count` — item count for footer

### `tableHeader(List<String> cols, List<double> widths) → Widget`

Builds the navy-tinted header row with all column labels.

### `deleteConfirmDialog({context, title, message, onConfirm}) → Widget`

Standard delete `AlertDialog` with Cancel + red Delete button.

---

## 11. CRUD Modal Pattern

All pages follow the same add/edit/delete pattern:

**Add:**
```dart
showModalBottomSheet(
  context: context,
  isScrollControlled: true,        // allows full-height with keyboard
  backgroundColor: Colors.transparent,
  builder: (_) => _XFormModal(
    title: 'Add X',
    item: null,
    onSave: (data) {
      setState(() => _items.add(data));
      _snack('X added');
    },
  ),
);
```

**Edit:**
```dart
_XFormModal(
  title: 'Edit X',
  item: _items[index],             // pre-fills all controllers
  onSave: (data) {
    setState(() => _items[index] = data);
    _snack('X updated');
  },
)
```

**Delete:**
```dart
showDialog(
  context: context,
  builder: (_) => AlertDialog(
    title: Text('Delete X'),
    content: Text('Remove "${item['name']}"?'),
    actions: [
      TextButton('Cancel'),
      ElevatedButton('Delete', backgroundColor: kRed,
        onPressed: () {
          Navigator.pop(context);
          setState(() => _items.removeAt(index));
          _snack('X deleted');
        }),
    ],
  ),
);
```

**Modal form init pattern:**
```dart
@override
void initState() {
  super.initState();
  final d = widget.item;
  _nameCtrl = TextEditingController(text: d?['name'] as String? ?? '');
  _dropdownValue = d?['status'] as String? ?? 'Default';
}
```

---

## 12. Table Scroll Fix

### The problem

When each table row has its own `SingleChildScrollView(horizontal)`, the header and rows scroll independently. Scrolling right on a row doesn't move the header.

### The solution

Put the header **and** all rows into a single `Column`, then wrap that entire `Column` in **one** `SingleChildScrollView(scrollDirection: Axis.horizontal)`.

```dart
Container(
  child: Column(children: [
    Expanded(
      child: SingleChildScrollView(           // (A) vertical scroll
        child: SingleChildScrollView(         // (B) ONE horizontal scroll for everything
          scrollDirection: Axis.horizontal,
          child: Column(                      // header + rows move together
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _tableHeader(),                 // header
              ...items.map((item) => Column([
                Divider(height: 1),
                _tableRow(item),
              ])),
            ],
          ),
        ),
      ),
    ),
    _footer(),                                // outside both scrolls
  ]),
)
```

This pattern is used in:
- `TableCard` in `org_helpers.dart` (shared by all 4 org CRUD tabs)
- `SchedulePage`, `SlabRatesPage`, `IntervalHistoryPage`, `AlarmTemplatePage`, `NotificationsPage` (each inline)

---

## 13. Dummy Data Reference

### Devices

| ID | Name | Gateway | Template | Status | Power | PF | Anomalies | IP |
|---|---|---|---|---|---|---|---|---|
| 1 | Delicia Warehouse | GW-01 | Industrial Meter v2 | Online | 18.43 kWh | 0.94 | 42 | 192.168.1.101 |
| 2 | Main Office Block | GW-01 | Industrial Meter v2 | Online | 12.87 kWh | 0.91 | 5 | 192.168.1.102 |
| 3 | Factory Floor A | GW-02 | Pump Monitor v1 | Offline | 0.0 | 0.0 | 0 | 192.168.2.101 |
| 4 | Cold Storage Unit | GW-02 | Smart Meter v3 | Online | 8.65 kWh | 0.88 | 12 | 192.168.2.102 |
| 5 | Pump Station B | GW-03 | Pump Monitor v1 | Online | 5.22 kWh | 0.96 | 3 | 192.168.3.101 |
| 6 | Rooftop Solar Array | GW-03 | Solar Monitor v1 | Offline | 0.0 | 0.0 | 0 | 192.168.3.102 |

### Gateways

| ID | Name | IP | Location | Status | Connected Devices |
|---|---|---|---|---|---|
| 1 | Gateway-01 | 192.168.1.1 | Warehouse Block | Online | 2 |
| 2 | Gateway-02 | 192.168.2.1 | Factory Area | Online | 2 |
| 3 | Gateway-03 | 192.168.3.1 | Outdoor Zone | Offline | 2 |

### Users

| Name | Email | Role | Status | Last Login |
|---|---|---|---|---|
| Admin User | admin@embedaiot.com | Admin | Active | 2025-06-10 14:00 |
| Zeeshan Abbas | zeeshan@embedaiot.com | Manager | Active | 2025-06-10 09:30 |
| Ali Raza | ali@embedaiot.com | Operator | Active | 2025-06-09 16:45 |
| Sara Khan | sara@embedaiot.com | Viewer | Inactive | 2025-06-05 11:20 |
| Ahmed Malik | ahmed@embedaiot.com | Operator | Active | 2025-06-10 08:15 |

### Device Templates

| Name | Protocol | Slaves | Variables | Updated |
|---|---|---|---|---|
| Industrial Meter v2 | Modbus RTU | 3 | 18 | 2025-05-20 |
| Pump Monitor v1 | Modbus TCP | 2 | 12 | 2025-04-15 |
| Smart Meter v3 | MQTT | 4 | 24 | 2025-05-30 |
| Solar Monitor v1 | Modbus TCP | 2 | 10 | 2025-03-10 |

### Alarm Contacts

| Name | Phone | Method | Status |
|---|---|---|---|
| Admin User | +92-300-1234567 | Email + SMS | Active |
| Zeeshan Abbas | +92-333-7654321 | Email | Active |
| Ali Raza | +92-321-9876543 | SMS | Inactive |

### Organisation Profile

| Field | Value |
|---|---|
| Name | EmbedAIoT Pvt. Ltd. |
| Email | info@embedaiot.com |
| Phone | +92-300-0000000 |
| Address | 123 Tech Park, Gulberg III, Lahore, Pakistan |
| Website | www.embedaiot.com |
| Industry | Industrial IoT |
| Timezone | Asia/Karachi (PKT, UTC+5) |
| Currency | PKR |
| Current Plan | Professional |
| Devices Used | 6 out of 20 |

### Subscription Plans

| Plan | Price | Annual (−20%) | Devices | Popular |
|---|---|---|---|---|
| Basic | PKR 5,000/mo | PKR 4,000/mo | 5 | No |
| Professional | PKR 12,000/mo | PKR 9,600/mo | 20 | Yes — current plan |
| Enterprise | Custom | Custom | Unlimited | No |

### Products

| Name | Category | Price | Description |
|---|---|---|---|
| Smart Energy Meter | Hardware | PKR 15,000 | 3-phase smart meter, Modbus RTU |
| IoT Gateway Pro | Hardware | PKR 25,000 | 4G/WiFi/Ethernet, 16 devices |
| Current Sensor 100A | Sensor | PKR 3,500 | Split-core CT 100A/5A |
| Voltage Protection Relay | Hardware | PKR 8,500 | 3-phase over/under voltage relay |
| EmbedAIoT Basic Plan | Software | PKR 5,000/mo | 5 devices, email alerts |
| EmbedAIoT Pro Plan | Software | PKR 12,000/mo | 20 devices, AI analytics, SMS |

### Key Electrical Constants (Detail Page)

| Measurement | Value |
|---|---|
| Voltage A / B / C | 236.4 / 235.4 / 234.1 V |
| Line Voltage A / B / C | 406.3 / 408.0 / 408.1 V |
| Current A / B / C | 16.3 / 34.89 / 48.4 A |
| Active Power | 21.56 kW |
| Reactive Power | 7.64 kVAR |
| Apparent Power | 23.27 kVA |
| Power Consumption | 15,908.27 kWh |
| Power Factor | 0.92 |
| Frequency | 50.24 Hz |
| THD-Ua / Ub / Uc | 1.0 / 0.6 / 0.8 % |
| THD-Ia / Ib / Ic | 2.8 / 7.3 / 20.1 % |

---

## 14. Assets

Declared in `pubspec.yaml` under `flutter.assets`:

| Path | Used In |
|---|---|
| `assets/logo.png` | Available (not currently referenced in code) |
| `assets/logo-removebg-preview.png` | `LoginPage` (24% height), `_HomeRoot` AppBar (30px height) |

---

## 15. Known Lint Notices

All are **severity: Information** — not errors, not warnings. The app compiles and runs correctly with these present.

| Page | Widget | Issue |
|---|---|---|
| `org_helpers.dart` | `ModalDropdown` | `DropdownButtonFormField.value` deprecated in Flutter ≥3.33.0, use `initialValue` |
| `schedule_page.dart` | `_DropField` | Same deprecation |
| `slab_rates_page.dart` | `_DD` | Same deprecation |
| `interval_history_page.dart` | `_DD` | Same deprecation |
| `alarm_template_page.dart` | `_DD` | Same deprecation |

**How to fix when upgrading to Flutter 3.33+:**
```dart
// Before
DropdownButtonFormField<String>(value: _myValue, ...)

// After
DropdownButtonFormField<String>(initialValue: _myValue, ...)
```

---

## 16. API Integration Roadmap

The `http: ^1.2.0` package is already in `pubspec.yaml`. The app is structured so every dummy data reference is a clean, isolated swap.

### Recommended service layer

Create `lib/services/api_service.dart`:

```dart
class ApiService {
  static const _base = 'https://api.embedaiot.com/v1';
  static String? _token;

  static void setToken(String t) => _token = t;

  static Future<dynamic> get(String path) async {
    final r = await http.get(
      Uri.parse('$_base$path'),
      headers: {'Authorization': 'Bearer $_token', 'Accept': 'application/json'},
    );
    if (r.statusCode != 200) throw Exception('API error ${r.statusCode}');
    return jsonDecode(r.body);
  }

  static Future<dynamic> post(String path, Map body) async { ... }
  static Future<dynamic> put(String path, Map body) async { ... }
  static Future<void> delete(String path) async { ... }
}
```

### Endpoints by page

| Page / Feature | HTTP | Suggested Endpoint |
|---|---|---|
| Login | POST | `/auth/login` |
| Dashboard summary | GET | `/dashboard/summary?device={id}&slave={id}` |
| Device list | GET | `/devices` |
| Device detail metrics | GET | `/devices/{id}/metrics` |
| Add device | POST | `/devices` |
| Edit device | PUT | `/devices/{id}` |
| Delete device | DELETE | `/devices/{id}` |
| Org profile | GET / PUT | `/org/profile` |
| Users list | GET | `/org/users` |
| Add user | POST | `/org/users` |
| Edit user | PUT | `/org/users/{id}` |
| Delete user | DELETE | `/org/users/{id}` |
| Gateways | GET / POST / PUT / DELETE | `/gateways` / `/gateways/{id}` |
| Device templates | GET / POST / PUT / DELETE | `/templates` / `/templates/{id}` |
| Alarm contacts | GET / POST / PUT / DELETE | `/alarm-contacts` / `/alarm-contacts/{id}` |
| Schedules | GET / POST / PUT / DELETE | `/schedules` / `/schedules/{id}` |
| Slab rates | GET / POST / PUT / DELETE | `/slab-rates` / `/slab-rates/{id}` |
| Interval history | GET / POST / PUT / DELETE | `/interval-history` / `/interval-history/{id}` |
| Alarm templates | GET / POST / PUT / DELETE | `/alarm-templates` / `/alarm-templates/{id}` |
| Notifications | GET | `/notifications` |
| Delete notification | DELETE | `/notifications/{id}` |
| Clear all notifications | DELETE | `/notifications` |
| AI — Voltage imbalance | GET | `/analytics/voltage-imbalance?range={range}` |
| AI — Current imbalance | GET | `/analytics/current-imbalance?range={range}` |
| AI — Power factor | GET | `/analytics/power-factor?range={range}` |
| AI — Energy consumption | GET | `/analytics/energy-consumption?range={range}` |
| AI — Anomalies | GET | `/analytics/anomalies?range={range}` |
| Subscription plans | GET | `/subscription/plans` |
| Current subscription | GET | `/subscription/current` |
| Upgrade subscription | POST | `/subscription/upgrade` |
| Products | GET | `/products` |

### Migration pattern for a CRUD page

**Before (dummy data):**
```dart
@override
void initState() {
  super.initState();
  _items = DummyData.users.map((e) => Map<String, dynamic>.from(e)).toList();
}
```

**After (API):**
```dart
bool _loading = true;

@override
void initState() {
  super.initState();
  _loadData();
}

Future<void> _loadData() async {
  try {
    final data = await ApiService.get('/org/users') as List;
    setState(() { _items = data.cast<Map<String, dynamic>>(); _loading = false; });
  } catch (e) {
    setState(() => _loading = false);
    _snack('Failed to load users', error: true);
  }
}
```

Add a `CircularProgressIndicator` in `build()` when `_loading == true`.

---

*Document generated: 2026-06-11 · EmbedAIoT v1.0.0*
