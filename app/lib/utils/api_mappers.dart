import 'package:intl/intl.dart';

class ApiMappers {
  static String fmtDate(dynamic value) {
    if (value == null) return '—';
    try {
      final dt = DateTime.parse(value.toString()).toLocal();
      return DateFormat('yyyy-MM-dd HH:mm').format(dt);
    } catch (_) {
      return value.toString();
    }
  }

  static String deviceStatus(dynamic status) =>
      status == 'ONLINE' ? 'Online' : 'Offline';

  static String userStatus(dynamic status) {
    switch (status) {
      case 'ACTIVE':
        return 'Active';
      case 'INACTIVE':
        return 'Inactive';
      case 'DELETED':
        return 'Deleted';
      default:
        return status?.toString() ?? '—';
    }
  }

  static String userRole(dynamic role) {
    switch (role) {
      case 'ORG_ADMIN':
        return 'Org Admin';
      case 'USER':
        return 'User';
      default:
        return role?.toString() ?? '—';
    }
  }

  static Map<String, dynamic> device(Map<String, dynamic> d) => {
        'id': d['id'],
        'name': d['name'] ?? '—',
        'gateway': d['gateway']?['name'] ?? '—',
        'template': d['template']?['name'] ?? '—',
        'status': deviceStatus(d['status']),
        'lastSeen': fmtDate(d['lastDataReceivedAt']),
        'org': d['organization']?['name'] ?? '—',
        'slave': '—',
        'serialNo': (d['id'] as String?) == null ? '—' : (d['id'] as String).substring(0, (d['id'] as String).length.clamp(0, 8)).toUpperCase(),
        'ipAddress': d['gateway']?['model']?.toString() ?? '—',
        'powerKwh': 0.0,
        'powerFactor': '—',
        'anomalies': 0,
        'switchState': d['switchState'] ?? 'OFF',
        'templateId': d['templateId'],
        'gatewayId': d['gatewayId'],
        'raw': d,
      };

  /// Merge dashboard summary metrics into a mapped device row.
  static Map<String, dynamic> enrichDevice(
    Map<String, dynamic> device,
    Map<String, dynamic>? summary,
  ) {
    final m = Map<String, dynamic>.from(device);
    if (summary == null) return m;

    double metricVal(String key) {
      final block = summary[key];
      if (block is Map && block['value'] != null) {
        return double.tryParse(block['value'].toString()) ?? 0;
      }
      return 0;
    }

    m['powerKwh'] = metricVal('totalPowerConsumption');
    m['powerFactor'] = metricVal('powerFactor').toStringAsFixed(2);
    final anomalies = summary['anomalies'];
    if (anomalies is Map) {
      m['anomalies'] = (anomalies['count'] as num?)?.toInt() ?? 0;
    }
    return m;
  }

  /// Parse GET /sensor-data/latest `data` object: { VarName: { value, unit } }.
  static String latestReading(Map<String, dynamic>? data, String key, {int decimals = 2}) {
    if (data == null) return '—';
    final entry = data[key];
    if (entry is Map && entry['value'] != null) {
      final v = double.tryParse(entry['value'].toString()) ?? 0;
      return v.toStringAsFixed(decimals);
    }
    if (entry != null) {
      final v = double.tryParse(entry.toString());
      if (v != null) return v.toStringAsFixed(decimals);
    }
    return '—';
  }

  static double latestReadingNum(Map<String, dynamic>? data, String key) {
    if (data == null) return 0;
    final entry = data[key];
    if (entry is Map && entry['value'] != null) {
      return double.tryParse(entry['value'].toString()) ?? 0;
    }
    return double.tryParse('$entry') ?? 0;
  }

  static double summaryMetric(Map<String, dynamic>? summary, String key) {
    if (summary == null) return 0;
    final block = summary[key];
    if (block is Map && block['value'] != null) {
      return double.tryParse(block['value'].toString()) ?? 0;
    }
    return 0;
  }

  static Map<String, dynamic> savingsBlock(Map<String, dynamic>? summary, String period) {
    final esc = summary?['energySavingsComparison'];
    if (esc is Map && esc[period] is Map) {
      return Map<String, dynamic>.from(esc[period] as Map);
    }
    return {};
  }

  static Map<String, dynamic> gateway(Map<String, dynamic> g, {int devices = 0}) => {
        'id': g['id'],
        'name': g['name'] ?? '—',
        'ipAddress': g['model'] ?? '—',
        'status': deviceStatus(g['status']),
        'devices': devices,
        'location': g['organization']?['name'] ?? '—',
        'lastSeen': fmtDate(g['lastSeenAt']),
        'serialNo': g['serialNumber'] ?? '—',
        'raw': g,
      };

  static Map<String, dynamic> user(Map<String, dynamic> u) => {
        'id': u['id'],
        'name': u['fullName'] ?? '—',
        'email': u['email'] ?? '—',
        'role': userRole(u['role']),
        'roleRaw': u['role'],
        'status': userStatus(u['status']),
        'statusRaw': u['status'],
        'lastLogin': fmtDate(u['updatedAt']),
        'phone': u['phone'],
        'raw': u,
      };

  static Map<String, dynamic> deviceTemplate(Map<String, dynamic> t) => {
        'id': t['id'],
        'name': t['name'] ?? '—',
        'slaves': t['totalSlaves'] ?? t['_count']?['slaves'] ?? 0,
        'variables': t['totalVariables'] ?? 0,
        'protocol': t['acquisitionMethod'] ?? '—',
        'updatedAt': fmtDate(t['updatedAt']).split(' ').first,
        'raw': t,
      };

  static Map<String, dynamic> alarmContact(Map<String, dynamic> c) {
    final hasWhatsapp = c['whatsapp'] != null && c['whatsapp'].toString().isNotEmpty;
    final method = c['remark']?.toString().isNotEmpty == true
        ? c['remark'].toString()
        : (hasWhatsapp ? 'Email + SMS' : 'Email');
    return {
      'id': c['id'],
      'name': c['name'] ?? '—',
      'email': c['email'] ?? '—',
      'phone': c['mobile'] ?? '—',
      'mobile': c['mobile'] ?? '—',
      'whatsapp': c['whatsapp'] ?? '—',
      'remark': c['remark'] ?? '—',
      'method': method,
      'status': 'Active',
      'raw': c,
    };
  }

  static Map<String, dynamic> notification(Map<String, dynamic> n) => {
        'id': n['id'],
        'trigger': n['triggerName'] ?? '—',
        'device': n['deviceName'] ?? '—',
        'desc': n['description'] ?? '—',
        'time': fmtDate(n['createdAt']),
        'severity': n['read'] == true ? 'Info' : 'Warning',
        'read': n['read'] == true,
        'raw': n,
      };

  static Map<String, dynamic> scheduledTask(Map<String, dynamic> t) => {
        'id': t['id'],
        'deviceId': t['deviceId'],
        'slave': t['device']?['name'] ?? t['deviceConfigSlaveId']?.toString().substring(0, 8) ?? '—',
        'variable': t['variableName'] ?? '—',
        'action': t['action'] == 'OFF' ? 'Alert' : 'Control',
        'time': t['scheduledTime'] ?? '—',
        'repeat': _repeatLabel(t['repeatType']),
        'status': t['status'] == 'ACTIVE' ? 'Active' : 'Inactive',
        'raw': t,
      };

  static String _repeatLabel(dynamic v) {
    switch (v) {
      case 'DAILY':
        return 'Daily';
      case 'WEEKLY':
        return 'Weekly';
      case 'ONCE':
        return 'Once';
      default:
        return v?.toString() ?? 'Daily';
    }
  }

  static Map<String, dynamic> slabRate(Map<String, dynamic> s) => {
        'id': s['id'],
        'slave': s['deviceConfigSlaveId']?.toString().substring(0, 8) ?? '—',
        'slaveId': s['deviceConfigSlaveId'],
        'from': s['unitFrom']?.toString() ?? '0',
        'to': s['unitTo']?.toString() ?? '0',
        'rate': s['rate']?.toString() ?? '0',
        'onPeak': s['onPeakRate']?.toString() ?? '—',
        'offPeak': s['offPeakRate']?.toString() ?? '—',
        'raw': s,
      };

  static Map<String, dynamic> intervalHistory(Map<String, dynamic> h) => {
        'id': h['id'],
        'slave': h['slaveName'] ?? '—',
        'variable': h['variableName'] ?? '—',
        'unit': h['totalUnit']?.toString() ?? '0',
        'totalUnit': h['totalUnit']?.toString() ?? '0',
        'tariff': h['tariff']?.toString() ?? '0',
        'start': fmtDate(h['startDate']).split(' ').first,
        'end': fmtDate(h['endDate']).split(' ').first,
        'raw': h,
      };

  static String _priorityLabel(dynamic p) {
    switch (p) {
      case 'HIGH':
        return 'Critical';
      case 'LOW':
        return 'Info';
      default:
        return 'Warning';
    }
  }

  static Map<String, dynamic> alarmTemplate(Map<String, dynamic> t) => {
        'id': t['id'],
        'name': t['name'] ?? '—',
        'trigger': t['name'] ?? '—',
        'template': t['deviceTemplate']?['name'] ?? '—',
        'variable': t['watchedVariable']?['name'] ?? t['templateVariable']?['name'] ?? '—',
        'deviceTemplateId': t['deviceTemplateId'] ?? t['deviceTemplate']?['id'],
        'templateVariableId': t['templateVariableId'] ?? t['watchedVariable']?['id'],
        'condition': t['operator'] ?? '—',
        'operator': t['operator'] ?? '—',
        'threshold': t['threshold']?.toString() ?? '—',
        'severity': _priorityLabel(t['priority']),
        'type': t['anomalyType'] ?? '—',
        'priority': t['priority'] ?? 'MEDIUM',
        'updated': fmtDate(t['updatedAt']),
        'status': t['isActive'] == true ? 'Active' : 'Inactive',
        'raw': t,
      };

  static Map<String, dynamic> product(Map<String, dynamic> p) => {
        'id': p['id'],
        'name': p['name'] ?? '—',
        'description': p['description'] ?? '',
        'price': p['price']?.toString() ?? '0',
        'imageUrl': p['imageUrl'],
        'raw': p,
      };

  static Map<String, dynamic> anomaly(Map<String, dynamic> a) => {
        'id': a['id'],
        'variable': a['variableName'] ?? '—',
        'type': a['triggerType'] ?? 'custom',
        'value': a['currentValue']?.toString() ?? '—',
        'time': fmtDate(a['alarmTime']),
        'status': a['processState'] == 'PROCESSED' ? 'Processed' : 'Open',
        'raw': a,
      };

  static List<double> chartValues(List<dynamic>? points, {String valueKey = 'value'}) {
    if (points == null || points.isEmpty) return [];
    return points
        .map((p) {
          final v = p is Map ? p[valueKey] ?? p['predictedValue'] : p;
          return (v is num) ? v.toDouble() : double.tryParse('$v') ?? 0;
        })
        .toList();
  }
}
