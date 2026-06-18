import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../app_theme.dart';
import '../services/api_client.dart';
import '../services/ems_api.dart';
import '../utils/api_mappers.dart';
import '../widgets/api_state_views.dart';

class NotificationsPage extends StatefulWidget {
  const NotificationsPage({super.key});

  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  bool _loadingMore = false;
  Object? _error;
  int _page = 1;
  int _totalPages = 1;
  static const _pageSize = 30;
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    _load(reset: true);
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

  Future<void> _load({bool reset = false}) async {
    if (reset) {
      _page = 1;
      setState(() { _loading = true; _error = null; });
    }
    try {
      final res = await EmsApi.instance.getNotificationsPage(page: _page, limit: _pageSize);
      final raw = List<Map<String, dynamic>>.from(res['items'] as List);
      setState(() {
        _items = raw.map(ApiMappers.notification).toList();
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
      final res = await EmsApi.instance.getNotificationsPage(page: nextPage, limit: _pageSize);
      final raw = List<Map<String, dynamic>>.from(res['items'] as List);
      setState(() {
        _page = nextPage;
        _totalPages = (res['pages'] as num?)?.toInt() ?? _totalPages;
        _items.addAll(raw.map(ApiMappers.notification));
      });
    } catch (e) {
      _snack(e is ApiException ? e.message : 'Load failed', error: true);
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  static const _cols = ['Severity', 'Trigger Name', 'Device', 'Description', 'Time', 'Ops'];
  static const _widths = [80.0, 145.0, 95.0, 210.0, 135.0, 50.0];

  static const _severityColors = {
    'Critical': kRed,
    'Warning': kOrange,
    'Info': kBlue,
  };

  void _confirmDelete(int index) => showDialog(
        context: context,
        builder: (_) => _ConfirmDelete(
          label: _items[index]['trigger'] as String,
          onConfirm: () async {
            try {
              await EmsApi.instance.deleteNotification(_items[index]['id'] as String);
              await _load(reset: true);
              _snack('Notification deleted');
            } catch (e) {
              _snack(e is ApiException ? e.message : 'Delete failed', error: true);
            }
          },
        ),
      );

  void _confirmDeleteAll() => showDialog(
        context: context,
        builder: (_) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('Clear All Notifications',
              style: TextStyle(color: kNavy, fontWeight: FontWeight.w700)),
          content: const Text('This will permanently remove all alarm notifications.'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context),
                child: Text('Cancel', style: TextStyle(color: Colors.grey.shade600))),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(context);
                try {
                  await EmsApi.instance.deleteAllNotifications();
                  await _load(reset: true);
                  _snack('All notifications cleared');
                } catch (e) {
                  _snack(e is ApiException ? e.message : 'Failed', error: true);
                }
              },
              style: ElevatedButton.styleFrom(backgroundColor: kRed, foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
              child: const Text('Clear All'),
            ),
          ],
        ),
      );

  Future<void> _markAllRead() async {
    try {
      await EmsApi.instance.markAllNotificationsRead();
      await _load(reset: true);
      _snack('All notifications marked as read');
    } catch (e) {
      _snack(e is ApiException ? e.message : 'Failed', error: true);
    }
  }

  Future<void> _markRead(int index) async {
    final item = _items[index];
    if (item['read'] == true) return;
    try {
      await EmsApi.instance.markNotificationRead(item['id'] as String);
      setState(() {
        _items[index] = {...item, 'read': true, 'severity': 'Info'};
      });
    } catch (e) {
      _snack(e is ApiException ? e.message : 'Failed', error: true);
    }
  }

  Future<void> _exportCsv() async {
    try {
      final csv = await EmsApi.instance.buildNotificationsCsv(_items);
      final bytes = Uint8List.fromList(csv.codeUnits);
      await Share.shareXFiles(
        [XFile.fromData(bytes, name: 'notifications.csv', mimeType: 'text/csv')],
        subject: 'Alarm Notifications Export',
      );
    } catch (e) {
      _snack('Export failed', error: true);
    }
  }

  void _snack(String msg, {bool error = false}) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(msg),
        backgroundColor: error ? kRed : kGreen,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ));

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(backgroundColor: kBg, body: LoadingView());
    }
    if (_error != null) {
      return Scaffold(
        backgroundColor: kBg,
        body: ErrorView.fromError(_error!, onRetry: () => _load(reset: true)),
      );
    }

    final critCount = _items.where((i) => i['severity'] == 'Critical').length;
    final warnCount = _items.where((i) => i['severity'] == 'Warning').length;

    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kNavy,
        foregroundColor: Colors.white,
        title: Row(children: [
          const Text('Alarm Notifications',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Colors.white)),
          if (_items.isNotEmpty) ...[
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(color: kRed, borderRadius: BorderRadius.circular(12)),
              child: Text('${_items.length}',
                  style: const TextStyle(fontSize: 11, color: Colors.white, fontWeight: FontWeight.w700)),
            ),
          ],
        ]),
        elevation: 0,
        actions: [
          if (_items.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.download_outlined),
              tooltip: 'Export CSV',
              onPressed: _exportCsv,
            ),
          if (_items.any((i) => i['read'] != true))
            TextButton(
              onPressed: _markAllRead,
              child: const Text('Mark all read', style: TextStyle(color: Colors.white)),
            ),
          if (_items.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: ElevatedButton.icon(
                onPressed: _confirmDeleteAll,
                icon: const Icon(Icons.delete_sweep_outlined, size: 16),
                label: const Text('Clear All'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: kRed.withValues(alpha: 0.9),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                ),
              ),
            ),
        ],
      ),
      body: _items.isEmpty ? _empty() : Column(children: [
        Container(
          color: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(children: [
            _chip('Total', _items.length, kNavy),
            const SizedBox(width: 16),
            _chip('Critical', critCount, kRed),
            const SizedBox(width: 16),
            _chip('Warning', warnCount, kOrange),
          ]),
        ),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                boxShadow: [BoxShadow(color: kNavy.withValues(alpha: 0.05), blurRadius: 8, offset: const Offset(0, 2))],
              ),
              child: Column(children: [
                Expanded(
                  child: SingleChildScrollView(
                    controller: _scrollController,
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _tableHeader(),
                          ..._items.asMap().entries.map((e) => Column(children: [
                                Divider(height: 1, color: Colors.grey.shade100),
                                _tableRow(e.key, e.value),
                              ])),
                        ],
                      ),
                    ),
                  ),
                ),
                _footer(),
              ]),
            ),
          ),
        ),
      ]),
    );
  }

  Widget _chip(String label, int count, Color color) => Row(children: [
        Container(width: 8, height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 6),
        Text('$label: $count',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color)),
      ]);

  Widget _tableHeader() => Container(
        padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 12),
        decoration: BoxDecoration(
          color: kNavy.withValues(alpha: 0.04),
          borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
          border: Border(bottom: BorderSide(color: Colors.grey.shade200)),
        ),
        child: Row(
          children: List.generate(_cols.length, (i) => SizedBox(
            width: _widths[i],
            child: Text(_cols[i],
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: kNavy)),
          )),
        ),
      );

  Widget _tableRow(int idx, Map<String, dynamic> item) {
    final sc = _severityColors[item['severity']] ?? kNavy;
    final unread = item['read'] != true;
    return InkWell(
      onTap: () => _markRead(idx),
      child: Padding(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
      child: Row(children: [
        if (unread)
          Container(
            width: 6,
            height: 6,
            margin: const EdgeInsets.only(right: 6),
            decoration: const BoxDecoration(color: kBlue, shape: BoxShape.circle),
          ),
        SizedBox(width: _widths[0],
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                  color: sc.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(20)),
              child: Text(item['severity'] as String,
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: sc)),
            )),
        SizedBox(width: _widths[1],
            child: Text(item['trigger'] as String,
                style: const TextStyle(fontSize: 12, color: kNavy, fontWeight: FontWeight.w500),
                overflow: TextOverflow.ellipsis)),
        SizedBox(width: _widths[2],
            child: Text(item['device'] as String,
                style: TextStyle(fontSize: 12, color: Colors.grey.shade700))),
        SizedBox(width: _widths[3],
            child: Text(item['desc'] as String,
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                overflow: TextOverflow.ellipsis)),
        SizedBox(width: _widths[4],
            child: Text(item['time'] as String,
                style: TextStyle(fontSize: 11, color: Colors.grey.shade600))),
        SizedBox(
          width: _widths[5],
          child: GestureDetector(
            onTap: () => _confirmDelete(idx),
            child: const Icon(Icons.delete_outline, size: 17, color: kRed),
          ),
        ),
      ]),
    ),
    );
  }

  Widget _footer() => Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(border: Border(top: BorderSide(color: Colors.grey.shade100))),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('Page $_page of $_totalPages · ${_items.length} loaded',
                style: TextStyle(color: Colors.grey.shade500, fontSize: 12)),
            if (_loadingMore)
              const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
          ],
        ),
      );

  Widget _empty() => Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.notifications_none_outlined, size: 64, color: Colors.grey.shade300),
          const SizedBox(height: 12),
          Text('No notifications', style: TextStyle(fontSize: 15, color: Colors.grey.shade500)),
          const SizedBox(height: 6),
          Text('All alarm notifications will appear here',
              style: TextStyle(fontSize: 13, color: Colors.grey.shade400)),
        ]),
      );
}

class _ConfirmDelete extends StatelessWidget {
  const _ConfirmDelete({required this.label, required this.onConfirm});
  final String label;
  final VoidCallback onConfirm;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: const Text('Delete Notification',
          style: TextStyle(color: kNavy, fontWeight: FontWeight.w700)),
      content: Text('Remove notification "$label"?'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context),
            child: Text('Cancel', style: TextStyle(color: Colors.grey.shade600))),
        ElevatedButton(
          onPressed: () { Navigator.pop(context); onConfirm(); },
          style: ElevatedButton.styleFrom(backgroundColor: kRed, foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
          child: const Text('Delete'),
        ),
      ],
    );
  }
}
