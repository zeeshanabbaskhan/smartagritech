import 'package:flutter/material.dart';
import '../app_theme.dart';
import '../widgets/app_drawer.dart';
import 'dashboard/dashboard_page.dart';
import 'dashboard/detail_page.dart';
import 'subscription_page.dart';
import 'products_page.dart';
import 'schedule_page.dart';
import 'slab_rates_page.dart';
import 'interval_history_page.dart';
import 'alarm_template_page.dart';
import 'notifications_page.dart';
import 'ai_analytics/ai_analytics_page.dart';
import 'ai_analytics/voltage_imbalance_page.dart';
import 'ai_analytics/current_imbalance_page.dart';
import 'ai_analytics/power_factor_page.dart';
import 'ai_analytics/energy_consumption_page.dart';
import 'ai_analytics/anomalies_page.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  String _currentPage = 'dashboard';

  static const Map<String, String> _titles = {
    'dashboard': 'Dashboard',
    'detail': 'Dashboard · Detail',
    'subscription': 'Subscription',
    'products': 'Products',
    'schedule': 'Manage Schedule',
    'slab_rates': 'Manage Slab Rates',
    'interval_history': 'Manage Interval History',
    'alarm_template': 'Alarm Template',
    'notifications': 'Notifications',
    'ai_analytics': 'AI Analytics',
    'voltage_imbalance': 'Voltage Imbalance',
    'current_imbalance': 'Current Imbalance',
    'power_factor': 'Power Factor',
    'energy_consumption': 'Energy Consumption',
    'anomalies': 'Anomalies',
  };

  Widget _buildBody() {
    switch (_currentPage) {
      case 'dashboard':
        return const DashboardPage();
      case 'detail':
        return const DetailPage();
      case 'subscription':
        return const SubscriptionPage();
      case 'products':
        return const ProductsPage();
      case 'schedule':
        return const SchedulePage();
      case 'slab_rates':
        return const SlabRatesPage();
      case 'interval_history':
        return const IntervalHistoryPage();
      case 'alarm_template':
        return const AlarmTemplatePage();
      case 'notifications':
        return const NotificationsPage();
      case 'ai_analytics':
        return const AiAnalyticsPage();
      case 'voltage_imbalance':
        return const VoltageImbalancePage();
      case 'current_imbalance':
        return const CurrentImbalancePage();
      case 'power_factor':
        return const PowerFactorPage();
      case 'energy_consumption':
        return const EnergyConsumptionPage();
      case 'anomalies':
        return const AnomaliesPage();
      default:
        return const DashboardPage();
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = _titles[_currentPage] ?? 'EmbedAIoT';
    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kNavy,
        foregroundColor: Colors.white,
        title: Text(
          title,
          style: const TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
        iconTheme: const IconThemeData(color: Colors.white),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_none_outlined, size: 22),
            onPressed: () => setState(() => _currentPage = 'notifications'),
          ),
          IconButton(
            icon: const Icon(Icons.person_outline, size: 22),
            onPressed: () {},
          ),
          IconButton(
            icon: const Icon(Icons.logout_outlined, size: 20),
            onPressed: () => Navigator.of(context).pop(),
          ),
        ],
        elevation: 0,
      ),
      drawer: AppDrawer(
        currentPage: _currentPage,
        onNavigate: (page) => setState(() => _currentPage = page),
      ),
      body: _buildBody(),
    );
  }
}
