import 'package:flutter/foundation.dart';

import '../models/app_user.dart';
import 'api_client.dart';
import 'cache_service.dart';
import 'ems_api.dart';
import 'socket_service.dart';

class AuthService extends ChangeNotifier {
  AuthService._();
  static final AuthService instance = AuthService._();

  static const _tokenKey = 'ems_auth_token';
  static const _refreshKey = 'ems_refresh_token';

  AppUser? _user;
  bool _loading = true;

  AppUser? get user => _user;
  bool get isAuthenticated => _user != null;
  bool get isLoading => _loading;

  Future<void> init() async {
    ApiClient.instance.onUnauthorized = _handleUnauthorized;
    ApiClient.instance.onRefreshToken = _refreshAccessToken;
    _loading = true;
    notifyListeners();
    try {
      final prefs = CacheService.instance.prefs;
      final token = prefs.getString(_tokenKey);
      if (token != null && token.isNotEmpty) {
        ApiClient.instance.setToken(token);
        final me = await EmsApi.instance.fetchMe();
        if (me.role == 'SUPER_ADMIN') {
          await _clearSession();
        } else {
          _user = me;
          SocketService.instance.connect(token);
        }
      }
    } catch (_) {
      await _clearSession();
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<String?> _refreshAccessToken() async {
    final prefs = CacheService.instance.prefs;
    final refresh = prefs.getString(_refreshKey);
    if (refresh == null || refresh.isEmpty) return null;
    try {
      final res = await ApiClient.instance.post('/auth/refresh', body: {'refreshToken': refresh});
      final token = res['token'] as String?;
      final newRefresh = res['refreshToken'] as String?;
      if (token == null || token.isEmpty) return null;
      ApiClient.instance.setToken(token);
      await prefs.setString(_tokenKey, token);
      if (newRefresh != null && newRefresh.isNotEmpty) {
        await prefs.setString(_refreshKey, newRefresh);
      }
      return token;
    } catch (_) {
      return null;
    }
  }

  Future<void> login(String email, String password) async {
    final res = await ApiClient.instance.post('/auth/login', body: {
      'email': email.trim(),
      'password': password,
    });
    final token = res['token'] as String?;
    final refreshToken = res['refreshToken'] as String?;
    if (token == null || token.isEmpty) {
      throw ApiException('Login succeeded but no token received');
    }

    final loggedIn = AppUser.fromJson(Map<String, dynamic>.from(res['data'] as Map));
    if (loggedIn.role == 'SUPER_ADMIN') {
      ApiClient.instance.setToken(null);
      throw ApiException(
        'Super Admin accounts are managed from the web dashboard. '
        'Please log in from the website.',
      );
    }

    ApiClient.instance.setToken(token);
    final prefs = CacheService.instance.prefs;
    await prefs.setString(_tokenKey, token);
    if (refreshToken != null && refreshToken.isNotEmpty) {
      await prefs.setString(_refreshKey, refreshToken);
    }
    _user = loggedIn;
    try {
      _user = await EmsApi.instance.fetchMe();
    } catch (_) {}
    SocketService.instance.connect(token);
    notifyListeners();
  }

  Future<void> logout() async {
    try {
      final refresh = CacheService.instance.prefs.getString(_refreshKey);
      await ApiClient.instance.post('/auth/logout', body: {
        'refreshToken': ?refresh,
      });
    } catch (_) {}
    SocketService.instance.disconnect();
    await _clearSession();
    notifyListeners();
  }

  Future<void> _clearSession() async {
    _user = null;
    ApiClient.instance.setToken(null);
    SocketService.instance.disconnect();
    final prefs = CacheService.instance.prefs;
    await prefs.remove(_tokenKey);
    await prefs.remove(_refreshKey);
  }

  Future<void> _handleUnauthorized() async {
    if (_user == null) return;
    await _clearSession();
    notifyListeners();
  }
}
