import 'package:flutter/material.dart';
import '../app_theme.dart';

class AppDrawer extends StatefulWidget {
  final String currentPage;
  final ValueChanged<String> onNavigate;

  const AppDrawer({
    super.key,
    required this.currentPage,
    required this.onNavigate,
  });

  @override
  State<AppDrawer> createState() => _AppDrawerState();
}

class _AppDrawerState extends State<AppDrawer> {
  bool _dashboardExpanded = true;
  bool _aiExpanded = false;

  void _nav(String page) {
    widget.onNavigate(page);
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return Drawer(
      backgroundColor: Colors.white,
      child: Column(
        children: [
          // Header
          Container(
            width: double.infinity,
            color: kNavy,
            padding: const EdgeInsets.fromLTRB(20, 52, 20, 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Image.asset(
                  'assets/logo-removebg-preview.png',
                  height: 56,
                  fit: BoxFit.contain,
                ),
                const SizedBox(height: 8),
                Text(
                  'EmbedAIoT',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(vertical: 8),
              children: [
                _sectionHeader('Manage Dashboard', Icons.dashboard_outlined,
                    _dashboardExpanded, () {
                  setState(() => _dashboardExpanded = !_dashboardExpanded);
                }),
                if (_dashboardExpanded) ...[
                  _subItem('Dashboard', 'dashboard'),
                  _subItem('Detail', 'detail'),
                ],
                _navItem('Subscription', Icons.card_membership_outlined, 'subscription'),
                _navItem('Products', Icons.inventory_2_outlined, 'products'),
                _navItem('Schedule', Icons.calendar_today_outlined, 'schedule'),
                _navItem('Manage Slab Rates', Icons.table_chart_outlined, 'slab_rates'),
                _navItem('Manage Interval History', Icons.history_outlined, 'interval_history'),
                _navItem('Alarm Template', Icons.notifications_none_outlined, 'alarm_template'),
                _navItem('Notification', Icons.notifications_active_outlined, 'notifications'),
                _sectionHeader('Manage AI Analytics', Icons.analytics_outlined,
                    _aiExpanded, () {
                  setState(() => _aiExpanded = !_aiExpanded);
                }),
                if (_aiExpanded) ...[
                  _subItem('AI Analytics', 'ai_analytics'),
                  _subItem('Voltage Imbalance', 'voltage_imbalance'),
                  _subItem('Current Imbalance', 'current_imbalance'),
                  _subItem('Power Factor', 'power_factor'),
                  _subItem('Energy Consumption', 'energy_consumption'),
                  _subItem('Anomalies', 'anomalies'),
                ],
              ],
            ),
          ),
          // Footer
          Container(
            padding: const EdgeInsets.all(16),
            child: Text(
              '© 2025 EmbedAIoT · Smarter Solutions',
              style: TextStyle(
                color: Colors.grey.shade500,
                fontSize: 11,
              ),
              textAlign: TextAlign.center,
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionHeader(
      String label, IconData icon, bool expanded, VoidCallback onTap) {
    return ListTile(
      dense: true,
      leading: Icon(icon, color: kNavy, size: 20),
      title: Text(label,
          style: const TextStyle(
              color: kNavy, fontSize: 13, fontWeight: FontWeight.w600)),
      trailing: Icon(
        expanded ? Icons.expand_less : Icons.expand_more,
        color: Colors.grey.shade400,
        size: 18,
      ),
      onTap: onTap,
    );
  }

  Widget _subItem(String label, String page) {
    final active = widget.currentPage == page;
    return Padding(
      padding: const EdgeInsets.only(left: 16),
      child: ListTile(
        dense: true,
        leading: Container(
          width: 6,
          height: 6,
          decoration: BoxDecoration(
            color: active ? kBlue : Colors.grey.shade400,
            shape: BoxShape.circle,
          ),
        ),
        title: Text(label,
            style: TextStyle(
              color: active ? kBlue : Colors.grey.shade700,
              fontSize: 13,
              fontWeight: active ? FontWeight.w600 : FontWeight.w400,
            )),
        tileColor: active ? kBlue.withValues(alpha: 0.06) : null,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        onTap: () => _nav(page),
      ),
    );
  }

  Widget _navItem(String label, IconData icon, String page) {
    final active = widget.currentPage == page;
    return ListTile(
      dense: true,
      leading: Icon(icon,
          color: active ? kBlue : Colors.grey.shade500, size: 20),
      title: Text(label,
          style: TextStyle(
            color: active ? kBlue : Colors.grey.shade700,
            fontSize: 13,
            fontWeight: active ? FontWeight.w600 : FontWeight.w400,
          )),
      tileColor: active ? kBlue.withValues(alpha: 0.06) : null,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      onTap: () => _nav(page),
    );
  }
}
