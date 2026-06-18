import 'package:flutter/material.dart';
import '../../app_theme.dart';
import '../../services/app_state.dart';
import '../../services/ems_api.dart';
import '../../utils/api_mappers.dart';
import '../../widgets/api_state_views.dart';
import '../../widgets/device_slave_selector.dart';
import '../../widgets/metric_card.dart';

class DetailPage extends StatefulWidget {
  const DetailPage({super.key});

  @override
  State<DetailPage> createState() => _DetailPageState();
}

class _DetailPageState extends State<DetailPage> {
  final _appState = AppState.instance;
  bool _loading = true;
  Object? _error;
  Map<String, dynamic>? _summary;
  Map<String, dynamic> _latest = {};

  static const _readingKeys = [
    ('VoltageA', 'V', 1),
    ('VoltageB', 'V', 1),
    ('VoltageC', 'V', 1),
    ('CurrentA', 'A', 2),
    ('CurrentB', 'A', 2),
    ('CurrentC', 'A', 2),
    ('ActivePower', 'kW', 2),
    ('ReactivePower', 'kVar', 2),
    ('ApparentPower', 'kVA', 2),
    ('PowerConsumption', 'kWh', 2),
    ('ExportPower', 'kWh', 2),
    ('PowerFactor', '', 2),
    ('Frequency', 'Hz', 2),
    ('THD_V', '%', 1),
    ('THD_I', '%', 1),
  ];

  @override
  void initState() {
    super.initState();
    _appState.addListener(_load);
    _init();
  }

  @override
  void dispose() {
    _appState.removeListener(_load);
    super.dispose();
  }

  Future<void> _init() async {
    if (_appState.devices.isEmpty) await _appState.loadDevices();
    await _load();
  }

  Future<void> _load() async {
    final deviceId = _appState.selectedDeviceId;
    if (deviceId == null) {
      if (mounted) setState(() { _loading = false; _summary = null; });
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      final summaryRes = await EmsApi.instance.getDashboardSummary(
        deviceId: deviceId,
        slaveId: _appState.selectedSlaveId,
      );
      final latestRes = await EmsApi.instance.getLatestSensorData(
        deviceId: deviceId,
        slaveId: _appState.selectedSlaveId,
      );
      if (mounted) {
        setState(() {
          _summary = Map<String, dynamic>.from(summaryRes['data'] as Map? ?? {});
          _latest = Map<String, dynamic>.from(latestRes['data'] as Map? ?? {});
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _error = e; _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kNavy,
        foregroundColor: Colors.white,
        title: const Text('Dashboard · Detail',
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
                      const SizedBox(height: 16),
                      GridView.builder(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: _readingKeys.length,
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 3,
                          mainAxisSpacing: 10,
                          crossAxisSpacing: 10,
                          childAspectRatio: 1.1,
                        ),
                        itemBuilder: (_, i) {
                          final (key, unit, decimals) = _readingKeys[i];
                          return DetailTile(
                            title: key,
                            value: ApiMappers.latestReading(_latest, key, decimals: decimals),
                            unit: unit,
                          );
                        },
                      ),
                      const SizedBox(height: 20),
                      const Text('ENERGY SAVINGS COMPARISON',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF8A9BBE),
                            letterSpacing: 1.0,
                          )),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(child: _SavingCard(period: 'daily', summary: _summary)),
                          const SizedBox(width: 10),
                          Expanded(child: _SavingCard(period: 'weekly', summary: _summary)),
                          const SizedBox(width: 10),
                          Expanded(child: _SavingCard(period: 'monthly', summary: _summary)),
                        ],
                      ),
                      const SizedBox(height: 24),
                    ],
                  ),
                ),
    );
  }
}

class _SavingCard extends StatelessWidget {
  const _SavingCard({required this.period, required this.summary});
  final String period;
  final Map<String, dynamic>? summary;

  @override
  Widget build(BuildContext context) {
    final block = ApiMappers.savingsBlock(summary, period);
    final pct = (block['percentage'] as num?)?.toDouble() ?? 0;
    final current = (block['current'] as num?)?.toDouble() ?? 0;
    final previous = (block['previous'] as num?)?.toDouble() ?? 0;
    final color = pct >= 0 ? kRed : kGreen;

    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border(top: BorderSide(color: color, width: 2)),
      ),
      child: Column(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            child: Icon(pct >= 0 ? Icons.trending_up : Icons.trending_down,
                color: Colors.white, size: 18),
          ),
          const SizedBox(height: 6),
          Text(period[0].toUpperCase() + period.substring(1),
              style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
          const SizedBox(height: 2),
          Text('${pct.toStringAsFixed(1)}%',
              style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 14)),
          const SizedBox(height: 2),
          Text('${current.toStringAsFixed(1)} vs ${previous.toStringAsFixed(1)} kWh',
              style: TextStyle(fontSize: 9, color: Colors.grey.shade500),
              textAlign: TextAlign.center),
        ],
      ),
    );
  }
}
