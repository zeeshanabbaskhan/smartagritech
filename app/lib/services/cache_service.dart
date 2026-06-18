import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

const String kDevicesCache = 'cache_devices';
const String kDashboardPrefix = 'cache_dashboard_';

class CacheService {
  CacheService._();
  static final CacheService instance = CacheService._();

  SharedPreferences? _prefs;

  /// Call once at app startup before any cache/auth reads (P-42).
  Future<void> init() async {
    _prefs ??= await SharedPreferences.getInstance();
  }

  SharedPreferences get prefs {
    final p = _prefs;
    if (p == null) throw StateError('CacheService.init() must be called first');
    return p;
  }

  Future<void> setJson(String key, Map<String, dynamic> value) async {
    await prefs.setString(key, jsonEncode(value));
  }

  Future<Map<String, dynamic>?> getJson(String key) async {
    final raw = prefs.getString(key);
    if (raw == null) return null;
    try {
      return Map<String, dynamic>.from(jsonDecode(raw) as Map);
    } catch (_) {
      return null;
    }
  }

  Future<void> setList(String key, List<Map<String, dynamic>> value) async {
    await prefs.setString(key, jsonEncode(value));
  }

  Future<List<Map<String, dynamic>>?> getList(String key) async {
    final raw = prefs.getString(key);
    if (raw == null) return null;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is List) {
        return decoded.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<void> clear(String key) async {
    await prefs.remove(key);
  }
}
