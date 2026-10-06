import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ThemeService extends ChangeNotifier {
  ThemeService._();
  static final ThemeService instance = ThemeService._();

  static const String _prefKey = 'ems_theme_mode';
  bool _isDark = true; // Dark mode default matching EMS Dashboard

  bool get isDark => _isDark;
  ThemeMode get themeMode => _isDark ? ThemeMode.dark : ThemeMode.light;

  Future<void> init() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final saved = prefs.getBool(_prefKey);
      if (saved != null) {
        _isDark = saved;
      } else {
        _isDark = true; // default dark
      }
      notifyListeners();
    } catch (_) {}
  }

  Future<void> toggleTheme() async {
    _isDark = !_isDark;
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_prefKey, _isDark);
    } catch (_) {}
  }

  Future<void> setDarkMode(bool dark) async {
    if (_isDark == dark) return;
    _isDark = dark;
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_prefKey, _isDark);
    } catch (_) {}
  }
}
