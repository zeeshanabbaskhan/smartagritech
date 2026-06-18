import 'package:flutter/material.dart';
import '../../app_theme.dart';
import '../../services/app_state.dart';
import '../../services/ems_api.dart';
import '../../utils/api_mappers.dart';
import '../../widgets/api_state_views.dart';
import '../../widgets/chart_painters.dart';
import '../../widgets/device_slave_selector.dart';

class VoltageImbalancePage extends StatefulWidget {
  const VoltageImbalancePage({super.key});

  @override
  State<VoltageImbalancePage> createState() => _VoltageImbalancePageState();
}

class _VoltageImbalancePageState extends State<VoltageImbalancePage> {
  bool _loading = true;
  Object? _error;
  Map<String, dynamic>? _data;

  @override
  void initState() {
    super.initState();
    AppState.instance.addListener(_load);
    _init();
  }

  @override
  void dispose() {
    AppState.instance.removeListener(_load);
    super.dispose();
  }

  Future<void> _init() async {
    if (AppState.instance.devices.isEmpty) {
      await AppState.instance.loadDevices();
    }
    await _load();
  }

  Future<void> _load() async {
    final deviceId = AppState.instance.selectedDeviceId;
    if (deviceId == null) {
      if (mounted) setState(() { _loading = false; _data = null; });
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      final res = await EmsApi.instance.getAiVoltage(
        deviceId: deviceId,
        slaveId: AppState.instance.selectedSlaveId,
      );
      if (mounted) {
        setState(() {
          _data = Map<String, dynamic>.from(res['data'] as Map? ?? {});
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _error = e; _loading = false; });
    }
  }

  double get _currentValue {
    final current = _data?['current'];
    if (current is Map) {
      final v = current['VoltageImbalance'];
      return (v is num) ? v.toDouble() : double.tryParse('$v') ?? 0;
    }
    return 0;
  }

  List<double> get _imbalanceChart {
    final chart = _data?['chartData'];
    if (chart is! Map) return [];
    return ApiMappers.chartValues(chart['voltageImbalance'] as List?);
  }

  List<double> get _voltageChart {
    final chart = _data?['chartData'];
    if (chart is! Map) return [];
    return ApiMappers.chartValues(chart['voltageA'] as List?);
  }

  List<Map<String, dynamic>> get _alarms {
    final list = _data?['alarms'];
    if (list is! List) return [];
    return list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kNavy,
        foregroundColor: Colors.white,
        title: const Text('Voltage Imbalance Details',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
        elevation: 0,
      ),
      body: _loading
          ? const LoadingView()
          : _error != null
              ? ErrorView.fromError(_error!, onRetry: _load)
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Dashboard → Voltage',
                          style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                      const SizedBox(height: 14),
                      DeviceSlaveSelector(onChanged: _load),
                      const SizedBox(height: 20),
                      const Text('Voltage Imbalance',
                          style: TextStyle(
                              fontSize: 16, fontWeight: FontWeight.w600, color: kNavy)),
                      const SizedBox(height: 6),
                      Text(
                        _currentValue.toStringAsFixed(2),
                        style: const TextStyle(
                          fontSize: 52,
                          fontWeight: FontWeight.w700,
                          color: kNavy,
                        ),
                      ),
                      const SizedBox(height: 20),
                      const Text('⚠ Anomalies',
                          style: TextStyle(
                              fontSize: 15, fontWeight: FontWeight.w600, color: kNavy)),
                      const SizedBox(height: 8),
                      Container(
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          boxShadow: [
                            BoxShadow(
                                color: kNavy.withValues(alpha: 0.05),
                                blurRadius: 8,
                                offset: const Offset(0, 2)),
                          ],
                        ),
                        child: Column(
                          children: [
                            _anomalyHeader(),
                            if (_alarms.isEmpty)
                              Padding(
                                padding: const EdgeInsets.all(16),
                                child: Text('No voltage alarms in this period',
                                    style: TextStyle(color: Colors.grey.shade500, fontSize: 13)),
                              )
                            else
                              ..._alarms.map((a) => _anomalyRow(
                                    ApiMappers.fmtDate(a['alarmTime']),
                                    a['triggerType']?.toString() ?? '—',
                                  )),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),
                      _chartCard('Voltage Imbalance Trend', _imbalanceChart, kOrange),
                      const SizedBox(height: 16),
                      _chartCard('Voltage A Over Time', _voltageChart, kBlue),
                      const SizedBox(height: 24),
                    ],
                  ),
                ),
    );
  }

  Widget _chartCard(String title, List<double> data, Color color) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
              color: kNavy.withValues(alpha: 0.05), blurRadius: 8, offset: const Offset(0, 2)),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: kNavy)),
          const SizedBox(height: 12),
          if (data.isEmpty)
            Text('No chart data', style: TextStyle(color: Colors.grey.shade500, fontSize: 13))
          else
            FullBarChart(
              data: data,
              xLabels: List.generate(data.length, (i) => '${i + 1}'),
              color: color,
              height: 160,
            ),
        ],
      ),
    );
  }

  Widget _anomalyHeader() {
    return Container(
      decoration: BoxDecoration(
          color: Colors.grey.shade50,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
          border: Border(bottom: BorderSide(color: Colors.grey.shade200))),
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 16),
      child: Row(
        children: [
          Expanded(
              child: Text('Time',
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Colors.grey.shade700))),
          Expanded(
              child: Text('Type',
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Colors.grey.shade700))),
        ],
      ),
    );
  }

  Widget _anomalyRow(String time, String type) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 16),
      decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: Colors.grey.shade100))),
      child: Row(
        children: [
          Expanded(child: Text(time, style: const TextStyle(fontSize: 13, color: kNavy))),
          Expanded(
              child: Text(type, style: TextStyle(fontSize: 13, color: Colors.grey.shade700))),
        ],
      ),
    );
  }
}
