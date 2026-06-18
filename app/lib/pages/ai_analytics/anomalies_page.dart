import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../../app_theme.dart';
import '../../services/api_client.dart';
import '../../services/app_state.dart';
import '../../services/ems_api.dart';
import '../../utils/api_mappers.dart';
import '../../widgets/api_state_views.dart';
import '../../widgets/device_slave_selector.dart';
import '../../widgets/time_filter_chips.dart';

class AnomaliesPage extends StatefulWidget {
  const AnomaliesPage({super.key});

  @override
  State<AnomaliesPage> createState() => _AnomaliesPageState();
}

class _AnomaliesPageState extends State<AnomaliesPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kNavy,
        foregroundColor: Colors.white,
        title: const Text('Anomalies',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
        elevation: 0,
        bottom: TabBar(
          controller: _tabs,
          indicatorColor: Colors.white,
          indicatorWeight: 3,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white60,
          labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
          tabs: const [
            Tab(text: 'Anomalies'),
            Tab(text: 'Timeline'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: const [
          _AnomaliesTab(),
          _TimelineTab(),
        ],
      ),
    );
  }
}

// ── Tab 1: Anomalies list ─────────────────────────────────────────────────────
class _AnomaliesTab extends StatefulWidget {
  const _AnomaliesTab();

  @override
  State<_AnomaliesTab> createState() => _AnomaliesTabState();
}

class _AnomaliesTabState extends State<_AnomaliesTab> {
  bool _loading = true;
  Object? _error;
  List<Map<String, dynamic>> _items = [];

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
    setState(() { _loading = true; _error = null; });
    try {
      final raw = await EmsApi.instance.getAnomalies(deviceId: deviceId);
      setState(() => _items = raw.map(ApiMappers.anomaly).toList());
    } catch (e) {
      setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _exportCsv() async {
    try {
      final sb = StringBuffer();
      sb.writeln('DeviceName,TriggerName,Value,Condition,AlarmState,ProcessState,CreatedAt');
      for (final a in _items) {
        final raw = a['raw'] as Map<String, dynamic>? ?? a;
        sb.writeln(
          '"${raw['deviceName'] ?? ''}", '
          '"${raw['variableName'] ?? ''}", '
          '"${raw['currentValue'] ?? ''}", '
          '"${raw['operator'] ?? ''}", '
          '"${raw['alarmState'] ?? ''}", '
          '"${raw['processState'] ?? ''}", '
          '"${raw['alarmTime'] ?? ''}"',
        );
      }
      final bytes = Uint8List.fromList(sb.toString().codeUnits);
      await Share.shareXFiles(
        [XFile.fromData(bytes, name: 'anomalies.csv', mimeType: 'text/csv')],
        subject: 'Anomalies Export',
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Export failed'), backgroundColor: kRed),
        );
      }
    }
  }

  Future<void> _acknowledge(String id) async {
    try {
      await EmsApi.instance.acknowledgeAnomaly(id);
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Anomaly acknowledged'), backgroundColor: kGreen),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e is ApiException ? e.message : 'Failed'),
            backgroundColor: kRed,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return _loading
        ? const LoadingView()
        : _error != null
            ? ErrorView.fromError(_error!, onRetry: _load)
            : SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        DeviceSlaveSelector(onChanged: _load),
                        if (_items.isNotEmpty)
                          IconButton(
                            icon: const Icon(Icons.download_outlined, color: kNavy),
                            tooltip: 'Export CSV',
                            onPressed: _exportCsv,
                          ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    Text('${_items.length}',
                        style: const TextStyle(
                            fontSize: 52, fontWeight: FontWeight.w700, color: kRed)),
                    const SizedBox(height: 12),
                    ..._items.map((a) => Card(
                          margin: const EdgeInsets.only(bottom: 8),
                          child: ListTile(
                            title: Text(a['variable'] as String),
                            subtitle: Text('${a['type']} · ${a['time']} · value ${a['value']}'),
                            trailing: a['status'] == 'Open'
                                ? TextButton(
                                    onPressed: () => _acknowledge(a['id'] as String),
                                    child: const Text('Acknowledge'),
                                  )
                                : Text(a['status'] as String,
                                    style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
                          ),
                        )),
                    if (_items.isEmpty)
                      Text('No anomalies found',
                          style: TextStyle(color: Colors.grey.shade500)),
                  ],
                ),
              );
  }
}

// ── Tab 2: Timeline ───────────────────────────────────────────────────────────
class _TimelineTab extends StatefulWidget {
  const _TimelineTab();

  @override
  State<_TimelineTab> createState() => _TimelineTabState();
}

class _TimelineTabState extends State<_TimelineTab> {
  bool _loading = false;
  Object? _error;
  Map<String, dynamic>? _data;
  String _timeRange = '24h';

  @override
  void initState() {
    super.initState();
    AppState.instance.addListener(_onDeviceChange);
    _load();
  }

  @override
  void dispose() {
    AppState.instance.removeListener(_onDeviceChange);
    super.dispose();
  }

  void _onDeviceChange() => _load();

  Future<void> _load() async {
    final deviceId = AppState.instance.selectedDeviceId;
    if (deviceId == null) {
      setState(() { _data = null; _loading = false; });
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      final res = await EmsApi.instance.getAnomalyTimeline(
          deviceId: deviceId, timeRange: _timeRange);
      setState(() => _data = res);
    } catch (e) {
      setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final deviceId = AppState.instance.selectedDeviceId;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          DeviceSlaveSelector(onChanged: _load),
          const SizedBox(height: 12),
          TimeFilterChips(onChanged: (f) {
            setState(() => _timeRange = f);
            _load();
          }),
          const SizedBox(height: 16),
          if (deviceId == null)
            Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 40),
                child: Text('Select a device to view the anomaly timeline',
                    style: TextStyle(color: Colors.grey.shade500, fontSize: 13),
                    textAlign: TextAlign.center),
              ),
            )
          else if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 40),
              child: Center(child: CircularProgressIndicator(color: kNavy)),
            )
          else if (_error != null)
            ErrorView.fromError(_error!, onRetry: _load)
          else
            _buildBuckets(),
        ],
      ),
    );
  }

  Widget _buildBuckets() {
    final inner = _data?['data'];
    final dataMap = inner is Map ? inner : (_data ?? {});
    final buckets = dataMap['buckets'] as List? ?? [];

    if (buckets.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 40),
          child: Text('No timeline data for selected range',
              style: TextStyle(color: Colors.grey.shade500, fontSize: 13)),
        ),
      );
    }

    return Column(
      children: buckets.map<Widget>((b) {
        final bucket = b as Map<String, dynamic>;
        final time = bucket['time'] as String? ?? '';
        final count = (bucket['count'] as num?)?.toInt() ?? 0;
        final types = bucket['types'] as List? ?? [];

        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            boxShadow: [
              BoxShadow(color: kNavy.withValues(alpha: 0.05), blurRadius: 6, offset: const Offset(0, 2))
            ],
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(time,
                        style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                    const SizedBox(height: 4),
                    if (types.isNotEmpty)
                      Wrap(
                        spacing: 6,
                        children: types.map<Widget>((t) {
                          final tp = t as Map<String, dynamic>;
                          return Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: kRed.withValues(alpha: 0.08),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text(
                              '${tp['type'] ?? ''}: ${tp['count'] ?? 0}',
                              style: const TextStyle(fontSize: 10, color: kRed, fontWeight: FontWeight.w600),
                            ),
                          );
                        }).toList(),
                      ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: count > 0 ? kRed.withValues(alpha: 0.1) : kGreen.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '$count',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: count > 0 ? kRed : kGreen,
                  ),
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }
}
