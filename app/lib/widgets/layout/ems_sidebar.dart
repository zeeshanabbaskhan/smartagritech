import 'package:flutter/material.dart';
import '../../app_theme.dart';
import '../../services/auth_service.dart';
import '../../services/navigation_state.dart';

class EmsSidebarItem {
  final String label;
  final IconData icon;
  final String? route;
  final String? breadcrumb;
  final List<EmsSidebarItem>? children;
  final bool isDivider;

  const EmsSidebarItem({
    required this.label,
    required this.icon,
    this.route,
    this.breadcrumb,
    this.children,
    this.isDivider = false,
  });

  const EmsSidebarItem.divider(this.label)
      : icon = Icons.remove,
        route = null,
        breadcrumb = null,
        children = null,
        isDivider = true;
}

class EmsSidebar extends StatefulWidget {
  final VoidCallback? onItemTapped;

  const EmsSidebar({super.key, this.onItemTapped});

  @override
  State<EmsSidebar> createState() => _EmsSidebarState();
}

class _EmsSidebarState extends State<EmsSidebar> {
  final Set<String> _expandedAccordions = {'Manage Dashboard', 'Manage AI Analytics', 'EV Chargers'};

  List<EmsSidebarItem> _getNavItems(EmsRole role) {
    if (role == EmsRole.superAdmin) {
      return [
        const EmsSidebarItem.divider('MAIN'),
        const EmsSidebarItem(
          label: 'Dashboard',
          icon: Icons.dashboard_outlined,
          route: '/dashboard',
          breadcrumb: 'ADMIN / DASHBOARD',
        ),
        const EmsSidebarItem(
          label: 'Custom Dashboards',
          icon: Icons.dashboard_customize_outlined,
          route: '/custom-dashboard',
          breadcrumb: 'ADMIN / CUSTOM DASHBOARDS',
        ),
        const EmsSidebarItem.divider('MANAGEMENT'),
        const EmsSidebarItem(
          label: 'Organizations',
          icon: Icons.business_outlined,
          route: '/org-management',
          breadcrumb: 'ADMIN / ORGANIZATIONS',
        ),
        const EmsSidebarItem(
          label: 'Users',
          icon: Icons.people_outline,
          route: '/users',
          breadcrumb: 'ADMIN / USERS',
        ),
        const EmsSidebarItem(
          label: 'Manage Gateway',
          icon: Icons.router_outlined,
          route: '/gateways',
          breadcrumb: 'ADMIN / GATEWAYS',
        ),
        const EmsSidebarItem(
          label: 'MQTT Bridges',
          icon: Icons.sensors_outlined,
          route: '/mqtt-bridges',
          breadcrumb: 'ADMIN / MQTT BRIDGES',
        ),
        const EmsSidebarItem(
          label: 'Devices',
          icon: Icons.memory_outlined,
          route: '/devices',
          breadcrumb: 'ADMIN / DEVICES',
        ),
        const EmsSidebarItem(
          label: 'Device Templates',
          icon: Icons.description_outlined,
          route: '/device-templates',
          breadcrumb: 'ADMIN / DEVICE TEMPLATES',
        ),
        const EmsSidebarItem(
          label: 'Access Groups',
          icon: Icons.shield_outlined,
          route: '/access-groups',
          breadcrumb: 'ADMIN / ACCESS GROUPS',
        ),
        const EmsSidebarItem(
          label: 'Device Groups',
          icon: Icons.inventory_2_outlined,
          route: '/device-groups',
          breadcrumb: 'ADMIN / DEVICE GROUPS',
        ),
        const EmsSidebarItem(
          label: 'Manage Icons',
          icon: Icons.sentiment_satisfied_alt_outlined,
          route: '/icons',
          breadcrumb: 'ADMIN / ICONS',
        ),
        const EmsSidebarItem(
          label: 'Manage Products',
          icon: Icons.inventory_outlined,
          route: '/products',
          breadcrumb: 'ADMIN / PRODUCTS',
        ),
        const EmsSidebarItem(
          label: 'Manage List',
          icon: Icons.format_list_bulleted_outlined,
          route: '/lists',
          breadcrumb: 'ADMIN / LISTS',
        ),
        const EmsSidebarItem.divider('DATA'),
        const EmsSidebarItem(
          label: 'Data Center',
          icon: Icons.storage_outlined,
          route: '/data-center',
          breadcrumb: 'ADMIN / DATA CENTER',
        ),
        const EmsSidebarItem(
          label: 'Historical Data',
          icon: Icons.history_outlined,
          route: '/historical-data',
          breadcrumb: 'ADMIN / HISTORICAL DATA',
        ),
        const EmsSidebarItem(
          label: 'Variable Alarms',
          icon: Icons.insights_outlined,
          route: '/variable-alarms',
          breadcrumb: 'ADMIN / VARIABLE ALARMS',
        ),
        const EmsSidebarItem(
          label: 'Linkage Records',
          icon: Icons.link_outlined,
          route: '/linkage-records',
          breadcrumb: 'ADMIN / LINKAGE RECORDS',
        ),
        const EmsSidebarItem.divider('ALARMS'),
        const EmsSidebarItem(
          label: 'Template Triggers',
          icon: Icons.notifications_none_outlined,
          route: '/template-triggers',
          breadcrumb: 'ADMIN / TEMPLATE TRIGGERS',
        ),
        const EmsSidebarItem(
          label: 'Alarm Settings',
          icon: Icons.alarm_outlined,
          route: '/alarm-settings',
          breadcrumb: 'ADMIN / ALARM SETTINGS',
        ),
        const EmsSidebarItem(
          label: 'Alarm Contacts',
          icon: Icons.contacts_outlined,
          route: '/alarm-contacts',
          breadcrumb: 'ADMIN / ALARM CONTACTS',
        ),
        const EmsSidebarItem.divider('SYSTEM'),
        const EmsSidebarItem(
          label: 'Device Timestamps',
          icon: Icons.timer_outlined,
          route: '/device-timestamps',
          breadcrumb: 'ADMIN / DEVICE TIMESTAMPS',
        ),
        const EmsSidebarItem(
          label: 'Schedule Tasks',
          icon: Icons.calendar_month_outlined,
          route: '/schedule',
          breadcrumb: 'ADMIN / SCHEDULE TASKS',
        ),
        const EmsSidebarItem(
          label: 'Theme Settings',
          icon: Icons.palette_outlined,
          route: '/theme-settings',
          breadcrumb: 'ADMIN / THEME SETTINGS',
        ),
      ];
    } else if (role == EmsRole.orgAdmin) {
      return [
        const EmsSidebarItem.divider('MAIN'),
        const EmsSidebarItem(
          label: 'Dashboard',
          icon: Icons.dashboard_outlined,
          route: '/org-dashboard',
          breadcrumb: 'ORG / DASHBOARD',
        ),
        const EmsSidebarItem(
          label: 'Custom Dashboards',
          icon: Icons.dashboard_customize_outlined,
          route: '/custom-dashboard',
          breadcrumb: 'ORG / CUSTOM DASHBOARDS',
        ),
        const EmsSidebarItem.divider('DEVICES'),
        const EmsSidebarItem(
          label: 'My Devices',
          icon: Icons.memory_outlined,
          route: '/devices',
          breadcrumb: 'ORG / DEVICES',
        ),
        const EmsSidebarItem(
          label: 'Access Groups',
          icon: Icons.shield_outlined,
          route: '/access-groups',
          breadcrumb: 'ORG / ACCESS GROUPS',
        ),
        const EmsSidebarItem(
          label: 'Device Groups',
          icon: Icons.inventory_2_outlined,
          route: '/device-groups',
          breadcrumb: 'ORG / DEVICE GROUPS',
        ),
        const EmsSidebarItem(
          label: 'EV Chargers',
          icon: Icons.electric_bolt_outlined,
          children: [
            EmsSidebarItem(
              label: 'Live Session',
              icon: Icons.bolt,
              route: '/ev-live-session',
              breadcrumb: 'EV CHARGERS / LIVE SESSION',
            ),
            EmsSidebarItem(
              label: 'Analytics',
              icon: Icons.bar_chart,
              route: '/ev-analytics',
              breadcrumb: 'EV CHARGERS / ANALYTICS',
            ),
            EmsSidebarItem(
              label: 'Energy Hub',
              icon: Icons.battery_charging_full,
              route: '/ev-energy-hub',
              breadcrumb: 'EV CHARGERS / ENERGY HUB',
            ),
            EmsSidebarItem(
              label: 'V2G / Exports',
              icon: Icons.sync_alt,
              route: '/ev-v2g',
              breadcrumb: 'EV CHARGERS / V2G EXPORTS',
            ),
            EmsSidebarItem(
              label: 'AI Decision Log',
              icon: Icons.smart_toy_outlined,
              route: '/ev-ai-log',
              breadcrumb: 'EV CHARGERS / AI LOG',
            ),
            EmsSidebarItem(
              label: 'Fleet',
              icon: Icons.directions_car_outlined,
              route: '/ev-fleet',
              breadcrumb: 'EV CHARGERS / FLEET',
            ),
            EmsSidebarItem(
              label: 'Profile',
              icon: Icons.account_circle_outlined,
              route: '/ev-profile',
              breadcrumb: 'EV CHARGERS / PROFILE',
            ),
            EmsSidebarItem(
              label: 'Control System',
              icon: Icons.tune,
              route: '/ev-control',
              breadcrumb: 'EV CHARGERS / CONTROL',
            ),
          ],
        ),
        const EmsSidebarItem.divider('DATA'),
        const EmsSidebarItem(
          label: 'AI Analytics',
          icon: Icons.auto_awesome_outlined,
          children: [
            EmsSidebarItem(
              label: 'Voltage Imbalance',
              icon: Icons.speed_outlined,
              route: '/voltage-imbalance',
              breadcrumb: 'AI / VOLTAGE IMBALANCE',
            ),
            EmsSidebarItem(
              label: 'Current Imbalance',
              icon: Icons.show_chart,
              route: '/current-imbalance',
              breadcrumb: 'AI / CURRENT IMBALANCE',
            ),
            EmsSidebarItem(
              label: 'Power Factor',
              icon: Icons.trending_up,
              route: '/power-factor',
              breadcrumb: 'AI / POWER FACTOR',
            ),
            EmsSidebarItem(
              label: 'Energy Consumption',
              icon: Icons.bolt,
              route: '/energy-consumption',
              breadcrumb: 'AI / ENERGY CONSUMPTION',
            ),
            EmsSidebarItem(
              label: 'Anomalies',
              icon: Icons.warning_amber_rounded,
              route: '/anomalies',
              breadcrumb: 'AI / ANOMALIES',
            ),
          ],
        ),
        const EmsSidebarItem(
          label: 'Historical Data',
          icon: Icons.history_outlined,
          route: '/historical-data',
          breadcrumb: 'ORG / HISTORICAL DATA',
        ),
        const EmsSidebarItem.divider('ALARMS'),
        const EmsSidebarItem(
          label: 'Template Triggers',
          icon: Icons.notifications_none_outlined,
          route: '/template-triggers',
          breadcrumb: 'ORG / TEMPLATE TRIGGERS',
        ),
        const EmsSidebarItem(
          label: 'Alarm Settings',
          icon: Icons.alarm_outlined,
          route: '/alarm-settings',
          breadcrumb: 'ORG / ALARM SETTINGS',
        ),
        const EmsSidebarItem(
          label: 'Alarm Contacts',
          icon: Icons.contacts_outlined,
          route: '/alarm-contacts',
          breadcrumb: 'ORG / ALARM CONTACTS',
        ),
        const EmsSidebarItem.divider('SYSTEM'),
        const EmsSidebarItem(
          label: 'Schedule Tasks',
          icon: Icons.calendar_month_outlined,
          route: '/schedule',
          breadcrumb: 'ORG / SCHEDULE TASKS',
        ),
        const EmsSidebarItem(
          label: 'Settings',
          icon: Icons.settings_outlined,
          route: '/settings',
          breadcrumb: 'ORG / SETTINGS',
        ),
      ];
    } else {
      // Standard User Nav
      return [
        const EmsSidebarItem(
          label: 'Manage Dashboard',
          icon: Icons.dashboard_outlined,
          children: [
            EmsSidebarItem(
              label: 'Dashboard',
              icon: Icons.space_dashboard_outlined,
              route: '/user-dashboard',
              breadcrumb: 'USER / DASHBOARD',
            ),
            EmsSidebarItem(
              label: 'Detail',
              icon: Icons.speed_outlined,
              route: '/dashboard-detail',
              breadcrumb: 'USER / DETAIL',
            ),
            EmsSidebarItem(
              label: 'Custom Dashboards',
              icon: Icons.dashboard_customize_outlined,
              route: '/custom-dashboard',
              breadcrumb: 'USER / CUSTOM DASHBOARDS',
            ),
          ],
        ),
        const EmsSidebarItem(
          label: 'Subscription',
          icon: Icons.credit_card_outlined,
          route: '/subscription',
          breadcrumb: 'USER / SUBSCRIPTION',
        ),
        const EmsSidebarItem(
          label: 'Products',
          icon: Icons.shopping_bag_outlined,
          route: '/products',
          breadcrumb: 'USER / PRODUCTS',
        ),
        const EmsSidebarItem(
          label: 'Schedule',
          icon: Icons.calendar_today_outlined,
          route: '/schedule',
          breadcrumb: 'USER / SCHEDULE',
        ),
        const EmsSidebarItem(
          label: 'Manage Slab Rates',
          icon: Icons.layers_outlined,
          route: '/slab-rates',
          breadcrumb: 'USER / SLAB RATES',
        ),
        const EmsSidebarItem(
          label: 'Manage Interval History',
          icon: Icons.access_time_outlined,
          route: '/interval-history',
          breadcrumb: 'USER / INTERVAL HISTORY',
        ),
        const EmsSidebarItem(
          label: 'Alarm Template',
          icon: Icons.notifications_active_outlined,
          route: '/alarm-template',
          breadcrumb: 'USER / ALARM TEMPLATE',
        ),
        const EmsSidebarItem(
          label: 'Notification',
          icon: Icons.notifications_outlined,
          route: '/notifications',
          breadcrumb: 'USER / NOTIFICATIONS',
        ),
        const EmsSidebarItem(
          label: 'Manage AI Analytics',
          icon: Icons.auto_awesome_outlined,
          children: [
            EmsSidebarItem(
              label: 'AI Analytics',
              icon: Icons.insights_outlined,
              route: '/ai-analytics',
              breadcrumb: 'AI / ANALYTICS',
            ),
            EmsSidebarItem(
              label: 'Voltage Imbalance',
              icon: Icons.speed_outlined,
              route: '/voltage-imbalance',
              breadcrumb: 'AI / VOLTAGE IMBALANCE',
            ),
            EmsSidebarItem(
              label: 'Current Imbalance',
              icon: Icons.show_chart,
              route: '/current-imbalance',
              breadcrumb: 'AI / CURRENT IMBALANCE',
            ),
            EmsSidebarItem(
              label: 'Power Factor',
              icon: Icons.trending_up,
              route: '/power-factor',
              breadcrumb: 'AI / POWER FACTOR',
            ),
            EmsSidebarItem(
              label: 'Energy Consumption',
              icon: Icons.bolt,
              route: '/energy-consumption',
              breadcrumb: 'AI / ENERGY CONSUMPTION',
            ),
            EmsSidebarItem(
              label: 'Anomalies',
              icon: Icons.warning_amber_rounded,
              route: '/anomalies',
              breadcrumb: 'AI / ANOMALIES',
            ),
          ],
        ),
      ];
    }
  }

  @override
  Widget build(BuildContext context) {
    final nav = NavigationState.instance;
    final currentRoute = nav.currentRoute;
    final items = _getNavItems(nav.currentRole);

    String roleBadge;
    switch (nav.currentRole) {
      case EmsRole.superAdmin:
        roleBadge = 'Super Admin';
        break;
      case EmsRole.orgAdmin:
        roleBadge = 'Org Admin';
        break;
      case EmsRole.user:
        roleBadge = 'User';
        break;
    }

    return Container(
      width: 250,
      color: kEmsSidebarBg,
      child: Column(
        children: [
          // Header: Brand & Logo
          Container(
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 16),
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: Color(0xFF1F2937), width: 1)),
            ),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(9),
                  ),
                  padding: const EdgeInsets.all(4),
                  child: Image.asset(
                    'assets/elsa_logo.jpeg',
                    fit: BoxFit.contain,
                    errorBuilder: (context, error, stackTrace) => const Icon(Icons.bolt, color: kEmsPrimary, size: 22),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Elsa Energy',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.2,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                        decoration: BoxDecoration(
                          color: kEmsPrimary.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          roleBadge.toUpperCase(),
                          style: const TextStyle(
                            color: kEmsPrimary,
                            fontSize: 9,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.6,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Nav Items Scroll List
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 14),
              children: items.map((item) {
                if (item.isDivider) {
                  return Padding(
                    padding: const EdgeInsets.fromLTRB(10, 14, 10, 6),
                    child: Text(
                      item.label,
                      style: const TextStyle(
                        color: Color(0xFF6B7280),
                        fontSize: 9.5,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.2,
                      ),
                    ),
                  );
                }

                if (item.children != null && item.children!.isNotEmpty) {
                  final isExpanded = _expandedAccordions.contains(item.label);
                  final hasActiveChild = item.children!.any((c) => c.route == currentRoute);

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      InkWell(
                        onTap: () {
                          setState(() {
                            if (isExpanded) {
                              _expandedAccordions.remove(item.label);
                            } else {
                              _expandedAccordions.add(item.label);
                            }
                          });
                        },
                        borderRadius: BorderRadius.circular(8),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
                          child: Row(
                            children: [
                              Icon(
                                item.icon,
                                size: 16,
                                color: hasActiveChild ? kEmsPrimary : const Color(0xFF9AA09A),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  item.label,
                                  style: TextStyle(
                                    color: hasActiveChild ? Colors.white : const Color(0xFFD1D5C8),
                                    fontSize: 12.5,
                                    fontWeight: hasActiveChild ? FontWeight.w700 : FontWeight.w500,
                                  ),
                                ),
                              ),
                              Icon(
                                isExpanded ? Icons.keyboard_arrow_down : Icons.keyboard_arrow_right,
                                size: 14,
                                color: const Color(0xFF6B7280),
                              ),
                            ],
                          ),
                        ),
                      ),
                      if (isExpanded)
                        Padding(
                          padding: const EdgeInsets.only(left: 14),
                          child: Container(
                            decoration: const BoxDecoration(
                              border: Border(left: BorderSide(color: Color(0xFF1F2937), width: 1.5)),
                            ),
                            margin: const EdgeInsets.only(left: 12),
                            padding: const EdgeInsets.only(left: 6),
                            child: Column(
                              children: item.children!.map((child) {
                                final isActive = child.route == currentRoute;
                                return _buildNavLink(
                                  label: child.label,
                                  icon: child.icon,
                                  isActive: isActive,
                                  onTap: () {
                                    if (child.route != null) {
                                      nav.navigateTo(
                                        child.route!,
                                        title: child.label,
                                        breadcrumb: child.breadcrumb ?? 'EMS',
                                      );
                                      widget.onItemTapped?.call();
                                    }
                                  },
                                );
                              }).toList(),
                            ),
                          ),
                        ),
                    ],
                  );
                }

                // Simple Nav Link
                final isActive = item.route == currentRoute;
                return _buildNavLink(
                  label: item.label,
                  icon: item.icon,
                  isActive: isActive,
                  onTap: () {
                    if (item.route != null) {
                      nav.navigateTo(
                        item.route!,
                        title: item.label,
                        breadcrumb: item.breadcrumb ?? 'EMS',
                      );
                      widget.onItemTapped?.call();
                    }
                  },
                );
              }).toList(),
            ),
          ),

          // Bottom Bar: User Card (matching Sidebar.jsx)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: const BoxDecoration(
              color: Color(0xFF0E131F),
              border: Border(top: BorderSide(color: Color(0xFF1F2937), width: 1)),
            ),
            child: Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: Image.asset(
                    'assets/admin_avatar.png',
                    width: 32,
                    height: 32,
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) => Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: kEmsPrimary.withValues(alpha: 0.15),
                        shape: BoxShape.circle,
                        border: Border.all(color: kEmsPrimary.withValues(alpha: 0.3)),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        (AuthService.instance.user?.fullName.isNotEmpty == true
                                ? AuthService.instance.user!.fullName[0]
                                : 'U')
                            .toUpperCase(),
                        style: const TextStyle(color: kEmsPrimary, fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        AuthService.instance.user?.fullName ??
                            (nav.currentRole == EmsRole.orgAdmin ? 'Ambition Admin' : 'User'),
                        style: const TextStyle(
                          color: Color(0xFFECEEE6),
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (AuthService.instance.user?.organization?['name'] != null ||
                          nav.currentRole == EmsRole.orgAdmin)
                        Text(
                          AuthService.instance.user?.organization?['name']?.toString() ?? 'Ambition',
                          style: const TextStyle(
                            color: Color(0xFF60A5FA),
                            fontSize: 9.5,
                            fontWeight: FontWeight.w600,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      Text(
                        roleBadge.toUpperCase(),
                        style: const TextStyle(
                          color: kEmsPrimary,
                          fontSize: 8.5,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNavLink({
    required String label,
    required IconData icon,
    required bool isActive,
    required VoidCallback onTap,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 2),
      decoration: BoxDecoration(
        color: isActive ? kEmsPrimary.withValues(alpha: 0.12) : Colors.transparent,
        borderRadius: const BorderRadius.horizontal(right: Radius.circular(8)),
        border: isActive
            ? const Border(left: BorderSide(color: kEmsPrimary, width: 2.5))
            : null,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8.5),
            child: Row(
              children: [
                Icon(
                  icon,
                  size: 16,
                  color: isActive ? kEmsPrimary : const Color(0xFF9AA09A),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    label,
                    style: TextStyle(
                      color: isActive ? kEmsPrimary : const Color(0xFFD1D5C8),
                      fontSize: 12.5,
                      fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
