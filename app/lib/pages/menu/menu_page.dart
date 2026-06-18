import 'package:flutter/material.dart';
import '../../app_theme.dart';
import '../../services/auth_service.dart';
import '../../services/ems_api.dart';
import '../schedule_page.dart';
import '../slab_rates_page.dart';
import '../interval_history_page.dart';
import '../alarm_history_page.dart';
import '../alarm_settings_page.dart';
import '../alarm_template_page.dart';
import '../notifications_page.dart';
import '../sensor_history_page.dart';
import '../subscription_page.dart';
import '../products_page.dart';
import '../ai_analytics/ai_analytics_page.dart';
import '../ai_analytics/voltage_imbalance_page.dart';
import '../ai_analytics/current_imbalance_page.dart';
import '../ai_analytics/power_factor_page.dart';
import '../ai_analytics/energy_consumption_page.dart';
import '../ai_analytics/anomalies_page.dart';
import '../dashboard/detail_page.dart';
import '../org/organization_page.dart';
import '../device_timestamps_page.dart';

class MenuPage extends StatefulWidget {
  const MenuPage({super.key});

  @override
  State<MenuPage> createState() => _MenuPageState();
}

class _MenuPageState extends State<MenuPage> {
  int _unread = 0;

  @override
  void initState() {
    super.initState();
    _loadUnread();
  }

  Future<void> _loadUnread() async {
    try {
      final n = await EmsApi.instance.getUnreadNotificationCount();
      if (mounted) setState(() => _unread = n);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final user = AuthService.instance.user;
    final showOrg = user?.canManageOrg == true;

    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kNavy,
        foregroundColor: Colors.white,
        automaticallyImplyLeading: false,
        title: const Text(
          'Menu',
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Colors.white),
        ),
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (showOrg) ...[
            _MenuSection(
              title: 'Organisation',
              items: [
                _MenuItem(
                  icon: Icons.business_outlined,
                  label: 'Organisation',
                  subtitle: 'Profile & settings',
                  color: kNavy,
                  onTap: () => _push(context, const OrganizationPage()),
                ),
                _MenuItem(
                  icon: Icons.people_outline,
                  label: 'Users',
                  subtitle: 'Manage team members',
                  color: kBlue,
                  onTap: () => _push(context, const OrganizationPage(initialTab: 1)),
                ),
                _MenuItem(
                  icon: Icons.router_outlined,
                  label: 'Gateways',
                  subtitle: 'Manage IoT gateways',
                  color: kGreen,
                  onTap: () => _push(context, const OrganizationPage(initialTab: 2)),
                ),
                _MenuItem(
                  icon: Icons.description_outlined,
                  label: 'Device Templates',
                  subtitle: 'Blueprint configurations',
                  color: kOrange,
                  onTap: () => _push(context, const OrganizationPage(initialTab: 3)),
                ),
                _MenuItem(
                  icon: Icons.contact_phone_outlined,
                  label: 'Alarm Contacts',
                  subtitle: 'Notification recipients',
                  color: kRed,
                  onTap: () => _push(context, const OrganizationPage(initialTab: 4)),
                ),
                _MenuItem(
                  icon: Icons.widgets_outlined,
                  label: 'Widget Templates',
                  subtitle: 'Dashboard card configuration',
                  color: kBlue,
                  onTap: () => _push(context, const OrganizationPage(initialTab: 5)),
                ),
              ],
            ),
            const SizedBox(height: 16),
          ],

          // ── Device Management ─────────────────────────────────────────────
          _MenuSection(
            title: 'Device Management',
            items: [
              _MenuItem(
                icon: Icons.list_alt_outlined,
                label: 'Dashboard Detail',
                subtitle: 'All live sensor readings',
                color: kBlue,
                onTap: () => _push(context, const DetailPage()),
              ),
              _MenuItem(
                icon: Icons.calendar_today_outlined,
                label: 'Schedule',
                subtitle: 'Manage scheduled tasks',
                color: kBlue,
                onTap: () => _push(context, const SchedulePage()),
              ),
              _MenuItem(
                icon: Icons.table_chart_outlined,
                label: 'Slab Rates',
                subtitle: 'Electricity tariff slabs',
                color: kGreen,
                onTap: () => _push(context, const SlabRatesPage()),
              ),
              _MenuItem(
                icon: Icons.history_outlined,
                label: 'Interval History',
                subtitle: 'Data recording intervals',
                color: kNavy,
                onTap: () => _push(context, const IntervalHistoryPage()),
              ),
              _MenuItem(
                icon: Icons.notifications_none_outlined,
                label: 'Alarm Templates',
                subtitle: 'Configure alert rules',
                color: kOrange,
                onTap: () => _push(context, const AlarmTemplatePage()),
              ),
              _MenuItem(
                icon: Icons.history_edu_outlined,
                label: 'Alarm History',
                subtitle: 'Variable alarms & linkage records',
                color: kRed,
                onTap: () => _push(context, const AlarmHistoryPage()),
              ),
              _MenuItem(
                icon: Icons.tune_outlined,
                label: 'Alarm Settings',
                subtitle: 'Configure notification channels',
                color: kOrange,
                onTap: () => _push(context, const AlarmSettingsPage()),
              ),
              _MenuItem(
                icon: Icons.sensors_outlined,
                label: 'Sensor History',
                subtitle: 'Raw sensor data & download',
                color: kBlue,
                onTap: () => _push(context, const SensorHistoryPage()),
              ),
              _MenuItem(
                icon: Icons.notifications_active_outlined,
                label: 'Notifications',
                subtitle: 'View alarm notifications',
                color: kRed,
                badge: _unread > 0 ? '$_unread' : null,
                onTap: () async {
                  await _push(context, const NotificationsPage());
                  _loadUnread();
                },
              ),
              if (showOrg)
                _MenuItem(
                  icon: Icons.access_time_outlined,
                  label: 'Device Connectivity',
                  subtitle: 'Last ping & online status',
                  color: kNavy,
                  onTap: () => _push(context, const DeviceTimestampsPage()),
                ),
            ],
          ),
          const SizedBox(height: 16),

          // ── AI Analytics ──────────────────────────────────────────────────
          _MenuSection(
            title: 'AI Analytics',
            items: [
              _MenuItem(
                icon: Icons.analytics_outlined,
                label: 'AI Analytics',
                subtitle: 'Overview & predictions',
                color: kNavy,
                onTap: () => _push(context, const AiAnalyticsPage()),
              ),
              _MenuItem(
                icon: Icons.electric_bolt_outlined,
                label: 'Voltage Imbalance',
                subtitle: 'Phase voltage analysis',
                color: kOrange,
                onTap: () => _push(context, const VoltageImbalancePage()),
              ),
              _MenuItem(
                icon: Icons.waves_outlined,
                label: 'Current Imbalance',
                subtitle: 'Current distribution',
                color: kBlue,
                onTap: () => _push(context, const CurrentImbalancePage()),
              ),
              _MenuItem(
                icon: Icons.battery_charging_full_outlined,
                label: 'Power Factor',
                subtitle: 'PF trends & anomalies',
                color: kGreen,
                onTap: () => _push(context, const PowerFactorPage()),
              ),
              _MenuItem(
                icon: Icons.bolt_outlined,
                label: 'Energy Consumption',
                subtitle: 'Consumption forecast',
                color: kNavy,
                onTap: () => _push(context, const EnergyConsumptionPage()),
              ),
              _MenuItem(
                icon: Icons.warning_amber_outlined,
                label: 'Anomalies',
                subtitle: 'Detected irregularities',
                color: kRed,
                onTap: () => _push(context, const AnomaliesPage()),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // ── Account ───────────────────────────────────────────────────────
          _MenuSection(
            title: 'Account',
            items: [
              if (showOrg)
                _MenuItem(
                  icon: Icons.card_membership_outlined,
                  label: 'Subscription',
                  subtitle: 'Plans & billing',
                  color: kBlue,
                  onTap: () => _push(context, const SubscriptionPage()),
                ),
              _MenuItem(
                icon: Icons.inventory_2_outlined,
                label: 'Products',
                subtitle: 'Hardware & software catalog',
                color: kGreen,
                onTap: () => _push(context, const ProductsPage()),
              ),
            ],
          ),
          const SizedBox(height: 24),

          // ── App version ───────────────────────────────────────────────────
          Center(
            child: Text(
              'EmbedAIoT v1.0.0  ·  © 2025 Smarter Solutions',
              style: TextStyle(fontSize: 11, color: Colors.grey.shade400),
            ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Future<void> _push(BuildContext context, Widget page) {
    return Navigator.push(context, MaterialPageRoute(builder: (_) => page));
  }
}

// ── Section ───────────────────────────────────────────────────────────────────
class _MenuSection extends StatelessWidget {
  const _MenuSection({required this.title, required this.items});
  final String title;
  final List<_MenuItem> items;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 10),
          child: Text(
            title.toUpperCase(),
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: Colors.grey.shade500,
              letterSpacing: 0.8,
            ),
          ),
        ),
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            boxShadow: [
              BoxShadow(
                color: kNavy.withValues(alpha: 0.05),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            children: List.generate(items.length, (i) {
              return Column(
                children: [
                  items[i],
                  if (i < items.length - 1)
                    Divider(height: 1, indent: 60, color: Colors.grey.shade100),
                ],
              );
            }),
          ),
        ),
      ],
    );
  }
}

// ── Menu Item ─────────────────────────────────────────────────────────────────
class _MenuItem extends StatelessWidget {
  const _MenuItem({
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.color,
    required this.onTap,
    this.badge,
  });
  final IconData icon;
  final String label;
  final String subtitle;
  final Color color;
  final VoidCallback onTap;
  final String? badge;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label,
                      style: const TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w600, color: kNavy)),
                  Text(subtitle,
                      style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
                ],
              ),
            ),
            if (badge != null) ...[
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: kRed,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  badge!,
                  style: const TextStyle(fontSize: 11, color: Colors.white, fontWeight: FontWeight.w700),
                ),
              ),
              const SizedBox(width: 8),
            ],
            Icon(Icons.arrow_forward_ios, size: 13, color: Colors.grey.shade300),
          ],
        ),
      ),
    );
  }
}
