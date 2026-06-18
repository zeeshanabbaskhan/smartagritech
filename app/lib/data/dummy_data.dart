class DummyData {
  static const String device = 'Delicia Warehouse';
  static const String slave = 'Main Wapda';

  // ── Dashboard summary values ──
  static const double totalPowerKwh = 18.43;
  static const double totalExportKwh = 0.0;
  static const double voltageImbalancePct = 27.25;
  static const double currentImbalanceVal = 58.83;
  static const double powerFactorVal = 0.94;
  static const double predictedConsumptionVal = 20.27;
  static const int totalAnomalies = 42;
  static const double thdV = 0.0;
  static const double thdI = 0.0;
  static const double frequencyHz = 0.0;

  static const List<Map<String, dynamic>> anomalyTypes = [
    {'type': 'Overvoltage (Voltage)', 'count': 39},
    {'type': 'Overload (Current)', 'count': 2},
  ];

  // ── Dashboard mini charts ──
  static const List<double> powerConsumptionChart = [
    0.3, 0.8, 1.1, 1.4, 1.3, 1.6, 1.8, 1.5, 1.9, 1.7, 1.8, 1.95
  ];
  static const List<double> exportPowerChart = [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
  ];
  static const List<double> voltageImbalanceChart = [
    313, 316, 315, 313, 312, 313, 315, 314, 316, 317, 316, 315
  ];
  static const List<double> currentImbalanceChart = [
    28, 29, 31, 26, 28, 31, 34, 32, 29, 31, 30, 33
  ];
  static const List<double> powerFactorChart = [
    0.93, 0.91, 0.90, 0.93, 0.95, 0.93, 0.91, 0.90, 0.93, 0.92, 0.91, 0.93
  ];
  static const List<double> predictedConsumptionMini = [
    2, 4, 5.5, 7, 8.5, 10, 12, 13.5, 15, 17, 18.5, 20.27
  ];

  // ── Detail page ──
  static const double voltageA = 236.4;
  static const double voltageB = 235.4;
  static const double voltageC = 234.1;
  static const double phaseVoltageA = 406.3;
  static const double phaseVoltageB = 408.0;
  static const double phaseVoltageC = 408.1;
  static const double currentA = 16.3;
  static const double currentB = 34.89;
  static const double currentC = 48.4;
  static const double activePower = 21.56;
  static const double reactivePower = 7.64;
  static const double apparentPower = 23.27;
  static const double powerConsumption = 15908.27;
  static const double exportPower = 0.84;
  static const double powerFactor = 0.92;
  static const double frequency = 50.24;
  static const double thdUa = 1.0;
  static const double thdUb = 0.6;
  static const double thdUc = 0.8;
  static const double thdIa = 2.8;
  static const double thdIb = 7.3;
  static const double thdIc = 20.1;
  static const double totalCostPKR = 0.0;

  static const double dailySaving = -18.1;
  static const double weeklySaving = -4.7;
  static const double monthlySaving = -259.8;
  static const String dailyDetail = '455.47 vs 385.77 kWh';
  static const String weeklyDetail = '2,493.65 vs 2,382.19 kWh';
  static const String monthlyDetail = '9,804.43 vs 2,725.22 kWh';

  // ── AI Analytics ── Voltage Imbalance
  static const double aiVoltageImbalance = 27.20;
  static const List<Map<String, String>> voltageAnomalies = [
    {'time': 'Jun 9, 00:00', 'type': 'Overvoltage'},
    {'time': 'Jun 9, 00:30', 'type': 'Overvoltage'},
    {'time': 'Jun 9, 01:00', 'type': 'Overvoltage'},
    {'time': 'Jun 9, 01:30', 'type': 'Overvoltage'},
    {'time': 'Jun 9, 02:00', 'type': 'Overvoltage'},
  ];
  static const List<double> predictedVoltage = [
    2.7, 2.0, 1.9, 2.5, 2.0, 2.1, 2.8, 2.5, 3.3, 2.6, 2.6, 3.0, 2.7
  ];
  static const List<double> voltageOverTime = [
    318, 316, 317, 318, 316, 315, 316, 318, 317, 316, 315, 316, 318,
    317, 316, 315, 316, 317, 318, 316, 315, 316, 317, 316, 318
  ];

  // ── AI Analytics ── Current Imbalance
  static const double aiCurrentImbalance = 45.69;
  static const List<Map<String, String>> currentAnomalies = [
    {'time': 'Jun 9, 00:30', 'type': 'Overload'},
    {'time': 'Jun 9, 01:30', 'type': 'Overload'},
    {'time': 'Jun 9, 02:00', 'type': 'Overload'},
    {'time': 'Jun 9, 03:00', 'type': 'Overload'},
    {'time': 'Jun 9, 03:30', 'type': 'Overload'},
  ];
  static const List<double> predictedCurrent = [
    2.7, 2.0, 1.9, 2.5, 2.0, 2.1, 2.8, 2.5, 3.3, 2.6, 2.6, 3.0, 2.7
  ];
  static const List<double> currentOverTime = [
    27, 30, 25, 29, 28, 30, 33, 36, 35, 34, 33, 29, 34,
    31, 28, 30, 26, 30, 33, 32, 30, 29, 32, 27, 33
  ];

  // ── AI Analytics ── Power Factor
  static const double aiPowerFactor = 0.90;
  static const List<Map<String, String>> powerFactorAnomalies = [
    {'time': 'Jun 9, 01:30', 'type': 'Low Power Factor'},
    {'time': 'Jun 9, 02:00', 'type': 'Low Power Factor'},
    {'time': 'Jun 9, 04:30', 'type': 'Low Power Factor'},
    {'time': 'Jun 9, 05:00', 'type': 'Low Power Factor'},
    {'time': 'Jun 9, 05:30', 'type': 'Low Power Factor'},
  ];
  static const List<double> predictedPowerFactor = [
    2.8, 2.0, 1.9, 2.5, 2.1, 1.9, 2.1, 2.8, 2.0, 2.0, 3.4, 2.6, 3.0, 2.7
  ];
  static const List<double> powerFactorOverTime = [
    0.90, 0.88, 0.89, 0.90, 0.88, 0.87, 0.88, 0.89, 0.85, 0.86, 0.87, 0.88,
    0.90, 0.91, 0.89, 0.90, 0.89, 0.88, 0.90, 0.91, 0.89, 0.90, 0.91, 0.90, 0.92
  ];

  // ── AI Analytics ── Energy Consumption
  static const double aiTotalConsumption = 255.91;
  static const List<double> predictedConsumptionChart = [
    2.8, 2.0, 1.9, 2.5, 2.1, 2.8, 3.4, 2.6, 3.0, 2.7, 2.5, 2.6, 2.7
  ];

  // ── AI Analytics ── Anomalies
  static const int aiTotalAnomalies = 109;
  static const int aiOvervoltageCount = 81;
  static const int aiLowPFCount = 16;
  static const int aiOverloadCount = 12;
  static const List<double> anomaliesTimeline = [
    3, 4, 3, 4, 5, 4, 3, 4, 3, 4, 5, 4, 3, 4, 3, 4, 3, 4, 5, 4, 3, 4, 3, 4, 4
  ];

  // ── Labels ──
  static const List<String> miniTimeLabels = [
    '11:55', '12:05', '12:15', '12:25', '12:35', '12:45', '12:55',
    '01:05', '01:15', '01:25', '01:35', '01:45'
  ];
  static const List<String> hourlyLabels = [
    '12:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00',
    '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '01:00'
  ];

  // ─────────────────────────────────────────
  // DEVICES
  // ─────────────────────────────────────────
  static const List<Map<String, dynamic>> devices = [
    {
      'id': '1',
      'name': 'Delicia Warehouse',
      'gateway': 'Gateway-01',
      'template': 'Industrial Meter v2',
      'status': 'Online',
      'lastSeen': '2025-06-10 14:32',
      'org': 'EmbedAIoT',
      'slave': 'Main Wapda',
      'ipAddress': '192.168.1.101',
      'serialNo': 'DW-2024-001',
      'powerKwh': 18.43,
      'powerFactor': 0.94,
      'anomalies': 42,
    },
    {
      'id': '2',
      'name': 'Main Office Block',
      'gateway': 'Gateway-01',
      'template': 'Industrial Meter v2',
      'status': 'Online',
      'lastSeen': '2025-06-10 14:30',
      'org': 'EmbedAIoT',
      'slave': 'LESCO Grid',
      'ipAddress': '192.168.1.102',
      'serialNo': 'MB-2024-002',
      'powerKwh': 12.87,
      'powerFactor': 0.91,
      'anomalies': 5,
    },
    {
      'id': '3',
      'name': 'Factory Floor A',
      'gateway': 'Gateway-02',
      'template': 'Pump Monitor v1',
      'status': 'Offline',
      'lastSeen': '2025-06-09 22:15',
      'org': 'EmbedAIoT',
      'slave': 'Generator',
      'ipAddress': '192.168.2.101',
      'serialNo': 'FF-2024-003',
      'powerKwh': 0.0,
      'powerFactor': 0.0,
      'anomalies': 0,
    },
    {
      'id': '4',
      'name': 'Cold Storage Unit',
      'gateway': 'Gateway-02',
      'template': 'Smart Meter v3',
      'status': 'Online',
      'lastSeen': '2025-06-10 14:28',
      'org': 'EmbedAIoT',
      'slave': 'Main Wapda',
      'ipAddress': '192.168.2.102',
      'serialNo': 'CS-2024-004',
      'powerKwh': 8.65,
      'powerFactor': 0.88,
      'anomalies': 12,
    },
    {
      'id': '5',
      'name': 'Pump Station B',
      'gateway': 'Gateway-03',
      'template': 'Pump Monitor v1',
      'status': 'Online',
      'lastSeen': '2025-06-10 14:10',
      'org': 'EmbedAIoT',
      'slave': 'Backup WAPDA',
      'ipAddress': '192.168.3.101',
      'serialNo': 'PS-2024-005',
      'powerKwh': 5.22,
      'powerFactor': 0.96,
      'anomalies': 3,
    },
    {
      'id': '6',
      'name': 'Rooftop Solar Array',
      'gateway': 'Gateway-03',
      'template': 'Solar Monitor v1',
      'status': 'Offline',
      'lastSeen': '2025-06-08 06:00',
      'org': 'EmbedAIoT',
      'slave': 'Solar Inverter',
      'ipAddress': '192.168.3.102',
      'serialNo': 'RS-2024-006',
      'powerKwh': 0.0,
      'powerFactor': 0.0,
      'anomalies': 0,
    },
  ];

  // ─────────────────────────────────────────
  // GATEWAYS
  // ─────────────────────────────────────────
  static const List<Map<String, dynamic>> gateways = [
    {
      'id': '1',
      'name': 'Gateway-01',
      'ipAddress': '192.168.1.1',
      'status': 'Online',
      'devices': 2,
      'location': 'Warehouse Block',
      'lastSeen': '2025-06-10 14:32',
      'serialNo': 'GW-2024-001',
    },
    {
      'id': '2',
      'name': 'Gateway-02',
      'ipAddress': '192.168.2.1',
      'status': 'Online',
      'devices': 2,
      'location': 'Factory Area',
      'lastSeen': '2025-06-10 14:30',
      'serialNo': 'GW-2024-002',
    },
    {
      'id': '3',
      'name': 'Gateway-03',
      'ipAddress': '192.168.3.1',
      'status': 'Offline',
      'devices': 2,
      'location': 'Outdoor Zone',
      'lastSeen': '2025-06-08 12:00',
      'serialNo': 'GW-2024-003',
    },
  ];

  // ─────────────────────────────────────────
  // USERS
  // ─────────────────────────────────────────
  static const List<Map<String, dynamic>> users = [
    {
      'id': '1',
      'name': 'Admin User',
      'email': 'admin@embedaiot.com',
      'role': 'Admin',
      'status': 'Active',
      'lastLogin': '2025-06-10 14:00',
    },
    {
      'id': '2',
      'name': 'Zeeshan Abbas',
      'email': 'zeeshan@embedaiot.com',
      'role': 'Manager',
      'status': 'Active',
      'lastLogin': '2025-06-10 09:30',
    },
    {
      'id': '3',
      'name': 'Ali Raza',
      'email': 'ali@embedaiot.com',
      'role': 'Operator',
      'status': 'Active',
      'lastLogin': '2025-06-09 16:45',
    },
    {
      'id': '4',
      'name': 'Sara Khan',
      'email': 'sara@embedaiot.com',
      'role': 'Viewer',
      'status': 'Inactive',
      'lastLogin': '2025-06-05 11:20',
    },
    {
      'id': '5',
      'name': 'Ahmed Malik',
      'email': 'ahmed@embedaiot.com',
      'role': 'Operator',
      'status': 'Active',
      'lastLogin': '2025-06-10 08:15',
    },
  ];

  // ─────────────────────────────────────────
  // DEVICE TEMPLATES
  // ─────────────────────────────────────────
  static const List<Map<String, dynamic>> deviceTemplates = [
    {
      'id': '1',
      'name': 'Industrial Meter v2',
      'slaves': 3,
      'variables': 18,
      'protocol': 'Modbus RTU',
      'updatedAt': '2025-05-20',
    },
    {
      'id': '2',
      'name': 'Pump Monitor v1',
      'slaves': 2,
      'variables': 12,
      'protocol': 'Modbus TCP',
      'updatedAt': '2025-04-15',
    },
    {
      'id': '3',
      'name': 'Smart Meter v3',
      'slaves': 4,
      'variables': 24,
      'protocol': 'MQTT',
      'updatedAt': '2025-05-30',
    },
    {
      'id': '4',
      'name': 'Solar Monitor v1',
      'slaves': 2,
      'variables': 10,
      'protocol': 'Modbus TCP',
      'updatedAt': '2025-03-10',
    },
  ];

  // ─────────────────────────────────────────
  // ALARM CONTACTS
  // ─────────────────────────────────────────
  static const List<Map<String, dynamic>> alarmContacts = [
    {
      'id': '1',
      'name': 'Admin User',
      'email': 'admin@embedaiot.com',
      'phone': '+92-300-1234567',
      'method': 'Email + SMS',
      'status': 'Active',
    },
    {
      'id': '2',
      'name': 'Zeeshan Abbas',
      'email': 'zeeshan@embedaiot.com',
      'phone': '+92-333-7654321',
      'method': 'Email',
      'status': 'Active',
    },
    {
      'id': '3',
      'name': 'Ali Raza',
      'email': 'ali@embedaiot.com',
      'phone': '+92-321-9876543',
      'method': 'SMS',
      'status': 'Inactive',
    },
  ];

  // ─────────────────────────────────────────
  // PRODUCTS
  // ─────────────────────────────────────────
  static const List<Map<String, dynamic>> products = [
    {
      'id': '1',
      'name': 'Smart Energy Meter',
      'category': 'Hardware',
      'price': 'PKR 15,000',
      'stock': 24,
      'status': 'Available',
      'description': '3-phase smart energy meter with IoT connectivity and Modbus RTU support.',
    },
    {
      'id': '2',
      'name': 'IoT Gateway Pro',
      'category': 'Hardware',
      'price': 'PKR 25,000',
      'stock': 8,
      'status': 'Available',
      'description': 'Industrial IoT gateway with 4G, WiFi, and Ethernet. Supports up to 16 devices.',
    },
    {
      'id': '3',
      'name': 'Current Sensor 100A',
      'category': 'Sensor',
      'price': 'PKR 3,500',
      'stock': 50,
      'status': 'Available',
      'description': 'Split-core current transformer 100A/5A. Easy clip-on installation.',
    },
    {
      'id': '4',
      'name': 'Voltage Protection Relay',
      'category': 'Hardware',
      'price': 'PKR 8,500',
      'stock': 15,
      'status': 'Available',
      'description': 'Over/under voltage protection relay with DIN rail mount. 3-phase.',
    },
    {
      'id': '5',
      'name': 'EmbedAIoT Basic Plan',
      'category': 'Software',
      'price': 'PKR 5,000/mo',
      'stock': 0,
      'status': 'Service',
      'description': 'Up to 5 devices, basic analytics, email alerts, 1-year data retention.',
    },
    {
      'id': '6',
      'name': 'EmbedAIoT Pro Plan',
      'category': 'Software',
      'price': 'PKR 12,000/mo',
      'stock': 0,
      'status': 'Service',
      'description': 'Up to 20 devices, AI analytics, SMS + email alerts, unlimited retention.',
    },
  ];

  // ─────────────────────────────────────────
  // SUBSCRIPTION PLANS
  // ─────────────────────────────────────────
  static const List<Map<String, dynamic>> subscriptionPlans = [
    {
      'name': 'Basic',
      'subtitle': 'For small teams & startups',
      'price': 5000,
      'period': 'per month',
      'devices': '5 Devices',
      'popular': false,
      'features': [
        '5 IoT Devices',
        'Basic Dashboard',
        'Email Alerts',
        '1-Year Data History',
        'Standard Support',
      ],
    },
    {
      'name': 'Professional',
      'subtitle': 'For growing operations',
      'price': 12000,
      'period': 'per month',
      'devices': '20 Devices',
      'popular': true,
      'features': [
        '20 IoT Devices',
        'AI Analytics',
        'Email + SMS Alerts',
        'Unlimited History',
        'Priority Support',
        'Custom Reports',
      ],
    },
    {
      'name': 'Enterprise',
      'subtitle': 'For large-scale deployments',
      'price': 0,
      'period': 'contact us',
      'devices': 'Unlimited',
      'popular': false,
      'features': [
        'Unlimited Devices',
        'Advanced AI Analytics',
        'All Alert Channels',
        'Unlimited History',
        'Dedicated Support',
        'Custom Integration',
        'On-premise Option',
      ],
    },
  ];

  // ─────────────────────────────────────────
  // ORGANIZATION
  // ─────────────────────────────────────────
  static const Map<String, dynamic> organization = {
    'name': 'EmbedAIoT Pvt. Ltd.',
    'email': 'info@embedaiot.com',
    'phone': '+92-300-0000000',
    'address': '123 Tech Park, Gulberg III, Lahore, Pakistan',
    'website': 'www.embedaiot.com',
    'industry': 'Industrial IoT',
    'timezone': 'Asia/Karachi (PKT, UTC+5)',
    'currency': 'PKR',
    'plan': 'Professional',
    'devicesUsed': 6,
    'devicesLimit': 20,
  };
}
