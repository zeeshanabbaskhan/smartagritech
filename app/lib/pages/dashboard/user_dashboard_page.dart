import 'package:flutter/material.dart';
import '../../app_theme.dart';
import '../../services/ems_api.dart';
import '../../widgets/ems_ui/ems_metric_range_card.dart';
import '../../widgets/ems_ui/ems_button.dart';
import '../../services/navigation_state.dart';

class UserDashboardPage extends StatefulWidget {
  const UserDashboardPage({super.key});

  @override
  State<UserDashboardPage> createState() => _UserDashboardPageState();
}

class _UserDashboardPageState extends State<UserDashboardPage> {
  bool _loading = true;
  List<Map<String, dynamic>> _devices = [];
  List<Map<String, dynamic>> _alarms = [];
  String? _selectedDeviceId;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final res = await Future.wait([
        EmsApi.instance.getDevicesForUi(withMetrics: true).catchError((_) => <Map<String, dynamic>>[]),
        EmsApi.instance.getAnomalies().catchError((_) => <Map<String, dynamic>>[]),
      ]);
      if (mounted) {
        setState(() {
          _devices = res[0];
          _alarms = res[1];
          if (_devices.isNotEmpty && _selectedDeviceId == null) {
            _selectedDeviceId = _devices.first['id']?.toString();
          }
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  double _readDouble(Map<String, dynamic> d, List<String> keys, {double fallback = 0.0}) {
    for (final k in keys) {
      final val = d[k];
      if (val != null) {
        if (val is num) return val.toDouble();
        final parsed = double.tryParse(val.toString());
        if (parsed != null) return parsed;
      }
    }
    return fallback;
  }

  Map<String, List<Map<String, dynamic>>> _buildChart(double base, {double variance = 0.1}) {
    if (base <= 0) base = 10.0;
    List<Map<String, dynamic>> gen(int count, double factor) {
      return List.generate(count, (i) {
        final cycle = (i % 5 - 2) * 0.2;
        final v = base * (1.0 + (variance * cycle * factor));
        return {'v': v > 0 ? v : 0.0};
      });
    }
    return {
      '1h': gen(12, 0.5),
      '24h': gen(24, 0.8),
      '7d': gen(7, 1.0),
      '30d': gen(30, 1.2),
    };
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (_loading && _devices.isEmpty) {
      return const Center(child: CircularProgressIndicator(color: kEmsPrimary));
    }

    final selectedDev = _devices.firstWhere(
      (d) => d['id']?.toString() == _selectedDeviceId,
      orElse: () => _devices.isNotEmpty ? _devices.first : <String, dynamic>{},
    );

    final powerKw = _readDouble(selectedDev, ['power', 'powerKw', 'totalPower', 'totalPowerConsumption'], fallback: 0.0);
    final volt = _readDouble(selectedDev, ['voltage', 'avgVoltage', 'voltageImbalance'], fallback: 230.0);
    final curr = _readDouble(selectedDev, ['current', 'avgCurrent', 'currentImbalance'], fallback: 0.0);
    final pf = _readDouble(selectedDev, ['pf', 'powerFactor'], fallback: 0.95);
    final thdV = _readDouble(selectedDev, ['thdV', 'thd_v', 'voltageThd'], fallback: 1.8);
    final thdI = _readDouble(selectedDev, ['thdI', 'thd_i', 'currentThd'], fallback: 2.4);
    final freq = _readDouble(selectedDev, ['frequency', 'freq'], fallback: 50.0);
    final exportPower = _readDouble(selectedDev, ['exportPower', 'export_power'], fallback: 0.0);
    final predicted = _readDouble(selectedDev, ['predicted', 'predictedConsumption'], fallback: powerKw * 1.05);

    final activeAlarms = _alarms.where((a) => a['alarmState'] == 'ACTIVE' || a['processState'] == 'UNPROCESSED').toList();

    return RefreshIndicator(
      onRefresh: _loadData,
      color: kEmsPrimary,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Filter & Device Selector Bar
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: isDark ? kEmsCardDark : Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: isDark ? kEmsBorderDark : kEmsBorderLight,
                ),
              ),
              child: Row(
                children: [
                  const Icon(Icons.memory, size: 18, color: kEmsPrimary),
                  const SizedBox(width: 8),
                  Expanded(
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String?>(
                        value: _selectedDeviceId,
                        isExpanded: true,
                        dropdownColor: isDark ? kEmsCardDark : Colors.white,
                        hint: Text(
                          _devices.isEmpty ? 'No devices available' : 'Select meter node',
                          style: TextStyle(fontSize: 13, color: isDark ? Colors.white70 : kEmsTextHeading),
                        ),
                        items: _devices.map((d) {
                          final name = d['name']?.toString() ?? 'Device';
                          final id = d['id']?.toString() ?? '';
                          final isOnline = d['status'] == 'Online';
                          return DropdownMenuItem<String?>(
                            value: id,
                            child: Row(
                              children: [
                                Container(
                                  width: 8,
                                  height: 8,
                                  margin: const EdgeInsets.only(right: 8),
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: isOnline ? const Color(0xFF22C55E) : const Color(0xFFEF4444),
                                  ),
                                ),
                                Expanded(
                                  child: Text(
                                    name,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontSize: 12.5,
                                      fontWeight: FontWeight.w700,
                                      color: isDark ? Colors.white : kEmsTextHeading,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          );
                        }).toList(),
                        onChanged: (val) {
                          if (val != null) setState(() => _selectedDeviceId = val);
                        },
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  EmsButton(
                    label: 'Detail View',
                    icon: Icons.speed_outlined,
                    variant: EmsButtonVariant.secondary,
                    onPressed: () {
                      NavigationState.instance.navigateTo(
                        '/dashboard-detail',
                        title: 'Detail Readouts',
                        breadcrumb: 'USER / DETAIL READOUTS',
                      );
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // Active Anomaly Alert Banner
            if (activeAlarms.isNotEmpty)
              Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0x26F5A623) : const Color(0xFFFEF3C7),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: kEmsPrimary.withValues(alpha: 0.35)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.warning_amber_rounded, size: 20, color: kEmsPrimary),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            activeAlarms.first['triggerName']?.toString() ??
                                activeAlarms.first['trigger_name']?.toString() ??
                                'Active Anomaly Detected',
                            style: TextStyle(
                              color: isDark ? Colors.white : const Color(0xFF92400E),
                              fontSize: 12.5,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          Text(
                            activeAlarms.first['description']?.toString() ??
                                'Substation feeder deviation recorded beyond threshold.',
                            style: TextStyle(
                              color: isDark ? const Color(0xFFD1D5C8) : const Color(0xFFB45309),
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    ),
                    TextButton(
                      onPressed: () {
                        NavigationState.instance.navigateTo(
                          '/anomalies',
                          title: 'Anomalies',
                          breadcrumb: 'AI / ANOMALIES',
                        );
                      },
                      child: const Text(
                        'Inspect',
                        style: TextStyle(
                          color: kEmsPrimary,
                          fontWeight: FontWeight.w700,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

            // 9 Telemetry Metric Cards Grid
            LayoutBuilder(
              builder: (context, constraints) {
                final width = constraints.maxWidth;
                int crossAxisCount = 3;
                if (width < 600) {
                  crossAxisCount = 1;
                } else if (width < 960) {
                  crossAxisCount = 2;
                }

                final cards = [
                  EmsMetricRangeCard(
                    icon: Icons.bolt,
                    title: 'Total Power Consumption',
                    value: powerKw > 0 ? powerKw.toStringAsFixed(1) : '—',
                    unit: 'kW',
                    data: _buildChart(powerKw > 0 ? powerKw : 15.0),
                  ),
                  EmsMetricRangeCard(
                    icon: Icons.electric_meter_outlined,
                    title: 'Total Export Power',
                    value: exportPower > 0 ? exportPower.toStringAsFixed(1) : '—',
                    unit: 'kW',
                    data: _buildChart(exportPower > 0 ? exportPower : 0.0),
                  ),
                  EmsMetricRangeCard(
                    icon: Icons.speed,
                    title: 'Voltage Imbalance',
                    value: volt > 0 ? volt.toStringAsFixed(1) : '—',
                    unit: 'V',
                    data: _buildChart(volt > 0 ? volt : 230.0, variance: 0.03),
                  ),
                  EmsMetricRangeCard(
                    icon: Icons.show_chart,
                    title: 'Current Imbalance',
                    value: curr > 0 ? curr.toStringAsFixed(1) : '—',
                    unit: 'A',
                    data: _buildChart(curr > 0 ? curr : 12.0),
                  ),
                  EmsMetricRangeCard(
                    icon: Icons.trending_up,
                    title: 'Power Factor Average',
                    value: pf > 0 ? pf.toStringAsFixed(2) : '—',
                    unit: 'PF',
                    data: _buildChart(pf > 0 ? pf : 0.95, variance: 0.02),
                  ),
                  EmsMetricRangeCard(
                    icon: Icons.insights,
                    title: 'Predicted Consumption',
                    value: predicted > 0 ? predicted.toStringAsFixed(1) : '—',
                    unit: 'kW',
                    data: _buildChart(predicted > 0 ? predicted : 18.0),
                  ),
                  EmsMetricRangeCard(
                    icon: Icons.waves,
                    title: 'Voltage THD (Total Harmonic)',
                    value: thdV > 0 ? thdV.toStringAsFixed(1) : '—',
                    unit: '%',
                    data: _buildChart(thdV > 0 ? thdV : 1.8, variance: 0.05),
                  ),
                  EmsMetricRangeCard(
                    icon: Icons.graphic_eq,
                    title: 'Current THD (Total Harmonic)',
                    value: thdI > 0 ? thdI.toStringAsFixed(1) : '—',
                    unit: '%',
                    data: _buildChart(thdI > 0 ? thdI : 2.4, variance: 0.05),
                  ),
                  EmsMetricRangeCard(
                    icon: Icons.av_timer,
                    title: 'Grid Frequency',
                    value: freq > 0 ? freq.toStringAsFixed(1) : '—',
                    unit: 'Hz',
                    data: _buildChart(freq > 0 ? freq : 50.0, variance: 0.01),
                  ),
                ];

                return GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: cards.length,
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: crossAxisCount,
                    mainAxisSpacing: 14,
                    crossAxisSpacing: 14,
                    mainAxisExtent: 195,
                  ),
                  itemBuilder: (ctx, i) => cards[i],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
