import '../services/ems_api.dart';

/// Shared helpers for device config slaves / variables across forms.
class DeviceHelpers {
  DeviceHelpers._();

  static List<Map<String, dynamic>> flattenVariables(List<Map<String, dynamic>> slaves) {
    final vars = <Map<String, dynamic>>[];
    for (final slave in slaves) {
      final list = slave['configVariables'] ?? slave['variables'];
      if (list is List) {
        for (final v in list) {
          if (v is Map) vars.add(Map<String, dynamic>.from(v));
        }
      }
    }
    return vars;
  }

  /// All config slaves across org devices, with display label.
  static Future<List<Map<String, dynamic>>> loadAllSlaves() async {
    final devices = await EmsApi.instance.getDevices();
    final slaves = <Map<String, dynamic>>[];
    for (final d in devices) {
      final deviceId = d['id'] as String?;
      if (deviceId == null) continue;
      try {
        final config = await EmsApi.instance.getDeviceConfig(deviceId);
        for (final s in config) {
          final slave = Map<String, dynamic>.from(s);
          slave['deviceId'] = deviceId;
          slave['deviceName'] = d['name'];
          slave['label'] = '${d['name']} · ${s['name']}';
          slaves.add(slave);
        }
      } catch (_) {}
    }
    return slaves;
  }
}
