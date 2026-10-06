import 'package:flutter/material.dart';
import '../../app_theme.dart';
import '../../services/theme_service.dart';
import '../../services/navigation_state.dart';
import '../ems_ui/ems_modal.dart';
import '../../data/ems_mock_data.dart';

class EmsTopbar extends StatelessWidget {
  final VoidCallback? onMenuPressed;

  const EmsTopbar({super.key, this.onMenuPressed});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final nav = NavigationState.instance;

    String currentRoleLabel;
    switch (nav.currentRole) {
      case EmsRole.superAdmin:
        currentRoleLabel = 'Super Admin';
        break;
      case EmsRole.orgAdmin:
        currentRoleLabel = 'Org Admin';
        break;
      case EmsRole.user:
        currentRoleLabel = 'User';
        break;
    }

    return Container(
      height: 56,
      decoration: BoxDecoration(
        color: isDark ? kEmsCardDark : Colors.white,
        border: Border(
          bottom: BorderSide(
            color: isDark ? kEmsBorderDark : kEmsBorderLight,
            width: 1,
          ),
        ),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14),
      child: Row(
        children: [
          // Mobile Menu Button
          if (onMenuPressed != null) ...[
            IconButton(
              icon: const Icon(Icons.menu, size: 20),
              color: isDark ? kEmsTextPrimaryDark : kEmsTextPrimaryLight,
              onPressed: onMenuPressed,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
            ),
            const SizedBox(width: 8),
          ],

          // Title & Breadcrumb
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  nav.pageTitle,
                  style: TextStyle(
                    color: isDark ? kEmsTextPrimaryDark : kEmsTextPrimaryLight,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  nav.breadcrumb,
                  style: const TextStyle(
                    color: kEmsTextMuted,
                    fontSize: 9.5,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.8,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),

          // Actions
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Dashboard View Switcher (Org vs User)
              Container(
                margin: const EdgeInsets.only(right: 8),
                padding: const EdgeInsets.all(2),
                decoration: BoxDecoration(
                  color: isDark ? kEmsSurface800Dark : kEmsSurface100Light,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: isDark ? kEmsBorderDark : kEmsBorder),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    InkWell(
                      onTap: () {
                        nav.setRole(EmsRole.orgAdmin);
                        nav.navigateTo('/dashboard', title: 'Organization Dashboard', breadcrumb: 'ORG / DASHBOARD');
                      },
                      borderRadius: BorderRadius.circular(14),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                        decoration: BoxDecoration(
                          color: nav.currentRole == EmsRole.orgAdmin ? kEmsPrimary : Colors.transparent,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Text(
                          'Org View',
                          style: TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w700,
                            color: nav.currentRole == EmsRole.orgAdmin ? Colors.white : (isDark ? kEmsTextMutedDark : kEmsTextMuted),
                          ),
                        ),
                      ),
                    ),
                    InkWell(
                      onTap: () {
                        nav.setRole(EmsRole.user);
                        nav.navigateTo('/dashboard', title: 'User Dashboard', breadcrumb: 'USER / DASHBOARD');
                      },
                      borderRadius: BorderRadius.circular(14),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                        decoration: BoxDecoration(
                          color: nav.currentRole == EmsRole.user ? kEmsPrimary : Colors.transparent,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Text(
                          'User View',
                          style: TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w700,
                            color: nav.currentRole == EmsRole.user ? Colors.white : (isDark ? kEmsTextMutedDark : kEmsTextMuted),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // Theme Toggle (Dark / Light)
              IconButton(
                icon: Icon(
                  isDark ? Icons.light_mode_outlined : Icons.dark_mode_outlined,
                  size: 18,
                  color: isDark ? kEmsPrimary : kEmsTextPrimaryLight,
                ),
                tooltip: 'Switch to ${isDark ? 'Light' : 'Dark'} Mode',
                onPressed: () => ThemeService.instance.toggleTheme(),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
              ),
              const SizedBox(width: 4),

              // Notifications Bell with Badge
              Stack(
                alignment: Alignment.topRight,
                children: [
                  IconButton(
                    icon: Icon(
                      Icons.notifications_outlined,
                      size: 20,
                      color: isDark ? kEmsTextPrimaryDark : kEmsTextPrimaryLight,
                    ),
                    onPressed: () {
                      _showNotificationsDialog(context);
                    },
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                  ),
                  Positioned(
                    top: 6,
                    right: 6,
                    child: Container(
                      width: 8,
                      height: 8,
                      decoration: const BoxDecoration(
                        color: kEmsPrimary,
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 8),

              // Role Switcher / Profile Dropdown
              PopupMenuButton<EmsRole>(
                tooltip: 'Switch User Role',
                onSelected: (role) {
                  nav.setRole(role);
                },
                color: isDark ? kEmsSidebarBg : Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                  side: BorderSide(
                    color: isDark ? kEmsBorderDark : kEmsBorderLight,
                  ),
                ),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: isDark ? kEmsSurface800Dark : kEmsSurface100Light,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: isDark ? kEmsBorderDark : kEmsBorderLight,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(11),
                        child: Image.asset(
                          'assets/admin_avatar.png',
                          width: 22,
                          height: 22,
                          fit: BoxFit.cover,
                          errorBuilder: (context, error, stackTrace) => CircleAvatar(
                            radius: 11,
                            backgroundColor: kEmsPrimary.withValues(alpha: 0.2),
                            child: const Icon(Icons.person, size: 13, color: kEmsPrimary),
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        currentRoleLabel,
                        style: TextStyle(
                          color: isDark ? kEmsTextPrimaryDark : kEmsTextPrimaryLight,
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const Icon(Icons.arrow_drop_down, size: 16, color: kEmsTextMuted),
                    ],
                  ),
                ),
                itemBuilder: (ctx) => [
                  const PopupMenuItem(
                    value: EmsRole.user,
                    child: Row(
                      children: [
                        Icon(Icons.person_outline, size: 16, color: kEmsPrimary),
                        SizedBox(width: 8),
                        Text('Switch to User Role', style: TextStyle(fontSize: 12)),
                      ],
                    ),
                  ),
                  const PopupMenuItem(
                    value: EmsRole.orgAdmin,
                    child: Row(
                      children: [
                        Icon(Icons.business_outlined, size: 16, color: kEmsPrimary),
                        SizedBox(width: 8),
                        Text('Switch to Org Admin', style: TextStyle(fontSize: 12)),
                      ],
                    ),
                  ),
                  const PopupMenuItem(
                    value: EmsRole.superAdmin,
                    child: Row(
                      children: [
                        Icon(Icons.admin_panel_settings_outlined, size: 16, color: kEmsPrimary),
                        SizedBox(width: 8),
                        Text('Switch to Super Admin', style: TextStyle(fontSize: 12)),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _showNotificationsDialog(BuildContext context) {
    EmsModal.show(
      context: context,
      title: 'Active Alarms & Notifications',
      confirmLabel: 'Clear All',
      cancelLabel: 'Close',
      content: SizedBox(
        width: 380,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: EmsMockData.anomalies.map((anom) {
            final isCritical = anom['severity'] == 'Critical';
            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: isCritical
                    ? kEmsDanger.withValues(alpha: 0.08)
                    : kEmsWarning.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: isCritical
                      ? kEmsDanger.withValues(alpha: 0.2)
                      : kEmsWarning.withValues(alpha: 0.2),
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    isCritical ? Icons.error_outline : Icons.warning_amber_rounded,
                    size: 18,
                    color: isCritical ? kEmsDanger : kEmsWarning,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          anom['title'] as String,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${anom['deviceName']} • ${anom['timestamp']}',
                          style: const TextStyle(color: kEmsTextMuted, fontSize: 10),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          }).toList(),
        ),
      ),
    );
  }
}
