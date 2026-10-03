/// Comprehensive Offline Mock Data matching web_frontend EMS Dashboard
class EmsMockData {
  // ─── Organizations ────────────────────────────────────────────────────────
  static final List<Map<String, dynamic>> organizations = [
    {
      'id': 'org-1',
      'name': 'Smart AgriTech Central',
      'code': 'SATC-01',
      'deviceCount': 8,
      'gatewayCount': 2,
      'status': 'Active',
      'contactEmail': 'ops@smartagritech.com',
    },
    {
      'id': 'org-2',
      'name': 'Apex Cold Logistics',
      'code': 'ACL-02',
      'deviceCount': 4,
      'gatewayCount': 1,
      'status': 'Active',
      'contactEmail': 'monitoring@apexcold.com',
    },
    {
      'id': 'org-3',
      'name': 'Indus Dairy & Agro Processing',
      'code': 'IDAP-03',
      'deviceCount': 6,
      'gatewayCount': 2,
      'status': 'Active',
      'contactEmail': 'energy@indusdairy.com',
    },
  ];

  // ─── Users ────────────────────────────────────────────────────────────────
  static final List<Map<String, dynamic>> users = [
    {
      'id': 'usr-admin',
      'fullName': 'Super Administrator',
      'email': 'admin@ems.io',
      'role': 'SUPER_ADMIN',
      'roleLabel': 'Super Admin',
      'orgName': 'System Master',
      'status': 'ACTIVE',
    },
    {
      'id': 'usr-org',
      'fullName': 'Organization Admin',
      'email': 'org@ems.io',
      'role': 'ORG_ADMIN',
      'roleLabel': 'Organization Admin',
      'orgName': 'Smart AgriTech Central',
      'status': 'ACTIVE',
    },
    {
      'id': 'usr-user',
      'fullName': 'Station Engineer',
      'email': 'user@ems.io',
      'role': 'USER',
      'roleLabel': 'Operator',
      'orgName': 'Smart AgriTech Central',
      'status': 'ACTIVE',
    },
  ];

  // ─── Devices ──────────────────────────────────────────────────────────────
  static final List<Map<String, dynamic>> devices = [
    {
      'id': 'dev-1',
      'name': 'Main Incomer 11kV Substation',
      'code': 'SUB-11KV-01',
      'status': 'Online',
      'gatewayName': 'Edge-GW-Alpha',
      'model': 'Schneider PM8000',
      'switchState': true,
      'voltage': '402.4 V',
      'current': '184.2 A',
      'activePower': '124.5 kW',
      'powerFactor': '0.96',
      'lastSeen': 'Just now',
      'orgId': 'org-1',
    },
    {
      'id': 'dev-2',
      'name': 'Cold Storage Chiller #1',
      'code': 'CS-CHILL-01',
      'status': 'Online',
      'gatewayName': 'Edge-GW-Alpha',
      'model': 'Acrel APM810',
      'switchState': true,
      'voltage': '398.1 V',
      'current': '92.6 A',
      'activePower': '58.3 kW',
      'powerFactor': '0.94',
      'lastSeen': '1 min ago',
      'orgId': 'org-1',
    },
    {
      'id': 'dev-3',
      'name': 'Solar Inverter Farm 250kW',
      'code': 'SOLAR-INV-250',
      'status': 'Online',
      'gatewayName': 'Edge-GW-Beta',
      'model': 'Huawei SUN2000',
      'switchState': true,
      'voltage': '415.0 V',
      'current': '210.5 A',
      'activePower': '142.0 kW',
      'powerFactor': '0.99',
      'lastSeen': 'Just now',
      'orgId': 'org-1',
    },
    {
      'id': 'dev-4',
      'name': 'High-Pressure Irrigation Pump #2',
      'code': 'PUMP-IRR-02',
      'status': 'Offline',
      'gatewayName': 'Edge-GW-Beta',
      'model': 'Selecs MFM384',
      'switchState': false,
      'voltage': '0.0 V',
      'current': '0.0 A',
      'activePower': '0.0 kW',
      'powerFactor': '0.00',
      'lastSeen': '42 mins ago',
      'orgId': 'org-1',
    },
    {
      'id': 'dev-5',
      'name': 'Cold Storage Deep Freezer #2',
      'code': 'CS-FREEZ-02',
      'status': 'Online',
      'gatewayName': 'Edge-GW-Alpha',
      'model': 'Acrel APM810',
      'switchState': true,
      'voltage': '401.8 V',
      'current': '76.4 A',
      'activePower': '47.2 kW',
      'powerFactor': '0.95',
      'lastSeen': 'Just now',
      'orgId': 'org-1',
    },
    {
      'id': 'dev-6',
      'name': 'Processing Hall Packaging Line',
      'code': 'PROC-LINE-A',
      'status': 'Online',
      'gatewayName': 'Edge-GW-Alpha',
      'model': 'Schneider PM5350',
      'switchState': true,
      'voltage': '399.7 V',
      'current': '48.1 A',
      'activePower': '31.4 kW',
      'powerFactor': '0.92',
      'lastSeen': '2 mins ago',
      'orgId': 'org-1',
    },
  ];

  // ─── Slaves ───────────────────────────────────────────────────────────────
  static final List<Map<String, dynamic>> slaves = [
    {'id': 'slave-1', 'deviceId': 'dev-1', 'name': 'Feeder 1 - Main Bus', 'isDefault': true},
    {'id': 'slave-2', 'deviceId': 'dev-1', 'name': 'Feeder 2 - Essential Auxiliary', 'isDefault': false},
    {'id': 'slave-3', 'deviceId': 'dev-2', 'name': 'Compressor Motor A', 'isDefault': true},
    {'id': 'slave-4', 'deviceId': 'dev-3', 'name': 'String Array Inverter', 'isDefault': true},
  ];

  // ─── Gateways ─────────────────────────────────────────────────────────────
  static final List<Map<String, dynamic>> gateways = [
    {
      'id': 'gw-1',
      'name': 'Edge-GW-Alpha',
      'ipAddress': '192.168.10.150',
      'macAddress': '70:B3:D5:E2:81:4A',
      'port': 502,
      'status': 'Online',
      'connectedDevices': 4,
      'lastHeartbeat': '10s ago',
    },
    {
      'id': 'gw-2',
      'name': 'Edge-GW-Beta',
      'ipAddress': '192.168.10.151',
      'macAddress': '70:B3:D5:E2:81:9B',
      'port': 502,
      'status': 'Online',
      'connectedDevices': 2,
      'lastHeartbeat': '25s ago',
    },
  ];

  // ─── Time-Series Generator for Charts ──────────────────────────────────────
  static Map<String, List<Map<String, dynamic>>> getMetricSeries({
    required double baseVal,
    required double variance,
  }) {
    return {
      '1h': [
        {'t': '10:00', 'v': (baseVal - variance * 0.4)},
        {'t': '10:15', 'v': (baseVal + variance * 0.3)},
        {'t': '10:30', 'v': (baseVal - variance * 0.1)},
        {'t': '10:45', 'v': (baseVal + variance * 0.7)},
        {'t': '11:00', 'v': baseVal},
      ],
      '24h': [
        {'t': '00:00', 'v': (baseVal * 0.6)},
        {'t': '04:00', 'v': (baseVal * 0.55)},
        {'t': '08:00', 'v': (baseVal * 0.95)},
        {'t': '12:00', 'v': (baseVal * 1.15)},
        {'t': '16:00', 'v': (baseVal * 1.05)},
        {'t': '20:00', 'v': (baseVal * 0.85)},
      ],
      '7d': [
        {'t': 'Mon', 'v': (baseVal * 0.9)},
        {'t': 'Tue', 'v': (baseVal * 1.02)},
        {'t': 'Wed', 'v': (baseVal * 0.98)},
        {'t': 'Thu', 'v': (baseVal * 1.05)},
        {'t': 'Fri', 'v': (baseVal * 1.1)},
        {'t': 'Sat', 'v': (baseVal * 0.8)},
        {'t': 'Sun', 'v': (baseVal * 0.75)},
      ],
      '30d': [
        {'t': 'Wk 1', 'v': (baseVal * 0.95)},
        {'t': 'Wk 2', 'v': (baseVal * 1.02)},
        {'t': 'Wk 3', 'v': (baseVal * 1.08)},
        {'t': 'Wk 4', 'v': baseVal},
      ],
    };
  }

  // ─── Dashboard Metrics Overview ───────────────────────────────────────────
  static Map<String, dynamic> getDashboardMetrics() {
    return {
      'totalPower': {'val': '124.50', 'unit': 'kW', 'chart': getMetricSeries(baseVal: 124.5, variance: 15.0)},
      'exportPower': {'val': '48.20', 'unit': 'kW', 'chart': getMetricSeries(baseVal: 48.2, variance: 8.0)},
      'voltageImbalance': {'val': '0.84', 'unit': '%', 'chart': getMetricSeries(baseVal: 0.84, variance: 0.2)},
      'currentImbalance': {'val': '2.15', 'unit': '%', 'chart': getMetricSeries(baseVal: 2.15, variance: 0.5)},
      'powerFactor': {'val': '0.96', 'unit': 'PF', 'chart': getMetricSeries(baseVal: 0.96, variance: 0.03)},
      'predicted': {'val': '138.20', 'unit': 'kW', 'chart': getMetricSeries(baseVal: 138.2, variance: 10.0)},
      'thdV': {'val': '1.42', 'unit': '%', 'chart': getMetricSeries(baseVal: 1.42, variance: 0.3)},
      'thdI': {'val': '3.80', 'unit': '%', 'chart': getMetricSeries(baseVal: 3.8, variance: 0.6)},
      'frequency': {'val': '50.04', 'unit': 'Hz', 'chart': getMetricSeries(baseVal: 50.04, variance: 0.05)},
    };
  }

  // ─── Detailed 25 Readouts for Detail Page (matching READOUT_DEFS in UserDashboardDetail.jsx) ──
  static final List<Map<String, dynamic>> electricalReadouts = [
    {'label': 'Voltage A', 'value': '232.4', 'unit': 'V', 'category': 'Voltage'},
    {'label': 'Voltage B', 'value': '231.8', 'unit': 'V', 'category': 'Voltage'},
    {'label': 'Voltage C', 'value': '233.1', 'unit': 'V', 'category': 'Voltage'},
    {'label': 'Phase Voltage A', 'value': '402.1', 'unit': 'V', 'category': 'Voltage'},
    {'label': 'Phase Voltage B', 'value': '401.5', 'unit': 'V', 'category': 'Voltage'},
    {'label': 'Phase Voltage C', 'value': '402.8', 'unit': 'V', 'category': 'Voltage'},
    {'label': 'Current A', 'value': '62.4', 'unit': 'A', 'category': 'Current'},
    {'label': 'Current B', 'value': '61.1', 'unit': 'A', 'category': 'Current'},
    {'label': 'Current C', 'value': '60.7', 'unit': 'A', 'category': 'Current'},
    {'label': 'Operating Power', 'value': '124.50', 'unit': 'kW', 'category': 'Power'},
    {'label': 'Reactive Power', 'value': '36.20', 'unit': 'kVar', 'category': 'Power'},
    {'label': 'Apparent Power', 'value': '129.68', 'unit': 'kVA', 'category': 'Power'},
    {'label': 'Units (kWh)', 'value': '48,294.6', 'unit': 'kWh', 'category': 'Energy'},
    {'label': 'Export Power', 'value': '12.40', 'unit': 'kWh', 'category': 'Power'},
    {'label': 'Power Factor', 'value': '0.96', 'unit': '', 'category': 'Quality'},
    {'label': 'Frequency', 'value': '50.04', 'unit': 'Hz', 'category': 'Quality'},
    {'label': 'Temperature', 'value': '38.5', 'unit': '°C', 'category': 'Environment'},
    {'label': 'Energy', 'value': '48,294.6', 'unit': 'kWh', 'category': 'Energy'},
    {'label': 'THD Ua', 'value': '1.42', 'unit': '%', 'category': 'Quality'},
    {'label': 'THD Ub', 'value': '1.38', 'unit': '%', 'category': 'Quality'},
    {'label': 'THD Uc', 'value': '1.45', 'unit': '%', 'category': 'Quality'},
    {'label': 'THD Ia', 'value': '3.80', 'unit': '%', 'category': 'Quality'},
    {'label': 'THD Ib', 'value': '3.65', 'unit': '%', 'category': 'Quality'},
    {'label': 'THD Ic', 'value': '3.92', 'unit': '%', 'category': 'Quality'},
    {'label': 'Total cost', 'value': '1,183,217', 'unit': 'PKR', 'category': 'Cost'},
  ];

  // ─── Anomalies ────────────────────────────────────────────────────────────
  static final List<Map<String, dynamic>> anomalies = [
    {
      'id': 'anom-1',
      'title': 'High Phase Voltage Imbalance (>2%)',
      'deviceName': 'Main Incomer 11kV Substation',
      'severity': 'Warning',
      'value': '2.45%',
      'timestamp': 'Today at 08:42 AM',
      'status': 'Resolved',
    },
    {
      'id': 'anom-2',
      'title': 'Low Power Factor Threshold Breach (<0.85)',
      'deviceName': 'Cold Storage Chiller #1',
      'severity': 'Critical',
      'value': '0.81 PF',
      'timestamp': 'Yesterday at 04:15 PM',
      'status': 'Active',
    },
    {
      'id': 'anom-3',
      'title': 'Unusual Nighttime Peak Load Spike',
      'deviceName': 'Processing Hall Packaging Line',
      'severity': 'Warning',
      'value': '+42.8 kW',
      'timestamp': 'Sep 21, 02:10 AM',
      'status': 'Investigating',
    },
  ];

  // ─── Tariffs / Slab Rates ──────────────────────────────────────────────────
  static final List<Map<String, dynamic>> slabRates = [
    {'tier': 'Off-Peak Tariff', 'kwhRange': '1 - 300 kWh', 'rate': 'PKR 24.50', 'timeWindow': '10:00 PM - 06:00 PM'},
    {'tier': 'Peak Demand Tariff', 'kwhRange': '301 - 700 kWh', 'rate': 'PKR 48.00', 'timeWindow': '06:00 PM - 10:00 PM'},
    {'tier': 'Industrial Commercial Exceed', 'kwhRange': '700+ kWh', 'rate': 'PKR 54.20', 'timeWindow': '24 Hours'},
  ];

  // ─── Schedules ────────────────────────────────────────────────────────────
  static final List<Map<String, dynamic>> schedules = [
    {'name': 'Nightly Chiller Eco-Mode', 'device': 'Cold Storage Chiller #1', 'cron': '0 23 * * *', 'action': 'Switch to 60%', 'active': true},
    {'name': 'Irrigation Pump Morning Cycle', 'device': 'High-Pressure Irrigation Pump #2', 'cron': '30 5 * * *', 'action': 'Turn ON', 'active': false},
    {'name': 'Solar Inverter Diagnostic Sync', 'device': 'Solar Inverter Farm 250kW', 'cron': '0 0 * * 0', 'action': 'Self-Test', 'active': true},
  ];

  // ─── Interval History (15-min Intervals) ──────────────────────────────────
  static final List<Map<String, dynamic>> intervalHistory = [
    {'timestamp': '2026-09-23 09:30', 'device': 'Main Incomer 11kV', 'kWh': '31.12', 'peakKw': '124.5', 'avgPf': '0.96'},
    {'timestamp': '2026-09-23 09:15', 'device': 'Main Incomer 11kV', 'kWh': '30.84', 'peakKw': '123.4', 'avgPf': '0.96'},
    {'timestamp': '2026-09-23 09:00', 'device': 'Main Incomer 11kV', 'kWh': '29.50', 'peakKw': '118.0', 'avgPf': '0.95'},
    {'timestamp': '2026-09-23 08:45', 'device': 'Main Incomer 11kV', 'kWh': '32.10', 'peakKw': '128.4', 'avgPf': '0.94'},
    {'timestamp': '2026-09-23 08:30', 'device': 'Main Incomer 11kV', 'kWh': '33.40', 'peakKw': '133.6', 'avgPf': '0.94'},
  ];

  // ─── EV Chargers ──────────────────────────────────────────────────────────
  static final List<Map<String, dynamic>> evChargers = [
    {
      'id': 'ev-1',
      'stationName': 'Bay A1 — HyperCharge 150kW DC',
      'status': 'Charging',
      'vehicle': 'Tesla Model Y Fleet #4',
      'soc': '68%',
      'power': '112.4 kW',
      'deliveredEnergy': '44.2 kWh',
      'duration': '34 mins',
      'batteryTemp': '32.4 °C',
    },
    {
      'id': 'ev-2',
      'stationName': 'Bay A2 — AC Fast 22kW Type 2',
      'status': 'Available',
      'vehicle': 'None',
      'soc': '--',
      'power': '0.0 kW',
      'deliveredEnergy': '0.0 kWh',
      'duration': '--',
      'batteryTemp': '--',
    },
    {
      'id': 'ev-3',
      'stationName': 'Bay B1 — V2G Bi-Directional Inverter',
      'status': 'Discharging (V2G)',
      'vehicle': 'BYD Atto 3 Fleet #2',
      'soc': '84%',
      'power': '18.5 kW (Export)',
      'deliveredEnergy': '12.8 kWh',
      'duration': '48 mins',
      'batteryTemp': '29.1 °C',
    },
  ];
}
