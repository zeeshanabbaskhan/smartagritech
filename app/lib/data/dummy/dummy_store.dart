import '../dummy_data.dart';
import 'dummy_helpers.dart';

/// In-memory mutable store backing dummy API responses.
class DummyStore {
  DummyStore._();
  static final DummyStore instance = DummyStore._();

  static const orgId = 'org-1';
  static const demoOrgAdminEmail = 'orgadmin@ems.com';
  static const demoOrgAdminPassword = 'Admin@123456';
  static const demoUserEmail = 'user@ems.com';
  static const demoUserPassword = 'User@123456';

  final Map<String, String> passwords = {
    demoOrgAdminEmail: demoOrgAdminPassword,
    demoUserEmail: demoUserPassword,
    'superadmin@ems.com': 'Admin@123456',
  };

  Map<String, dynamic>? currentUser;
  String? accessToken;
  String? refreshToken;

  late Map<String, dynamic> organization;
  late List<Map<String, dynamic>> users;
  late List<Map<String, dynamic>> gateways;
  late List<Map<String, dynamic>> devices;
  late List<Map<String, dynamic>> deviceTemplates;
  late List<Map<String, dynamic>> templateSlaves;
  late List<Map<String, dynamic>> templateVariables;
  late List<Map<String, dynamic>> deviceConfigSlaves;
  late List<Map<String, dynamic>> deviceConfigVariables;
  late List<Map<String, dynamic>> notifications;
  late List<Map<String, dynamic>> scheduledTasks;
  late List<Map<String, dynamic>> taskLogs;
  late List<Map<String, dynamic>> slabRates;
  late List<Map<String, dynamic>> intervalHistory;
  late List<Map<String, dynamic>> alarmTemplates;
  late List<Map<String, dynamic>> alarmContacts;
  late List<Map<String, dynamic>> alarmSettings;
  late List<Map<String, dynamic>> anomalies;
  late List<Map<String, dynamic>> products;
  late List<Map<String, dynamic>> widgetTemplates;
  late List<Map<String, dynamic>> deviceTimestamps;
  late List<Map<String, dynamic>> variableAlarms;
  late List<Map<String, dynamic>> linkageRecords;
  late List<Map<String, dynamic>> alarmNotifications;
  late List<Map<String, dynamic>> deviceUserLinks;

  bool _seeded = false;

  void ensureSeeded() {
    if (_seeded) return;
    _seeded = true;
    _seed();
  }

  void reset() {
    _seeded = false;
    currentUser = null;
    accessToken = null;
    refreshToken = null;
    ensureSeeded();
  }

  void _seed() {
    organization = {
      'id': orgId,
      'name': DummyData.organization['name'],
      'email': DummyData.organization['email'],
      'phone': DummyData.organization['phone'],
      'address': DummyData.organization['address'],
      'website': DummyData.organization['website'],
      'industry': DummyData.organization['industry'],
      'timezone': 'Asia/Karachi',
      'currency': DummyData.organization['currency'],
      'plan': DummyData.organization['plan'],
      'deviceLimit': DummyData.organization['devicesLimit'],
      'deviceCount': DummyData.organization['devicesUsed'],
      'description': 'Demo organisation for offline Flutter builds.',
      'logoUrl': '',
    };

    users = [
      _user('usr-admin', 'Org Admin', demoOrgAdminEmail, 'ORG_ADMIN', 'ACTIVE'),
      _user('usr-1', 'Demo User', demoUserEmail, 'USER', 'ACTIVE'),
      ...DummyData.users.asMap().entries.map((e) {
        final u = e.value;
        return _user(
          'usr-${e.key + 2}',
          u['name'] as String,
          u['email'] as String,
          _uiRoleToApi(u['role'] as String),
          u['status'] == 'Active' ? 'ACTIVE' : 'INACTIVE',
        );
      }),
    ];

    gateways = DummyData.gateways.asMap().entries.map((e) {
      final g = e.value;
      final id = 'gw-${e.key + 1}';
      return {
        'id': id,
        'name': g['name'],
        'model': 'N510',
        'serialNumber': g['serialNo'],
        'ipAddress': g['ipAddress'],
        'location': g['location'],
        'status': g['status'] == 'Online' ? 'ONLINE' : 'OFFLINE',
        'organizationId': orgId,
        'lastSeenAt': DummyHelpers.iso(),
        '_count': {'devices': g['devices']},
      };
    }).toList();

    deviceTemplates = DummyData.deviceTemplates.asMap().entries.map((e) {
      final t = e.value;
      final slaveCount = t['slaves'] as int? ?? 2;
      final varCount = t['variables'] as int? ?? 10;
      return {
        'id': 'tpl-${e.key + 1}',
        'name': t['name'],
        'acquisitionMethod': t['protocol'],
        'protocol': t['protocol'],
        'organizationId': orgId,
        'updatedAt': DummyHelpers.iso(DateTime.parse('${t['updatedAt']}T00:00:00Z')),
        'totalSlaves': slaveCount,
        'totalVariables': varCount,
        '_count': {
          'slaves': slaveCount,
          'templateSlaves': slaveCount,
          'templateVariables': varCount,
        },
      };
    }).toList();

    templateSlaves = [];
    templateVariables = [];
    for (var ti = 0; ti < deviceTemplates.length; ti++) {
      final tpl = deviceTemplates[ti];
      final tplId = tpl['id'] as String;
      final slaveCount = (DummyData.deviceTemplates[ti]['slaves'] as int?) ?? 2;
      for (var si = 0; si < slaveCount; si++) {
        final slaveId = 'tsl-$tplId-$si';
        templateSlaves.add({
          'id': slaveId,
          'templateId': tplId,
          'name': si == 0 ? 'Main Wapda' : 'Slave ${si + 1}',
          'slaveAddress': si + 1,
          'organizationId': orgId,
        });
        final varNames = ['VoltageA', 'VoltageB', 'VoltageC', 'CurrentA', 'CurrentB', 'CurrentC',
          'PowerConsumption', 'PowerFactor', 'VoltageImbalance', 'CurrentImbalance'];
        for (var vi = 0; vi < varNames.length; vi++) {
          templateVariables.add({
            'id': 'tvar-$slaveId-$vi',
            'templateId': tplId,
            'templateSlaveId': slaveId,
            'name': varNames[vi],
            'unit': varNames[vi].contains('Voltage') ? 'V' : varNames[vi].contains('Current') ? 'A' : '',
            'dataType': 'FLOAT',
            'registerAddress': 100 + vi,
            'organizationId': orgId,
          });
        }
      }
    }

    devices = DummyData.devices.asMap().entries.map((e) {
      final d = e.value;
      final id = 'dev-${e.key + 1}';
      final gwIdx = int.tryParse((d['gateway'] as String).replaceAll(RegExp(r'[^0-9]'), '')) ?? 1;
      final tplIdx = ((e.key) % deviceTemplates.length);
      final gwId = 'gw-$gwIdx';
      final tplId = 'tpl-${tplIdx + 1}';
      return {
        'id': id,
        'name': d['name'],
        'status': d['status'] == 'Online' ? 'ONLINE' : 'OFFLINE',
        'gatewayId': gwId,
        'templateId': tplId,
        'organizationId': orgId,
        'switchState': 'ON',
        'lastDataReceivedAt': DummyHelpers.iso(),
        'ingestApiKey': null,
        'gateway': gateways.firstWhere((g) => g['id'] == gwId, orElse: () => gateways.first),
        'template': deviceTemplates[tplIdx],
        'organization': {'id': orgId, 'name': organization['name']},
      };
    }).toList();

    deviceConfigSlaves = [];
    deviceConfigVariables = [];
    for (final dev in devices) {
      final devId = dev['id'] as String;
      final tplId = dev['templateId'] as String;
      final tplSlaveList = templateSlaves.where((s) => s['templateId'] == tplId).take(2);
      for (final ts in tplSlaveList) {
        final cfgSlaveId = 'cfg-$devId-${ts['id']}';
        deviceConfigSlaves.add({
          'id': cfgSlaveId,
          'deviceId': devId,
          'name': ts['name'],
          'slaveAddress': ts['slaveAddress'],
          'organizationId': orgId,
          'configVariables': <Map<String, dynamic>>[],
        });
        final vars = templateVariables.where((v) => v['templateSlaveId'] == ts['id']);
        for (final tv in vars) {
          final cv = {
            'id': 'cfgvar-$cfgSlaveId-${tv['name']}',
            'deviceId': devId,
            'deviceConfigSlaveId': cfgSlaveId,
            'name': tv['name'],
            'unit': tv['unit'],
            'currentValue': _defaultVarValue(tv['name'] as String),
            'isActive': true,
            'organizationId': orgId,
            'lastUpdatedAt': DummyHelpers.iso(),
          };
          deviceConfigVariables.add(cv);
          (deviceConfigSlaves.last['configVariables'] as List).add(cv);
        }
      }
    }

    deviceTimestamps = devices.map((d) => {
          'id': 'dts-${d['id']}',
          'deviceId': d['id'],
          'deviceName': d['name'],
          'lastDataReceivedAt': d['lastDataReceivedAt'],
          'lastAlarmAt': DummyHelpers.iso(DateTime.now().subtract(const Duration(days: 1))),
          'organizationId': orgId,
        }).toList();

    notifications = List.generate(12, (i) {
      final dev = devices[i % devices.length];
      return {
        'id': 'notif-$i',
        'organizationId': orgId,
        'deviceId': dev['id'],
        'deviceName': dev['name'],
        'triggerName': i.isEven ? 'Overvoltage Alert' : 'Low Power Factor',
        'description': 'Threshold breached on ${dev['name']}',
        'read': i > 3,
        'createdAt': DummyHelpers.iso(DateTime.now().subtract(Duration(hours: i * 2))),
      };
    });

    scheduledTasks = List.generate(5, (i) {
      final dev = devices[i % devices.length];
      final slave = deviceConfigSlaves.isNotEmpty
          ? deviceConfigSlaves[i % deviceConfigSlaves.length]
          : null;
      return {
        'id': 'task-$i',
        'name': 'Scheduled Report ${i + 1}',
        'deviceId': dev['id'],
        'device': {'id': dev['id'], 'name': dev['name']},
        'deviceConfigSlaveId': slave?['id'],
        'variableName': 'PowerConsumption',
        'cronExpression': '0 ${8 + i} * * *',
        'scheduledTime': '${8 + i}:00',
        'repeatType': i.isEven ? 'DAILY' : 'WEEKLY',
        'action': i == 2 ? 'OFF' : 'ON',
        'status': i == 2 ? 'INACTIVE' : 'ACTIVE',
        'enabled': i != 2,
        'organizationId': orgId,
        'lastRunAt': DummyHelpers.iso(DateTime.now().subtract(Duration(days: i))),
      };
    });

    taskLogs = List.generate(8, (i) => {
          'id': 'tlog-$i',
          'scheduledTaskId': 'task-0',
          'status': i.isEven ? 'SUCCESS' : 'FAILED',
          'message': i.isEven ? 'Report generated' : 'Device offline',
          'executedAt': DummyHelpers.iso(DateTime.now().subtract(Duration(hours: i * 6))),
        });

    slabRates = List.generate(3, (i) {
      final slaveId = deviceConfigSlaves[i]['id'];
      return {
        'id': 'slab-$i',
        'deviceConfigSlaveId': slaveId,
        'name': 'Tier ${i + 1}',
        'unitFrom': i * 100.0,
        'unitTo': (i + 1) * 100.0,
        'rate': 15.0 + i * 2,
        'onPeakRate': 18.0 + i * 2,
        'offPeakRate': 12.0 + i * 2,
        'organizationId': orgId,
      };
    });

    intervalHistory = List.generate(15, (i) {
      final dev = devices[i % devices.length];
      final slave = deviceConfigSlaves[i % deviceConfigSlaves.length];
      final start = DateTime.now().subtract(Duration(days: i + 1));
      final end = DateTime.now().subtract(Duration(days: i));
      return {
        'id': 'int-$i',
        'deviceId': dev['id'],
        'deviceName': dev['name'],
        'slaveName': slave['name'],
        'variableName': 'PowerConsumption',
        'totalUnit': 120.0 + i * 5,
        'tariff': 1800.0 + i * 50,
        'startDate': DummyHelpers.iso(start),
        'endDate': DummyHelpers.iso(end),
        'startTime': DummyHelpers.iso(start),
        'endTime': DummyHelpers.iso(end),
        'consumptionKwh': 120.0 + i * 5,
        'cost': 1800.0 + i * 50,
        'organizationId': orgId,
      };
    });

    alarmTemplates = List.generate(4, (i) {
      final tpl = deviceTemplates[i % deviceTemplates.length];
      return {
        'id': 'atpl-$i',
        'name': ['Overvoltage', 'Undervoltage', 'Overload', 'Low PF'][i],
        'triggerType': ['overvoltage', 'undervoltage', 'overload', 'low_power_factor'][i],
        'anomalyType': ['overvoltage', 'undervoltage', 'overload', 'low_power_factor'][i],
        'variableName': ['VoltageA', 'VoltageA', 'CurrentA', 'PowerFactor'][i],
        'operator': 'GT',
        'threshold': [240.0, 200.0, 50.0, 0.85][i],
        'priority': i == 0 ? 'HIGH' : 'MEDIUM',
        'isActive': true,
        'deviceTemplateId': tpl['id'],
        'templateVariableId': 'tvar-tpl-${(i % deviceTemplates.length) + 1}-0-0',
        'deviceTemplate': {'id': tpl['id'], 'name': tpl['name']},
        'watchedVariable': {'id': 'tvar-demo-$i', 'name': ['VoltageA', 'VoltageA', 'CurrentA', 'PowerFactor'][i]},
        'updatedAt': DummyHelpers.iso(DateTime.now().subtract(Duration(days: i * 3))),
        'organizationId': orgId,
      };
    });

    alarmContacts = DummyData.alarmContacts.asMap().entries.map((e) {
      final c = e.value;
      final method = c['method'] as String? ?? 'Email';
      return {
        'id': 'ac-${e.key + 1}',
        'name': c['name'],
        'email': c['email'],
        'mobile': c['phone'],
        'phone': c['phone'],
        'whatsapp': method.contains('SMS') ? c['phone'] : '',
        'remark': method,
        'notifyEmail': method.contains('Email'),
        'notifySms': method.contains('SMS'),
        'status': c['status'] == 'Active' ? 'ACTIVE' : 'INACTIVE',
        'organizationId': orgId,
      };
    }).toList();

    alarmSettings = List.generate(2, (i) => {
          'id': 'aset-$i',
          'name': 'Email Alert ${i + 1}',
          'pushType': 'email',
          'status': 'ACTIVE',
          'enabled': true,
          'createdAt': DummyHelpers.iso(DateTime.now().subtract(Duration(days: i * 5))),
          'organizationId': orgId,
        });

    anomalies = List.generate(25, (i) {
      final dev = devices[i % devices.length];
      return {
        'id': 'anom-$i',
        'deviceId': dev['id'],
        'deviceName': dev['name'],
        'variableName': 'VoltageA',
        'triggerType': ['overvoltage', 'low_power_factor', 'overload'][i % 3],
        'currentValue': 245.0 + i,
        'operator': 'GT',
        'threshold': 240.0,
        'alarmState': i > 15 ? 'RESOLVED' : 'ACTIVE',
        'processState': i > 10 ? 'PROCESSED' : 'UNPROCESSED',
        'alarmTime': DummyHelpers.iso(DateTime.now().subtract(Duration(hours: i * 3))),
        'acknowledged': i > 10,
        'organizationId': orgId,
      };
    });

    products = DummyData.products.asMap().entries.map((e) {
      final p = e.value;
      return {
        'id': 'prod-${e.key + 1}',
        'name': p['name'],
        'category': p['category'],
        'price': p['price'],
        'stock': p['stock'],
        'status': p['status'],
        'description': p['description'],
        'organizationId': orgId,
      };
    }).toList();

    widgetTemplates = List.generate(3, (i) => {
          'id': 'wtpl-$i',
          'name': ['Power KPI', 'Voltage Chart', 'PF Gauge'][i],
          'displayName': ['Total Power', 'Voltage Trend', 'Power Factor'][i],
          'variableName': ['PowerConsumption', 'VoltageA', 'PowerFactor'][i],
          'unit': ['kWh', 'V', ''][i],
          'widgetType': ['metric', 'line_chart', 'gauge'][i],
          'position': i,
          'config': {'color': '#4A90D9'},
          'organizationId': orgId,
        });

    variableAlarms = List.generate(20, (i) {
      final dev = devices[i % devices.length];
      return {
        'id': 'va-$i',
        'deviceId': dev['id'],
        'deviceName': dev['name'],
        'variableName': 'VoltageA',
        'triggerType': 'overvoltage',
        'alarmTime': DummyHelpers.iso(DateTime.now().subtract(Duration(hours: i * 4))),
        'currentValue': 245.0,
        'alarmState': 'ACTIVE',
        'processState': i > 8 ? 'PROCESSED' : 'UNPROCESSED',
        'organizationId': orgId,
      };
    });

    linkageRecords = List.generate(10, (i) {
      final dev = devices[i % devices.length];
      return {
        'id': 'lnk-$i',
        'deviceId': dev['id'],
        'deviceName': dev['name'],
        'action': 'SWITCH_OFF',
        'triggerType': 'overvoltage',
        'executedAt': DummyHelpers.iso(DateTime.now().subtract(Duration(days: i))),
        'organizationId': orgId,
      };
    });

    alarmNotifications = List.generate(8, (i) {
      final dev = devices[i % devices.length];
      return {
        'id': 'ahn-$i',
        'deviceId': dev['id'],
        'deviceName': dev['name'],
        'channel': 'email',
        'recipient': demoOrgAdminEmail,
        'sentAt': DummyHelpers.iso(DateTime.now().subtract(Duration(hours: i * 5))),
        'organizationId': orgId,
      };
    });

    deviceUserLinks = [
      // Demo USER (usr-1) only sees these two devices
      {'deviceId': 'dev-1', 'userId': 'usr-1'},
      {'deviceId': 'dev-2', 'userId': 'usr-1'},
    ];
  }

  Map<String, dynamic> _user(String id, String fullName, String email, String role, String status) => {
        'id': id,
        'fullName': fullName,
        'email': email,
        'role': role,
        'status': status,
        'organizationId': orgId,
        'organization': {'id': orgId, 'name': organization['name']},
        'lastLoginAt': DummyHelpers.iso(),
        'updatedAt': DummyHelpers.iso(),
      };

  String _uiRoleToApi(String role) {
    switch (role) {
      case 'Admin':
        return 'ORG_ADMIN';
      case 'Viewer':
      case 'Operator':
      case 'Manager':
        return 'USER';
      default:
        return 'USER';
    }
  }

  String _defaultVarValue(String name) {
    switch (name) {
      case 'VoltageA':
        return '${DummyData.voltageA}';
      case 'VoltageB':
        return '${DummyData.voltageB}';
      case 'VoltageC':
        return '${DummyData.voltageC}';
      case 'CurrentA':
        return '${DummyData.currentA}';
      case 'CurrentB':
        return '${DummyData.currentB}';
      case 'CurrentC':
        return '${DummyData.currentC}';
      case 'PowerConsumption':
        return '${DummyData.powerConsumption}';
      case 'PowerFactor':
        return '${DummyData.powerFactor}';
      case 'VoltageImbalance':
        return '${DummyData.voltageImbalancePct}';
      case 'CurrentImbalance':
        return '${DummyData.currentImbalanceVal}';
      default:
        return '0';
    }
  }

  Map<String, dynamic>? findUserByEmail(String email) {
    final lower = email.trim().toLowerCase();
    for (final u in users) {
      if ((u['email'] as String).toLowerCase() == lower) return u;
    }
    return null;
  }

  Map<String, dynamic>? findDevice(String id) {
    for (final d in devices) {
      if (d['id'] == id) return d;
    }
    return null;
  }

  bool get isOrgAdmin => currentUser?['role'] == 'ORG_ADMIN';
  bool get isUser => currentUser?['role'] == 'USER';

  /// Devices visible to the logged-in user (USER = assigned only).
  List<Map<String, dynamic>> visibleDevices() {
    if (currentUser == null) return [];
    if (isOrgAdmin) return devices.map(DummyHelpers.clone).toList();
    final userId = currentUser!['id'] as String;
    final assigned = deviceUserLinks
        .where((l) => l['userId'] == userId)
        .map((l) => l['deviceId'] as String)
        .toSet();
    return devices
        .where((d) => assigned.contains(d['id']))
        .map(DummyHelpers.clone)
        .toList();
  }

  bool canAccessDevice(String deviceId) {
    if (currentUser == null) return false;
    if (isOrgAdmin) return findDevice(deviceId) != null;
    final userId = currentUser!['id'] as String;
    return deviceUserLinks.any((l) => l['userId'] == userId && l['deviceId'] == deviceId);
  }

  List<Map<String, dynamic>> deviceConfigFor(String deviceId) {
    return deviceConfigSlaves
        .where((s) => s['deviceId'] == deviceId)
        .map((s) => DummyHelpers.clone(s))
        .toList();
  }

  int unreadNotificationCount() => notifications.where((n) => n['read'] != true).length;
}
