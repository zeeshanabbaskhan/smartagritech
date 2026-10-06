import 'dart:async';
import 'package:flutter/material.dart';
import '../../app_theme.dart';
import '../../data/live_ems_engine.dart';
import '../../services/navigation_state.dart';
import '../../services/theme_service.dart';
import '../../widgets/ems_ui/ems_stat_card.dart';
import '../../widgets/ems_ui/ems_power_flow.dart';
import '../../widgets/ems_ui/ems_history_chart.dart';

class OrgDashboardPage extends StatefulWidget {
  const OrgDashboardPage({super.key});

  @override
  State<OrgDashboardPage> createState() => _OrgDashboardPageState();
}

class _OrgDashboardPageState extends State<OrgDashboardPage> {
  int _tick = 0;
  Timer? _tickerTimer;

  // Filter KPI by Access Group: 'all' or group ID
  String _groupFilter = 'all';

  // Bottom device telemetry search
  String _deviceSearchQuery = '';

  @override
  void initState() {
    super.initState();
    // 5-second dynamic tick matching D:\embed dashboard working\src\pages\org\OrgDashboard.jsx
    _tickerTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (mounted) setState(() => _tick++);
    });
  }

  @override
  void dispose() {
    _tickerTimer?.cancel();
    super.dispose();
  }

  void _handleToggleSwitch(LiveDeviceItem d) {
    setState(() {
      LiveEmsEngine.instance.toggleDeviceSwitch(d.id);
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${d.name}: Breaker turned ${d.switchOn ? "ON (Online)" : "OFF (Offline)"}'),
        duration: const Duration(seconds: 2),
        backgroundColor: d.switchOn ? const Color(0xFF22C55E) : const Color(0xFFEF4444),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    const orgName = 'Ambition';

    // 1. All devices belonging to Ambition
    final orgDevices = LiveEmsEngine.instance.devices.where((d) => d.org == orgName).toList();

    // 2. Access Groups for Ambition
    final orgAccessGroups = LiveEmsEngine.instance.accessGroups.where((g) => g.org == orgName).toList();

    // 3. Filtered active devices for KPI calculation
    final activeDevices = _groupFilter == 'all'
        ? orgDevices
        : () {
            final grp = orgAccessGroups.firstWhere((g) => g.id.toString() == _groupFilter, orElse: () => orgAccessGroups.first);
            return orgDevices.where((d) => grp.deviceIds.contains(d.id)).toList();
          }();

    // 4. Dynamic KPI values computed from live telemetry
    final kpiValues = LiveEmsEngine.instance.computeKpiValues(activeDevices, _tick);
    final totalPower = kpiValues['totalPower'] as double;
    final totalCurrent = kpiValues['totalCurrent'] as double;
    final avgVoltage = kpiValues['avgVoltage'] as double;
    final avgPf = kpiValues['avgPF'] as double;
    final onlineCount = kpiValues['onlineCount'] as int;

    // 5. Dynamic Instantaneous Power Flow math
    final powerFlow = LiveEmsEngine.instance.computePowerFlow(orgName, totalPower, _tick);

    // 6. 24-hour source curves
    final sourceSeries = LiveEmsEngine.instance.buildSourceSeries(orgName);

    // 7. Dynamic savings calculation
    final savings = LiveEmsEngine.instance.computeSavings(sourceSeries);

    // 8. Device groups loads
    final deviceGroupLoads = LiveEmsEngine.instance.deviceGroups.map((g) {
      final grpDevices = orgDevices.where((d) => g.deviceIds.contains(d.id)).toList();
      final onlineGrp = grpDevices.where((d) => d.status == 'Online' && d.switchOn).toList();
      final load = onlineGrp.fold<double>(0.0, (sum, d) => sum + LiveEmsEngine.instance.getLiveTelemetryNum(d.name, 'power', false, _tick));
      return {
        'id': g.id,
        'name': g.name,
        'deviceCount': grpDevices.length,
        'load': double.parse(load.toStringAsFixed(2)),
        'active': onlineGrp.isNotEmpty,
      };
    }).toList();

    // 9. 24-hour device groups series for Chart 2
    final deviceGroupSeries = LiveEmsEngine.instance.buildDeviceGroupSeries(deviceGroupLoads);

    // 10. Filtered devices for bottom telemetry section
    final filteredTelemetryDevices = _deviceSearchQuery.trim().isEmpty
        ? orgDevices.reversed.take(5).toList()
        : orgDevices.where((d) {
            final q = _deviceSearchQuery.toLowerCase().trim();
            return d.name.toLowerCase().contains(q) ||
                d.gateway.toLowerCase().contains(q) ||
                d.template.toLowerCase().contains(q);
          }).toList();

    // Group line colors matching Recharts
    const groupColors = [
      Color(0xFF8B5CF6), Color(0xFFF5A623), Color(0xFF3B82F6), Color(0xFF22C55E),
      Color(0xFFEC4899), Color(0xFF14B8A6), Color(0xFFF97316), Color(0xFF6366F1),
      Color(0xFF94A3B8),
    ];

    final timeLabels = sourceSeries.map((s) => s.time).toList();

    return Scaffold(
      backgroundColor: isDark ? kEmsBgDark : kEmsBgLight,
      body: SafeArea(
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Top Super Admin Impersonation Banner ──
              _buildImpersonationBanner(),

              Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // ── Header Row ──
                    _buildTopHeader(isDark),
                    const SizedBox(height: 18),

                    // ── 1. Energy Flow Overview (Dynamic Mind Map) ──
                    EmsPowerFlow(
                      orgName: orgName,
                      powerFlow: powerFlow,
                      savings: savings,
                      sources: LiveEmsEngine.instance.sources,
                      groups: deviceGroupLoads,
                      onGroupClick: (groupId) => _showGroupDevicesModal(groupId, context, isDark),
                      onUpdateSource: (sourceId, newCap) {
                        setState(() {
                          final src = LiveEmsEngine.instance.sources.firstWhere((s) => s.id == sourceId);
                          src.capacity = newCap;
                          src.overridden = true;
                        });
                      },
                    ),
                    const SizedBox(height: 20),

                    // ── 2. KPI Scoping Filter Bar & 4 Dynamic Cards ──
                    _buildKpiSection(isDark, orgAccessGroups, totalPower, totalCurrent, avgVoltage, avgPf, onlineCount),
                    const SizedBox(height: 18),

                    // ── 3. Four Stat Cards ──
                    _buildStatCardsRow(orgDevices.length, onlineCount),
                    const SizedBox(height: 24),

                    // ── 4. Chart 1: Power Sources — Last 24 Hours ──
                    EmsHistoryChart(
                      title: 'Power Sources — Last 24 Hours',
                      subtitle: 'Solar, Generator, Grid and total Load over the last 24 hours — hover to compare all four at once',
                      unit: 'kW',
                      timeLabels: timeLabels,
                      series: [
                        EmsChartSeries(
                          id: 'load',
                          name: 'Load',
                          color: const Color(0xFF8B5CF6),
                          values: sourceSeries.map((s) => s.load).toList(),
                        ),
                        EmsChartSeries(
                          id: 'solar',
                          name: 'Solar',
                          color: const Color(0xFFF5A623),
                          values: sourceSeries.map((s) => s.solar).toList(),
                        ),
                        EmsChartSeries(
                          id: 'generator',
                          name: 'Generator',
                          color: const Color(0xFF22C55E),
                          values: sourceSeries.map((s) => s.generator).toList(),
                        ),
                        EmsChartSeries(
                          id: 'grid',
                          name: 'Grid',
                          color: const Color(0xFF3B82F6),
                          values: sourceSeries.map((s) => s.grid).toList(),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),

                    // ── 5. Chart 2: Asset Group Load — Last 24 Hours ──
                    EmsHistoryChart(
                      title: 'Asset Group Load — Last 24 Hours',
                      subtitle: 'Every device group at Ambition plotted together — hover any point to see each group\'s detailed value, or click a group below to view its devices',
                      unit: 'kW',
                      timeLabels: timeLabels,
                      series: [
                        for (int i = 0; i < deviceGroupLoads.length; i++)
                          EmsChartSeries(
                            id: deviceGroupLoads[i]['id'].toString(),
                            name: deviceGroupLoads[i]['name'].toString(),
                            color: groupColors[i % groupColors.length],
                            values: deviceGroupSeries
                                .map((row) => (row[deviceGroupLoads[i]['id'].toString()] as num?)?.toDouble() ?? 0.0)
                                .toList(),
                          ),
                      ],
                      onLegendTap: (gId) => _showGroupDevicesModal(gId, context, isDark),
                    ),
                    const SizedBox(height: 20),

                    // ── 6. Chart 3: Power Consumption — Last 24 Hours ──
                    EmsHistoryChart(
                      title: 'Power Consumption — Last 24 Hours',
                      subtitle: 'Real-time load in kW logged at Ambition',
                      unit: 'kW',
                      timeLabels: timeLabels,
                      series: [
                        EmsChartSeries(
                          id: 'consumption',
                          name: 'Load',
                          color: const Color(0xFFF5A623),
                          values: LiveEmsEngine.instance.historicalData
                              .map((row) => ((row['power'] as num) / 1000.0))
                              .toList(),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),

                    // ── 7. Device Telemetry Control Panel (matching OrgDashboard.jsx lines 618-713) ──
                    _buildDeviceTelemetrySection(isDark, filteredTelemetryDevices, orgName),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Top Impersonation Banner ──
  Widget _buildImpersonationBanner() {
    return Container(
      color: const Color(0xFFF59E0B),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          const Expanded(
            child: Text(
              'Viewing as Ambition (Ambition) — signed in from Super Admin',
              style: TextStyle(color: Color(0xFF78350F), fontSize: 12, fontWeight: FontWeight.w800),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          InkWell(
            onTap: () => NavigationState.instance.setRole(EmsRole.superAdmin),
            borderRadius: BorderRadius.circular(6),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.25),
                borderRadius: BorderRadius.circular(6),
              ),
              child: const Row(
                children: [
                  Icon(Icons.keyboard_return, size: 12, color: Color(0xFF78350F)),
                  SizedBox(width: 4),
                  Text('Return to Super Admin', style: TextStyle(color: Color(0xFF78350F), fontSize: 11, fontWeight: FontWeight.w800)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Top Header ──
  Widget _buildTopHeader(bool isDark) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          children: [
            Text(
              'Dashboard',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: isDark ? kEmsTextMainDark : kEmsTextMain),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: const Color(0xFF2563EB).withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: const Color(0xFF3B82F6).withValues(alpha: 0.3)),
              ),
              child: const Text('ORG', style: TextStyle(color: Color(0xFF3B82F6), fontSize: 10, fontWeight: FontWeight.w900)),
            ),
          ],
        ),
        Row(
          children: [
            IconButton(
              icon: Icon(isDark ? Icons.light_mode_outlined : Icons.dark_mode_outlined, size: 18, color: isDark ? kEmsTextMutedDark : kEmsTextMuted),
              onPressed: () => ThemeService.instance.toggleTheme(),
              tooltip: 'Toggle Theme',
            ),
            IconButton(
              icon: Icon(Icons.notifications_none, size: 20, color: isDark ? kEmsTextMutedDark : kEmsTextMuted),
              onPressed: () {},
            ),
            Container(
              width: 32,
              height: 32,
              decoration: const BoxDecoration(color: Color(0xFF2563EB), shape: BoxShape.circle),
              child: const Center(child: Text('A', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 13))),
            ),
          ],
        ),
      ],
    );
  }

  // ── KPI Section with Filter KPIs Dropdown ──
  Widget _buildKpiSection(
    bool isDark,
    List<LiveAccessGroup> accessGroups,
    double totalPower,
    double totalCurrent,
    double avgVoltage,
    double avgPf,
    int onlineCount,
  ) {
    final activeGroupLabel = _groupFilter == 'all'
        ? 'All Organization Devices'
        : (accessGroups.firstWhere((g) => g.id.toString() == _groupFilter, orElse: () => accessGroups.first).name);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Dropdown Header Row
        Row(
          children: [
            const Text(
              'FILTER KPIS:',
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.grey, letterSpacing: 0.8),
            ),
            const SizedBox(width: 8),
            PopupMenuButton<String>(
              initialValue: _groupFilter,
              onSelected: (val) => setState(() => _groupFilter = val),
              itemBuilder: (ctx) => [
                const PopupMenuItem(value: 'all', child: Text('All Organization Devices', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700))),
                ...accessGroups.map((g) => PopupMenuItem(value: g.id.toString(), child: Text(g.name, style: const TextStyle(fontSize: 12)))),
              ],
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: isDark ? kEmsCardDark : Colors.white,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: isDark ? kEmsBorderDark : kEmsBorder),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.search, size: 12, color: Colors.grey),
                    const SizedBox(width: 6),
                    Text(activeGroupLabel, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: isDark ? kEmsTextMainDark : kEmsTextMain)),
                    const SizedBox(width: 6),
                    const Icon(Icons.arrow_drop_down, size: 16, color: Colors.grey),
                  ],
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),

        // 4 KPI Cards
        LayoutBuilder(
          builder: (context, constraints) {
            final isWide = constraints.maxWidth > 720;
            return GridView.count(
              crossAxisCount: isWide ? 4 : 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: isWide ? 1.6 : 1.3,
              children: [
                _buildKpiCard('Total Power Consumption', '${totalPower.toStringAsFixed(1)} kW', 'Sum · $onlineCount online', Icons.bolt, const Color(0xFFF5A623), isDark),
                _buildKpiCard('Total Current', '${totalCurrent.toStringAsFixed(1)} A', 'Sum · $onlineCount online', Icons.show_chart, const Color(0xFF3B82F6), isDark),
                _buildKpiCard('Avg Voltage', '${avgVoltage.toStringAsFixed(1)} V', 'Mean · $onlineCount online', Icons.speed, const Color(0xFF22C55E), isDark),
                _buildKpiCard('Avg Power Factor', avgPf.toStringAsFixed(2), 'Mean · $onlineCount online', Icons.trending_up, const Color(0xFF8B5CF6), isDark),
              ],
            );
          },
        ),
      ],
    );
  }

  Widget _buildKpiCard(String label, String value, String sub, IconData icon, Color color, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? kEmsCardDark : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? kEmsBorderDark : kEmsBorder),
        boxShadow: kEmsCardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  label.toUpperCase(),
                  style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: isDark ? kEmsTextMutedDark : kEmsTextMuted, letterSpacing: 0.5),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Icon(icon, size: 15, color: color),
            ],
          ),
          Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: isDark ? kEmsTextMainDark : kEmsTextMain)),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(sub, style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w600, color: isDark ? kEmsTextMutedDark : kEmsTextMuted)),
              Icon(Icons.chevron_right, size: 14, color: isDark ? kEmsTextMutedDark : kEmsTextMuted),
            ],
          ),
        ],
      ),
    );
  }

  // ── Stat Cards Row ──
  Widget _buildStatCardsRow(int totalDevices, int onlineCount) {
    final offlineCount = totalDevices - onlineCount;
    return LayoutBuilder(
      builder: (context, constraints) {
        final isWide = constraints.maxWidth > 720;
        return GridView.count(
          crossAxisCount: isWide ? 4 : 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: isWide ? 2.4 : 1.7,
          children: [
            InkWell(
              onTap: () => NavigationState.instance.navigateTo('/devices', title: 'Device Management', breadcrumb: 'HOME / DEVICES'),
              child: EmsStatCard(
                label: 'My Devices',
                value: '$totalDevices',
                sub: 'Ambition facility',
                icon: Icons.memory_outlined,
                color: EmsStatColor.primary,
              ),
            ),
            InkWell(
              onTap: () => NavigationState.instance.navigateTo('/devices', title: 'Device Management', breadcrumb: 'HOME / DEVICES'),
              child: EmsStatCard(
                label: 'Online Devices',
                value: '$onlineCount',
                sub: offlineCount > 0 ? '$offlineCount offline' : 'All devices online',
                icon: Icons.check_circle_outline,
                color: EmsStatColor.success,
              ),
            ),
            EmsStatCard(
              label: 'Active Alarms',
              value: '${offlineCount > 0 ? 1 : 0}',
              sub: 'System status active',
              icon: Icons.warning_amber_rounded,
              color: EmsStatColor.warning,
            ),
            const EmsStatCard(
              label: 'Monthly Energy',
              value: '12,450 kWh',
              sub: 'Current billing cycle',
              icon: Icons.electric_bolt,
              color: EmsStatColor.info,
            ),
          ],
        );
      },
    );
  }

  // ── Bottom Device Telemetry Section ──
  Widget _buildDeviceTelemetrySection(bool isDark, List<LiveDeviceItem> devicesList, String orgName) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? kEmsCardDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? kEmsBorderDark : kEmsBorder),
        boxShadow: kEmsCardShadow,
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Section Header + Search
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(Icons.radio, size: 18, color: Color(0xFF2563EB)),
                  const SizedBox(width: 8),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Device Telemetry',
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: isDark ? kEmsTextMainDark : kEmsTextMain),
                      ),
                      Text(
                        _deviceSearchQuery.trim().isNotEmpty
                            ? 'Search results for "$_deviceSearchQuery"'
                            : 'Showing 5 latest devices. Use the search bar to find past devices for $orgName.',
                        style: TextStyle(fontSize: 10, color: isDark ? kEmsTextMutedDark : kEmsTextMuted, fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                ],
              ),
              Container(
                width: 200,
                height: 34,
                padding: const EdgeInsets.symmetric(horizontal: 10),
                decoration: BoxDecoration(
                  color: isDark ? kEmsBgDark : kEmsSurfaceAlt,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: isDark ? kEmsBorderDark : kEmsBorder),
                ),
                child: Row(
                  children: [
                    Icon(Icons.search, size: 13, color: isDark ? kEmsTextMutedDark : kEmsTextMuted),
                    const SizedBox(width: 6),
                    Expanded(
                      child: TextField(
                        onChanged: (val) => setState(() => _deviceSearchQuery = val),
                        style: TextStyle(fontSize: 11, color: isDark ? kEmsTextMainDark : kEmsTextMain),
                        decoration: InputDecoration(
                          hintText: 'Search device or gateway...',
                          hintStyle: TextStyle(fontSize: 11, color: isDark ? kEmsTextMutedDark : kEmsTextMuted),
                          isDense: true,
                          border: InputBorder.none,
                          contentPadding: EdgeInsets.zero,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Render Device Cards
          for (final d in devicesList) ...[
            _buildDeviceTelemetryCard(d, isDark),
            const SizedBox(height: 14),
          ],
        ],
      ),
    );
  }

  Widget _buildDeviceTelemetryCard(LiveDeviceItem d, bool isDark) {
    final isOffline = d.status == 'Offline' || !d.switchOn;

    final powerStr = LiveEmsEngine.instance.getLiveTelemetry(d.name, 'power', isOffline, _tick);
    final currentStr = LiveEmsEngine.instance.getLiveTelemetry(d.name, 'current', isOffline, _tick);
    final voltageStr = LiveEmsEngine.instance.getLiveTelemetry(d.name, 'voltage', isOffline, _tick);
    final pfStr = LiveEmsEngine.instance.getLiveTelemetry(d.name, 'pf', isOffline, _tick);
    final consumptionStr = LiveEmsEngine.instance.getLiveTelemetry(d.name, 'consumption', isOffline, _tick);

    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF0F172A).withValues(alpha: 0.6) : const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: isDark ? kEmsBorderDark : kEmsBorder),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Device Header Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF1E293B) : const Color(0xFFEFF6FF),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.memory, size: 20, color: Color(0xFF2563EB)),
                  ),
                  const SizedBox(width: 10),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        d.name,
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: isDark ? kEmsTextMainDark : kEmsTextMain),
                      ),
                      Text(
                        'GATEWAY: ${d.gateway.toUpperCase()} • TEMPLATE: ${d.template.toUpperCase()}',
                        style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: isDark ? kEmsTextMutedDark : kEmsTextMuted, letterSpacing: 0.5),
                      ),
                    ],
                  ),
                ],
              ),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: isOffline ? const Color(0xFFEF4444).withValues(alpha: 0.15) : const Color(0xFF22C55E).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: isOffline ? const Color(0xFFEF4444).withValues(alpha: 0.3) : const Color(0xFF22C55E).withValues(alpha: 0.3)),
                    ),
                    child: Text(
                      isOffline ? 'OFFLINE' : 'ONLINE',
                      style: TextStyle(color: isOffline ? const Color(0xFFEF4444) : const Color(0xFF22C55E), fontSize: 9.5, fontWeight: FontWeight.w900, letterSpacing: 0.6),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text('SWITCH', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: isDark ? kEmsTextMutedDark : kEmsTextMuted)),
                  const SizedBox(width: 6),
                  Switch(
                    value: d.switchOn,
                    activeThumbColor: kEmsPrimary,
                    onChanged: (_) => _handleToggleSwitch(d),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 14),

          // 5 Live Metric Tiles (matching OrgDashboard.jsx lines 685-707)
          LayoutBuilder(
            builder: (context, constraints) {
              final isWide = constraints.maxWidth > 700;
              return GridView.count(
                crossAxisCount: isWide ? 5 : 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 8,
                crossAxisSpacing: 8,
                childAspectRatio: isWide ? 1.6 : 1.5,
                children: [
                  _buildMetricTile('ACTIVE POWER', powerStr, 'kW', const Color(0xFFF5A623), d.name, isDark),
                  _buildMetricTile('CURRENT', currentStr, 'A', const Color(0xFF3B82F6), d.name, isDark),
                  _buildMetricTile('VOLTAGE', voltageStr, 'V', const Color(0xFF22C55E), d.name, isDark),
                  _buildMetricTile('POWER FACTOR', pfStr, '', const Color(0xFF8B5CF6), d.name, isDark),
                  _buildMetricTile('ENERGY CONSUMPTION', consumptionStr, 'kWh', const Color(0xFFEAB308), d.name, isDark),
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildMetricTile(String label, String value, String unit, Color color, String devName, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: isDark ? kEmsCardDark : Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: isDark ? kEmsBorderDark : kEmsBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 8.5, fontWeight: FontWeight.w900, color: Colors.grey, letterSpacing: 0.5)),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: isDark ? kEmsTextMainDark : kEmsTextMain)),
              if (unit.isNotEmpty) ...[
                const SizedBox(width: 4),
                Text(unit, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Colors.grey)),
              ],
            ],
          ),
          Text('for $devName', style: const TextStyle(fontSize: 8, fontWeight: FontWeight.w700, color: Colors.grey), overflow: TextOverflow.ellipsis),
        ],
      ),
    );
  }

  void _showGroupDevicesModal(String groupId, BuildContext context, bool isDark) {
    final grp = LiveEmsEngine.instance.deviceGroups.firstWhere(
      (g) => g.id == groupId,
      orElse: () => LiveEmsEngine.instance.deviceGroups.first,
    );
    final groupDevices = LiveEmsEngine.instance.devices.where((d) => grp.deviceIds.contains(d.id)).toList();

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(20),
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
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: Colors.grey.withValues(alpha: 0.4),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Row(
              children: [
                const Icon(Icons.widgets, color: Color(0xFF7C3AED), size: 18),
                const SizedBox(width: 8),
                Text(
                  '${grp.name} — Devices',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
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
            const SizedBox(height: 12),
            if (groupDevices.isEmpty)
              const Padding(
                padding: EdgeInsets.all(12),
                child: Text('This group has no devices assigned yet.', style: TextStyle(fontSize: 12, color: Colors.grey)),
              )
            else
              ...groupDevices.map((d) {
                final isOffline = d.status == 'Offline' || !d.switchOn;
                final p = LiveEmsEngine.instance.getLiveTelemetry(d.name, 'power', isOffline, _tick);
                final c = LiveEmsEngine.instance.getLiveTelemetry(d.name, 'current', isOffline, _tick);
                final v = LiveEmsEngine.instance.getLiveTelemetry(d.name, 'voltage', isOffline, _tick);
                return Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: isDark ? kEmsBorderDark : kEmsBorder),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(d.name, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: isDark ? kEmsTextMainDark : kEmsTextMain)),
                          const SizedBox(height: 2),
                          Text('${d.gateway} • ${d.template}', style: const TextStyle(fontSize: 10, color: Colors.grey)),
                        ],
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text('$p kW', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFF7C3AED))),
                          Text('$v V • $c A', style: const TextStyle(fontSize: 9.5, color: Colors.grey)),
                        ],
                      ),
                    ],
                  ),
                );
              }),
            const SizedBox(height: 14),
            ElevatedButton(
              onPressed: () => Navigator.pop(ctx),
              style: ElevatedButton.styleFrom(
                backgroundColor: kEmsPrimary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: const Text('Close'),
            ),
          ],
        ),
      ),
    );
  }
}
