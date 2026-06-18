import 'package:flutter/material.dart';
import '../app_theme.dart';
import '../services/app_state.dart';
import '../services/auth_service.dart';
import '../services/ems_api.dart';
import 'account_settings_page.dart';
import 'dashboard/dashboard_page.dart';
import 'devices/devices_page.dart';
import 'menu/menu_page.dart';
import 'notifications_page.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _tabIndex = 0;

  final _homeNav = GlobalKey<NavigatorState>();
  final _devicesNav = GlobalKey<NavigatorState>();
  final _menuNav = GlobalKey<NavigatorState>();

  List<GlobalKey<NavigatorState>> get _navKeys =>
      [_homeNav, _devicesNav, _menuNav];

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (_navKeys[_tabIndex].currentState?.canPop() ?? false) {
          _navKeys[_tabIndex].currentState!.pop();
        }
      },
      child: Scaffold(
        body: IndexedStack(
          index: _tabIndex,
          children: [
            _TabNavigator(navKey: _homeNav, child: const _HomeRoot()),
            _TabNavigator(navKey: _devicesNav, child: const DevicesPage()),
            _TabNavigator(navKey: _menuNav, child: const MenuPage()),
          ],
        ),
        bottomNavigationBar: Container(
          decoration: BoxDecoration(
            color: Colors.white,
            boxShadow: [
              BoxShadow(
                color: kNavy.withValues(alpha: 0.08),
                blurRadius: 12,
                offset: const Offset(0, -2),
              ),
            ],
          ),
          child: BottomNavigationBar(
            currentIndex: _tabIndex,
            onTap: (i) {
              if (i == _tabIndex) {
                // Tap same tab → pop to root
                _navKeys[i].currentState?.popUntil((r) => r.isFirst);
              } else {
                setState(() => _tabIndex = i);
              }
            },
            backgroundColor: Colors.white,
            selectedItemColor: kOrange,
            unselectedItemColor: Colors.grey.shade400,
            selectedLabelStyle: const TextStyle(
              fontWeight: FontWeight.w600,
              fontSize: 11,
            ),
            unselectedLabelStyle: const TextStyle(fontSize: 11),
            type: BottomNavigationBarType.fixed,
            elevation: 0,
            items: const [
              BottomNavigationBarItem(
                icon: Icon(Icons.home_outlined),
                activeIcon: Icon(Icons.home),
                label: 'Home',
              ),
              BottomNavigationBarItem(
                icon: Icon(Icons.devices_outlined),
                activeIcon: Icon(Icons.devices),
                label: 'Devices',
              ),
              BottomNavigationBarItem(
                icon: Icon(Icons.grid_view_outlined),
                activeIcon: Icon(Icons.grid_view),
                label: 'Menu',
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TabNavigator extends StatelessWidget {
  const _TabNavigator({required this.navKey, required this.child});
  final GlobalKey<NavigatorState> navKey;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Navigator(
      key: navKey,
      onGenerateRoute: (_) => MaterialPageRoute(builder: (_) => child),
    );
  }
}

// ── Home tab root ─────────────────────────────────────────────────────────────
class _HomeRoot extends StatefulWidget {
  const _HomeRoot();

  @override
  State<_HomeRoot> createState() => _HomeRootState();
}

class _HomeRootState extends State<_HomeRoot> {
  int _unread = 0;
  int _lastSeenAlarmCount = 0;

  @override
  void initState() {
    super.initState();
    AppState.instance.addListener(_onAppStateChange);
    _loadUnread();
  }

  @override
  void dispose() {
    AppState.instance.removeListener(_onAppStateChange);
    super.dispose();
  }

  void _onAppStateChange() {
    final alarmCount = AppState.instance.liveAlarms.length;
    if (alarmCount > _lastSeenAlarmCount) {
      final newAlarms = alarmCount - _lastSeenAlarmCount;
      _lastSeenAlarmCount = alarmCount;
      if (mounted) setState(() => _unread += newAlarms);
    }
  }

  Future<void> _loadUnread() async {
    try {
      final n = await EmsApi.instance.getUnreadNotificationCount();
      if (mounted) setState(() => _unread = n);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kNavy,
        foregroundColor: Colors.white,
        automaticallyImplyLeading: false,
        title: Row(
          children: [
            Image.asset(
              'assets/logo-removebg-preview.png',
              height: 30,
              fit: BoxFit.contain,
            ),
            const SizedBox(width: 10),
            const Text(
              'EmbedAIoT',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: Colors.white,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: Badge(
              isLabelVisible: _unread > 0,
              label: Text('$_unread'),
              child: const Icon(Icons.notifications_none_outlined, size: 22),
            ),
            onPressed: () async {
              await Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const NotificationsPage()),
              );
              _loadUnread();
            },
          ),
          IconButton(
            icon: const Icon(Icons.person_outline, size: 22),
            onPressed: () => _showProfileSheet(context),
          ),
        ],
        elevation: 0,
      ),
      body: const DashboardPage(),
    );
  }

  void _showProfileSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => const _ProfileSheet(),
    );
  }
}

class _ProfileSheet extends StatelessWidget {
  const _ProfileSheet();

  @override
  Widget build(BuildContext context) {
    final user = AuthService.instance.user;
    final orgName = user?.organization?['name'] ?? 'EMS';

    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.shade300,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 20),
          CircleAvatar(
            radius: 36,
            backgroundColor: kNavy,
            child: Text(
              user?.initials ?? '?',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 22,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            user?.fullName ?? 'User',
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: kNavy,
            ),
          ),
          Text(
            user?.email ?? '',
            style: TextStyle(fontSize: 13, color: Colors.grey.shade500),
          ),
          const SizedBox(height: 4),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: kOrange.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              '${user?.roleLabel ?? ''} · $orgName',
              style: const TextStyle(fontSize: 12, color: kOrange, fontWeight: FontWeight.w600),
            ),
          ),
          const SizedBox(height: 24),
          _ProfileTile(Icons.settings_outlined, 'Account Settings', () {
            Navigator.pop(context);
            Navigator.of(context, rootNavigator: true).push(
              MaterialPageRoute(builder: (_) => const AccountSettingsPage()));
          }),
          _ProfileTile(Icons.help_outline, 'Help & Support', () {
            Navigator.pop(context);
          }),
          _ProfileTile(Icons.logout_outlined, 'Sign Out', () async {
            Navigator.pop(context);
            await AuthService.instance.logout();
          }, color: kRed),
          const SizedBox(height: 12),
        ],
      ),
    );
  }
}

class _ProfileTile extends StatelessWidget {
  const _ProfileTile(this.icon, this.label, this.onTap, {this.color});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = color ?? kNavy;
    return ListTile(
      leading: Icon(icon, color: c, size: 20),
      title: Text(label, style: TextStyle(color: c, fontWeight: FontWeight.w500)),
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 0),
    );
  }
}
