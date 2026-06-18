import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/api_config.dart';

class ApiException implements Exception {
  ApiException(this.message, {this.statusCode});
  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

typedef UnauthorizedHandler = Future<void> Function();
typedef TokenRefreshHandler = Future<String?> Function();

class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  String? _token;
  UnauthorizedHandler? onUnauthorized;
  TokenRefreshHandler? onRefreshToken;

  void setToken(String? token) => _token = token;
  String? get token => _token;

  Map<String, String> _headers({bool jsonBody = true}) {
    final headers = <String, String>{
      'Accept': 'application/json',
      if (jsonBody) 'Content-Type': 'application/json',
    };
    if (_token != null && _token!.isNotEmpty) {
      headers['Authorization'] = 'Bearer $_token';
    }
    return headers;
  }

  Uri _uri(String path, [Map<String, String>? query]) {
    final base = ApiConfig.baseUrl.replaceAll(RegExp(r'/$'), '');
    final p = path.startsWith('/') ? path : '/$path';
    return Uri.parse('$base$p').replace(queryParameters: query);
  }

  dynamic _decode(http.Response res) {
    if (res.body.isEmpty) return null;
    return jsonDecode(res.body);
  }

  Future<void> _throwIfError(http.Response res, dynamic body) async {
    if (res.statusCode >= 200 && res.statusCode < 300) return;
    final message = body is Map && body['message'] != null
        ? body['message'].toString()
        : 'Request failed (${res.statusCode})';
    throw ApiException(message, statusCode: res.statusCode);
  }

  static const _timeout = Duration(seconds: 20);
  bool _retryAfterRefresh = false;

  Future<Map<String, dynamic>> get(String path, {Map<String, String>? query}) async {
    return _request(() async {
      final res = await http.get(_uri(path, query), headers: _headers()).timeout(_timeout);
      final body = _decode(res);
      await _throwIfError(res, body);
      return Map<String, dynamic>.from(body as Map);
    });
  }

  Future<Map<String, dynamic>> post(String path, {Map<String, dynamic>? body}) async {
    return _request(() async {
      final res = await http.post(
        _uri(path),
        headers: _headers(),
        body: body != null ? jsonEncode(body) : null,
      ).timeout(_timeout);
      final decoded = _decode(res);
      await _throwIfError(res, decoded);
      if (decoded == null) return {'success': true};
      return Map<String, dynamic>.from(decoded as Map);
    });
  }

  Future<Map<String, dynamic>> put(String path, {Map<String, dynamic>? body}) async {
    return _request(() async {
      final res = await http.put(
        _uri(path),
        headers: _headers(),
        body: body != null ? jsonEncode(body) : null,
      ).timeout(_timeout);
      final decoded = _decode(res);
      await _throwIfError(res, decoded);
      if (decoded == null) return {'success': true};
      return Map<String, dynamic>.from(decoded as Map);
    });
  }

  Future<Map<String, dynamic>> patch(String path, {Map<String, dynamic>? body}) async {
    return _request(() async {
      final res = await http.patch(
        _uri(path),
        headers: _headers(),
        body: body != null ? jsonEncode(body) : null,
      ).timeout(_timeout);
      final decoded = _decode(res);
      await _throwIfError(res, decoded);
      if (decoded == null) return {'success': true};
      return Map<String, dynamic>.from(decoded as Map);
    });
  }

  Future<Map<String, dynamic>> delete(String path, {Map<String, dynamic>? body}) async {
    return _request(() async {
      final res = await http.delete(
        _uri(path),
        headers: _headers(),
        body: body != null ? jsonEncode(body) : null,
      ).timeout(_timeout);
      final decoded = _decode(res);
      await _throwIfError(res, decoded);
      if (decoded == null) return {'success': true};
      return Map<String, dynamic>.from(decoded as Map);
    });
  }

  Future<Map<String, dynamic>> _request(Future<Map<String, dynamic>> Function() fn) async {
    _retryAfterRefresh = false;
    try {
      return await fn();
    } on ApiException catch (e) {
      if (e.statusCode == 401 && !_retryAfterRefresh && onRefreshToken != null) {
        _retryAfterRefresh = true;
        final newToken = await onRefreshToken!();
        if (newToken != null && newToken.isNotEmpty) {
          setToken(newToken);
          return fn();
        }
      }
      if (e.statusCode == 401 && onUnauthorized != null) await onUnauthorized!();
      rethrow;
    }
  }
}
