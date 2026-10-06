
class ApiConfig {
  static const String _envBase = String.fromEnvironment('API_BASE_URL');

  // Default to active local EMS backend service running on port 5000
  static const String _localBase = 'http://localhost:5000/api';

  static String get baseUrl {
    if (_envBase.isNotEmpty) return _envBase;
    return _localBase;
  }
}
