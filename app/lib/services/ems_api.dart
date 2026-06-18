import '../models/app_user.dart';
import '../utils/api_mappers.dart';
import 'api_client.dart';
import 'auth_service.dart';
import 'cache_service.dart';

class EmsApi {
  EmsApi._();
  static final EmsApi instance = EmsApi._();

  final _api = ApiClient.instance;

  List<Map<String, dynamic>> _list(Map<String, dynamic> res) {
    final data = res['data'];
    if (data is List) {
      return data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    return [];
  }

  Map<String, dynamic>? _obj(Map<String, dynamic> res) {
    final data = res['data'];
    if (data is Map) return Map<String, dynamic>.from(data);
    return null;
  }

  Future<AppUser> fetchMe() async {
    final res = await _api.get('/auth/me');
    return AppUser.fromJson(Map<String, dynamic>.from(res['data'] as Map));
  }

  // ─── Devices ───────────────────────────────────────────────────────────────
  Future<List<Map<String, dynamic>>> getDevices({String? search, String? status}) async {
    final query = <String, String>{'limit': '100'};
    if (search != null && search.isNotEmpty) query['search'] = search;
    if (status != null && status != 'All') {
      query['status'] = status == 'Online' ? 'ONLINE' : 'OFFLINE';
    }
    // Return cached data if available and no filters applied
    if (search == null && status == null) {
      final cached = await CacheService.instance.getList(kDevicesCache);
      if (cached != null && cached.isNotEmpty) {
        // Refresh cache in background
        _api.get('/devices', query: query).then((res) {
          final result = _list(res);
          if (result.isNotEmpty) {
            CacheService.instance.setList(kDevicesCache, result);
          }
        }).catchError((_) {});
        return cached;
      }
    }
    final result = _list(await _api.get('/devices', query: query));
    if (search == null && status == null && result.isNotEmpty) {
      await CacheService.instance.setList(kDevicesCache, result);
    }
    return result;
  }

  /// Devices mapped for UI with optional per-device dashboard metrics.
  Future<List<Map<String, dynamic>>> getDevicesForUi({
    String? search,
    String? status,
    bool withMetrics = true,
  }) async {
    final raw = await getDevices(search: search, status: status);
    final mapped = raw.map(ApiMappers.device).toList();
    if (!withMetrics) return mapped;

    final enriched = await Future.wait(mapped.map((d) async {
      final id = d['id'] as String?;
      if (id == null || d['status'] != 'Online') return d;
      try {
        final res = await getDashboardSummary(deviceId: id, timeRange: '24h');
        return ApiMappers.enrichDevice(d, Map<String, dynamic>.from(res['data'] as Map? ?? {}));
      } catch (_) {
        return d;
      }
    }));
    return enriched;
  }

  Future<Map<String, dynamic>> getDevice(String id) async {
    return Map<String, dynamic>.from(
      (_obj(await _api.get('/devices/$id')) ?? {}),
    );
  }

  Future<Map<String, dynamic>> createDevice(Map<String, dynamic> body) async {
    return Map<String, dynamic>.from(
      (_obj(await _api.post('/devices', body: body)) ?? {}),
    );
  }

  Future<Map<String, dynamic>> updateDevice(String id, Map<String, dynamic> body) async {
    return Map<String, dynamic>.from(
      (_obj(await _api.put('/devices/$id', body: body)) ?? {}),
    );
  }

  Future<void> deleteDevice(String id) async {
    await _api.delete('/devices/$id');
  }

  Future<List<Map<String, dynamic>>> getDeviceConfig(String deviceId) async {
    return _list(await _api.get('/devices/$deviceId/config'));
  }

  Future<Map<String, dynamic>> getLatestSensorData({
    required String deviceId,
    String? slaveId,
  }) async {
    final query = <String, String>{'deviceId': deviceId};
    if (slaveId != null) query['slaveId'] = slaveId;
    return await _api.get('/sensor-data/latest', query: query);
  }

  Future<Map<String, dynamic>> getDashboardSummary({
    required String deviceId,
    String? slaveId,
    String timeRange = '24h',
  }) async {
    final query = <String, String>{
      'deviceId': deviceId,
      'timeRange': timeRange,
    };
    if (slaveId != null) query['slaveId'] = slaveId;
    return await _api.get('/sensor-data/dashboard-summary', query: query);
  }

  Future<Map<String, dynamic>> getSensorDataHistory({
    required String deviceId,
    String? slaveId,
    String timeRange = '24h',
    int page = 1,
    int limit = 50,
  }) async {
    final query = <String, String>{
      'deviceId': deviceId,
      'timeRange': timeRange,
      'page': '$page',
      'limit': '$limit',
    };
    if (slaveId != null) query['slaveId'] = slaveId;
    return await _api.get('/sensor-data/readings', query: query);
  }

  // ─── Users ───────────────────────────────────────────────────────────────
  Future<List<Map<String, dynamic>>> getUsers({String? search}) async {
    final query = <String, String>{'limit': '100'};
    if (search != null && search.isNotEmpty) query['search'] = search;
    return _list(await _api.get('/users', query: query));
  }

  Future<Map<String, dynamic>> createUser(Map<String, dynamic> body) async {
    return Map<String, dynamic>.from((_obj(await _api.post('/users', body: body)) ?? {}));
  }

  Future<Map<String, dynamic>> updateUser(String id, Map<String, dynamic> body) async {
    return Map<String, dynamic>.from((_obj(await _api.put('/users/$id', body: body)) ?? {}));
  }

  Future<void> updateUserStatus(String id, String status) async {
    await _api.patch('/users/$id/status', body: {'status': status});
  }

  Future<void> resetUserPassword(String id, String newPassword) async {
    await _api.post('/users/$id/reset-password', body: {'newPassword': newPassword});
  }

  // ─── Gateways ────────────────────────────────────────────────────────────
  Future<List<Map<String, dynamic>>> getGateways() async {
    return _list(await _api.get('/gateways', query: {'limit': '100'}));
  }

  Future<Map<String, dynamic>> createGateway(Map<String, dynamic> body) async {
    return Map<String, dynamic>.from((_obj(await _api.post('/gateways', body: body)) ?? {}));
  }

  Future<Map<String, dynamic>> updateGateway(String id, Map<String, dynamic> body) async {
    return Map<String, dynamic>.from((_obj(await _api.put('/gateways/$id', body: body)) ?? {}));
  }

  Future<void> deleteGateway(String id) async {
    await _api.delete('/gateways/$id');
  }

  // ─── Device Templates ────────────────────────────────────────────────────
  Future<List<Map<String, dynamic>>> getDeviceTemplates() async {
    return _list(await _api.get('/device-templates', query: {'limit': '100'}));
  }

  Future<Map<String, dynamic>> getDeviceTemplate(String id) async {
    return Map<String, dynamic>.from(
      (_obj(await _api.get('/device-templates/$id')) ?? {}),
    );
  }

  Future<Map<String, dynamic>> createDeviceTemplate(Map<String, dynamic> body) async {
    return Map<String, dynamic>.from(
      (_obj(await _api.post('/device-templates', body: body)) ?? {}),
    );
  }

  Future<Map<String, dynamic>> updateDeviceTemplate(String id, Map<String, dynamic> body) async {
    return Map<String, dynamic>.from(
      (_obj(await _api.put('/device-templates/$id', body: body)) ?? {}),
    );
  }

  Future<void> deleteDeviceTemplate(String id) async {
    await _api.delete('/device-templates/$id');
  }

  // ─── Organization ────────────────────────────────────────────────────────
  Future<Map<String, dynamic>> getMyOrganization() async {
    return Map<String, dynamic>.from((_obj(await _api.get('/organizations/me')) ?? {}));
  }

  Future<Map<String, dynamic>> updateMyOrganization(Map<String, dynamic> body) async {
    return Map<String, dynamic>.from(
      (_obj(await _api.put('/organizations/me', body: body)) ?? {}),
    );
  }

  // ─── Notifications ───────────────────────────────────────────────────────
  Future<List<Map<String, dynamic>>> getNotifications({int page = 1, int limit = 30}) async {
    final res = await _api.get('/notifications', query: {
      'page': '$page',
      'limit': '$limit',
    });
    return _list(res);
  }

  Future<Map<String, dynamic>> getNotificationsPage({int page = 1, int limit = 30}) async {
    final res = await _api.get('/notifications', query: {
      'page': '$page',
      'limit': '$limit',
    });
    return {
      'items': _list(res),
      'total': (res['total'] as num?)?.toInt() ?? 0,
      'pages': (res['pages'] as num?)?.toInt() ?? 1,
      'page': (res['page'] as num?)?.toInt() ?? page,
    };
  }

  Future<int> getUnreadNotificationCount() async {
    final res = await _api.get('/notifications', query: {'limit': '1'});
    return (res['unreadCount'] as num?)?.toInt() ?? 0;
  }

  Future<void> deleteNotification(String id) async {
    await _api.delete('/notifications/$id');
  }

  Future<void> deleteAllNotifications() async {
    await _api.delete('/notifications');
  }

  Future<void> markNotificationRead(String id) async {
    await _api.patch('/notifications/$id/read');
  }

  Future<void> markAllNotificationsRead() async {
    await _api.patch('/notifications/read-all');
  }

  Future<String> buildNotificationsCsv(List<Map<String, dynamic>> notifications) {
    final sb = StringBuffer();
    sb.writeln('Title,Device,Description,Read,CreatedAt');
    for (final n in notifications) {
      final raw = n['raw'] as Map<String, dynamic>? ?? n;
      sb.writeln('"${raw['triggerName'] ?? ''}", "${raw['deviceName'] ?? ''}", "${raw['description'] ?? ''}", "${raw['read']}", "${raw['createdAt'] ?? ''}"');
    }
    return Future.value(sb.toString());
  }

  // ─── Scheduled Tasks ─────────────────────────────────────────────────────
  Future<List<Map<String, dynamic>>> getScheduledTasks({String? deviceId}) async {
    final q = <String, String>{'limit': '100'};
    if (deviceId != null) q['deviceId'] = deviceId;
    return _list(await _api.get('/scheduled-tasks', query: q));
  }

  Future<Map<String, dynamic>> createScheduledTask(Map<String, dynamic> body) async {
    return Map<String, dynamic>.from(
      (_obj(await _api.post('/scheduled-tasks', body: body)) ?? {}),
    );
  }

  Future<Map<String, dynamic>> updateScheduledTask(String id, Map<String, dynamic> body) async {
    return Map<String, dynamic>.from(
      (_obj(await _api.put('/scheduled-tasks/$id', body: body)) ?? {}),
    );
  }

  Future<void> deleteScheduledTask(String id) async {
    await _api.delete('/scheduled-tasks/$id');
  }

  Future<void> toggleScheduledTask(String id) async {
    await _api.patch('/scheduled-tasks/$id/toggle');
  }

  // ─── Slab Rates & Interval History ───────────────────────────────────────
  Future<List<Map<String, dynamic>>> getSlabRates({String? slaveId}) async {
    final q = <String, String>{'limit': '100'};
    if (slaveId != null) q['deviceConfigSlaveId'] = slaveId;
    return _list(await _api.get('/slab-rates', query: q));
  }

  Future<Map<String, dynamic>> createSlabRate(Map<String, dynamic> body) async {
    return Map<String, dynamic>.from((_obj(await _api.post('/slab-rates', body: body)) ?? {}));
  }

  Future<Map<String, dynamic>> updateSlabRate(String id, Map<String, dynamic> body) async {
    return Map<String, dynamic>.from(
      (_obj(await _api.put('/slab-rates/$id', body: body)) ?? {}),
    );
  }

  Future<void> deleteSlabRate(String id) async {
    await _api.delete('/slab-rates/$id');
  }

  Future<Map<String, dynamic>> getIntervalHistoryPage({int page = 1, int limit = 30}) async {
    final res = await _api.get('/interval-history', query: {
      'page': '$page',
      'limit': '$limit',
    });
    return {
      'items': _list(res),
      'total': (res['total'] as num?)?.toInt() ?? 0,
      'pages': (res['pages'] as num?)?.toInt() ?? 1,
      'page': (res['page'] as num?)?.toInt() ?? page,
    };
  }

  Future<List<Map<String, dynamic>>> getIntervalHistory({int page = 1, int limit = 30}) async {
    final res = await getIntervalHistoryPage(page: page, limit: limit);
    return List<Map<String, dynamic>>.from(res['items'] as List);
  }

  Future<Map<String, dynamic>> createIntervalHistory(Map<String, dynamic> body) async {
    return Map<String, dynamic>.from(
      (_obj(await _api.post('/interval-history', body: body)) ?? {}),
    );
  }

  Future<void> deleteIntervalHistory(String id) async {
    await _api.delete('/interval-history/$id');
  }

  // ─── Alarms ──────────────────────────────────────────────────────────────
  Future<List<Map<String, dynamic>>> getAlarmTemplates() async {
    return _list(await _api.get('/alarm-templates', query: {'limit': '100'}));
  }

  Future<Map<String, dynamic>> createAlarmTemplate(Map<String, dynamic> body) async {
    return Map<String, dynamic>.from(
      (_obj(await _api.post('/alarm-templates', body: body)) ?? {}),
    );
  }

  Future<Map<String, dynamic>> updateAlarmTemplate(String id, Map<String, dynamic> body) async {
    return Map<String, dynamic>.from(
      (_obj(await _api.put('/alarm-templates/$id', body: body)) ?? {}),
    );
  }

  Future<void> deleteAlarmTemplate(String id) async {
    await _api.delete('/alarm-templates/$id');
  }

  Future<List<Map<String, dynamic>>> getAlarmContacts() async {
    return _list(await _api.get('/alarm-contacts', query: {'limit': '100'}));
  }

  Future<Map<String, dynamic>> createAlarmContact(Map<String, dynamic> body) async {
    return Map<String, dynamic>.from(
      (_obj(await _api.post('/alarm-contacts', body: body)) ?? {}),
    );
  }

  Future<Map<String, dynamic>> updateAlarmContact(String id, Map<String, dynamic> body) async {
    return Map<String, dynamic>.from(
      (_obj(await _api.put('/alarm-contacts/$id', body: body)) ?? {}),
    );
  }

  Future<void> deleteAlarmContact(String id) async {
    await _api.delete('/alarm-contacts/$id');
  }

  // ─── Anomalies & AI ──────────────────────────────────────────────────────
  Future<Map<String, dynamic>> getAnomaliesPage({String? deviceId, int page = 1, int limit = 30}) async {
    final q = <String, String>{'page': '$page', 'limit': '$limit'};
    if (deviceId != null) q['deviceId'] = deviceId;
    final res = await _api.get('/anomalies', query: q);
    return {
      'items': _list(res),
      'total': (res['total'] as num?)?.toInt() ?? 0,
      'pages': (res['pages'] as num?)?.toInt() ?? 1,
      'page': (res['page'] as num?)?.toInt() ?? page,
    };
  }

  Future<List<Map<String, dynamic>>> getAnomalies({String? deviceId, int page = 1, int limit = 30}) async {
    final res = await getAnomaliesPage(deviceId: deviceId, page: page, limit: limit);
    return List<Map<String, dynamic>>.from(res['items'] as List);
  }

  Future<void> acknowledgeAnomaly(String id) async {
    await _api.patch('/anomalies/$id/acknowledge');
  }

  Future<Map<String, dynamic>> getAiVoltage({
    required String deviceId,
    String? slaveId,
    String timeRange = '24h',
  }) async {
    final q = <String, String>{'deviceId': deviceId, 'timeRange': timeRange};
    if (slaveId != null) q['slaveId'] = slaveId;
    return await _api.get('/ai/voltage-imbalance', query: q);
  }

  Future<Map<String, dynamic>> getAiCurrent({
    required String deviceId,
    String? slaveId,
    String timeRange = '24h',
  }) async {
    final q = <String, String>{'deviceId': deviceId, 'timeRange': timeRange};
    if (slaveId != null) q['slaveId'] = slaveId;
    return await _api.get('/ai/current-imbalance', query: q);
  }

  Future<Map<String, dynamic>> getAiPowerFactor({
    required String deviceId,
    String? slaveId,
    String timeRange = '24h',
  }) async {
    final q = <String, String>{'deviceId': deviceId, 'timeRange': timeRange};
    if (slaveId != null) q['slaveId'] = slaveId;
    return await _api.get('/ai/power-factor', query: q);
  }

  Future<Map<String, dynamic>> getAiEnergy({
    required String deviceId,
    String? slaveId,
    String timeRange = '24h',
  }) async {
    final q = <String, String>{'deviceId': deviceId, 'timeRange': timeRange};
    if (slaveId != null) q['slaveId'] = slaveId;
    return await _api.get('/ai/energy-consumption', query: q);
  }

  // ─── Products & Subscriptions ──────────────────────────────────────────────
  Future<List<Map<String, dynamic>>> getProducts() async {
    return _list(await _api.get('/products', query: {'limit': '100'}));
  }

  Future<void> submitSubscription(Map<String, dynamic> body) async {
    await _api.post('/subscriptions', body: body);
  }

  // ─── Alarm Settings ──────────────────────────────────────────────────────────
  Future<List<Map<String, dynamic>>> getAlarmSettings() async =>
      _list(await _api.get('/alarm-settings', query: {'limit': '100'}));

  Future<Map<String, dynamic>> createAlarmSetting(Map<String, dynamic> body) async =>
      Map<String, dynamic>.from(_obj(await _api.post('/alarm-settings', body: body)) ?? {});

  Future<Map<String, dynamic>> updateAlarmSetting(String id, Map<String, dynamic> body) async =>
      Map<String, dynamic>.from(_obj(await _api.put('/alarm-settings/$id', body: body)) ?? {});

  Future<void> deleteAlarmSetting(String id) async =>
      _api.delete('/alarm-settings/$id');

  // ─── Alarm History ────────────────────────────────────────────────────────────
  Future<Map<String, dynamic>> getVariableAlarmHistoryPage({String? deviceId, int page = 1, int limit = 30}) async {
    final q = <String, String>{'page': '$page', 'limit': '$limit'};
    if (deviceId != null) q['deviceId'] = deviceId;
    final res = await _api.get('/alarm-history/variable-alarms', query: q);
    return {
      'items': _list(res),
      'total': (res['total'] as num?)?.toInt() ?? 0,
      'pages': (res['pages'] as num?)?.toInt() ?? 1,
      'page': (res['page'] as num?)?.toInt() ?? page,
    };
  }

  Future<List<Map<String, dynamic>>> getVariableAlarmHistory({String? deviceId, int page = 1, int limit = 30}) async {
    final res = await getVariableAlarmHistoryPage(deviceId: deviceId, page: page, limit: limit);
    return List<Map<String, dynamic>>.from(res['items'] as List);
  }

  Future<void> processVariableAlarm(String id) async =>
      _api.patch('/alarm-history/variable-alarms/$id/process');

  Future<void> batchDeleteVariableAlarms({String? deviceId}) async {
    final body = deviceId != null ? {'deviceId': deviceId} : <String, dynamic>{};
    await _api.delete('/alarm-history/variable-alarms', body: body);
  }

  Future<Map<String, dynamic>> getLinkageHistoryPage({String? deviceId, int page = 1, int limit = 30}) async {
    final q = <String, String>{'page': '$page', 'limit': '$limit'};
    if (deviceId != null) q['deviceId'] = deviceId;
    final res = await _api.get('/alarm-history/linkage-records', query: q);
    return {
      'items': _list(res),
      'total': (res['total'] as num?)?.toInt() ?? 0,
      'pages': (res['pages'] as num?)?.toInt() ?? 1,
      'page': (res['page'] as num?)?.toInt() ?? page,
    };
  }

  Future<List<Map<String, dynamic>>> getLinkageHistory({String? deviceId, int page = 1, int limit = 30}) async {
    final res = await getLinkageHistoryPage(deviceId: deviceId, page: page, limit: limit);
    return List<Map<String, dynamic>>.from(res['items'] as List);
  }

  Future<void> batchDeleteLinkageHistory({String? deviceId}) async {
    final body = deviceId != null ? {'deviceId': deviceId} : <String, dynamic>{};
    await _api.delete('/alarm-history/linkage-records', body: body);
  }

  // ─── Anomaly Timeline ─────────────────────────────────────────────────────────
  Future<Map<String, dynamic>> getAnomalyTimeline({required String deviceId, String timeRange = '24h'}) async {
    return await _api.get('/anomalies/timeline', query: {'deviceId': deviceId, 'timeRange': timeRange});
  }

  // ─── Task Logs ────────────────────────────────────────────────────────────────
  Future<List<Map<String, dynamic>>> getTaskLogs(String taskId) async =>
      _list(await _api.get('/scheduled-tasks/$taskId/logs', query: {'limit': '50'}));

  // ─── Template Slaves ──────────────────────────────────────────────────────────
  Future<List<Map<String, dynamic>>> getTemplateSlaves(String templateId) async =>
      _list(await _api.get('/device-templates/$templateId/slaves', query: {'limit': '100'}));

  Future<Map<String, dynamic>> createTemplateSlave(String templateId, Map<String, dynamic> body) async =>
      Map<String, dynamic>.from(_obj(await _api.post('/device-templates/$templateId/slaves', body: body)) ?? {});

  Future<Map<String, dynamic>> updateTemplateSlave(String templateId, String slaveId, Map<String, dynamic> body) async =>
      Map<String, dynamic>.from(_obj(await _api.put('/device-templates/$templateId/slaves/$slaveId', body: body)) ?? {});

  Future<void> deleteTemplateSlave(String templateId, String slaveId) async =>
      _api.delete('/device-templates/$templateId/slaves/$slaveId');

  // ─── Template Variables ───────────────────────────────────────────────────────
  Future<List<Map<String, dynamic>>> getTemplateVariables(String templateId, String slaveId) async =>
      _list(await _api.get('/device-templates/$templateId/slaves/$slaveId/variables', query: {'limit': '100'}));

  Future<Map<String, dynamic>> createTemplateVariable(String templateId, String slaveId, Map<String, dynamic> body) async =>
      Map<String, dynamic>.from(_obj(await _api.post('/device-templates/$templateId/slaves/$slaveId/variables', body: body)) ?? {});

  Future<Map<String, dynamic>> updateTemplateVariable(String templateId, String slaveId, String varId, Map<String, dynamic> body) async =>
      Map<String, dynamic>.from(_obj(await _api.put('/device-templates/$templateId/slaves/$slaveId/variables/$varId', body: body)) ?? {});

  Future<void> deleteTemplateVariable(String templateId, String slaveId, String varId) async =>
      _api.delete('/device-templates/$templateId/slaves/$slaveId/variables/$varId');

  // ─── Clone Template ───────────────────────────────────────────────────────────
  Future<Map<String, dynamic>> cloneDeviceTemplate(String id) async =>
      Map<String, dynamic>.from(_obj(await _api.post('/device-templates/$id/clone')) ?? {});

  // ─── Device Users ─────────────────────────────────────────────────────────────
  Future<List<Map<String, dynamic>>> getDeviceUsers(String deviceId) async =>
      _list(await _api.get('/devices/$deviceId/users', query: {'limit': '100'}));

  Future<void> assignDeviceUser(String deviceId, String userId) async =>
      _api.post('/devices/$deviceId/users', body: {'userId': userId});

  Future<void> removeDeviceUser(String deviceId, String userId) async =>
      _api.delete('/devices/$deviceId/users/$userId');

  // ─── Current user update ──────────────────────────────────────────────────────
  Future<Map<String, dynamic>> updateMe(Map<String, dynamic> body) async =>
      Map<String, dynamic>.from(_obj(await _api.put('/users/${AuthService.instance.user!.id}', body: body)) ?? {});

  Future<void> changePassword(String currentPassword, String newPassword) async =>
      _api.post('/auth/change-password', body: {'currentPassword': currentPassword, 'newPassword': newPassword});

  // ─── Alarm History Notifications ─────────────────────────────────────────────
  Future<Map<String, dynamic>> getAlarmHistoryNotificationsPage({String? deviceId, int page = 1, int limit = 30}) async {
    final q = <String, String>{'page': '$page', 'limit': '$limit'};
    if (deviceId != null) q['deviceId'] = deviceId;
    final res = await _api.get('/alarm-history/notifications', query: q);
    return {
      'items': _list(res),
      'total': (res['total'] as num?)?.toInt() ?? 0,
      'pages': (res['pages'] as num?)?.toInt() ?? 1,
      'page': (res['page'] as num?)?.toInt() ?? page,
    };
  }

  Future<List<Map<String, dynamic>>> getAlarmHistoryNotifications({String? deviceId, int page = 1, int limit = 30}) async {
    final res = await getAlarmHistoryNotificationsPage(deviceId: deviceId, page: page, limit: limit);
    return List<Map<String, dynamic>>.from(res['items'] as List);
  }

  // ─── Widget Templates ─────────────────────────────────────────────────────────
  Future<List<Map<String, dynamic>>> getWidgetTemplates() async =>
      _list(await _api.get('/widget-templates', query: {'limit': '100'}));

  Future<Map<String, dynamic>> createWidgetTemplate(Map<String, dynamic> body) async =>
      Map<String, dynamic>.from(_obj(await _api.post('/widget-templates', body: body)) ?? {});

  Future<Map<String, dynamic>> updateWidgetTemplate(String id, Map<String, dynamic> body) async =>
      Map<String, dynamic>.from(_obj(await _api.put('/widget-templates/$id', body: body)) ?? {});

  Future<void> deleteWidgetTemplate(String id) async =>
      _api.delete('/widget-templates/$id');

  // ─── Device Timestamps ────────────────────────────────────────────────────────
  Future<List<Map<String, dynamic>>> getDeviceTimestamps() async =>
      _list(await _api.get('/device-timestamps', query: {'limit': '200'}));
}
