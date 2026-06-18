import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;

class ApiConfig {
  static const String _envBase = String.fromEnvironment('API_BASE_URL');

  static String get baseUrl {
    if (_envBase.isNotEmpty) return _envBase;
    if (kIsWeb) return 'http://localhost:5000/api';
    if (!kIsWeb && Platform.isAndroid) return 'http://10.0.2.2:5000/api';
    return 'http://localhost:5000/api';
  }
}
