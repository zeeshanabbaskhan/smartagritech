import '../../data/dummy_data.dart';
import '../../services/api_client.dart';
import 'dummy_helpers.dart';
import 'dummy_store.dart';

/// Routes HTTP-style API calls to in-memory dummy data when [AppConfig.isDummyMode].
class DummyApi {
  DummyApi._();
  static final DummyApi instance = DummyApi._();

  DummyStore get _s => DummyStore.instance;

  Future<Map<String, dynamic>> handle(
    String method,
    String path, {
    Map<String, String>? query,
    Map<String, dynamic>? body,
  }) async {
    _s.ensureSeeded();
    await Future<void>.delayed(const Duration(milliseconds: 40));

    final segments = path.split('/').where((s) => s.isNotEmpty).toList();
    final m = method.toUpperCase();

    try {
      if (segments.isEmpty) return DummyHelpers.ok(null);

      // ─── Auth ─────────────────────────────────────────────────────────────
      if (segments[0] == 'auth') {
        return _auth(m, segments, body);
      }

      // ─── Sensor data (no path prefix conflict) ────────────────────────────
      if (segments[0] == 'sensor-data') {
        return _sensorData(m, segments, query);
      }

      // ─── AI analytics ─────────────────────────────────────────────────────
      if (segments[0] == 'ai') {
        return _ai(segments, query);
      }

      // ─── Devices + nested ─────────────────────────────────────────────────
      if (segments[0] == 'devices') {
        return _devices(m, segments, query, body);
      }

      // ─── Device templates + nested ────────────────────────────────────────
      if (segments[0] == 'device-templates') {
        return _deviceTemplates(m, segments, query, body);
      }

      // ─── Other top-level resources ─────────────────────────────────────────
      switch (segments[0]) {
        case 'users':
          return _users(m, segments, query, body);
        case 'gateways':
          return _gateways(m, segments, query, body);
        case 'organizations':
          return _organizations(m, segments, body);
        case 'notifications':
          return _notifications(m, segments, query);
        case 'scheduled-tasks':
          return _scheduledTasks(m, segments, query, body);
        case 'slab-rates':
          return _slabRates(m, segments, query, body);
        case 'interval-history':
          return _intervalHistory(m, segments, query, body);
        case 'alarm-templates':
          return _alarmTemplates(m, segments, query, body);
        case 'alarm-contacts':
          return _alarmContacts(m, segments, query, body);
        case 'alarm-settings':
          return _alarmSettings(m, segments, query, body);
        case 'alarm-history':
          return _alarmHistory(m, segments, query, body);
        case 'anomalies':
          return _anomalies(m, segments, query);
        case 'products':
          return _products(m, segments, query, body);
        case 'subscriptions':
          return _subscriptions(m, body);
        case 'widget-templates':
          return _widgetTemplates(m, segments, query, body);
        case 'device-timestamps':
          return _deviceTimestamps(query);
      }

      throw ApiException('Dummy API: route not found ($method $path)', statusCode: 404);
    } on ApiException {
      rethrow;
    } catch (e) {
      throw ApiException('Dummy API error: $e', statusCode: 500);
    }
  }

  // ─── Auth ──────────────────────────────────────────────────────────────────

  Map<String, dynamic> _auth(String m, List<String> segs, Map<String, dynamic>? body) {
    final action = segs.length > 1 ? segs[1] : '';
    switch ('$m:$action') {
      case 'POST:login':
        final email = (body?['email'] ?? '').toString().trim().toLowerCase();
        final password = (body?['password'] ?? '').toString();
        if (email == 'superadmin@ems.com') {
          throw ApiException(
            'Super Admin accounts are managed from the web dashboard.',
            statusCode: 403,
          );
        }
        final user = _s.findUserByEmail(email);
        final expected = _s.passwords[email];
        if (user == null || expected == null || password != expected) {
          throw ApiException('Invalid email or password', statusCode: 401);
        }
        _s.currentUser = DummyHelpers.clone(user);
        _s.accessToken = 'dummy-access-${user['id']}';
        _s.refreshToken = 'dummy-refresh-${user['id']}';
        return {
          'success': true,
          'token': _s.accessToken,
          'refreshToken': _s.refreshToken,
          'data': _s.currentUser,
        };
      case 'POST:logout':
        return {'success': true};
      case 'POST:refresh':
        final rt = body?['refreshToken']?.toString();
        if (rt == null || rt != _s.refreshToken) {
          throw ApiException('Invalid refresh token', statusCode: 401);
        }
        _s.accessToken = 'dummy-access-refreshed';
        return {'success': true, 'token': _s.accessToken, 'refreshToken': _s.refreshToken};
      case 'GET:me':
        _restoreSession();
        if (_s.currentUser == null) throw ApiException('Unauthorized', statusCode: 401);
        return DummyHelpers.ok(_s.currentUser);
      case 'POST:change-password':
        return {'success': true, 'message': 'Password changed'};
      default:
        throw ApiException('Dummy auth route not found', statusCode: 404);
    }
  }

  // ─── Sensor data ───────────────────────────────────────────────────────────

  Map<String, dynamic> _sensorData(String m, List<String> segs, Map<String, String>? query) {
    if (m != 'GET') throw ApiException('Method not allowed', statusCode: 405);
    final deviceId = query?['deviceId'];
    if (deviceId != null && !_s.canAccessDevice(deviceId)) {
      throw ApiException('Device not found', statusCode: 404);
    }
    final action = segs.length > 1 ? segs[1] : '';
    switch (action) {
      case 'latest':
        return DummyHelpers.ok(DummyHelpers.latestReadings());
      case 'dashboard-summary':
        return {
          'success': true,
          'timeRange': query?['timeRange'] ?? '24h',
          'data': DummyHelpers.dashboardSummary(),
        };
      case 'readings':
        final page = int.tryParse(query?['page'] ?? '1') ?? 1;
        final res = DummyHelpers.paginated(DummyHelpers.sensorReadings(), query);
        return {...res, 'hasMore': page < (res['pages'] as int? ?? 1)};
      default:
        throw ApiException('Dummy sensor-data route not found', statusCode: 404);
    }
  }

  // ─── AI ────────────────────────────────────────────────────────────────────

  Map<String, dynamic> _ai(List<String> segs, Map<String, String>? query) {
    final deviceId = query?['deviceId'];
    if (deviceId != null && !_s.canAccessDevice(deviceId)) {
      throw ApiException('Device not found', statusCode: 404);
    }
    final action = segs.length > 1 ? segs[1] : '';
    switch (action) {
      case 'voltage-imbalance':
        return DummyHelpers.ok(DummyHelpers.voltageAnalysis());
      case 'current-imbalance':
        return DummyHelpers.ok(DummyHelpers.currentAnalysis());
      case 'power-factor':
        return DummyHelpers.ok(DummyHelpers.powerFactorAnalysis());
      case 'energy-consumption':
        return DummyHelpers.ok(DummyHelpers.energyAnalysis());
      case 'predictions':
        return DummyHelpers.ok(null);
      default:
        throw ApiException('Dummy AI route not found', statusCode: 404);
    }
  }

  // ─── Devices ───────────────────────────────────────────────────────────────

  Map<String, dynamic> _devices(
    String m,
    List<String> segs,
    Map<String, String>? query,
    Map<String, dynamic>? body,
  ) {
    if (segs.length == 1) {
      if (m == 'GET') {
        var list = _s.visibleDevices();
        final search = query?['search'];
        if (search != null && search.isNotEmpty) {
          final q = search.toLowerCase();
          list = list.where((d) => (d['name'] as String).toLowerCase().contains(q)).toList();
        }
        final status = query?['status'];
        if (status != null && status.isNotEmpty) {
          list = list.where((d) => d['status'] == status).toList();
        }
        return DummyHelpers.paginated(list, query);
      }
      if (m == 'POST') {
        if (!_s.isOrgAdmin) {
          throw ApiException('Only Org Admin can create devices', statusCode: 403);
        }
        final id = DummyHelpers.nextId('dev');
        final gwId = body?['gatewayId'] ?? _s.gateways.first['id'];
        final tplId = body?['templateId'] ?? _s.deviceTemplates.first['id'];
        final dev = {
          'id': id,
          'name': body?['name'] ?? 'New Device',
          'status': 'OFFLINE',
          'gatewayId': gwId,
          'templateId': tplId,
          'organizationId': DummyStore.orgId,
          'switchState': 'OFF',
          'lastDataReceivedAt': null,
          'ingestApiKey': 'dummy-ingest-key-$id',
          'gateway': _s.gateways.firstWhere((g) => g['id'] == gwId, orElse: () => _s.gateways.first),
          'template': _s.deviceTemplates.firstWhere((t) => t['id'] == tplId, orElse: () => _s.deviceTemplates.first),
          'organization': {'id': DummyStore.orgId, 'name': _s.organization['name']},
        };
        _s.devices.add(dev);
        return {'success': true, 'data': dev, 'ingestApiKey': dev['ingestApiKey']};
      }
    }

    final deviceId = segs[1];

    if (segs.length == 2) {
      if (m == 'GET') {
        final d = _s.findDevice(deviceId);
        if (d == null || !_s.canAccessDevice(deviceId)) {
          throw ApiException('Device not found', statusCode: 404);
        }
        return DummyHelpers.ok(DummyHelpers.clone(d));
      }
      if (m == 'PUT') {
        if (!_s.isOrgAdmin) throw ApiException('Only Org Admin can update devices', statusCode: 403);
        final d = _s.findDevice(deviceId);
        if (d == null) throw ApiException('Device not found', statusCode: 404);
        d.addAll(body ?? {});
        return DummyHelpers.ok(DummyHelpers.clone(d));
      }
      if (m == 'DELETE') {
        if (!_s.isOrgAdmin) throw ApiException('Only Org Admin can delete devices', statusCode: 403);
        _s.devices.removeWhere((d) => d['id'] == deviceId);
        return {'success': true};
      }
    }

    if (segs.length >= 3 && segs[2] == 'config') {
      if (m == 'GET' && segs.length == 3) {
        return DummyHelpers.ok(_s.deviceConfigFor(deviceId));
      }
      if (segs.length >= 5 && segs[3] == 'variables' && m == 'PATCH') {
        final varId = segs[4];
        final cv = _s.deviceConfigVariables.firstWhere(
          (v) => v['id'] == varId,
          orElse: () => throw ApiException('Variable not found', statusCode: 404),
        );
        cv['currentValue'] = body?['currentValue']?.toString() ?? cv['currentValue'];
        cv['lastUpdatedAt'] = DummyHelpers.iso();
        return DummyHelpers.ok(DummyHelpers.clone(cv));
      }
    }

    if (segs.length >= 3 && segs[2] == 'users') {
      if (m == 'GET') {
        final links = _s.deviceUserLinks.where((l) => l['deviceId'] == deviceId);
        final list = links.map((l) {
          final u = _s.users.firstWhere((u) => u['id'] == l['userId']);
          return DummyHelpers.clone(u);
        }).toList();
        return DummyHelpers.paginated(list, query);
      }
      if (m == 'POST') {
        _s.deviceUserLinks.add({'deviceId': deviceId, 'userId': body?['userId']});
        return {'success': true};
      }
      if (m == 'DELETE' && segs.length >= 4) {
        final userId = segs[3];
        _s.deviceUserLinks.removeWhere((l) => l['deviceId'] == deviceId && l['userId'] == userId);
        return {'success': true};
      }
    }

    throw ApiException('Dummy devices route not found', statusCode: 404);
  }

  // ─── Device templates ──────────────────────────────────────────────────────

  Map<String, dynamic> _deviceTemplates(
    String m,
    List<String> segs,
    Map<String, String>? query,
    Map<String, dynamic>? body,
  ) {
    if (segs.length == 1) {
      if (m == 'GET') return DummyHelpers.paginated(_s.deviceTemplates, query);
      if (m == 'POST') {
        final id = DummyHelpers.nextId('tpl');
        final tpl = {
          'id': id,
          'name': body?['name'] ?? 'New Template',
          'acquisitionMethod': body?['acquisitionMethod'] ?? body?['protocol'] ?? 'Modbus RTU',
          'protocol': body?['acquisitionMethod'] ?? body?['protocol'] ?? 'Modbus RTU',
          'organizationId': DummyStore.orgId,
          'updatedAt': DummyHelpers.iso(),
          'totalSlaves': 0,
          'totalVariables': 0,
        };
        _s.deviceTemplates.add(tpl);
        return DummyHelpers.ok(tpl);
      }
    }

    final tplId = segs[1];

    if (segs.length == 2) {
      if (m == 'GET') {
        final t = _s.deviceTemplates.firstWhere(
          (t) => t['id'] == tplId,
          orElse: () => throw ApiException('Template not found', statusCode: 404),
        );
        return DummyHelpers.ok(DummyHelpers.clone(t));
      }
      if (m == 'PUT') {
        final t = _s.deviceTemplates.firstWhere((t) => t['id'] == tplId);
        t.addAll(body ?? {});
        t['updatedAt'] = DummyHelpers.iso();
        return DummyHelpers.ok(DummyHelpers.clone(t));
      }
      if (m == 'DELETE') {
        _s.deviceTemplates.removeWhere((t) => t['id'] == tplId);
        return {'success': true};
      }
      if (m == 'POST' && segs[1] == tplId && segs.length == 3 && segs[2] == 'clone') {
        // handled below
      }
    }

    if (segs.length == 3 && segs[2] == 'clone' && m == 'POST') {
      final src = _s.deviceTemplates.firstWhere((t) => t['id'] == tplId);
      final id = DummyHelpers.nextId('tpl');
      final clone = DummyHelpers.clone(src);
      clone['id'] = id;
      clone['name'] = '${src['name']} (Copy)';
      _s.deviceTemplates.add(clone);
      return DummyHelpers.ok(clone);
    }

    if (segs.length >= 3 && segs[2] == 'slaves') {
      final slaveId = segs.length > 3 ? segs[3] : null;
      if (slaveId == null && m == 'GET') {
        final list = _s.templateSlaves.where((s) => s['templateId'] == tplId).toList();
        return DummyHelpers.paginated(list, query);
      }
      if (slaveId == null && m == 'POST') {
        final id = DummyHelpers.nextId('tsl');
        final slave = {
          'id': id,
          'templateId': tplId,
          'name': body?['name'] ?? 'New Slave',
          'slaveAddress': body?['slaveAddress'] ?? 1,
          'organizationId': DummyStore.orgId,
        };
        _s.templateSlaves.add(slave);
        return DummyHelpers.ok(slave);
      }
      if (slaveId != null && segs.length == 4) {
        if (m == 'PUT') {
          final s = _s.templateSlaves.firstWhere((s) => s['id'] == slaveId);
          s.addAll(body ?? {});
          return DummyHelpers.ok(DummyHelpers.clone(s));
        }
        if (m == 'DELETE') {
          _s.templateSlaves.removeWhere((s) => s['id'] == slaveId);
          return {'success': true};
        }
      }
      if (slaveId != null && segs.length >= 5 && segs[4] == 'variables') {
        final varId = segs.length > 5 ? segs[5] : null;
        if (varId == null && m == 'GET') {
          final list = _s.templateVariables.where((v) => v['templateSlaveId'] == slaveId).toList();
          return DummyHelpers.paginated(list, query);
        }
        if (varId == null && m == 'POST') {
          final id = DummyHelpers.nextId('tvar');
          final v = {
            'id': id,
            'templateId': tplId,
            'templateSlaveId': slaveId,
            'name': body?['name'] ?? 'NewVar',
            'unit': body?['unit'] ?? '',
            'dataType': 'FLOAT',
            'registerAddress': body?['registerAddress'] ?? 0,
            'organizationId': DummyStore.orgId,
          };
          _s.templateVariables.add(v);
          return DummyHelpers.ok(v);
        }
        if (varId != null) {
          if (m == 'PUT') {
            final v = _s.templateVariables.firstWhere((v) => v['id'] == varId);
            v.addAll(body ?? {});
            return DummyHelpers.ok(DummyHelpers.clone(v));
          }
          if (m == 'DELETE') {
            _s.templateVariables.removeWhere((v) => v['id'] == varId);
            return {'success': true};
          }
        }
      }
    }

    throw ApiException('Dummy device-templates route not found', statusCode: 404);
  }

  // ─── Users ─────────────────────────────────────────────────────────────────

  Map<String, dynamic> _users(
    String m,
    List<String> segs,
    Map<String, String>? query,
    Map<String, dynamic>? body,
  ) {
    if (!_s.isOrgAdmin && m != 'PUT') {
      // USER may update own profile via PUT /users/:id
      if (!(m == 'PUT' && segs.length == 2 && segs[1] == _s.currentUser?['id'])) {
        throw ApiException('Org Admin access required', statusCode: 403);
      }
    }
    if (segs.length == 1) {
      if (m == 'GET') {
        if (!_s.isOrgAdmin) throw ApiException('Org Admin access required', statusCode: 403);
        var list = _s.users.map(DummyHelpers.clone).toList();
        final search = query?['search'];
        if (search != null && search.isNotEmpty) {
          final q = search.toLowerCase();
          list = list.where((u) => (u['email'] as String).toLowerCase().contains(q)).toList();
        }
        return DummyHelpers.paginated(list, query);
      }
      if (m == 'POST') {
        final id = DummyHelpers.nextId('usr');
        final u = {
          'id': id,
          'fullName': body?['fullName'] ?? 'New User',
          'email': body?['email'] ?? 'new@example.com',
          'role': body?['role'] ?? 'USER',
          'status': 'ACTIVE',
          'organizationId': DummyStore.orgId,
          'organization': {'id': DummyStore.orgId, 'name': _s.organization['name']},
        };
        _s.users.add(u);
        if (body?['password'] != null) {
          _s.passwords[(u['email'] as String).toLowerCase()] = body!['password'].toString();
        }
        return DummyHelpers.ok(u);
      }
    }

    final userId = segs[1];
    if (segs.length == 2) {
      if (m == 'PUT') {
        if (!_s.isOrgAdmin && userId != _s.currentUser?['id']) {
          throw ApiException('You can only update your own profile', statusCode: 403);
        }
        final u = _s.users.firstWhere((u) => u['id'] == userId, orElse: () => throw ApiException('User not found', statusCode: 404));
        u.addAll(body ?? {});
        if (_s.currentUser?['id'] == userId) _s.currentUser = DummyHelpers.clone(u);
        return DummyHelpers.ok(DummyHelpers.clone(u));
      }
    }
    if (!_s.isOrgAdmin) throw ApiException('Org Admin access required', statusCode: 403);
    if (segs.length == 3 && segs[2] == 'status' && m == 'PATCH') {
      final u = _s.users.firstWhere((u) => u['id'] == userId);
      u['status'] = body?['status'] ?? u['status'];
      return DummyHelpers.ok(DummyHelpers.clone(u));
    }
    if (segs.length == 3 && segs[2] == 'reset-password' && m == 'POST') {
      return {'success': true};
    }
    throw ApiException('Dummy users route not found', statusCode: 404);
  }

  // ─── Gateways ──────────────────────────────────────────────────────────────

  Map<String, dynamic> _gateways(
    String m,
    List<String> segs,
    Map<String, String>? query,
    Map<String, dynamic>? body,
  ) {
    if (!_s.isOrgAdmin && m != 'GET') {
      throw ApiException('Org Admin access required', statusCode: 403);
    }
    // USER can list gateways read-only for device forms if needed; org pages are menu-hidden
    if (segs.length == 1) {
      if (m == 'GET') return DummyHelpers.paginated(_s.gateways, query);
      if (m == 'POST') {
        final id = DummyHelpers.nextId('gw');
        final g = {
          'id': id,
          'name': body?['name'] ?? 'New Gateway',
          'model': body?['model'] ?? 'N510',
          'serialNumber': body?['serialNumber'] ?? '',
          'organizationId': DummyStore.orgId,
          'status': 'OFFLINE',
        };
        _s.gateways.add(g);
        return DummyHelpers.ok(g);
      }
    }
    final id = segs[1];
    if (m == 'PUT') {
      final g = _s.gateways.firstWhere((g) => g['id'] == id);
      g.addAll(body ?? {});
      return DummyHelpers.ok(DummyHelpers.clone(g));
    }
    if (m == 'DELETE') {
      _s.gateways.removeWhere((g) => g['id'] == id);
      return {'success': true};
    }
    throw ApiException('Dummy gateways route not found', statusCode: 404);
  }

  // ─── Organizations ─────────────────────────────────────────────────────────

  Map<String, dynamic> _organizations(String m, List<String> segs, Map<String, dynamic>? body) {
    if (!_s.isOrgAdmin) throw ApiException('Org Admin access required', statusCode: 403);
    if (segs.length == 2 && segs[1] == 'me') {
      if (m == 'GET') return DummyHelpers.ok(DummyHelpers.clone(_s.organization));
      if (m == 'PUT') {
        _s.organization.addAll(body ?? {});
        return DummyHelpers.ok(DummyHelpers.clone(_s.organization));
      }
    }
    throw ApiException('Dummy organizations route not found', statusCode: 404);
  }

  // ─── Notifications ─────────────────────────────────────────────────────────

  Map<String, dynamic> _notifications(String m, List<String> segs, Map<String, String>? query) {
    List<Map<String, dynamic>> scopedNotifications() {
      if (_s.isOrgAdmin) return _s.notifications;
      final ids = _s.visibleDevices().map((d) => d['id'] as String).toSet();
      return _s.notifications.where((n) => ids.contains(n['deviceId'])).toList();
    }

    if (segs.length == 1) {
      if (m == 'GET') {
        return DummyHelpers.paginated(scopedNotifications(), query, extra: {
          'unreadCount': scopedNotifications().where((n) => n['read'] != true).length,
        });
      }
      if (m == 'DELETE') {
        if (_s.isOrgAdmin) {
          _s.notifications.clear();
        } else {
          final ids = _s.visibleDevices().map((d) => d['id'] as String).toSet();
          _s.notifications.removeWhere((n) => ids.contains(n['deviceId']));
        }
        return {'success': true};
      }
    }
    final id = segs[1];
    if (m == 'DELETE') {
      _s.notifications.removeWhere((n) => n['id'] == id);
      return {'success': true};
    }
    if (m == 'PATCH' && segs.length == 3 && segs[2] == 'read') {
      final n = _s.notifications.firstWhere((n) => n['id'] == id);
      n['read'] = true;
      return DummyHelpers.ok(DummyHelpers.clone(n));
    }
    if (m == 'PATCH' && id == 'read-all') {
      for (final n in _s.notifications) {
        n['read'] = true;
      }
      return {'success': true};
    }
    throw ApiException('Dummy notifications route not found', statusCode: 404);
  }

  // ─── Scheduled tasks ───────────────────────────────────────────────────────

  Map<String, dynamic> _scheduledTasks(
    String m,
    List<String> segs,
    Map<String, String>? query,
    Map<String, dynamic>? body,
  ) {
    if (segs.length == 1) {
      if (m == 'GET') {
        var list = _s.scheduledTasks;
        final deviceId = query?['deviceId'];
        if (deviceId != null) {
          list = list.where((t) => t['deviceId'] == deviceId).toList();
        }
        return DummyHelpers.paginated(list, query);
      }
      if (m == 'POST') {
        final id = DummyHelpers.nextId('task');
        final t = {'id': id, ...?body, 'organizationId': DummyStore.orgId};
        _s.scheduledTasks.add(t);
        return DummyHelpers.ok(t);
      }
    }
    final id = segs[1];
    if (segs.length == 3 && segs[2] == 'logs' && m == 'GET') {
      final logs = _s.taskLogs.where((l) => l['scheduledTaskId'] == id).toList();
      return DummyHelpers.paginated(logs, query);
    }
    if (segs.length == 3 && segs[2] == 'toggle' && m == 'PATCH') {
      final t = _s.scheduledTasks.firstWhere((t) => t['id'] == id);
      t['enabled'] = !(t['enabled'] == true);
      return DummyHelpers.ok(DummyHelpers.clone(t));
    }
    if (m == 'PUT') {
      final t = _s.scheduledTasks.firstWhere((t) => t['id'] == id);
      t.addAll(body ?? {});
      return DummyHelpers.ok(DummyHelpers.clone(t));
    }
    if (m == 'DELETE') {
      _s.scheduledTasks.removeWhere((t) => t['id'] == id);
      return {'success': true};
    }
    throw ApiException('Dummy scheduled-tasks route not found', statusCode: 404);
  }

  // ─── Slab rates ────────────────────────────────────────────────────────────

  Map<String, dynamic> _slabRates(
    String m,
    List<String> segs,
    Map<String, String>? query,
    Map<String, dynamic>? body,
  ) {
    if (segs.length == 1) {
      if (m == 'GET') {
        var list = _s.slabRates;
        final slaveId = query?['deviceConfigSlaveId'];
        if (slaveId != null) {
          list = list.where((s) => s['deviceConfigSlaveId'] == slaveId).toList();
        }
        return DummyHelpers.paginated(list, query);
      }
      if (m == 'POST') {
        final id = DummyHelpers.nextId('slab');
        final s = {'id': id, ...?body, 'organizationId': DummyStore.orgId};
        _s.slabRates.add(s);
        return DummyHelpers.ok(s);
      }
    }
    final id = segs[1];
    if (m == 'PUT') {
      final s = _s.slabRates.firstWhere((s) => s['id'] == id);
      s.addAll(body ?? {});
      return DummyHelpers.ok(DummyHelpers.clone(s));
    }
    if (m == 'DELETE') {
      _s.slabRates.removeWhere((s) => s['id'] == id);
      return {'success': true};
    }
    throw ApiException('Dummy slab-rates route not found', statusCode: 404);
  }

  // ─── Interval history ──────────────────────────────────────────────────────

  Map<String, dynamic> _intervalHistory(
    String m,
    List<String> segs,
    Map<String, String>? query,
    Map<String, dynamic>? body,
  ) {
    if (segs.length == 1) {
      if (m == 'GET') return DummyHelpers.paginated(_s.intervalHistory, query);
      if (m == 'POST') {
        final id = DummyHelpers.nextId('int');
        final row = {'id': id, ...?body, 'organizationId': DummyStore.orgId};
        _s.intervalHistory.insert(0, row);
        return DummyHelpers.ok(row);
      }
    }
    if (m == 'DELETE') {
      _s.intervalHistory.removeWhere((r) => r['id'] == segs[1]);
      return {'success': true};
    }
    throw ApiException('Dummy interval-history route not found', statusCode: 404);
  }

  // ─── Alarm templates / contacts / settings ─────────────────────────────────

  Map<String, dynamic> _crudList(
    List<Map<String, dynamic>> list,
    String m,
    List<String> segs,
    Map<String, String>? query,
    Map<String, dynamic>? body,
    String idPrefix,
  ) {
    if (segs.length == 1) {
      if (m == 'GET') return DummyHelpers.paginated(list, query);
      if (m == 'POST') {
        final id = DummyHelpers.nextId(idPrefix);
        final row = {'id': id, ...?body, 'organizationId': DummyStore.orgId};
        list.add(row);
        return DummyHelpers.ok(row);
      }
    }
    final id = segs[1];
    if (m == 'PUT') {
      final row = list.firstWhere((r) => r['id'] == id, orElse: () => throw ApiException('Not found', statusCode: 404));
      row.addAll(body ?? {});
      return DummyHelpers.ok(DummyHelpers.clone(row));
    }
    if (m == 'DELETE') {
      list.removeWhere((r) => r['id'] == id);
      return {'success': true};
    }
    throw ApiException('Dummy CRUD route not found', statusCode: 404);
  }

  Map<String, dynamic> _alarmTemplates(String m, List<String> segs, Map<String, String>? query, Map<String, dynamic>? body) =>
      _crudList(_s.alarmTemplates, m, segs, query, body, 'atpl');

  Map<String, dynamic> _alarmContacts(String m, List<String> segs, Map<String, String>? query, Map<String, dynamic>? body) =>
      _crudList(_s.alarmContacts, m, segs, query, body, 'ac');

  Map<String, dynamic> _alarmSettings(String m, List<String> segs, Map<String, String>? query, Map<String, dynamic>? body) =>
      _crudList(_s.alarmSettings, m, segs, query, body, 'aset');

  // ─── Alarm history ─────────────────────────────────────────────────────────

  Map<String, dynamic> _alarmHistory(
    String m,
    List<String> segs,
    Map<String, String>? query,
    Map<String, dynamic>? body,
  ) {
    final sub = segs.length > 1 ? segs[1] : '';
    List<Map<String, dynamic>> list;
    switch (sub) {
      case 'variable-alarms':
        list = _s.variableAlarms;
        if (segs.length == 2 && m == 'GET') {
          var filtered = list;
          final deviceId = query?['deviceId'];
          if (deviceId != null) filtered = list.where((r) => r['deviceId'] == deviceId).toList();
          return DummyHelpers.paginated(filtered, query);
        }
        if (segs.length == 3 && m == 'DELETE') {
          if (body?['deviceId'] != null) {
            _s.variableAlarms.removeWhere((r) => r['deviceId'] == body!['deviceId']);
          } else {
            _s.variableAlarms.clear();
          }
          return {'success': true};
        }
        if (segs.length == 4 && segs[3] == 'process' && m == 'PATCH') {
          final row = _s.variableAlarms.firstWhere((r) => r['id'] == segs[2]);
          row['processState'] = 'PROCESSED';
          return DummyHelpers.ok(DummyHelpers.clone(row));
        }
        break;
      case 'linkage-records':
        list = _s.linkageRecords;
        if (segs.length == 2 && m == 'GET') {
          var filtered = list;
          final deviceId = query?['deviceId'];
          if (deviceId != null) filtered = list.where((r) => r['deviceId'] == deviceId).toList();
          return DummyHelpers.paginated(filtered, query);
        }
        if (segs.length == 2 && m == 'DELETE') {
          if (body?['deviceId'] != null) {
            _s.linkageRecords.removeWhere((r) => r['deviceId'] == body!['deviceId']);
          } else {
            _s.linkageRecords.clear();
          }
          return {'success': true};
        }
        break;
      case 'notifications':
        list = _s.alarmNotifications;
        if (segs.length == 2 && m == 'GET') {
          var filtered = list;
          final deviceId = query?['deviceId'];
          if (deviceId != null) filtered = list.where((r) => r['deviceId'] == deviceId).toList();
          return DummyHelpers.paginated(filtered, query);
        }
        break;
    }
    throw ApiException('Dummy alarm-history route not found', statusCode: 404);
  }

  // ─── Anomalies ───────────────────────────────────────────────────────────────

  Map<String, dynamic> _anomalies(String m, List<String> segs, Map<String, String>? query) {
    if (segs.length == 2 && segs[1] == 'timeline' && m == 'GET') {
      final deviceId = query?['deviceId'];
      if (deviceId != null && !_s.canAccessDevice(deviceId)) {
        throw ApiException('Device not found', statusCode: 404);
      }
      final buckets = List.generate(12, (i) {
        final t = DateTime.now().subtract(Duration(hours: (11 - i) * 2));
        return {
          'time': DummyHelpers.iso(t),
          'count': DummyData.anomaliesTimeline[i % DummyData.anomaliesTimeline.length],
          'types': [
            {'type': 'overvoltage', 'count': 2 + (i % 3)},
            {'type': 'overload', 'count': 1 + (i % 2)},
          ],
        };
      });
      return {'success': true, 'data': {'buckets': buckets}};
    }
    if (segs.length == 1 && m == 'GET') {
      var list = _s.anomalies;
      final deviceId = query?['deviceId'];
      if (deviceId != null) {
        if (!_s.canAccessDevice(deviceId)) {
          throw ApiException('Device not found', statusCode: 404);
        }
        list = list.where((a) => a['deviceId'] == deviceId).toList();
      } else if (_s.isUser) {
        final ids = _s.visibleDevices().map((d) => d['id'] as String).toSet();
        list = list.where((a) => ids.contains(a['deviceId'])).toList();
      }
      return DummyHelpers.paginated(list, query);
    }
    if (segs.length == 3 && segs[2] == 'acknowledge' && m == 'PATCH') {
      final a = _s.anomalies.firstWhere((a) => a['id'] == segs[1]);
      a['acknowledged'] = true;
      a['alarmState'] = 'RESOLVED';
      a['processState'] = 'PROCESSED';
      return DummyHelpers.ok(DummyHelpers.clone(a));
    }
    throw ApiException('Dummy anomalies route not found', statusCode: 404);
  }

  // ─── Products / subscriptions / widgets ────────────────────────────────────

  Map<String, dynamic> _products(String m, List<String> segs, Map<String, String>? query, Map<String, dynamic>? body) =>
      _crudList(_s.products, m, segs, query, body, 'prod');

  Map<String, dynamic> _subscriptions(String m, Map<String, dynamic>? body) {
    if (m == 'POST') return {'success': true, 'message': 'Subscription request submitted'};
    throw ApiException('Dummy subscriptions route not found', statusCode: 404);
  }

  Map<String, dynamic> _widgetTemplates(String m, List<String> segs, Map<String, String>? query, Map<String, dynamic>? body) =>
      _crudList(_s.widgetTemplates, m, segs, query, body, 'wtpl');

  void _restoreSession() {
    if (_s.currentUser != null) return;
    final token = _s.accessToken;
    if (token == null || !token.startsWith('dummy-access-')) return;
    final suffix = token.replaceFirst('dummy-access-', '');
    if (suffix == 'refreshed') {
      if (_s.users.isNotEmpty) _s.currentUser = DummyHelpers.clone(_s.users.first);
      return;
    }
    for (final u in _s.users) {
      if (u['id'] == suffix) {
        _s.currentUser = DummyHelpers.clone(u);
        return;
      }
    }
  }

  Map<String, dynamic> _deviceTimestamps(Map<String, String>? query) {
    final now = DateTime.now();
    final list = _s.devices.map((d) {
      final lastActiveRaw = d['lastDataReceivedAt']?.toString();
      final lastActive = lastActiveRaw != null
          ? DateTime.tryParse(lastActiveRaw) ?? now
          : now;
      final minsAgo = now.difference(lastActive).inMinutes.abs();
      final isOnline = d['status'] == 'ONLINE' && minsAgo < 5;
      return {
        'id': 'dts-${d['id']}',
        'deviceId': d['id'],
        'device': {'id': d['id'], 'name': d['name'], 'status': d['status']},
        'deviceName': d['name'],
        'lastActiveAt': DummyHelpers.iso(lastActive),
        'lastActiveMinsAgo': minsAgo,
        'onlineStatus': isOnline ? 'ONLINE' : 'OFFLINE',
        'organizationId': DummyStore.orgId,
      };
    }).toList();
    return DummyHelpers.paginated(list, query);
  }
}
