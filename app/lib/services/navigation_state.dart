import 'package:flutter/material.dart';

enum EmsRole { superAdmin, orgAdmin, user }

class NavigationState extends ChangeNotifier {
  NavigationState._();
  static final NavigationState instance = NavigationState._();

  EmsRole _currentRole = EmsRole.user;
  String _currentRoute = '/dashboard';
  String _pageTitle = 'Dashboard';
  String _breadcrumb = 'HOME / DASHBOARD';
  bool _sidebarCollapsed = false;

  EmsRole get currentRole => _currentRole;
  String get currentRoute => _currentRoute;
  String get pageTitle => _pageTitle;
  String get breadcrumb => _breadcrumb;
  bool get sidebarCollapsed => _sidebarCollapsed;

  void setRole(EmsRole role) {
    _currentRole = role;
    _currentRoute = '/dashboard';
    _pageTitle = 'Dashboard';
    _breadcrumb = 'HOME / DASHBOARD';
    notifyListeners();
  }

  void navigateTo(String route, {required String title, required String breadcrumb}) {
    _currentRoute = route;
    _pageTitle = title;
    _breadcrumb = breadcrumb;
    notifyListeners();
  }

  void toggleSidebar() {
    _sidebarCollapsed = !_sidebarCollapsed;
    notifyListeners();
  }

  void setSidebarCollapsed(bool val) {
    _sidebarCollapsed = val;
    notifyListeners();
  }
}
