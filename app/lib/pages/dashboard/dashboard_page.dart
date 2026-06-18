import 'package:flutter/material.dart';
import '../../app_theme.dart';
import '../../services/app_state.dart';
import '../../services/ems_api.dart';
import '../../services/socket_service.dart';
import '../../utils/api_mappers.dart';
import '../../widgets/api_state_views.dart';
import '../../widgets/chart_painters.dart';
import '../../widgets/metric_card.dart';
import '../ai_analytics/voltage_imbalance_page.dart';
import '../ai_analytics/current_imbalance_page.dart';
import '../ai_analytics/power_factor_page.dart';
import '../ai_analytics/energy_consumption_page.dart';
import '../ai_analytics/anomalies_page.dart';
import 'detail_page.dart';

class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key});

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  final _appState = AppState.instance;
  bool _loading = true;
  Object? _error;
  Map<String, dynamic>? _summary;

  @override
  void initState() {
    super.initState();
    _init();
  }

  @override
  void dispose() {
    super.dispose();
  }

  Future<void> _init() async {
    try {
      await _appState.loadDevices();
      await _loadSummary();
    } catch (e) {
      if (mounted) setState(() { _error = e; _loading = false; });
    }
  }

  Future<void> _loadSummary() async {
    final deviceId = _appState.selectedDeviceId;
    if (deviceId == null) {
      if (mounted) setState(() { _loading = false; _summary = null; });
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      final res = await EmsApi.instance.getDashboardSummary(
        deviceId: deviceId,
        slaveId: _appState.selectedSlaveId,
        timeRange: '24h',
      );
      if (mounted) {
        setState(() {
          _summary = Map<String, dynamic>.from(res['data'] as Map? ?? {});
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _error = e; _loading = false; });
    }
  }

  double _metricValue(String key) {
    final block = _summary?[key];
    if (block is Map && block['value'] != null) {
      return double.tryParse(block['value'].toString()) ?? 0;
    }
    return 0;
  }

  List<double> _chartData(String key) {
    final block = _summary?[key];
    if (block is! Map) return [];
    return ApiMappers.chartValues(block['chartData'] as List?);
  }

  List<Map<String, dynamic>> get _anomalyBreakdown {
    final block = _summary?['anomalies'];
    if (block is! Map) return [];
    final list = block['breakdown'];
    if (list is! List) return [];
    return list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  int get _anomalyCount {
    final block = _summary?['anomalies'];
    if (block is Map) return (block['count'] as num?)?.toInt() ?? 0;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    if (_loading && _summary == null) {
      return const Scaffold(backgroundColor: kBg, body: LoadingView());
    }
    if (_error != null && _summary == null) {
      return Scaffold(
        backgroundColor: kBg,
        body: ErrorView.fromError(_error!, onRetry: _init),
      );
    }
    if (_appState.devices.isEmpty) {
      return Scaffold(
        backgroundColor: kBg,
        body: Center(
          child: Text('No devices available', style: TextStyle(color: Colors.grey.shade600)),
        ),
      );
    }

    return Scaffold(
      backgroundColor: kBg,
      body: RefreshIndicator(
        color: kOrange,
        onRefresh: _loadSummary,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: _DropdownField(
                      label: 'Device',
                      value: _appState.selectedDeviceName ?? 'Select device',
                      items: _appState.devices
                          .map((d) => d['name'] as String)
                          .toList(),
                      onChanged: (name) {
                        final match = _appState.devices
                            .where((d) => d['name'] == name)
                            .toList();
                        if (match.isNotEmpty) {
                          final id = match.first['id'] as String;
                          _appState.selectDevice(id);
                          SocketService.instance.subscribeDevice(id);
                          _loadSummary();
                        }
                      },
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _DropdownField(
                      label: 'Slave',
                      value: _appState.configSlaves
                              .where((s) => s['id'] == _appState.selectedSlaveId)
                              .map((s) => s['name'] as String)
                              .cast<String>()
                              .firstOrNull ??
                          '—',
                      items: _appState.configSlaves
                          .map((s) => s['name'] as String)
                          .toList(),
                      onChanged: (name) {
                        final match = _appState.configSlaves
                            .where((s) => s['name'] == name)
                            .toList();
                        if (match.isNotEmpty) {
                          _appState.selectSlave(match.first['id'] as String);
                          _loadSummary();
                        }
                      },
                    ),
                  ),
                ],
              ),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const DetailPage()),
                  ),
                  icon: const Icon(Icons.list_alt_outlined, size: 16, color: kOrange),
                  label: const Text('All readings', style: TextStyle(color: kOrange, fontWeight: FontWeight.w600)),
                ),
              ),
              const SizedBox(height: 8),
              MetricCard(
                title: '⚡ Total Power Consumption',
                value: _metricValue('totalPowerConsumption').toStringAsFixed(2),
                unit: 'kWh',
                chart: MiniBarChart(
                  data: _chartData('totalPowerConsumption'),
                  color: kBlue,
                  height: 75,
                ),
                onTap: () => Navigator.push(context,
                    MaterialPageRoute(builder: (_) => const EnergyConsumptionPage())),
              ),
              const SizedBox(height: 12),
              MetricCard(
                title: '⚡ Total Export Power',
                value: _metricValue('totalExportPower').toStringAsFixed(2),
                unit: 'kWh',
                chart: MiniBarChart(
                  data: _chartData('totalExportPower'),
                  color: kBlue,
                  height: 75,
                ),
              ),
              const SizedBox(height: 12),
              MetricCard(
                title: '⚡ Voltage Imbalance (%)',
                value: _metricValue('voltageImbalance').toStringAsFixed(2),
                unit: '',
                chart: MiniLineChart(
                  data: _chartData('voltageImbalance'),
                  color: kOrange,
                  height: 75,
                ),
                onTap: () => Navigator.push(context,
                    MaterialPageRoute(builder: (_) => const VoltageImbalancePage())),
              ),
              const SizedBox(height: 12),
              MetricCard(
                title: '⚖ Current Imbalance',
                value: _metricValue('currentImbalance').toStringAsFixed(2),
                unit: '',
                chart: MiniLineChart(
                  data: _chartData('currentImbalance'),
                  color: kGreen,
                  height: 75,
                ),
                onTap: () => Navigator.push(context,
                    MaterialPageRoute(builder: (_) => const CurrentImbalancePage())),
              ),
              const SizedBox(height: 12),
              MetricCard(
                title: '🔋 Real Time Power Factor',
                value: _metricValue('powerFactor').toStringAsFixed(2),
                unit: '',
                chart: MiniLineChart(
                  data: _chartData('powerFactor'),
                  color: kBlue,
                  height: 75,
                ),
                onTap: () => Navigator.push(context,
                    MaterialPageRoute(builder: (_) => const PowerFactorPage())),
              ),
              const SizedBox(height: 12),
              MetricCard(
                title: '⚠ Anomalies Detected',
                value: '',
                unit: '',
                extra: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    RichText(
                      text: TextSpan(children: [
                        TextSpan(
                          text: '$_anomalyCount ',
                          style: const TextStyle(
                            color: kRed,
                            fontSize: 22,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const TextSpan(
                          text: 'Total Anomalies Detected',
                          style: TextStyle(
                            color: kNavy,
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ]),
                    ),
                    const SizedBox(height: 8),
                    ..._anomalyBreakdown.map((a) => Padding(
                          padding: const EdgeInsets.only(bottom: 4),
                          child: Row(
                            children: [
                              SizedBox(
                                width: 30,
                                child: Text(
                                  '${a['count']}',
                                  style: const TextStyle(
                                    color: kNavy,
                                    fontWeight: FontWeight.w600,
                                    fontSize: 13,
                                  ),
                                ),
                              ),
                              Text(
                                a['type']?.toString() ?? '—',
                                style: TextStyle(
                                  color: Colors.grey.shade600,
                                  fontSize: 13,
                                ),
                              ),
                            ],
                          ),
                        )),
                  ],
                ),
                onTap: () => Navigator.push(context,
                    MaterialPageRoute(builder: (_) => const AnomaliesPage())),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: MetricCard(
                      title: '📶 THD-V',
                      value: _metricValue('thdV').toStringAsFixed(2),
                      unit: '%',
                      chart: MiniBarChart(
                        data: _chartData('thdV'),
                        color: kBlue,
                        height: 60,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: MetricCard(
                      title: '📶 THD-I',
                      value: _metricValue('thdI').toStringAsFixed(2),
                      unit: '%',
                      chart: MiniBarChart(
                        data: _chartData('thdI'),
                        color: kBlue,
                        height: 60,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              MetricCard(
                title: '🔄 Frequency',
                value: _metricValue('frequency').toStringAsFixed(2),
                unit: 'Hz',
                chart: MiniBarChart(
                  data: _chartData('frequency'),
                  color: kBlue,
                  height: 60,
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

class _DropdownField extends StatelessWidget {
  const _DropdownField({
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
  });
  final String label;
  final String value;
  final List<String> items;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: TextStyle(
                fontSize: 12,
                color: Colors.grey.shade600,
                fontWeight: FontWeight.w500)),
        const SizedBox(height: 4),
        DropdownButtonFormField<String>(
          initialValue: items.contains(value) ? value : (items.isNotEmpty ? items.first : null),
          items: items
              .map((e) => DropdownMenuItem(value: e, child: Text(e, overflow: TextOverflow.ellipsis)))
              .toList(),
          onChanged: onChanged,
          decoration: InputDecoration(
            filled: true,
            fillColor: Colors.white,
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(color: Colors.grey.shade300),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: kOrange, width: 1.5),
            ),
          ),
          style: const TextStyle(fontSize: 13, color: kNavy),
          isExpanded: true,
        ),
      ],
    );
  }
}
