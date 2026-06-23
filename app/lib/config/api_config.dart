
class ApiConfig {
  static const String _envBase = String.fromEnvironment('API_BASE_URL');

  static const String _productionBase = 'https://iotbackend.zeeshan-abbas.tech/api';

  static String get baseUrl {
    if (_envBase.isNotEmpty) return _envBase;
    return _productionBase;
  }
}
