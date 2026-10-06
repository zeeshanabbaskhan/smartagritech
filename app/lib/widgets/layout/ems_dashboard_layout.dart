import 'package:flutter/material.dart';
import '../../app_theme.dart';
import '../../services/navigation_state.dart';
import '../../services/theme_service.dart';
import '../../services/auth_service.dart';
import 'ems_sidebar.dart';

class EmsDashboardLayout extends StatefulWidget {
  final Widget child;

  const EmsDashboardLayout({super.key, required this.child});

  @override
  State<EmsDashboardLayout> createState() => _EmsDashboardLayoutState();
}

class _EmsDashboardLayoutState extends State<EmsDashboardLayout> {
  bool _phoneFrameEnabled = true;
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  int _currentIndex(String route) {
    if (route == '/org' ||
        route == '/org-dashboard' ||
        route == '/user' ||
        route == '/user-dashboard' ||
        route == '/dashboard' ||
        route == '/admin') {
      return 0;
    }
    if (route == '/custom-dashboard' || route.startsWith('/custom-dashboard')) {
      return 1;
    }
    if (route == '/devices' || route.startsWith('/device')) {
      return 2;
    }
    if (route.startsWith('/ai-analytics') ||
        route == '/voltage-imbalance' ||
        route == '/current-imbalance' ||
        route == '/power-factor' ||
        route == '/energy-consumption' ||
        route == '/anomalies') {
      return 3;
    }
    if (route == '/menu' ||
        route == '/settings' ||
        route == '/notifications' ||
        route.startsWith('/org-') ||
        route == '/gateways' ||
        route == '/users' ||
        route == '/account-settings') {
      return 4;
    }
    return 0;
  }

  void _onBottomNavTapped(int index) {
    final nav = NavigationState.instance;
    switch (index) {
      case 0:
        if (nav.currentRole == EmsRole.orgAdmin) {
          nav.navigateTo('/org-dashboard', title: 'Organization Dashboard', breadcrumb: 'ORG / DASHBOARD');
        } else if (nav.currentRole == EmsRole.superAdmin) {
          nav.navigateTo('/dashboard', title: 'Admin Dashboard', breadcrumb: 'ADMIN / DASHBOARD');
        } else {
          nav.navigateTo('/user-dashboard', title: 'User Dashboard', breadcrumb: 'USER / DASHBOARD');
        }
        break;
      case 1:
        nav.navigateTo('/custom-dashboard', title: 'Custom Dashboards', breadcrumb: 'EMS / CUSTOM DASHBOARDS');
        break;
      case 2:
        nav.navigateTo('/devices', title: 'My Devices', breadcrumb: 'EMS / DEVICES');
        break;
      case 3:
        nav.navigateTo('/ai-analytics', title: 'AI Analytics', breadcrumb: 'AI / ANALYTICS');
        break;
      case 4:
        if (_scaffoldKey.currentState != null) {
          if (_scaffoldKey.currentState!.isDrawerOpen) {
            _scaffoldKey.currentState!.closeDrawer();
          } else {
            _scaffoldKey.currentState!.openDrawer();
          }
        } else {
          nav.navigateTo('/menu', title: 'Menu', breadcrumb: 'EMS / MENU');
        }
        break;
    }
  }

  void _showProfileSheet(BuildContext context, bool isDark) {
    final user = AuthService.instance.user;
    final nav = NavigationState.instance;

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: isDark ? kEmsCardDark : Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          border: Border.all(color: isDark ? kEmsBorderDark : kEmsBorder),
        ),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Drag Handle
              Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: 18),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF374151) : const Color(0xFFE5E7EB),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),

              // User Info
              Row(
                children: [
                  CircleAvatar(
                    radius: 24,
                    backgroundColor: kEmsPrimary,
                    child: Text(
                      user?.initials ?? 'U',
                      style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          user?.fullName.isNotEmpty == true ? user!.fullName : 'EMS Operator',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            color: isDark ? Colors.white : kEmsTextHeading,
                          ),
                        ),
                        Text(
                          user?.email ?? 'operator@embedaiot.com',
                          style: TextStyle(
                            fontSize: 12,
                            color: isDark ? kEmsTextMutedDark : kEmsTextMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: kEmsPrimary.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      nav.currentRole == EmsRole.orgAdmin ? 'ORG ADMIN' : 'USER',
                      style: const TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                        color: kEmsPrimaryDark,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              const Divider(height: 1),
              const SizedBox(height: 12),

              // Switch View
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF3B82F6).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.sync_alt, color: Color(0xFF3B82F6), size: 18),
                ),
                title: Text(
                  nav.currentRole == EmsRole.orgAdmin ? 'Switch to User View' : 'Switch to Org View',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: isDark ? Colors.white : kEmsTextHeading),
                ),
                subtitle: Text(
                  nav.currentRole == EmsRole.orgAdmin ? 'View end-user meter readouts' : 'View executive energy distribution',
                  style: TextStyle(fontSize: 11, color: isDark ? kEmsTextMutedDark : kEmsTextMuted),
                ),
                onTap: () {
                  Navigator.pop(ctx);
                  nav.setRole(nav.currentRole == EmsRole.orgAdmin ? EmsRole.user : EmsRole.orgAdmin);
                },
              ),

              // Account Settings
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF8B5CF6).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.settings_outlined, color: Color(0xFF8B5CF6), size: 18),
                ),
                title: Text('Account Settings', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: isDark ? Colors.white : kEmsTextHeading)),
                onTap: () {
                  Navigator.pop(ctx);
                  nav.navigateTo('/account-settings', title: 'Settings', breadcrumb: 'ACCOUNT / SETTINGS');
                },
              ),

              // Logout
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: kEmsDanger.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.logout, color: kEmsDanger, size: 18),
                ),
                title: const Text('Sign Out', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: kEmsDanger)),
                onTap: () {
                  Navigator.pop(ctx);
                  AuthService.instance.logout();
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final nav = NavigationState.instance;
    final theme = ThemeService.instance;
    final isDark = theme.isDark;
    final activeIndex = _currentIndex(nav.currentRoute);

    return AnimatedBuilder(
      animation: nav,
      builder: (context, _) {
        return LayoutBuilder(
          builder: (context, constraints) {
            final isDesktop = constraints.maxWidth >= 768;

            Widget mobileAppScaffold = Scaffold(
              key: _scaffoldKey,
              backgroundColor: isDark ? kEmsBgDark : kEmsBgLight,
              drawer: Drawer(
                backgroundColor: const Color(0xFF0A0D14),
                child: SafeArea(
                  child: EmsSidebar(
                    onItemTapped: () {
                      if (_scaffoldKey.currentState?.isDrawerOpen == true) {
                        Navigator.of(context).pop();
                      }
                    },
                  ),
                ),
              ),
              appBar: PreferredSize(
                preferredSize: const Size.fromHeight(56),
                child: Container(
                  height: 56,
                  decoration: BoxDecoration(
                    color: isDark ? kEmsCardDark : Colors.white,
                    border: Border(
                      bottom: BorderSide(
                        color: isDark ? kEmsBorderDark : kEmsBorder,
                        width: 1,
                      ),
                    ),
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  child: Row(
                    children: [
                      // Hamburger Menu Button (opens Elsa Energy complete drawer)
                      IconButton(
                        icon: const Icon(Icons.menu_rounded, size: 22),
                        color: isDark ? Colors.white : kEmsTextHeading,
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                        tooltip: 'Navigation Menu',
                        onPressed: () {
                          _scaffoldKey.currentState?.openDrawer();
                        },
                      ),
                      const SizedBox(width: 4),

                      // Brand Logo Squircle
                      Container(
                        width: 32,
                        height: 32,
                        padding: const EdgeInsets.all(3),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: isDark ? kEmsBorderDark : kEmsBorder),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.06),
                              blurRadius: 4,
                            ),
                          ],
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(6),
                          child: Image.asset(
                            'assets/elsa_logo.jpeg',
                            fit: BoxFit.contain,
                            errorBuilder: (context, error, stackTrace) => const Icon(Icons.bolt, color: kEmsPrimary, size: 20),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),

                      // Brand Name + Live Badge
                      Expanded(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(
                                  'Elsa Energy',
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w800,
                                    color: isDark ? Colors.white : kEmsTextHeading,
                                    letterSpacing: -0.2,
                                  ),
                                ),
                                const SizedBox(width: 5),
                                Container(
                                  width: 5,
                                  height: 5,
                                  decoration: const BoxDecoration(
                                    color: Color(0xFF22C55E),
                                    shape: BoxShape.circle,
                                  ),
                                ),
                              ],
                            ),
                            Text(
                              nav.currentRole == EmsRole.orgAdmin
                                  ? 'Ambition • Energy Hub'
                                  : (nav.currentRole == EmsRole.superAdmin ? 'Super Admin • Platform' : 'User View • Meter Readouts'),
                              style: const TextStyle(
                                fontSize: 9.5,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF9AA09A),
                              ),
                            ),
                          ],
                        ),
                      ),

                      // View Switcher Pill
                      InkWell(
                        onTap: () {
                          nav.setRole(nav.currentRole == EmsRole.orgAdmin ? EmsRole.user : EmsRole.orgAdmin);
                        },
                        borderRadius: BorderRadius.circular(14),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: kEmsPrimary.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: kEmsPrimary.withValues(alpha: 0.3)),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.swap_horiz, size: 12, color: kEmsPrimaryDark),
                              const SizedBox(width: 4),
                              Text(
                                nav.currentRole == EmsRole.orgAdmin ? 'Org' : 'User',
                                style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: kEmsPrimaryDark),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),

                      // Theme Toggle (Sun/Moon)
                      IconButton(
                        icon: Icon(
                          isDark ? Icons.light_mode_outlined : Icons.dark_mode_outlined,
                          size: 18,
                          color: isDark ? const Color(0xFFFCD34D) : const Color(0xFF4B5563),
                        ),
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(minWidth: 30, minHeight: 30),
                        onPressed: () => theme.toggleTheme(),
                      ),

                      // Notifications Bell (with Red Badge for 1 active alarm)
                      Stack(
                        clipBehavior: Clip.none,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.notifications_none_outlined, size: 19),
                            color: isDark ? Colors.white : kEmsTextHeading,
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(minWidth: 30, minHeight: 30),
                            onPressed: () {
                              nav.navigateTo('/notifications', title: 'Notifications', breadcrumb: 'EMS / NOTIFICATIONS');
                            },
                          ),
                          Positioned(
                            top: 4,
                            right: 4,
                            child: Container(
                              width: 7,
                              height: 7,
                              decoration: const BoxDecoration(
                                color: Color(0xFFEF4444),
                                shape: BoxShape.circle,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(width: 4),

                      // User Avatar Button
                      InkWell(
                        onTap: () => _showProfileSheet(context, isDark),
                        borderRadius: BorderRadius.circular(99),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(16),
                          child: Image.asset(
                            'assets/admin_avatar.png',
                            width: 28,
                            height: 28,
                            fit: BoxFit.cover,
                            errorBuilder: (context, error, stackTrace) => CircleAvatar(
                              radius: 14,
                              backgroundColor: isDark ? const Color(0xFF374151) : const Color(0xFFE5E7EB),
                              child: const Icon(Icons.person_outline, size: 16, color: kEmsPrimaryDark),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              body: widget.child,
              bottomNavigationBar: Container(
                decoration: BoxDecoration(
                  color: isDark ? kEmsCardDark : Colors.white,
                  border: Border(
                    top: BorderSide(
                      color: isDark ? kEmsBorderDark : kEmsBorder,
                      width: 1,
                    ),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.05),
                      blurRadius: 10,
                      offset: const Offset(0, -2),
                    ),
                  ],
                ),
                child: SafeArea(
                  child: Container(
                    height: 58,
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        _buildNavItem(
                          icon: Icons.bolt_rounded,
                          label: 'Dashboard',
                          selected: activeIndex == 0,
                          onTap: () => _onBottomNavTapped(0),
                          isDark: isDark,
                        ),
                        _buildNavItem(
                          icon: Icons.dashboard_customize_outlined,
                          label: 'Custom',
                          selected: activeIndex == 1,
                          onTap: () => _onBottomNavTapped(1),
                          isDark: isDark,
                        ),
                        _buildNavItem(
                          icon: Icons.memory_outlined,
                          label: 'Devices',
                          selected: activeIndex == 2,
                          onTap: () => _onBottomNavTapped(2),
                          isDark: isDark,
                        ),
                        _buildNavItem(
                          icon: Icons.insights_rounded,
                          label: 'Analytics',
                          selected: activeIndex == 3,
                          onTap: () => _onBottomNavTapped(3),
                          isDark: isDark,
                        ),
                        _buildNavItem(
                          icon: Icons.menu_rounded,
                          label: 'Menu',
                          selected: activeIndex == 4,
                          onTap: () => _onBottomNavTapped(4),
                          isDark: isDark,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );

            // On desktop browser: center the mobile app inside an authentic mobile smartphone viewport
            if (isDesktop && _phoneFrameEnabled) {
              return Scaffold(
                backgroundColor: isDark ? const Color(0xFF07090E) : const Color(0xFFEDF0E8),
                body: Stack(
                  children: [
                    Center(
                      child: Container(
                        width: 480,
                        height: MediaQuery.of(context).size.height * 0.96,
                        margin: const EdgeInsets.symmetric(vertical: 16),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(32),
                          border: Border.all(
                            color: isDark ? const Color(0xFF262E40) : const Color(0xFFD5D9CE),
                            width: 3,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: isDark ? 0.6 : 0.15),
                              blurRadius: 36,
                              offset: const Offset(0, 12),
                            ),
                          ],
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(29),
                          child: mobileAppScaffold,
                        ),
                      ),
                    ),
                    // Frame mode toggle button in top right
                    Positioned(
                      top: 14,
                      right: 18,
                      child: InkWell(
                        onTap: () => setState(() => _phoneFrameEnabled = false),
                        borderRadius: BorderRadius.circular(20),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: isDark ? kEmsCardDark : Colors.white,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: isDark ? kEmsBorderDark : kEmsBorder),
                            boxShadow: kEmsCardShadow,
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.fullscreen, size: 14, color: kEmsPrimary),
                              const SizedBox(width: 5),
                              Text(
                                'Full Width Mobile',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: isDark ? Colors.white : kEmsTextHeading,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              );
            }

            // On mobile or when full width is toggled
            return Stack(
              children: [
                mobileAppScaffold,
                if (isDesktop && !_phoneFrameEnabled)
                  Positioned(
                    top: 12,
                    right: 18,
                    child: InkWell(
                      onTap: () => setState(() => _phoneFrameEnabled = true),
                      borderRadius: BorderRadius.circular(20),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: isDark ? kEmsCardDark : Colors.white,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: isDark ? kEmsBorderDark : kEmsBorder),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.phone_android, size: 13, color: kEmsPrimary),
                            SizedBox(width: 4),
                            Text('Phone View', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700)),
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            );
          },
        );
      },
    );
  }

  Widget _buildNavItem({
    required IconData icon,
    required String label,
    required bool selected,
    required VoidCallback onTap,
    required bool isDark,
    String? badge,
  }) {
    final activeColor = kEmsPrimary;
    final inactiveColor = isDark ? const Color(0xFF9AA09A) : const Color(0xFF6B7280);

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 3),
                  decoration: BoxDecoration(
                    color: selected ? kEmsPrimary.withValues(alpha: 0.15) : Colors.transparent,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    icon,
                    size: 20,
                    color: selected ? activeColor : inactiveColor,
                  ),
                ),
                if (badge != null)
                  Positioned(
                    top: -2,
                    right: -2,
                    child: Container(
                      padding: const EdgeInsets.all(3),
                      decoration: const BoxDecoration(
                        color: Color(0xFFEF4444),
                        shape: BoxShape.circle,
                      ),
                      constraints: const BoxConstraints(minWidth: 14, minHeight: 14),
                      child: Text(
                        badge,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 8,
                          fontWeight: FontWeight.w900,
                          height: 1,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                color: selected ? activeColor : inactiveColor,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
