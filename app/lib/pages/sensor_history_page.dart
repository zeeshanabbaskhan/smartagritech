import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../app_theme.dart';
import '../services/app_state.dart';
import '../services/ems_api.dart';
import '../utils/device_helpers.dart';
import '../widgets/api_state_views.dart';
import '../widgets/time_filter_chips.dart';

class SensorHistoryPage extends StatefulWidget {
  const SensorHistoryPage({super.key, this.deviceId});
  final String? deviceId;

  @override
  State<SensorHistoryPage> createState() => _SensorHistoryPageState();
}

class _SensorHistoryPageState extends State<SensorHistoryPage> {
  bool _loading = false;
  Object? _error;

  List<Map<String, dynamic>> _devices = [];
  List<Map<String, dynamic>> _slaves = [];
  String? _selectedDeviceId;
  String? _selectedSlaveId;
  String _timeRange = '24h';

  // Flattened rows: {timestamp, variableName, value, unit}
  List<Map<String, dynamic>> _rows = [];
  int _page = 1;
  bool _hasMore = false;
  static const _limit = 50;

  static const _cols = ['Timestamp', 'Variable', 'Value', 'Unit'];
  static const _widths = [160.0, 130.0, 90.0, 70.0];

  @override
  void initState() {
    super.initState();
    _initDevices();
  }

  Future<void> _initDevices() async {
    if (AppState.instance.devices.isEmpty) await AppState.instance.loadDevices();
    final slaves = await DeviceHelpers.loadAllSlaves();
    setState(() {
      _devices = AppState.instance.devices;
      _slaves = slaves;
      if (widget.deviceId != null) {
        _selectedDeviceId = widget.deviceId;
      } else {
        _selectedDeviceId = _devices.firstOrNull?['id'] as String?;
      }
      if (_selectedDeviceId != null) {
        final match = _slaves.where((s) => s['deviceId'] == _selectedDeviceId);
        _selectedSlaveId = match.isNotEmpty ? match.first['id'] as String? : null;
      }
    });
    if (_selectedDeviceId != null) await _load(reset: true);
  }

  List<Map<String, dynamic>> get _filteredSlaves => _selectedDeviceId == null
      ? _slaves
      : _slaves.where((s) => s['deviceId'] == _selectedDeviceId).toList();

  Future<void> _load({bool reset = false}) async {
    if (_selectedDeviceId == null) return;
    if (reset) {
      _page = 1;
      _rows = [];
    }
    setState(() { _loading = true; _error = null; });
    try {
      final res = await EmsApi.instance.getSensorDataHistory(
        deviceId: _selectedDeviceId!,
        slaveId: _selectedSlaveId,
        timeRange: _timeRange,
        page: _page,
        limit: _limit,
      );

      final buckets = res['data'];
      final List<dynamic> rows = buckets is List ? buckets : [];

      final newRows = <Map<String, dynamic>>[];
      for (final bucket in rows) {
        final b = bucket as Map<String, dynamic>;
        final ts = b['timestamp']?.toString() ?? '';
        final readings = b['readings'] as List? ?? [];
        for (final r in readings) {
          final reading = r as Map<String, dynamic>;
          newRows.add({
            'timestamp': ts,
            'variableName': reading['variableName'] ?? reading['variable'] ?? '',
            'value': reading['value'] ?? '',
            'unit': reading['unit'] ?? '',
          });
        }
      }

      setState(() {
        if (reset) {
          _rows = newRows;
        } else {
          _rows.addAll(newRows);
        }
        _hasMore = (res['hasMore'] as bool?) ?? (rows.length >= _limit);
      });
    } catch (e) {
      setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadMore() async {
    if (!_hasMore || _loading) return;
    _page++;
    await _load();
  }

  void _snack(String msg, {bool error = false}) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(msg),
        backgroundColor: error ? kRed : kGreen,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ));

  Future<void> _exportCsv() async {
    try {
      final sb = StringBuffer();
      sb.writeln('Timestamp,Variable,Value,Unit');
      for (final r in _rows) {
        sb.writeln('"${r['timestamp']}","${r['variableName']}","${r['value']}","${r['unit']}"');
      }
      final bytes = Uint8List.fromList(sb.toString().codeUnits);
      await Share.shareXFiles(
        [XFile.fromData(bytes, name: 'sensor_history.csv', mimeType: 'text/csv')],
        subject: 'Sensor History Export',
      );
    } catch (_) {
      _snack('Export failed', error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kNavy,
        foregroundColor: Colors.white,
        title: const Text('Sensor History',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Colors.white)),
        elevation: 0,
        actions: [
          if (_rows.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.download_outlined),
              tooltip: 'Export CSV',
              onPressed: _exportCsv,
            ),
        ],
      ),
      body: Column(children: [
        // ── Filters ─────────────────────────────────────────────────────────
        Container(
          color: Colors.white,
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(
                child: _FilterDropdown<String?>(
                  hint: 'Select Device',
                  value: _selectedDeviceId,
                  items: _devices.map((d) => DropdownMenuItem<String?>(
                      value: d['id'] as String?,
                      child: Text(d['name'] as String? ?? '',
                          overflow: TextOverflow.ellipsis))).toList(),
                  onChanged: (v) {
                    setState(() {
                      _selectedDeviceId = v;
                      final match = _slaves.where((s) => s['deviceId'] == v);
                      _selectedSlaveId = match.isNotEmpty ? match.first['id'] as String? : null;
                    });
                    _load(reset: true);
                  },
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _FilterDropdown<String?>(
                  hint: 'All Slaves',
                  value: _selectedSlaveId,
                  items: [
                    const DropdownMenuItem<String?>(value: null, child: Text('All Slaves')),
                    ..._filteredSlaves.map((s) => DropdownMenuItem<String?>(
                        value: s['id'] as String?,
                        child: Text(s['label'] as String? ?? '',
                            overflow: TextOverflow.ellipsis))),
                  ],
                  onChanged: (v) {
                    setState(() => _selectedSlaveId = v);
                    _load(reset: true);
                  },
                ),
              ),
            ]),
            const SizedBox(height: 10),
            TimeFilterChips(onChanged: (f) {
              setState(() => _timeRange = f);
              _load(reset: true);
            }),
          ]),
        ),

        // ── Table ────────────────────────────────────────────────────────────
        if (_error != null && _rows.isEmpty)
          Expanded(child: ErrorView.fromError(_error!, onRetry: () => _load(reset: true)))
        else if (_rows.isEmpty && _loading)
          const Expanded(child: LoadingView())
        else if (_rows.isEmpty)
          Expanded(
            child: Center(
              child: Text('No sensor data for selected filters',
                  style: TextStyle(color: Colors.grey.shade500, fontSize: 13)),
            ),
          )
        else
          Expanded(
            child: Column(children: [
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: [
                        BoxShadow(color: kNavy.withValues(alpha: 0.05), blurRadius: 8, offset: const Offset(0, 2))
                      ],
                    ),
                    child: SingleChildScrollView(
                      child: SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _tableHeader(),
                            ..._rows.map((r) => Column(children: [
                              Divider(height: 1, color: Colors.grey.shade100),
                              _tableRow(r),
                            ])),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              // Load more / footer
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('${_rows.length} rows',
                        style: TextStyle(color: Colors.grey.shade500, fontSize: 12)),
                    if (_hasMore)
                      TextButton(
                        onPressed: _loading ? null : _loadMore,
                        child: _loading
                            ? const SizedBox(width: 16, height: 16,
                                child: CircularProgressIndicator(strokeWidth: 2, color: kNavy))
                            : const Text('Load more', style: TextStyle(color: kNavy, fontWeight: FontWeight.w600)),
                      ),
                  ],
                ),
              ),
            ]),
          ),
      ]),
    );
  }

  Widget _tableHeader() => Container(
        padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 12),
        decoration: BoxDecoration(
          color: kNavy.withValues(alpha: 0.04),
          borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
          border: Border(bottom: BorderSide(color: const Color(0xFFE0E0E0))),
        ),
        child: Row(
          children: List.generate(_cols.length, (i) => SizedBox(
            width: _widths[i],
            child: Text(_cols[i],
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: kNavy)),
          )),
        ),
      );

  Widget _tableRow(Map<String, dynamic> r) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 12),
        child: Row(children: [
          SizedBox(width: _widths[0],
              child: Text(r['timestamp'] as String? ?? '',
                  style: TextStyle(fontSize: 11, color: Colors.grey.shade600))),
          SizedBox(width: _widths[1],
              child: Text(r['variableName'] as String? ?? '',
                  style: const TextStyle(fontSize: 11, color: kNavy, fontWeight: FontWeight.w500),
                  overflow: TextOverflow.ellipsis)),
          SizedBox(width: _widths[2],
              child: Text('${r['value']}',
                  style: TextStyle(fontSize: 11, color: Colors.grey.shade700))),
          SizedBox(width: _widths[3],
              child: Text(r['unit'] as String? ?? '',
                  style: TextStyle(fontSize: 11, color: Colors.grey.shade500))),
        ]),
      );
}

class _FilterDropdown<T> extends StatelessWidget {
  const _FilterDropdown({
    required this.hint,
    required this.value,
    required this.items,
    required this.onChanged,
  });
  final String hint;
  final T value;
  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T?> onChanged;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<T>(
      initialValue: value,
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 12),
        filled: true,
        fillColor: kBg,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
        isDense: true,
      ),
      style: const TextStyle(fontSize: 13, color: kNavy),
      items: items,
      onChanged: onChanged,
    );
  }
}
