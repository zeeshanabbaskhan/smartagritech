import 'package:flutter/material.dart';
import '../../app_theme.dart';
import '../../services/auth_service.dart';
import '../../services/ems_api.dart';
import '../../widgets/ems_ui/ems_history_chart.dart';

class CustomDashboardPage extends StatefulWidget {
  const CustomDashboardPage({super.key});

  @override
  State<CustomDashboardPage> createState() => _CustomDashboardPageState();
}

class _CustomDashboardPageState extends State<CustomDashboardPage> {
  bool _loading = true;
  String _searchQuery = '';
  String _filter = 'all'; // 'all', 'mine', 'shared', 'favorites'
  List<Map<String, dynamic>> _dashboards = [];
  List<Map<String, dynamic>> _devices = [];
  Map<String, dynamic>? _activeDashboardView;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final user = AuthService.instance.user;
      final orgId = user?.organizationId;
      final devList = await EmsApi.instance.getDevices();
      final dashList = await EmsApi.instance.getCustomDashboards(organizationId: orgId);

      if (mounted) {
        setState(() {
          _devices = devList;
          _dashboards = dashList.isNotEmpty ? dashList : _defaultDashboards();
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _dashboards = _defaultDashboards();
          _loading = false;
        });
      }
    }
  }

  List<Map<String, dynamic>> _defaultDashboards() {
    final user = AuthService.instance.user;
    return [
      {
        'id': 'dash-1',
        'name': 'Executive Overview',
        'description': 'Main executive telemetry metrics and multi-phase energy balance for Ambition facility',
        'ownerName': user?.fullName.isNotEmpty == true ? user!.fullName : 'Ambition Admin',
        'ownerUserId': user?.id,
        'targetDevice': 'AFL Main - Main',
        'favorite': true,
        'widgetsCount': 6,
        'updatedAt': DateTime.now().subtract(const Duration(hours: 2)).toIso8601String(),
      },
      {
        'id': 'dash-2',
        'name': 'Solar & Renewable Generation',
        'description': 'Real-time inverter tracking, yield ratios, and daily solar offset',
        'ownerName': 'Engineering Team',
        'ownerUserId': 'eng-1',
        'targetDevice': 'AFL Main - Solar Inverter 05',
        'favorite': false,
        'widgetsCount': 4,
        'updatedAt': DateTime.now().subtract(const Duration(days: 1)).toIso8601String(),
      },
      {
        'id': 'dash-3',
        'name': 'Facility Compressor Lines',
        'description': 'High-draw 55kW & 132kW compressor motor telemetry and power factor',
        'ownerName': 'Facility Operations',
        'ownerUserId': 'ops-1',
        'targetDevice': 'AFL B - Compressor 132kW',
        'favorite': true,
        'widgetsCount': 8,
        'updatedAt': DateTime.now().subtract(const Duration(days: 3)).toIso8601String(),
      },
    ];
  }

  String _timeAgo(String? iso) {
    if (iso == null || iso.isEmpty) return 'recently';
    final dt = DateTime.tryParse(iso);
    if (dt == null) return 'recently';
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }

  void _openCreateModal() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final nameCtrl = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 20,
          bottom: MediaQuery.of(context).viewInsets.bottom + 24,
        ),
        decoration: BoxDecoration(
          color: isDark ? kEmsCardDark : Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          border: Border.all(color: isDark ? kEmsBorderDark : kEmsBorder),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF374151) : const Color(0xFFE5E7EB),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Row(
              children: [
                const Icon(Icons.dashboard_customize_outlined, color: kEmsPrimary, size: 20),
                const SizedBox(width: 8),
                Text(
                  'New Custom Dashboard',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: isDark ? kEmsTextMainDark : kEmsTextMain,
                  ),
                ),
                const Spacer(),
                IconButton(
                  onPressed: () => Navigator.pop(ctx),
                  icon: const Icon(Icons.close, size: 18),
                ),
              ],
            ),
            const SizedBox(height: 14),
            TextField(
              controller: nameCtrl,
              style: TextStyle(fontSize: 12, color: isDark ? kEmsTextMainDark : kEmsTextMain),
              decoration: InputDecoration(
                hintText: 'Dashboard Name (e.g. Inverter Room Beta)',
                hintStyle: TextStyle(fontSize: 12, color: isDark ? kEmsTextMutedDark : kEmsTextMuted),
                filled: true,
                fillColor: isDark ? kEmsBgDark : kEmsSurfaceAlt,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
              ),
            ),
            const SizedBox(height: 14),
            ElevatedButton(
              onPressed: () {
                final name = nameCtrl.text.trim();
                if (name.isNotEmpty) {
                  setState(() {
                    _dashboards.insert(0, {
                      'id': 'dash-${DateTime.now().millisecondsSinceEpoch}',
                      'name': name,
                      'description': 'Custom layout built for Ambition facility',
                      'ownerName': 'Ambition Admin',
                      'ownerUserId': AuthService.instance.user?.id,
                      'targetDevice': _devices.isNotEmpty ? (_devices.first['name']?.toString() ?? 'All Devices') : 'All Devices',
                      'favorite': false,
                      'widgetsCount': 4,
                      'updatedAt': DateTime.now().toIso8601String(),
                    });
                  });
                  Navigator.pop(ctx);
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: kEmsPrimary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
              child: const Text('CREATE DASHBOARD', style: TextStyle(fontWeight: FontWeight.w800)),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final user = AuthService.instance.user;
    final orgName = user?.organization?['name'] ?? 'Ambition';

    // If active dashboard view is open, render the detail view!
    if (_activeDashboardView != null) {
      return _buildDashboardDetailView(_activeDashboardView!, isDark);
    }

    final filtered = _dashboards.where((d) {
      if (_filter == 'mine' && d['ownerUserId'] != user?.id) return false;
      if (_filter == 'shared' && d['ownerUserId'] == user?.id) return false;
      if (_filter == 'favorites' && d['favorite'] != true) return false;
      if (_searchQuery.trim().isNotEmpty) {
        final q = _searchQuery.toLowerCase();
        final name = (d['name'] ?? '').toString().toLowerCase();
        final desc = (d['description'] ?? '').toString().toLowerCase();
        return name.contains(q) || desc.contains(q);
      }
      return true;
    }).toList();

    return Scaffold(
      backgroundColor: isDark ? kEmsBgDark : kEmsBgLight,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _loadData,
          color: kEmsPrimary,
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              // Header Row
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.dashboard_customize_outlined, color: kEmsPrimary, size: 20),
                          const SizedBox(width: 8),
                          Text(
                            'Custom Dashboards',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                              color: isDark ? kEmsTextMainDark : kEmsTextMain,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Build bespoke dashboards for $orgName',
                        style: TextStyle(fontSize: 11, color: isDark ? kEmsTextMutedDark : kEmsTextMuted),
                      ),
                    ],
                  ),
                  ElevatedButton.icon(
                    onPressed: _openCreateModal,
                    icon: const Icon(Icons.add, size: 14),
                    label: const Text('NEW DASHBOARD', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: kEmsPrimary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      elevation: 0,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Search Box
              Container(
                decoration: BoxDecoration(
                  color: isDark ? kEmsCardDark : Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: isDark ? kEmsBorderDark : kEmsBorder),
                ),
                child: TextField(
                  onChanged: (v) => setState(() => _searchQuery = v),
                  style: TextStyle(fontSize: 12, color: isDark ? kEmsTextMainDark : kEmsTextMain),
                  decoration: InputDecoration(
                    hintText: 'Search custom dashboards...',
                    hintStyle: TextStyle(fontSize: 12, color: isDark ? kEmsTextMutedDark : kEmsTextMuted),
                    prefixIcon: Icon(Icons.search, size: 16, color: isDark ? kEmsTextMutedDark : kEmsTextMuted),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
              const SizedBox(height: 12),

              // Filter Chips
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _chip('All (${_dashboards.length})', 'all', isDark),
                    const SizedBox(width: 8),
                    _chip('My Dashboards', 'mine', isDark),
                    const SizedBox(width: 8),
                    _chip('Shared with me', 'shared', isDark),
                    const SizedBox(width: 8),
                    _chip('Favorites', 'favorites', isDark),
                  ],
                ),
              ),
              const SizedBox(height: 18),

              // Dashboards Grid
              if (_loading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 40),
                  child: Center(child: CircularProgressIndicator(color: kEmsPrimary)),
                )
              else if (filtered.isEmpty)
                Container(
                  padding: const EdgeInsets.all(32),
                  decoration: BoxDecoration(
                    color: isDark ? kEmsCardDark : Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: isDark ? kEmsBorderDark : kEmsBorder),
                  ),
                  child: Column(
                    children: [
                      Icon(Icons.dashboard_customize_outlined, size: 40, color: isDark ? kEmsTextMutedDark : kEmsTextMuted),
                      const SizedBox(height: 12),
                      Text(
                        'No custom dashboards found',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: isDark ? kEmsTextMainDark : kEmsTextMain,
                        ),
                      ),
                    ],
                  ),
                )
              else
                LayoutBuilder(
                  builder: (context, constraints) {
                    final isWide = constraints.maxWidth > 720;
                    return GridView.builder(
                      itemCount: filtered.length,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: isWide ? 2 : 1,
                        mainAxisSpacing: 14,
                        crossAxisSpacing: 14,
                        mainAxisExtent: 180,
                      ),
                      itemBuilder: (ctx, i) => _buildDashboardCard(filtered[i], isDark),
                    );
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _chip(String label, String key, bool isDark) {
    final active = _filter == key;
    return GestureDetector(
      onTap: () => setState(() => _filter = key),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: active ? kEmsPrimary : (isDark ? kEmsCardDark : Colors.white),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: active ? kEmsPrimary : (isDark ? kEmsBorderDark : kEmsBorder),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: active ? FontWeight.w800 : FontWeight.w600,
            color: active ? Colors.white : (isDark ? kEmsTextMutedDark : kEmsTextMuted),
          ),
        ),
      ),
    );
  }

  Widget _buildDashboardCard(Map<String, dynamic> dash, bool isDark) {
    final isFav = dash['favorite'] == true;
    final target = dash['targetDevice']?.toString();
    final widgetCount = dash['widgetsCount'] ?? 6;

    return InkWell(
      onTap: () => setState(() => _activeDashboardView = dash),
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDark ? kEmsCardDark : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: isDark ? kEmsBorderDark : kEmsBorder),
          boxShadow: kEmsCardShadow,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    dash['name']?.toString() ?? 'Custom Dashboard',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: isDark ? kEmsTextMainDark : kEmsTextMain,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                IconButton(
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  onPressed: () {
                    setState(() => dash['favorite'] = !isFav);
                  },
                  icon: Icon(
                    isFav ? Icons.star : Icons.star_border,
                    color: isFav ? const Color(0xFFF5A623) : (isDark ? kEmsTextMutedDark : kEmsTextMuted),
                    size: 18,
                  ),
                ),
              ],
            ),
            Text(
              dash['description']?.toString() ?? '',
              style: TextStyle(
                fontSize: 11,
                color: isDark ? kEmsTextMutedDark : kEmsTextMuted,
                height: 1.3,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            Wrap(
              spacing: 6,
              runSpacing: 4,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                if (target != null && target.isNotEmpty)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFF3B82F6).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.memory, size: 10, color: Color(0xFF3B82F6)),
                        const SizedBox(width: 4),
                        Text(
                          target,
                          style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: Color(0xFF3B82F6)),
                        ),
                      ],
                    ),
                  ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                  decoration: BoxDecoration(
                    color: kEmsPrimary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.person_outline, size: 10, color: kEmsPrimary),
                      const SizedBox(width: 4),
                      Text(
                        dash['ownerName']?.toString() ?? 'Yours',
                        style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: kEmsPrimary),
                      ),
                    ],
                  ),
                ),
                Text(
                  'Updated ${_timeAgo(dash['updatedAt']?.toString())}',
                  style: TextStyle(fontSize: 9.5, color: isDark ? kEmsTextMutedDark : kEmsTextMuted),
                ),
                Text(
                  '• $widgetCount widgets',
                  style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: isDark ? kEmsTextMutedDark : kEmsTextMuted),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // ── Interactive Detail View for a Custom Dashboard ──
  Widget _buildDashboardDetailView(Map<String, dynamic> dash, bool isDark) {
    return Scaffold(
      backgroundColor: isDark ? kEmsBgDark : kEmsBgLight,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Top Back Navigation Bar
              Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back),
                    onPressed: () => setState(() => _activeDashboardView = null),
                  ),
                  const SizedBox(width: 6),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        dash['name']?.toString() ?? 'Custom Dashboard',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                          color: isDark ? kEmsTextMainDark : kEmsTextMain,
                        ),
                      ),
                      Text(
                        'Target: ${dash['targetDevice'] ?? "Ambition"} • Live View',
                        style: TextStyle(fontSize: 11, color: isDark ? kEmsTextMutedDark : kEmsTextMuted),
                      ),
                    ],
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: const Color(0xFF22C55E).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.sensors, size: 14, color: Color(0xFF22C55E)),
                        SizedBox(width: 4),
                        Text(
                          'LIVE STREAMING',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF22C55E),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),

              // KPI Row
              Row(
                children: [
                  _detailMetricBox('ACTIVE POWER', '434.1 kW', Icons.bolt, kEmsPrimary, isDark),
                  const SizedBox(width: 10),
                  _detailMetricBox('POWER FACTOR', '0.94 PF', Icons.trending_up, const Color(0xFF3B82F6), isDark),
                  const SizedBox(width: 10),
                  _detailMetricBox('GRID FREQUENCY', '49.8 Hz', Icons.speed, const Color(0xFF22C55E), isDark),
                ],
              ),
              const SizedBox(height: 18),

              // Custom Chart inside dashboard
              EmsHistoryChart(
                title: '${dash['name']} — Live Load History (kW)',
                subtitle: 'Telemetries recorded from target sensor array over last 24 hours',
                unit: 'kW',
                timeLabels: const ['06:00 AM', '09:00 AM', '12:00 PM', '03:00 PM', '06:00 PM'],
                series: const [
                  EmsChartSeries(
                    id: 'active_power',
                    name: 'Active Power',
                    color: Color(0xFF3B82F6),
                    values: [390, 420, 440, 434.1, 430],
                  ),
                  EmsChartSeries(
                    id: 'reactive_power',
                    name: 'Reactive Power',
                    color: Color(0xFF8B5CF6),
                    values: [42, 45, 48, 41.5, 40],
                  ),
                ],
              ),
              const SizedBox(height: 18),

              // Back button
              ElevatedButton.icon(
                onPressed: () => setState(() => _activeDashboardView = null),
                icon: const Icon(Icons.arrow_back, size: 16),
                label: const Text('BACK TO DASHBOARD LIST'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: kEmsPrimary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _detailMetricBox(String label, String value, IconData icon, Color color, bool isDark) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isDark ? kEmsCardDark : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: isDark ? kEmsBorderDark : kEmsBorder),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  label,
                  style: const TextStyle(fontSize: 8.5, fontWeight: FontWeight.w800, color: Color(0xFF94A3B8)),
                ),
                Icon(icon, size: 14, color: color),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              value,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w900,
                color: isDark ? kEmsTextMainDark : kEmsTextMain,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
