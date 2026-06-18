import 'dart:async';

import 'package:flutter/foundation.dart';

import 'ems_api.dart';

/// Shared app state: selected device for dashboard / AI analytics.
class AppState extends ChangeNotifier {
  AppState._();
  static final AppState instance = AppState._();

  List<Map<String, dynamic>> devices = [];
  String? selectedDeviceId;
  String? selectedSlaveId;
  List<Map<String, dynamic>> configSlaves = [];

  Map<String, dynamic> liveReadings = {};
  List<Map<String, dynamic>> liveAlarms = [];

  Timer? _notifyDebounce;

  String? get selectedDeviceName {
    if (selectedDeviceId == null) return null;
    final match = devices.where((d) => d['id'] == selectedDeviceId);
    if (match.isEmpty) return null;
    return match.first['name'] as String?;
  }

  Future<void> loadDevices() async {
    devices = await EmsApi.instance.getDevices();
    if (devices.isNotEmpty && selectedDeviceId == null) {
      selectedDeviceId = devices.first['id'] as String?;
      await loadSlavesForSelected();
    }
    notifyListeners();
  }

  Future<void> selectDevice(String? deviceId) async {
    selectedDeviceId = deviceId;
    selectedSlaveId = null;
    await loadSlavesForSelected();
    notifyListeners();
  }

  Future<void> loadSlavesForSelected() async {
    if (selectedDeviceId == null) {
      configSlaves = [];
      return;
    }
    configSlaves = await EmsApi.instance.getDeviceConfig(selectedDeviceId!);
    if (configSlaves.isNotEmpty && selectedSlaveId == null) {
      selectedSlaveId = configSlaves.first['id'] as String?;
    }
  }

  void selectSlave(String? slaveId) {
    selectedSlaveId = slaveId;
    notifyListeners();
  }

  /// P-46: debounce high-frequency socket updates to ~1 rebuild/sec max.
  void _debouncedNotify() {
    _notifyDebounce?.cancel();
    _notifyDebounce = Timer(const Duration(milliseconds: 800), notifyListeners);
  }

  void onLiveReading(Map<String, dynamic> data) {
    final deviceId = data['deviceId'] as String?;
    if (deviceId == null) return;
    liveReadings[deviceId] = data;
    _debouncedNotify();
  }

  void onLiveAlarm(Map<String, dynamic> data) {
    liveAlarms.insert(0, data);
    if (liveAlarms.length > 50) liveAlarms.removeLast();
    notifyListeners();
  }

  void onDeviceSwitch(Map<String, dynamic> data) {
    final deviceId = data['deviceId'] as String?;
    if (deviceId == null) return;
    final idx = devices.indexWhere((d) => d['id'] == deviceId);
    if (idx != -1) {
      devices[idx] = Map<String, dynamic>.from(devices[idx])
        ..['switchState'] = data['action'];
      notifyListeners();
    }
  }
}
