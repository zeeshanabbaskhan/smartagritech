import 'package:flutter/material.dart';
import '../app_theme.dart';
import '../services/ems_api.dart';
import '../utils/api_mappers.dart';
import '../widgets/api_state_views.dart';
import 'org/org_helpers.dart';

class DeviceTimestampsPage extends StatefulWidget {
  const DeviceTimestampsPage({super.key});

  @override
  State<DeviceTimestampsPage> createState() => _DeviceTimestampsPageState();
}

class _DeviceTimestampsPageState extends State<DeviceTimestampsPage> {
  List<Map<String, dynamic>> _records = [];
  bool _loading = true;
  Object? _error;
  String _filter = 'All';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final raw = await EmsApi.instance.getDeviceTimestamps();
      setState(() => _records = raw);
    } catch (e) {
      setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  static const _cols = ['Device', 'Status', 'Last Active', 'Mins Ago'];
  static const _widths = [160.0, 80.0, 145.0, 80.0];

  @override
  Widget build(BuildContext context) {
    final online = _records.where((r) => r['onlineStatus'] == 'ONLINE').length;
    final filtered = _filter == 'All'
        ? _records
        : _records.where((r) => r['onlineStatus'] == _filter).toList();

    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kNavy,
        foregroundColor: Colors.white,
        title: const Text('Device Connectivity',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Colors.white)),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_outlined, size: 20),
            onPressed: _load,
          ),
        ],
      ),
      body: Column(children: [
        Container(
          color: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              StatChip('Total', _records.length, kNavy),
              const SizedBox(width: 16),
              StatChip('Online', online, kGreen),
              const SizedBox(width: 16),
              StatChip('Offline', _records.length - online, kRed),
            ]),
            const SizedBox(height: 10),
            Row(children: [
              _filterChip('All', _filter == 'All', () => setState(() => _filter = 'All')),
              const SizedBox(width: 6),
              _filterChip('Online', _filter == 'ONLINE', () => setState(() => _filter = 'ONLINE')),
              const SizedBox(width: 6),
              _filterChip('Offline', _filter == 'OFFLINE', () => setState(() => _filter = 'OFFLINE')),
            ]),
          ]),
        ),
        Expanded(
          child: _loading
              ? const LoadingView()
              : _error != null
                  ? ErrorView.fromError(_error!, onRetry: _load)
                  : filtered.isEmpty
                      ? Center(
                          child: Text('No records found',
                              style: TextStyle(color: Colors.grey.shade500, fontSize: 13)))
                      : Padding(
                          padding: const EdgeInsets.all(16),
                          child: TableCard(
                            cols: _cols,
                            widths: _widths,
                            header: tableHeader(_cols, _widths),
                            rows: filtered.map((r) => Column(children: [
                              Divider(height: 1, color: Colors.grey.shade100),
                              _row(r),
                            ])).toList(),
                            count: filtered.length,
                          ),
                        ),
        ),
      ]),
    );
  }

  Widget _row(Map<String, dynamic> r) {
    final isOnline = r['onlineStatus'] == 'ONLINE';
    final minsAgo = r['lastActiveMinsAgo'] as int? ?? 0;
    final ts = r['lastActiveAt'] as String? ?? '';
    final displayTs = ApiMappers.fmtDate(ts);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
      child: Row(children: [
        SizedBox(
          width: _widths[0],
          child: Row(children: [
            Container(
              width: 7,
              height: 7,
              decoration: BoxDecoration(
                color: isOnline ? kGreen : kRed,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                r['device']?['name'] as String? ?? r['deviceId'] as String? ?? '—',
                style: const TextStyle(fontSize: 12, color: kNavy, fontWeight: FontWeight.w600),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ]),
        ),
        SizedBox(
          width: _widths[1],
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: (isOnline ? kGreen : kRed).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              isOnline ? 'Online' : 'Offline',
              style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: isOnline ? kGreen : kRed),
            ),
          ),
        ),
        SizedBox(
          width: _widths[2],
          child: Text(displayTs,
              style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
              overflow: TextOverflow.ellipsis),
        ),
        SizedBox(
          width: _widths[3],
          child: Text(
            isOnline ? 'Just now' : '${minsAgo}m ago',
            style: TextStyle(
                fontSize: 12,
                color: isOnline ? kGreen : Colors.grey.shade500,
                fontWeight: isOnline ? FontWeight.w600 : FontWeight.normal),
          ),
        ),
      ]),
    );
  }

  Widget _filterChip(String label, bool selected, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: selected ? kNavy : Colors.grey.shade100,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(label,
            style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: selected ? Colors.white : Colors.grey.shade600)),
      ),
    );
  }
}
