import 'package:flutter/material.dart';
import '../../app_theme.dart';
import '../../data/ems_mock_data.dart';
import '../../widgets/ems_ui/ems_stat_card.dart';
import '../../widgets/ems_ui/ems_power_flow.dart';
import '../../widgets/ems_ui/ems_metric_range_card.dart';
import '../../widgets/ems_ui/ems_device_slave_selector.dart';
import '../../widgets/ems_ui/ems_badge.dart';
import '../../services/navigation_state.dart';

class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key});

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  String _selectedDeviceId = 'dev-1';
  String _selectedSlaveId = 'slave-1';
  bool _isOrgWide = true;
  bool _isRefreshing = false;

  void _refresh() async {
    setState(() => _isRefreshing = true);
    await Future.delayed(const Duration(milliseconds: 600));
    if (mounted) setState(() => _isRefreshing = false);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? kEmsBgDark : kEmsBgLight,
      body: RefreshIndicator(
        onRefresh: () async => _refresh(),
        color: kEmsPrimary,
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── 1. Top Control Bar (Device / Slave Selector & Scope) ──
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: isDark ? kEmsCardDark : Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: isDark ? kEmsBorderDark : kEmsBorder),
                  boxShadow: kEmsCardShadow,
                ),
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final isCompact = constraints.maxWidth < 700;

                    final selectorWidget = EmsDeviceSlaveSelector(
                      initialDeviceId: _selectedDeviceId,
                      initialSlaveId: _selectedSlaveId,
                      onDeviceChanged: (id) => setState(() => _selectedDeviceId = id),
                      onSlaveChanged: (id) => setState(() => _selectedSlaveId = id),
                    );

                    final actionRow = Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Scope Toggle Pill
                        Container(
                          padding: const EdgeInsets.all(3),
                          decoration: BoxDecoration(
                            color: isDark ? kEmsSurface800Dark : kEmsSurface100Light,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              GestureDetector(
                                onTap: () => setState(() => _isOrgWide = true),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                  decoration: BoxDecoration(
                                    color: _isOrgWide ? kEmsPrimary : Colors.transparent,
                                    borderRadius: BorderRadius.circular(16),
                                  ),
                                  child: Text(
                                    'Org Wide',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                      color: _isOrgWide ? Colors.white : (isDark ? kEmsTextMutedDark : kEmsTextMuted),
                                    ),
                                  ),
                                ),
                              ),
                              GestureDetector(
                                onTap: () => setState(() => _isOrgWide = false),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                  decoration: BoxDecoration(
                                    color: !_isOrgWide ? kEmsPrimary : Colors.transparent,
                                    borderRadius: BorderRadius.circular(16),
                                  ),
                                  child: Text(
                                    'Selected Device',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                      color: !_isOrgWide ? Colors.white : (isDark ? kEmsTextMutedDark : kEmsTextMuted),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 10),
                        // Refresh button
                        IconButton(
                          icon: _isRefreshing
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: kEmsPrimary),
                                )
                              : const Icon(Icons.refresh_rounded, size: 20),
                          color: isDark ? kEmsTextMutedDark : kEmsTextMuted,
                          onPressed: _isRefreshing ? null : _refresh,
                          tooltip: 'Refresh Telemetry',
                        ),
                      ],
                    );

                    if (isCompact) {
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          selectorWidget,
                          const SizedBox(height: 10),
                          actionRow,
                        ],
                      );
                    }

                    return Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(child: selectorWidget),
                        actionRow,
                      ],
                    );
                  },
                ),
              ),
              const SizedBox(height: 18),

              // ── 2. KPI Stat Cards Row ──
              LayoutBuilder(
                builder: (context, constraints) {
                  final width = constraints.maxWidth;
                  int columns = 4;
                  if (width < 600) {
                    columns = 1;
                  } else if (width < 1000) {
                    columns = 2;
                  }

                  final statItems = [
                    const EmsStatCard(
                      label: 'Total Power',
                      value: '245.8 kW',
                      sub: 'Active load draw',
                      icon: Icons.bolt_outlined,
                      trend: 3.4,
                      color: EmsStatColor.primary,
                      sparklineData: [180, 195, 210, 225, 238, 245.8],
                    ),
                    const EmsStatCard(
                      label: 'Solar Generation',
                      value: '82.4 kW',
                      sub: 'Peak day generation',
                      icon: Icons.wb_sunny_outlined,
                      trend: 12.1,
                      color: EmsStatColor.warning,
                      sparklineData: [0, 15, 45, 75, 82.4, 78],
                    ),
                    const EmsStatCard(
                      label: 'Grid Net Import',
                      value: '163.4 kW',
                      sub: 'Active utility feed',
                      icon: Icons.electric_meter_outlined,
                      trend: -2.5,
                      color: EmsStatColor.info,
                      sparklineData: [180, 180, 165, 150, 156, 163.4],
                    ),
                    const EmsStatCard(
                      label: 'Connected Devices',
                      value: '8 / 10 Online',
                      sub: '98.5% platform uptime',
                      icon: Icons.memory_outlined,
                      color: EmsStatColor.success,
                      sparklineData: [8, 8, 8, 8, 8, 8],
                    ),
                  ];

                  if (columns == 1) {
                    return Column(
                      children: statItems.map((c) => Padding(padding: const EdgeInsets.only(bottom: 12), child: c)).toList(),
                    );
                  }

                  return GridView.count(
                    crossAxisCount: columns,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    crossAxisSpacing: 14,
                    mainAxisSpacing: 14,
                    childAspectRatio: columns == 4 ? 1.65 : 2.2,
                    children: statItems,
                  );
                },
              ),
              const SizedBox(height: 18),

              // ── 3. Power Flow Mind Map ──
              const EmsPowerFlow(
                gridKw: 163.4,
                solarKw: 82.4,
                genKw: 0.0,
                batteryKw: 24.0,
                totalLoadKw: 245.8,
                tariffPkr: 28.0,
              ),
              const SizedBox(height: 18),

              // ── 4. Metric Range Cards Grid ──
              LayoutBuilder(
                builder: (context, constraints) {
                  final isWide = constraints.maxWidth >= 900;
                  final cards = [
                    EmsMetricRangeCard(
                      icon: Icons.bolt,
                      title: 'Total Power Consumption (kW)',
                      value: '245.8',
                      unit: 'kW',
                      data: EmsMockData.getMetricSeries(baseVal: 245.8, variance: 35.0),
                    ),
                    EmsMetricRangeCard(
                      icon: Icons.trending_up,
                      title: 'Total Export Power (kW)',
                      value: '0.0',
                      unit: 'kW',
                      data: EmsMockData.getMetricSeries(baseVal: 0.0, variance: 2.0),
                    ),
                    EmsMetricRangeCard(
                      icon: Icons.speed,
                      title: 'Voltage Imbalance (%)',
                      value: '1.24',
                      unit: '%',
                      data: EmsMockData.getMetricSeries(baseVal: 1.24, variance: 0.3),
                    ),
                    EmsMetricRangeCard(
                      icon: Icons.show_chart,
                      title: 'Current Imbalance (%)',
                      value: '2.45',
                      unit: '%',
                      data: EmsMockData.getMetricSeries(baseVal: 2.45, variance: 0.6),
                    ),
                    EmsMetricRangeCard(
                      icon: Icons.battery_charging_full,
                      title: 'Real Time Power Factor',
                      value: '0.96',
                      unit: 'PF',
                      data: EmsMockData.getMetricSeries(baseVal: 0.96, variance: 0.02),
                    ),
                    EmsMetricRangeCard(
                      icon: Icons.waves,
                      title: 'Grid Frequency (Hz)',
                      value: '50.02',
                      unit: 'Hz',
                      data: EmsMockData.getMetricSeries(baseVal: 50.02, variance: 0.08),
                    ),
                  ];

                  if (!isWide) {
                    return Column(
                      children: cards.map((c) => Padding(padding: const EdgeInsets.only(bottom: 14), child: c)).toList(),
                    );
                  }

                  return GridView.count(
                    crossAxisCount: 2,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    crossAxisSpacing: 14,
                    mainAxisSpacing: 14,
                    childAspectRatio: 1.85,
                    children: cards,
                  );
                },
              ),
              const SizedBox(height: 18),

              // ── 5. Real-Time Telemetry Slaves Table ──
              Container(
                decoration: BoxDecoration(
                  color: isDark ? kEmsCardDark : Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: isDark ? kEmsBorderDark : kEmsBorder),
                  boxShadow: kEmsCardShadow,
                ),
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Device Telemetry & Meter Feeders',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                color: isDark ? Colors.white : kEmsTextHeading,
                              ),
                            ),
                            Text(
                              'Real-time phase voltages, currents, harmonics, and power readings',
                              style: TextStyle(fontSize: 11, color: isDark ? kEmsTextMutedDark : kEmsTextMuted),
                            ),
                          ],
                        ),
                        TextButton.icon(
                          onPressed: () {
                            NavigationState.instance.navigateTo(
                              '/devices',
                              title: 'My Devices',
                              breadcrumb: 'ORG / DEVICES',
                            );
                          },
                          icon: const Icon(Icons.arrow_forward, size: 14, color: kEmsPrimary),
                          label: const Text('View All Devices', style: TextStyle(color: kEmsPrimary, fontSize: 12, fontWeight: FontWeight.w700)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: DataTable(
                        headingRowColor: WidgetStateProperty.all(isDark ? kEmsSurface800Dark : kEmsSurface100Light),
                        headingTextStyle: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: isDark ? kEmsTextMutedDark : kEmsTextMuted,
                          letterSpacing: 0.5,
                        ),
                        dataTextStyle: TextStyle(
                          fontSize: 12,
                          color: isDark ? kEmsTextMainDark : kEmsTextMain,
                        ),
                        horizontalMargin: 12,
                        columnSpacing: 24,
                        columns: const [
                          DataColumn(label: Text('METER / FEEDER')),
                          DataColumn(label: Text('STATUS')),
                          DataColumn(label: Text('VOLTAGE (V)')),
                          DataColumn(label: Text('CURRENT (A)')),
                          DataColumn(label: Text('POWER (kW)')),
                          DataColumn(label: Text('PF')),
                          DataColumn(label: Text('LAST SEEN')),
                        ],
                        rows: EmsMockData.devices.take(5).map((d) {
                          final isOnline = d['status'] == 'Online';
                          return DataRow(
                            cells: [
                              DataCell(
                                Row(
                                  children: [
                                    Icon(Icons.speed, size: 16, color: isOnline ? kEmsPrimary : Colors.grey),
                                    const SizedBox(width: 8),
                                    Column(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          d['name'] as String,
                                          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
                                        ),
                                        Text(
                                          d['code'] as String,
                                          style: TextStyle(fontSize: 10, color: isDark ? kEmsTextMutedDark : kEmsTextMuted),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                              DataCell(
                                EmsBadge(
                                  label: isOnline ? 'Online' : 'Offline',
                                  variant: isOnline ? EmsBadgeVariant.success : EmsBadgeVariant.neutral,
                                ),
                              ),
                              DataCell(Text(d['voltage'] as String)),
                              DataCell(Text(d['current'] as String)),
                              DataCell(
                                Text(
                                  d['activePower'] as String,
                                  style: const TextStyle(fontWeight: FontWeight.w700, color: kEmsPrimaryDark),
                                ),
                              ),
                              DataCell(Text(d['powerFactor'] as String)),
                              DataCell(Text(d['lastSeen'] as String)),
                            ],
                          );
                        }).toList(),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
