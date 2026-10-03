import 'package:flutter/material.dart';
import '../services/navigation_state.dart';
import '../widgets/layout/ems_dashboard_layout.dart';

import 'dashboard/org_dashboard_page.dart';
import 'dashboard/user_dashboard_page.dart';
import 'dashboard/dashboard_detail_page.dart';
import 'devices/devices_page.dart';
import 'ev_chargers/ev_chargers_page.dart';
import 'ai_analytics/ai_analytics_page.dart';
import 'ai_analytics/voltage_imbalance_page.dart';
import 'ai_analytics/current_imbalance_page.dart';
import 'ai_analytics/power_factor_page.dart';
import 'ai_analytics/energy_consumption_page.dart';
import 'ai_analytics/anomalies_page.dart';
import 'interval_history_page.dart';
import 'alarm_settings_page.dart';
import 'alarm_history_page.dart';
import 'schedule_page.dart';
import 'notifications_page.dart';
import 'account_settings_page.dart';
import 'slab_rates_page.dart';
import 'device_timestamps_page.dart';
import 'org/gateways_page.dart';
import 'org/users_page.dart';
import 'org/org_management_page.dart';
import 'org/alarm_contacts_page.dart';
import 'org/device_templates_page.dart';
import 'custom_dashboard/custom_dashboard_page.dart';
import 'alarm_template_page.dart';
import 'subscription_page.dart';
import 'products_page.dart';
import 'menu/menu_page.dart';

class MainShell extends StatelessWidget {
  const MainShell({super.key});

  Widget _buildContent(String route, EmsRole role) {
    if (route == '/dashboard') {
      return role == EmsRole.orgAdmin
          ? const OrgDashboardPage()
          : const UserDashboardPage();
    }

    switch (route) {
      case '/org':
      case '/org-dashboard':
        return const OrgDashboardPage();
      case '/user':
      case '/user-dashboard':
        return const UserDashboardPage();
      case '/dashboard-detail':
        return const DashboardDetailPage();
      case '/devices':
        return const DevicesPage();
      case '/ev-chargers':
      case '/ev-live-session':
      case '/ev-analytics':
      case '/ev-control':
        return const EvChargersPage();
      case '/ai-analytics':
        return const AiAnalyticsPage();
      case '/voltage-imbalance':
        return const VoltageImbalancePage();
      case '/current-imbalance':
        return const CurrentImbalancePage();
      case '/power-factor':
        return const PowerFactorPage();
      case '/energy-consumption':
        return const EnergyConsumptionPage();
      case '/anomalies':
        return const AnomaliesPage();
      case '/interval-history':
        return const IntervalHistoryPage();
      case '/alarms':
      case '/alarm-settings':
        return const AlarmSettingsPage();
      case '/alarm-history':
        return const AlarmHistoryPage();
      case '/alarm-contacts':
        return const AlarmContactsTab();
      case '/schedule':
      case '/schedule-tasks':
        return const SchedulePage();
      case '/notifications':
        return const NotificationsPage();
      case '/settings':
      case '/account-settings':
        return const AccountSettingsPage();
      case '/slab-rates':
        return const SlabRatesPage();
      case '/device-timestamps':
        return const DeviceTimestampsPage();
      case '/gateways':
        return const GatewaysTab();
      case '/users':
        return const UsersTab();
      case '/org-management':
      case '/organizations':
        return const OrgManagementPage();
      case '/custom-dashboard':
      case '/custom-dashboards':
        return const CustomDashboardPage();
      case '/historical-data':
        return const IntervalHistoryPage();
      case '/template-triggers':
      case '/alarm-template':
        return const AlarmTemplatePage();
      case '/subscription':
        return const SubscriptionPage();
      case '/products':
        return const ProductsPage();
      case '/device-templates':
        return const DeviceTemplatesTab();
      case '/access-groups':
      case '/device-groups':
        return const OrgManagementPage();
      case '/menu':
        return const MenuPage();
      default:
        return role == EmsRole.orgAdmin ? const OrgDashboardPage() : const UserDashboardPage();
    }
  }

  @override
  Widget build(BuildContext context) {
    final nav = NavigationState.instance;

    return AnimatedBuilder(
      animation: nav,
      builder: (context, _) {
        return EmsDashboardLayout(
          child: _buildContent(nav.currentRoute, nav.currentRole),
        );
      },
    );
  }
}
