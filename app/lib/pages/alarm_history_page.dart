import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../app_theme.dart';
import '../services/api_client.dart';
import '../services/app_state.dart';
import '../services/ems_api.dart';
import '../widgets/api_state_views.dart';
import 'org/org_helpers.dart';

class AlarmHistoryPage extends StatefulWidget {
  const AlarmHistoryPage({super.key});

  @override
  State<AlarmHistoryPage> createState() => _AlarmHistoryPageState();
}

class _AlarmHistoryPageState extends State<AlarmHistoryPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
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
        title: const Text('Alarm History',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Colors.white)),
        elevation: 0,
        bottom: TabBar(
          controller: _tabs,
          indicatorColor: Colors.white,
          indicatorWeight: 3,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white60,
          labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
          tabs: const [
            Tab(text: 'Variable Alarms'),
            Tab(text: 'Linkage Records'),
            Tab(text: 'Notifications Sent'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: const [
          _VariableAlarmsTab(),
          _LinkageRecordsTab(),
          _NotificationsSentTab(),
        ],
      ),
    );
  }
}

// ── Variable Alarms Tab ───────────────────────────────────────────────────────
class _VariableAlarmsTab extends StatefulWidget {
  const _VariableAlarmsTab();

  @override
  State<_VariableAlarmsTab> createState() => _VariableAlarmsTabState();
}

class _VariableAlarmsTabState extends State<_VariableAlarmsTab> {
  bool _loading = true;
  bool _loadingMore = false;
  Object? _error;
  List<Map<String, dynamic>> _items = [];
  List<Map<String, dynamic>> _devices = [];
  String? _selectedDeviceId;
  int _page = 1;
  int _totalPages = 1;
  static const _pageSize = 30;
  final _scrollController = ScrollController();

  static const _cols = ['Device', 'Variable', 'Trigger', 'Value', 'Cond', 'State', 'Process', 'Time', 'Ops'];
  static const _widths = [90.0, 80.0, 90.0, 60.0, 50.0, 70.0, 90.0, 110.0, 72.0];

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    _initDevices();
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_loadingMore || _page >= _totalPages) return;
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 200) {
      _loadMore();
    }
  }

  Future<void> _initDevices() async {
    if (AppState.instance.devices.isEmpty) await AppState.instance.loadDevices();
    _devices = AppState.instance.devices;
    await _load(reset: true);
  }

  Future<void> _load({bool reset = false}) async {
    if (reset) {
      _page = 1;
      setState(() { _loading = true; _error = null; });
    }
    try {
      final res = await EmsApi.instance.getVariableAlarmHistoryPage(
        deviceId: _selectedDeviceId, page: _page, limit: _pageSize,
      );
      setState(() {
        _items = List<Map<String, dynamic>>.from(res['items'] as List);
        _totalPages = (res['pages'] as num?)?.toInt() ?? 1;
      });
    } catch (e) {
      setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadMore() async {
    if (_loadingMore || _page >= _totalPages) return;
    setState(() => _loadingMore = true);
    try {
      final nextPage = _page + 1;
      final res = await EmsApi.instance.getVariableAlarmHistoryPage(
        deviceId: _selectedDeviceId, page: nextPage, limit: _pageSize,
      );
      setState(() {
        _page = nextPage;
        _totalPages = (res['pages'] as num?)?.toInt() ?? _totalPages;
        _items.addAll(List<Map<String, dynamic>>.from(res['items'] as List));
      });
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  void _snack(String msg, {bool error = false}) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(msg),
        backgroundColor: error ? kRed : kGreen,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ));

  Future<void> _process(String id) async {
    try {
      await EmsApi.instance.processVariableAlarm(id);
      _snack('Alarm processed');
      await _load(reset: true);
    } catch (e) {
      _snack(e is ApiException ? e.message : 'Failed', error: true);
    }
  }

  Future<void> _clearAll() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Clear All', style: TextStyle(color: kNavy, fontWeight: FontWeight.w700)),
        content: const Text('Delete all variable alarm history?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('Cancel', style: TextStyle(color: Colors.grey.shade600)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: kRed, foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
            child: const Text('Clear All'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await EmsApi.instance.batchDeleteVariableAlarms(deviceId: _selectedDeviceId);
      _snack('History cleared');
      await _load(reset: true);
    } catch (e) {
      _snack(e is ApiException ? e.message : 'Failed', error: true);
    }
  }

  Future<void> _exportCsv() async {
    try {
      final sb = StringBuffer();
      sb.writeln('Device,Variable,Trigger,Value,Condition,AlarmState,ProcessState,Time');
      for (final a in _items) {
        sb.writeln('"${a['deviceName'] ?? ''}",'
            '"${a['variableName'] ?? ''}",'
            '"${a['triggerName'] ?? ''}",'
            '"${a['currentValue'] ?? ''}",'
            '"${a['operator'] ?? ''}",'
            '"${a['alarmState'] ?? ''}",'
            '"${a['processState'] ?? ''}",'
            '"${a['alarmTime'] ?? ''}"');
      }
      final bytes = Uint8List.fromList(sb.toString().codeUnits);
      await Share.shareXFiles(
        [XFile.fromData(bytes, name: 'variable_alarms.csv', mimeType: 'text/csv')],
        subject: 'Variable Alarm History',
      );
    } catch (_) {
      _snack('Export failed', error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      // Device selector + actions
      Container(
        color: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(children: [
          Expanded(
            child: DropdownButtonFormField<String>(
              initialValue: _selectedDeviceId,
              decoration: InputDecoration(
                hintText: 'All Devices',
                filled: true,
                fillColor: kBg,
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
              ),
              items: [
                const DropdownMenuItem(value: null, child: Text('All Devices')),
                ..._devices.map((d) => DropdownMenuItem(
                    value: d['id'] as String?, child: Text(d['name'] as String? ?? ''))),
              ],
              onChanged: (v) {
                setState(() => _selectedDeviceId = v);
                _load();
              },
            ),
          ),
          const SizedBox(width: 8),
          IconButton(
            icon: const Icon(Icons.download_outlined, color: kNavy, size: 20),
            tooltip: 'Export CSV',
            onPressed: _items.isEmpty ? null : _exportCsv,
          ),
          IconButton(
            icon: const Icon(Icons.delete_sweep_outlined, color: kRed, size: 20),
            tooltip: 'Clear All',
            onPressed: _items.isEmpty ? null : _clearAll,
          ),
        ]),
      ),
      Expanded(
        child: _loading
            ? const LoadingView()
            : _error != null
                ? ErrorView.fromError(_error!, onRetry: () => _load(reset: true))
                : _items.isEmpty
                    ? Center(
                        child: Text('No alarm history',
                            style: TextStyle(color: Colors.grey.shade500, fontSize: 13)))
                    : ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.all(16),
                        itemCount: _items.length + (_loadingMore ? 1 : 0) + 1,
                        itemBuilder: (context, i) {
                          if (i == 0) {
                            return TableCard(
                              cols: _cols,
                              widths: _widths,
                              header: tableHeader(_cols, _widths),
                              rows: const [],
                              count: 0,
                            );
                          }
                          final idx = i - 1;
                          if (idx >= _items.length) {
                            return const Padding(
                              padding: EdgeInsets.all(16),
                              child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
                            );
                          }
                          final item = _items[idx];
                          return Column(children: [
                            Divider(height: 1, color: Colors.grey.shade100),
                            _row(item),
                          ]);
                        },
                      ),
      ),
    ]);
  }

  Widget _row(Map<String, dynamic> item) {
    final processState = item['processState'] as String? ?? '';
    final alarmState = item['alarmState'] as String? ?? '';
    final isUnprocessed = processState == 'UNPROCESSED';
    final ts = (item['alarmTime'] as String? ?? '');
    final displayTs = ts.length > 16 ? ts.substring(0, 16) : ts;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
      child: Row(children: [
        SizedBox(width: _widths[0],
            child: Text(item['deviceName'] as String? ?? '',
                style: const TextStyle(fontSize: 11, color: kNavy, fontWeight: FontWeight.w500),
                overflow: TextOverflow.ellipsis)),
        SizedBox(width: _widths[1],
            child: Text(item['variableName'] as String? ?? '',
                style: TextStyle(fontSize: 11, color: Colors.grey.shade700),
                overflow: TextOverflow.ellipsis)),
        SizedBox(width: _widths[2],
            child: Text(item['triggerName'] as String? ?? '',
                style: TextStyle(fontSize: 11, color: Colors.grey.shade700),
                overflow: TextOverflow.ellipsis)),
        SizedBox(width: _widths[3],
            child: Text('${item['currentValue'] ?? ''}',
                style: TextStyle(fontSize: 11, color: Colors.grey.shade700))),
        SizedBox(width: _widths[4],
            child: Text(item['operator'] as String? ?? '',
                style: TextStyle(fontSize: 11, color: Colors.grey.shade700))),
        SizedBox(width: _widths[5],
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: alarmState == 'OPEN'
                    ? kRed.withValues(alpha: 0.1)
                    : kGreen.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(alarmState,
                  style: TextStyle(
                      fontSize: 10, fontWeight: FontWeight.w600,
                      color: alarmState == 'OPEN' ? kRed : kGreen)),
            )),
        SizedBox(width: _widths[6],
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: isUnprocessed ? kOrange.withValues(alpha: 0.1) : kGreen.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(processState,
                  style: TextStyle(
                      fontSize: 10, fontWeight: FontWeight.w600,
                      color: isUnprocessed ? kOrange : kGreen)),
            )),
        SizedBox(width: _widths[7],
            child: Text(displayTs,
                style: TextStyle(fontSize: 10, color: Colors.grey.shade600))),
        SizedBox(width: _widths[8],
            child: isUnprocessed
                ? GestureDetector(
                    onTap: () => _process(item['id'] as String),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: kBlue.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text('Process',
                          style: TextStyle(fontSize: 10, color: kBlue, fontWeight: FontWeight.w600)),
                    ),
                  )
                : const SizedBox()),
      ]),
    );
  }
}

// ── Linkage Records Tab ───────────────────────────────────────────────────────
class _LinkageRecordsTab extends StatefulWidget {
  const _LinkageRecordsTab();

  @override
  State<_LinkageRecordsTab> createState() => _LinkageRecordsTabState();
}

class _LinkageRecordsTabState extends State<_LinkageRecordsTab> {
  bool _loading = true;
  Object? _error;
  List<Map<String, dynamic>> _items = [];
  List<Map<String, dynamic>> _devices = [];
  String? _selectedDeviceId;

  static const _cols = ['Device', 'Trigger', 'Watched Var', 'Value', 'Linked Var', 'Action', 'Time'];
  static const _widths = [90.0, 90.0, 100.0, 60.0, 100.0, 70.0, 110.0];

  @override
  void initState() {
    super.initState();
    _initDevices();
  }

  Future<void> _initDevices() async {
    if (AppState.instance.devices.isEmpty) await AppState.instance.loadDevices();
    _devices = AppState.instance.devices;
    await _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final raw = await EmsApi.instance.getLinkageHistory(deviceId: _selectedDeviceId);
      setState(() => _items = raw);
    } catch (e) {
      setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _snack(String msg, {bool error = false}) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(msg),
        backgroundColor: error ? kRed : kGreen,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ));

  Future<void> _clearAll() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Clear All', style: TextStyle(color: kNavy, fontWeight: FontWeight.w700)),
        content: const Text('Delete all linkage record history?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('Cancel', style: TextStyle(color: Colors.grey.shade600)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: kRed, foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
            child: const Text('Clear All'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await EmsApi.instance.batchDeleteLinkageHistory(deviceId: _selectedDeviceId);
      _snack('History cleared');
      await _load();
    } catch (e) {
      _snack(e is ApiException ? e.message : 'Failed', error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Container(
        color: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(children: [
          Expanded(
            child: DropdownButtonFormField<String>(
              initialValue: _selectedDeviceId,
              decoration: InputDecoration(
                hintText: 'All Devices',
                filled: true,
                fillColor: kBg,
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
              ),
              items: [
                const DropdownMenuItem(value: null, child: Text('All Devices')),
                ..._devices.map((d) => DropdownMenuItem(
                    value: d['id'] as String?, child: Text(d['name'] as String? ?? ''))),
              ],
              onChanged: (v) {
                setState(() => _selectedDeviceId = v);
                _load();
              },
            ),
          ),
          const SizedBox(width: 8),
          IconButton(
            icon: const Icon(Icons.delete_sweep_outlined, color: kRed, size: 20),
            tooltip: 'Clear All',
            onPressed: _items.isEmpty ? null : _clearAll,
          ),
        ]),
      ),
      Expanded(
        child: _loading
            ? const LoadingView()
            : _error != null
                ? ErrorView.fromError(_error!, onRetry: _load)
                : _items.isEmpty
                    ? Center(
                        child: Text('No linkage records',
                            style: TextStyle(color: Colors.grey.shade500, fontSize: 13)))
                    : Padding(
                        padding: const EdgeInsets.all(16),
                        child: TableCard(
                          cols: _cols,
                          widths: _widths,
                          header: tableHeader(_cols, _widths),
                          rows: _items.map((item) => Column(children: [
                            Divider(height: 1, color: Colors.grey.shade100),
                            _row(item),
                          ])).toList(),
                          count: _items.length,
                        ),
                      ),
      ),
    ]);
  }

  Widget _row(Map<String, dynamic> item) {
    final ts = (item['createdAt'] as String? ?? '');
    final displayTs = ts.length > 16 ? ts.substring(0, 16) : ts;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
      child: Row(children: [
        SizedBox(width: _widths[0],
            child: Text(item['deviceName'] as String? ?? '',
                style: const TextStyle(fontSize: 11, color: kNavy, fontWeight: FontWeight.w500),
                overflow: TextOverflow.ellipsis)),
        SizedBox(width: _widths[1],
            child: Text(item['triggerName'] as String? ?? '',
                style: TextStyle(fontSize: 11, color: Colors.grey.shade700),
                overflow: TextOverflow.ellipsis)),
        SizedBox(width: _widths[2],
            child: Text(item['watchedVariableName'] as String? ?? '',
                style: TextStyle(fontSize: 11, color: Colors.grey.shade700),
                overflow: TextOverflow.ellipsis)),
        SizedBox(width: _widths[3],
            child: Text('${item['currentValue'] ?? ''}',
                style: TextStyle(fontSize: 11, color: Colors.grey.shade700))),
        SizedBox(width: _widths[4],
            child: Text(item['linkedVariableName'] as String? ?? '',
                style: TextStyle(fontSize: 11, color: Colors.grey.shade700),
                overflow: TextOverflow.ellipsis)),
        SizedBox(width: _widths[5],
            child: Text(item['action'] as String? ?? '',
                style: TextStyle(fontSize: 11, color: Colors.grey.shade700))),
        SizedBox(width: _widths[6],
            child: Text(displayTs,
                style: TextStyle(fontSize: 10, color: Colors.grey.shade600))),
      ]),
    );
  }
}

// ── Notifications Sent Tab ────────────────────────────────────────────────────
class _NotificationsSentTab extends StatefulWidget {
  const _NotificationsSentTab();

  @override
  State<_NotificationsSentTab> createState() => _NotificationsSentTabState();
}

class _NotificationsSentTabState extends State<_NotificationsSentTab> {
  bool _loading = true;
  Object? _error;
  List<Map<String, dynamic>> _items = [];
  List<Map<String, dynamic>> _devices = [];
  String? _selectedDeviceId;

  static const _cols = ['Device', 'Message', 'Push Type', 'Sent To', 'Status', 'Time'];
  static const _widths = [100.0, 160.0, 90.0, 130.0, 70.0, 120.0];

  @override
  void initState() {
    super.initState();
    _initDevices();
  }

  Future<void> _initDevices() async {
    if (AppState.instance.devices.isEmpty) await AppState.instance.loadDevices();
    _devices = AppState.instance.devices;
    await _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final raw = await EmsApi.instance.getAlarmHistoryNotifications(deviceId: _selectedDeviceId);
      setState(() => _items = raw);
    } catch (e) {
      setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Container(
        color: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: DropdownButtonFormField<String>(
          initialValue: _selectedDeviceId,
          decoration: InputDecoration(
            hintText: 'All Devices',
            filled: true,
            fillColor: kBg,
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
          ),
          items: [
            const DropdownMenuItem(value: null, child: Text('All Devices')),
            ..._devices.map((d) => DropdownMenuItem(
                value: d['id'] as String?, child: Text(d['name'] as String? ?? ''))),
          ],
          onChanged: (v) {
            setState(() => _selectedDeviceId = v);
            _load();
          },
        ),
      ),
      Expanded(
        child: _loading
            ? const LoadingView()
            : _error != null
                ? ErrorView.fromError(_error!, onRetry: _load)
                : _items.isEmpty
                    ? Center(
                        child: Text('No notifications sent',
                            style: TextStyle(color: Colors.grey.shade500, fontSize: 13)))
                    : Padding(
                        padding: const EdgeInsets.all(16),
                        child: TableCard(
                          cols: _cols,
                          widths: _widths,
                          header: tableHeader(_cols, _widths),
                          rows: _items.map((item) => Column(children: [
                            Divider(height: 1, color: Colors.grey.shade100),
                            _row(item),
                          ])).toList(),
                          count: _items.length,
                        ),
                      ),
      ),
    ]);
  }

  Widget _row(Map<String, dynamic> item) {
    final status = item['status'] as String? ?? 'SENT';
    final ts = item['sentAt'] as String? ?? '';
    final displayTs = ts.length > 16 ? ts.substring(0, 16) : ts;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
      child: Row(children: [
        SizedBox(width: _widths[0],
            child: Text(item['device']?['name'] as String? ?? '—',
                style: const TextStyle(fontSize: 11, color: kNavy, fontWeight: FontWeight.w500),
                overflow: TextOverflow.ellipsis)),
        SizedBox(width: _widths[1],
            child: Text(item['message'] as String? ?? '—',
                style: TextStyle(fontSize: 11, color: Colors.grey.shade700),
                overflow: TextOverflow.ellipsis)),
        SizedBox(width: _widths[2],
            child: Text(item['pushType'] as String? ?? '—',
                style: TextStyle(fontSize: 11, color: Colors.grey.shade700),
                overflow: TextOverflow.ellipsis)),
        SizedBox(width: _widths[3],
            child: Text(item['sentTo'] as String? ?? '—',
                style: TextStyle(fontSize: 11, color: Colors.grey.shade700),
                overflow: TextOverflow.ellipsis)),
        SizedBox(width: _widths[4],
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: kGreen.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(status,
                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: kGreen)),
            )),
        SizedBox(width: _widths[5],
            child: Text(displayTs,
                style: TextStyle(fontSize: 10, color: Colors.grey.shade600))),
      ]),
    );
  }
}
