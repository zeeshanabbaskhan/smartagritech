import 'package:flutter/material.dart';
import '../app_theme.dart';
import '../services/api_client.dart';
import '../services/ems_api.dart';
import '../utils/api_mappers.dart';
import '../utils/device_helpers.dart';
import '../widgets/api_state_views.dart';

class IntervalHistoryPage extends StatefulWidget {
  const IntervalHistoryPage({super.key});

  @override
  State<IntervalHistoryPage> createState() => _IntervalHistoryPageState();
}

class _IntervalHistoryPageState extends State<IntervalHistoryPage> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  bool _loadingMore = false;
  Object? _error;
  int _page = 1;
  int _totalPages = 1;
  int _total = 0;
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
      final res = await EmsApi.instance.getIntervalHistoryPage(page: _page, limit: _pageSize);
      final raw = List<Map<String, dynamic>>.from(res['items'] as List);
      setState(() {
        _items = raw.map(ApiMappers.intervalHistory).toList();
        _totalPages = (res['pages'] as num?)?.toInt() ?? 1;
        _total = (res['total'] as num?)?.toInt() ?? _items.length;
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
      final res = await EmsApi.instance.getIntervalHistoryPage(page: nextPage, limit: _pageSize);
      final raw = List<Map<String, dynamic>>.from(res['items'] as List);
      setState(() {
        _page = nextPage;
        _totalPages = (res['pages'] as num?)?.toInt() ?? _totalPages;
        _total = (res['total'] as num?)?.toInt() ?? _total;
        _items.addAll(raw.map(ApiMappers.intervalHistory));
      });
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  static const _cols = ['Variable', 'Slave', 'Total Units', 'Tariff', 'Date From', 'Date To', 'Ops'];
  static const _widths = [110.0, 85.0, 100.0, 80.0, 110.0, 110.0, 72.0];

  void _showModal([int? index]) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _IntervalFormModal(
        title: index != null ? 'Edit Interval' : 'Add Interval',
        item: index != null ? _items[index] : null,
        onSave: (data) async {
          if (index != null) {
            _snack('Edit not supported — delete and recreate', error: true);
            return;
          }
          try {
            await EmsApi.instance.createIntervalHistory({
              'deviceConfigSlaveId': data['slaveId'],
              'variableName': data['variable'],
              'startDate': data['from'],
              'endDate': data['to'],
            });
            await _load(reset: true);
            _snack('Interval computed and saved');
          } catch (e) {
            _snack(e is ApiException ? e.message : 'Save failed', error: true);
          }
        },
      ),
    );
  }

  void _confirmDelete(int index) => showDialog(
        context: context,
        builder: (_) => _ConfirmDelete(
          label: _items[index]['variable'] as String,
          onConfirm: () async {
            try {
              await EmsApi.instance.deleteIntervalHistory(_items[index]['id'] as String);
              await _load(reset: true);
              _snack('Interval deleted');
            } catch (e) {
              _snack(e is ApiException ? e.message : 'Delete failed', error: true);
            }
          },
        ),
      );

  void _snack(String msg, {bool error = false}) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(msg), backgroundColor: error ? kRed : kGreen,
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

    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kNavy,
        foregroundColor: Colors.white,
        title: const Text('Interval History',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Colors.white)),
        elevation: 0,
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: ElevatedButton.icon(
              onPressed: () => _showModal(),
              icon: const Icon(Icons.add, size: 16),
              label: const Text('Add'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: kNavy,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
              ),
            ),
          ),
        ],
      ),
      body: Padding(
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
                      if (_loadingMore)
                        const Padding(
                          padding: EdgeInsets.all(16),
                          child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
                        ),
                    ],
                  ),
                ),
              ),
            ),
            _footer(),
          ]),
        ),
      ),
    );
  }

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

  Widget _tableRow(int idx, Map<String, dynamic> item) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
        child: Row(children: [
          SizedBox(width: _widths[0],
              child: Text(item['variable'] as String,
                  style: const TextStyle(fontSize: 12, color: kNavy, fontWeight: FontWeight.w500),
                  overflow: TextOverflow.ellipsis)),
          SizedBox(width: _widths[1],
              child: Text(item['slave'] as String,
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade700))),
          SizedBox(width: _widths[2],
              child: Text(item['unit'] as String,
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade700))),
          SizedBox(width: _widths[3],
              child: Text(item['tariff'] as String,
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade700))),
          SizedBox(width: _widths[4],
              child: Text(item['from'] as String,
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade700))),
          SizedBox(width: _widths[5],
              child: Text(item['to'] as String,
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade700))),
          SizedBox(
            width: _widths[6],
            child: Row(children: [
              GestureDetector(onTap: () => _showModal(idx),
                  child: const Icon(Icons.edit_outlined, size: 17, color: kBlue)),
              const SizedBox(width: 10),
              GestureDetector(onTap: () => _confirmDelete(idx),
                  child: const Icon(Icons.delete_outline, size: 17, color: kRed)),
            ]),
          ),
        ]),
      );

  Widget _footer() => Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(border: Border(top: BorderSide(color: Colors.grey.shade100))),
        child: Text('Showing ${_items.length} of $_total entries',
            style: TextStyle(color: Colors.grey.shade500, fontSize: 12)),
      );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
class _IntervalFormModal extends StatefulWidget {
  const _IntervalFormModal({required this.title, this.item, required this.onSave});
  final String title;
  final Map<String, dynamic>? item;
  final void Function(Map<String, dynamic>) onSave;

  @override
  State<_IntervalFormModal> createState() => _IntervalFormModalState();
}

class _IntervalFormModalState extends State<_IntervalFormModal> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _from, _to;
  String? _slaveId;
  String _variable = 'PowerConsumption';
  List<Map<String, dynamic>> _slaves = [];

  @override
  void initState() {
    super.initState();
    final d = widget.item;
    _variable = d?['variable'] as String? ?? 'PowerConsumption';
    _from = TextEditingController(text: d?['start'] as String? ?? d?['from'] as String? ?? '');
    _to = TextEditingController(text: d?['end'] as String? ?? d?['to'] as String? ?? '');
    _loadSlaves();
  }

  Future<void> _loadSlaves() async {
    _slaves = await DeviceHelpers.loadAllSlaves();
    _slaveId ??= _slaves.firstOrNull?['id'] as String?;
    if (mounted) setState(() {});
  }

  @override
  void dispose() { _from.dispose(); _to.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return _Sheet(
      title: widget.title,
      child: Form(
        key: _formKey,
        child: Column(children: [
          _DD(
              'Slave',
              _slaves.firstWhere((s) => s['id'] == _slaveId, orElse: () => {'label': '—'})['label']?.toString() ?? '—',
              _slaves.map((s) => s['label']?.toString() ?? '—').toList(),
              (v) => setState(() {
                final match = _slaves.where((s) => s['label'] == v);
                _slaveId = match.isEmpty ? null : match.first['id'] as String?;
              })),
          const SizedBox(height: 14),
          _DD('Variable', _variable,
              ['PowerConsumption', 'ActivePower', 'VoltageA', 'CurrentA', 'PowerFactor'],
              (v) => setState(() => _variable = v!)),
          const SizedBox(height: 14),
          Row(children: [
            Expanded(child: _TF('Date From', _from, hint: '2025-06-01',
                validator: (v) => v!.isEmpty ? 'Required' : null)),
            const SizedBox(width: 12),
            Expanded(child: _TF('Date To', _to, hint: '2025-06-07')),
          ]),
          const SizedBox(height: 24),
          _ActRow(
            onCancel: () => Navigator.pop(context),
            onSave: () {
              if (_formKey.currentState!.validate()) {
                Navigator.pop(context);
                if (_slaveId == null) return;
                widget.onSave({
                  'variable': _variable,
                  'slaveId': _slaveId,
                  'from': _from.text.trim(),
                  'to': _to.text.trim(),
                });
              }
            },
          ),
        ]),
      ),
    );
  }
}

class _ConfirmDelete extends StatelessWidget {
  const _ConfirmDelete({required this.label, required this.onConfirm});
  final String label;
  final VoidCallback onConfirm;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: const Text('Delete Interval',
          style: TextStyle(color: kNavy, fontWeight: FontWeight.w700)),
      content: Text('Remove the interval record for "$label"?'),
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

// ── Inline helpers ────────────────────────────────────────────────────────────
class _Sheet extends StatelessWidget {
  const _Sheet({required this.title, required this.child});
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
          color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      padding: EdgeInsets.only(
          left: 24, right: 24, top: 16, bottom: MediaQuery.of(context).viewInsets.bottom + 24),
      child: SingleChildScrollView(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Center(child: Container(width: 40, height: 4,
              decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)))),
          const SizedBox(height: 16),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: kNavy)),
            IconButton(icon: const Icon(Icons.close, size: 20),
                onPressed: () => Navigator.pop(context),
                padding: EdgeInsets.zero, constraints: const BoxConstraints()),
          ]),
          const SizedBox(height: 20),
          child,
        ]),
      ),
    );
  }
}

class _TF extends StatelessWidget {
  const _TF(this.label, this.ctrl, {this.hint, this.validator});
  final String label;
  final TextEditingController ctrl;
  final String? hint;
  final bool num;
  final String? Function(String?)? validator;

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: kNavy)),
      const SizedBox(height: 6),
      TextFormField(
        controller: ctrl, validator: validator,
        keyboardType: num ? TextInputType.number : null,
        style: const TextStyle(fontSize: 14, color: kNavy),
        decoration: InputDecoration(
          hintText: hint, hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13),
          filled: true, fillColor: kBg,
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: kNavy, width: 1.5)),
          errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: kRed, width: 1.2)),
          focusedErrorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: kRed, width: 1.5)),
        ),
      ),
    ]);
  }
}

class _DD extends StatelessWidget {
  const _DD(this.label, this.value, this.items, this.onChanged);
  final String label, value;
  final List<String> items;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: kNavy)),
      const SizedBox(height: 6),
      DropdownButtonFormField<String>(
        initialValue: value, onChanged: onChanged,
        style: const TextStyle(fontSize: 14, color: kNavy),
        decoration: InputDecoration(
          filled: true, fillColor: kBg,
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: kNavy, width: 1.5)),
        ),
        items: items.map((e) => DropdownMenuItem(value: e, child: Text(e))).toList(),
      ),
    ]);
  }
}

class _ActRow extends StatelessWidget {
  const _ActRow({required this.onCancel, required this.onSave});
  final VoidCallback onCancel, onSave;

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      Expanded(
        child: OutlinedButton(
          onPressed: onCancel,
          style: OutlinedButton.styleFrom(
            foregroundColor: Colors.grey.shade600,
            side: BorderSide(color: Colors.grey.shade300),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            padding: const EdgeInsets.symmetric(vertical: 14),
          ),
          child: const Text('Cancel'),
        ),
      ),
      const SizedBox(width: 12),
      Expanded(
        child: ElevatedButton(
          onPressed: onSave,
          style: ElevatedButton.styleFrom(
            backgroundColor: kNavy, foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            padding: const EdgeInsets.symmetric(vertical: 14),
          ),
          child: const Text('Save', style: TextStyle(fontWeight: FontWeight.w600)),
        ),
      ),
    ]);
  }
}
