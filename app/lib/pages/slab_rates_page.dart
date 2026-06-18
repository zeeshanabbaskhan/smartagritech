import 'package:flutter/material.dart';
import '../app_theme.dart';
import '../services/api_client.dart';
import '../services/ems_api.dart';
import '../utils/api_mappers.dart';
import '../utils/device_helpers.dart';
import '../widgets/api_state_views.dart';

class SlabRatesPage extends StatefulWidget {
  const SlabRatesPage({super.key});

  @override
  State<SlabRatesPage> createState() => _SlabRatesPageState();
}

class _SlabRatesPageState extends State<SlabRatesPage> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final raw = await EmsApi.instance.getSlabRates();
      setState(() => _items = raw.map(ApiMappers.slabRate).toList());
    } catch (e) {
      setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  static const _cols = ['Slave', 'Unit From', 'Unit To', 'Rate (PKR)', 'On-Peak', 'Off-Peak', 'Ops'];
  static const _widths = [85.0, 90.0, 80.0, 100.0, 90.0, 90.0, 72.0];

  void _showModal([int? index]) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _SlabFormModal(
        title: index != null ? 'Edit Slab Rate' : 'Add Slab Rate',
        item: index != null ? _items[index] : null,
        onSave: (data) async {
          try {
            final body = {
              'deviceConfigSlaveId': data['slaveId'],
              'unitFrom': data['from'],
              'unitTo': data['to'],
              'rate': data['rate'],
              'onPeakRate': data['onPeak'],
              'offPeakRate': data['offPeak'],
            };
            if (index != null) {
              await EmsApi.instance.updateSlabRate(_items[index]['id'] as String, body);
            } else {
              await EmsApi.instance.createSlabRate(body);
            }
            await _load();
            _snack(index != null ? 'Slab rate updated' : 'Slab rate added');
          } catch (e) {
            _snack(e is ApiException ? e.message : 'Save failed', error: true);
          }
        },
      ),
    );
  }

  void _confirmDelete(int index) => showDialog(
        context: context,
        builder: (_) => _DeleteDialog(
          title: 'Delete Slab Rate',
          message: 'Remove this slab rate entry?',
          onConfirm: () async {
            try {
              await EmsApi.instance.deleteSlabRate(_items[index]['id'] as String);
              await _load();
              _snack('Slab rate deleted');
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
        body: ErrorView.fromError(_error!, onRetry: _load),
      );
    }

    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kNavy, foregroundColor: Colors.white,
        title: const Text('Slab Rates',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Colors.white)),
        elevation: 0,
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: ElevatedButton.icon(
              onPressed: () => _showModal(),
              icon: const Icon(Icons.add, size: 16),
              label: const Text('Add Slab'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white, foregroundColor: kNavy,
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
        child: Column(children: [
          _FilterRow(),
          const SizedBox(height: 16),
          Expanded(child: _buildTable()),
        ]),
      ),
    );
  }

  Widget _buildTable() => Container(
        decoration: BoxDecoration(
          color: Colors.white, borderRadius: BorderRadius.circular(12),
          boxShadow: [BoxShadow(color: kNavy.withValues(alpha: 0.05), blurRadius: 8, offset: const Offset(0, 2))],
        ),
        child: Column(children: [
          Expanded(
            child: SingleChildScrollView(
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _header(),
                    ..._items.asMap().entries.map((e) => Column(children: [
                          Divider(height: 1, color: Colors.grey.shade100),
                          _row(e.key, e.value),
                        ])),
                  ],
                ),
              ),
            ),
          ),
          _footer(),
        ]),
      );

  Widget _header() => Container(
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

  Widget _row(int idx, Map<String, dynamic> item) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
        child: Row(children: [
          _cell(_widths[0], item['slave'] as String),
          _cell(_widths[1], item['from'] as String),
          _cell(_widths[2], item['to'] as String),
          _cell(_widths[3], item['rate'] as String),
          _cell(_widths[4], item['onPeak'] as String),
          _cell(_widths[5], item['offPeak'] as String),
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

  Widget _cell(double w, String v) => SizedBox(
        width: w,
        child: Text(v, style: TextStyle(fontSize: 12, color: Colors.grey.shade700)),
      );

  Widget _footer() => Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(border: Border(top: BorderSide(color: Colors.grey.shade100))),
        child: Text('Showing 1 to ${_items.length} of ${_items.length} entries',
            style: TextStyle(color: Colors.grey.shade500, fontSize: 12)),
      );
}

class _FilterRow extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.white, borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Colors.grey.shade300),
        ),
        child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          const Text('All locations', style: TextStyle(fontSize: 13, color: kNavy)),
          Icon(Icons.keyboard_arrow_down, size: 18, color: Colors.grey.shade500),
        ]),
      );
}

// ── Slab Form Modal ───────────────────────────────────────────────────────────
class _SlabFormModal extends StatefulWidget {
  const _SlabFormModal({required this.title, this.item, required this.onSave});
  final String title;
  final Map<String, dynamic>? item;
  final void Function(Map<String, dynamic>) onSave;

  @override
  State<_SlabFormModal> createState() => _SlabFormModalState();
}

class _SlabFormModalState extends State<_SlabFormModal> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _from, _to, _rate, _onPeak, _offPeak;
  String? _slaveId;
  List<Map<String, dynamic>> _slaves = [];

  @override
  void initState() {
    super.initState();
    final d = widget.item;
    _slaveId = d?['slaveId'] as String?;
    _from = TextEditingController(text: d?['from'] ?? '');
    _to = TextEditingController(text: d?['to'] ?? '');
    _rate = TextEditingController(text: d?['rate'] ?? '');
    _onPeak = TextEditingController(text: d?['onPeak'] ?? '');
    _offPeak = TextEditingController(text: d?['offPeak'] ?? '');
    _loadSlaves();
  }

  Future<void> _loadSlaves() async {
    _slaves = await DeviceHelpers.loadAllSlaves();
    _slaveId ??= _slaves.firstOrNull?['id'] as String?;
    if (mounted) setState(() {});
  }

  @override
  void dispose() { _from.dispose(); _to.dispose(); _rate.dispose(); _onPeak.dispose(); _offPeak.dispose(); super.dispose(); }

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
          Row(children: [
            Expanded(child: _TF('Unit From', _from, hint: '0', num: true,
                v: (v) => v!.isEmpty ? 'Required' : null)),
            const SizedBox(width: 12),
            Expanded(child: _TF('Unit To', _to, hint: '100', num: true,
                v: (v) => v!.isEmpty ? 'Required' : null)),
          ]),
          const SizedBox(height: 14),
          _TF('Rate (PKR/unit)', _rate, hint: '12.50', num: true,
              v: (v) => v!.isEmpty ? 'Required' : null),
          const SizedBox(height: 14),
          Row(children: [
            Expanded(child: _TF('On-Peak Rate', _onPeak, hint: '15.00', num: true)),
            const SizedBox(width: 12),
            Expanded(child: _TF('Off-Peak Rate', _offPeak, hint: '10.00', num: true)),
          ]),
          const SizedBox(height: 24),
          _ActRow(
            onCancel: () => Navigator.pop(context),
            onSave: () {
              if (_formKey.currentState!.validate()) {
                Navigator.pop(context);
                if (_slaveId == null) return;
                widget.onSave({
                  'slaveId': _slaveId,
                  'from': _from.text.trim(),
                  'to': _to.text.trim(),
                  'rate': _rate.text.trim(),
                  'onPeak': _onPeak.text.trim(),
                  'offPeak': _offPeak.text.trim(),
                });
              }
            },
          ),
        ]),
      ),
    );
  }
}

// ── Shared page-level helpers ─────────────────────────────────────────────────
class _Sheet extends StatelessWidget {
  const _Sheet({required this.title, required this.child});
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(
        left: 24, right: 24, top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(child: Container(width: 40, height: 4,
                decoration: BoxDecoration(color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2)))),
            const SizedBox(height: 16),
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: kNavy)),
              IconButton(icon: const Icon(Icons.close, size: 20),
                  onPressed: () => Navigator.pop(context),
                  padding: EdgeInsets.zero, constraints: const BoxConstraints()),
            ]),
            const SizedBox(height: 20),
            child,
          ],
        ),
      ),
    );
  }
}

class _TF extends StatelessWidget {
  const _TF(this.label, this.ctrl,
      {this.hint, this.num = false, this.v});
  final String label;
  final TextEditingController ctrl;
  final String? hint;
  final bool num;
  final String? Function(String?)? v;

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: kNavy)),
      const SizedBox(height: 6),
      TextFormField(
        controller: ctrl,
        validator: v,
        keyboardType: num ? TextInputType.number : null,
        style: const TextStyle(fontSize: 14, color: kNavy),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13),
          filled: true, fillColor: kBg,
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: kNavy, width: 1.5)),
          errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: kRed, width: 1.2)),
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

class _DeleteDialog extends StatelessWidget {
  const _DeleteDialog({required this.title, required this.message, required this.onConfirm});
  final String title, message;
  final VoidCallback onConfirm;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: Text(title, style: const TextStyle(color: kNavy, fontWeight: FontWeight.w700)),
      content: Text(message),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text('Cancel', style: TextStyle(color: Colors.grey.shade600)),
        ),
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
