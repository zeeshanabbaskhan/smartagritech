import 'package:flutter/material.dart';
import '../../app_theme.dart';
import '../../services/app_state.dart';
import '../../services/ems_api.dart';
import '../../utils/api_mappers.dart';
import '../../widgets/api_state_views.dart';
import '../../widgets/chart_painters.dart';
import '../../widgets/device_slave_selector.dart';

class PowerFactorPage extends StatefulWidget {
  const PowerFactorPage({super.key});

  @override
  State<PowerFactorPage> createState() => _PowerFactorPageState();
}

class _PowerFactorPageState extends State<PowerFactorPage> {
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
    if (AppState.instance.devices.isEmpty) await AppState.instance.loadDevices();
    await _load();
  }

  Future<void> _load() async {
    final deviceId = AppState.instance.selectedDeviceId;
    if (deviceId == null) {
      if (mounted) setState(() => _loading = false);
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      final res = await EmsApi.instance.getAiPowerFactor(
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

  double get _value {
    final v = _data?['current'];
    return (v is num) ? v.toDouble() : double.tryParse('$v') ?? 0;
  }

  List<double> get _chart => ApiMappers.chartValues(_data?['chartData'] as List?);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kNavy,
        foregroundColor: Colors.white,
        title: const Text('Power Factor Details',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
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
                      DeviceSlaveSelector(onChanged: _load),
                      const SizedBox(height: 20),
                      const Text('Power Factor',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: kNavy)),
                      Text(_value.toStringAsFixed(3),
                          style: const TextStyle(fontSize: 52, fontWeight: FontWeight.w700, color: kNavy)),
                      const SizedBox(height: 20),
                      if (_chart.isEmpty)
                        Text('No chart data', style: TextStyle(color: Colors.grey.shade500))
                      else
                        FullBarChart(
                          data: _chart,
                          xLabels: List.generate(_chart.length, (i) => '${i + 1}'),
                          color: kGreen,
                          height: 160,
                        ),
                    ],
                  ),
                ),
    );
  }
}
