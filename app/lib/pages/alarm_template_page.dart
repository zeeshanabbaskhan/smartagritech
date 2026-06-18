import 'package:flutter/material.dart';
import '../app_theme.dart';
import '../services/api_client.dart';
import '../services/ems_api.dart';
import '../utils/api_mappers.dart';
import '../widgets/api_state_views.dart';

class AlarmTemplatePage extends StatefulWidget {
  const AlarmTemplatePage({super.key});

  @override
  State<AlarmTemplatePage> createState() => _AlarmTemplatePageState();
}

class _AlarmTemplatePageState extends State<AlarmTemplatePage> {
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
      final raw = await EmsApi.instance.getAlarmTemplates();
      setState(() => _items = raw.map(ApiMappers.alarmTemplate).toList());
    } catch (e) {
      setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  static const _cols = ['Trigger Name', 'Template', 'Variable', 'Condition', 'Threshold', 'Severity', 'Updated', 'Ops'];
  static const _widths = [140.0, 120.0, 120.0, 80.0, 85.0, 80.0, 130.0, 72.0];

  void _showModal([int? index]) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _AlarmFormModal(
        title: index != null ? 'Edit Alarm Template' : 'Add Alarm Template',
        item: index != null ? _items[index] : null,
        onSave: (data) async {
          try {
            if (index != null) {
              await EmsApi.instance.updateAlarmTemplate(_items[index]['id'] as String, data);
              _snack('Template updated');
            } else {
              await EmsApi.instance.createAlarmTemplate(data);
              _snack('Template added');
            }
            await _load();
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
          label: _items[index]['trigger'] as String,
          onConfirm: () async {
            try {
              await EmsApi.instance.deleteAlarmTemplate(_items[index]['id'] as String);
              await _load();
              _snack('Template deleted');
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

  static const _severityColors = {
    'Critical': kRed,
    'Warning': kOrange,
    'Info': kBlue,
  };

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
        backgroundColor: kNavy,
        foregroundColor: Colors.white,
        title: const Text('Alarm Templates',
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

  Widget _tableRow(int idx, Map<String, dynamic> item) {
    final sc = _severityColors[item['severity']] ?? kNavy;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
      child: Row(children: [
        SizedBox(width: _widths[0],
            child: Text(item['trigger'] as String,
                style: const TextStyle(fontSize: 12, color: kNavy, fontWeight: FontWeight.w500),
                overflow: TextOverflow.ellipsis)),
        SizedBox(width: _widths[1],
            child: Text(item['template'] as String,
                style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
                overflow: TextOverflow.ellipsis)),
        SizedBox(width: _widths[2],
            child: Text(item['variable'] as String,
                style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
                overflow: TextOverflow.ellipsis)),
        SizedBox(width: _widths[3],
            child: Text(item['condition'] as String,
                style: TextStyle(fontSize: 13, color: Colors.grey.shade700, fontWeight: FontWeight.w600))),
        SizedBox(width: _widths[4],
            child: Text(item['threshold'] as String,
                style: TextStyle(fontSize: 12, color: Colors.grey.shade700))),
        SizedBox(width: _widths[5],
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: sc.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(item['severity'] as String,
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: sc)),
            )),
        SizedBox(width: _widths[6],
            child: Text(item['updated'] as String,
                style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                overflow: TextOverflow.ellipsis)),
        SizedBox(
          width: _widths[7],
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
  }

  Widget _footer() => Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(border: Border(top: BorderSide(color: Colors.grey.shade100))),
        child: Text('Showing 1 to ${_items.length} of ${_items.length} entries',
            style: TextStyle(color: Colors.grey.shade500, fontSize: 12)),
      );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
class _AlarmFormModal extends StatefulWidget {
  const _AlarmFormModal({required this.title, this.item, required this.onSave});
  final String title;
  final Map<String, dynamic>? item;
  final void Function(Map<String, dynamic>) onSave;

  @override
  State<_AlarmFormModal> createState() => _AlarmFormModalState();
}

class _AlarmFormModalState extends State<_AlarmFormModal> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameCtrl;
  late final TextEditingController _thresholdCtrl;
  List<Map<String, dynamic>> _templates = [];
  List<Map<String, dynamic>> _variables = [];
  String? _templateId;
  String? _variableId;
  String _operator = 'GT';
  String _priority = 'MEDIUM';
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    final d = widget.item;
    _nameCtrl = TextEditingController(text: d?['trigger'] as String? ?? '');
    _thresholdCtrl = TextEditingController(text: d?['threshold'] as String? ?? '');
    _operator = _mapOperator(d?['condition'] as String? ?? 'GT');
    _priority = _mapPriority(d?['severity'] as String? ?? 'Warning');
    _templateId = d?['deviceTemplateId'] as String?;
    _variableId = d?['templateVariableId'] as String?;
    _init();
  }

  String _mapOperator(String ui) {
    switch (ui) {
      case '>':
      case 'GT':
        return 'GT';
      case '<':
      case 'LT':
        return 'LT';
      case '>=':
      case 'GTE':
        return 'GTE';
      case '<=':
      case 'LTE':
        return 'LTE';
      case '==':
      case 'EQ':
        return 'EQ';
      default:
        return 'GT';
    }
  }

  String _mapPriority(String ui) {
    switch (ui) {
      case 'Critical':
        return 'HIGH';
      case 'Info':
        return 'LOW';
      default:
        return 'MEDIUM';
    }
  }

  Future<void> _init() async {
    try {
      _templates = await EmsApi.instance.getDeviceTemplates();
      if (_templateId != null) await _loadVariables(_templateId!);
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _loadVariables(String templateId) async {
    try {
      final detail = await EmsApi.instance.getDeviceTemplate(templateId);
      final vars = <Map<String, dynamic>>[];
      final slaves = detail['slaves'];
      if (slaves is List) {
        for (final s in slaves) {
          if (s is! Map) continue;
          final list = s['variables'];
          if (list is List) {
            for (final v in list) {
              if (v is Map) vars.add(Map<String, dynamic>.from(v));
            }
          }
        }
      }
      setState(() {
        _variables = vars;
        if (_variableId == null && vars.isNotEmpty) {
          _variableId = vars.first['id'] as String?;
        }
      });
    } catch (_) {
      setState(() => _variables = []);
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _thresholdCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.item != null) {
      return _Sheet(
        title: widget.title,
        child: const Padding(
          padding: EdgeInsets.symmetric(vertical: 24),
          child: Text('Edit alarm templates is not supported in the app yet.'),
        ),
      );
    }

    return _Sheet(
      title: widget.title,
      child: _loading
          ? const Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: CircularProgressIndicator(color: kNavy)),
            )
          : Form(
              key: _formKey,
              child: Column(children: [
                _TF('Trigger Name', _nameCtrl, hint: 'e.g. Overvoltage Alert',
                    validator: (v) => v!.isEmpty ? 'Required' : null),
                const SizedBox(height: 14),
                _DD(
                  'Device Template',
                  _templates
                          .where((t) => t['id'] == _templateId)
                          .map((t) => t['name']?.toString() ?? '')
                          .firstOrNull ??
                      'Select template',
                  _templates.map((t) => t['name']?.toString() ?? '—').toList(),
                  (v) async {
                    final match = _templates.where((t) => t['name'] == v);
                    if (match.isEmpty) return;
                    _templateId = match.first['id'] as String?;
                    _variableId = null;
                    await _loadVariables(_templateId!);
                  },
                ),
                const SizedBox(height: 14),
                _DD(
                  'Variable',
                  _variables
                          .where((v) => v['id'] == _variableId)
                          .map((v) => v['name']?.toString() ?? '')
                          .firstOrNull ??
                      (_variables.isEmpty ? 'No variables' : 'Select variable'),
                  _variables.map((v) => v['name']?.toString() ?? '—').toList(),
                  (v) => setState(() {
                    final match = _variables.where((x) => x['name'] == v);
                    _variableId = match.isEmpty ? null : match.first['id'] as String?;
                  }),
                ),
                const SizedBox(height: 14),
                Row(children: [
                  Expanded(
                    child: _DD('Condition', _operatorLabel(_operator),
                        ['>', '<', '>=', '<=', '=='], (v) => setState(() => _operator = _mapOperator(v!))),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _TF('Threshold', _thresholdCtrl, hint: '250', num: true,
                        validator: (v) => v!.isEmpty ? 'Required' : null),
                  ),
                ]),
                const SizedBox(height: 14),
                _DD('Priority', _priorityLabel(_priority), ['Critical', 'Warning', 'Info'],
                    (v) => setState(() => _priority = _mapPriority(v!))),
                const SizedBox(height: 24),
                _ActRow(
                  onCancel: () => Navigator.pop(context),
                  onSave: () {
                    if (_formKey.currentState!.validate()) {
                      if (_templateId == null || _variableId == null) return;
                      Navigator.pop(context);
                      widget.onSave({
                        'name': _nameCtrl.text.trim(),
                        'deviceTemplateId': _templateId,
                        'templateVariableId': _variableId,
                        'operator': _operator,
                        'threshold': _thresholdCtrl.text.trim(),
                        'anomalyType': 'threshold',
                        'priority': _priority,
                      });
                    }
                  },
                ),
              ]),
            ),
    );
  }

  String _operatorLabel(String op) {
    switch (op) {
      case 'LT':
        return '<';
      case 'GTE':
        return '>=';
      case 'LTE':
        return '<=';
      case 'EQ':
        return '==';
      default:
        return '>';
    }
  }

  String _priorityLabel(String p) {
    switch (p) {
      case 'HIGH':
        return 'Critical';
      case 'LOW':
        return 'Info';
      default:
        return 'Warning';
    }
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
      title: const Text('Delete Template',
          style: TextStyle(color: kNavy, fontWeight: FontWeight.w700)),
      content: Text('Delete alarm template "$label"?'),
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
            Expanded(child: Text(title,
                style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: kNavy))),
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
  const _TF(this.label, this.ctrl, {this.hint, this.num = false, this.validator});
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
        isExpanded: true,
        style: const TextStyle(fontSize: 14, color: kNavy),
        decoration: InputDecoration(
          filled: true, fillColor: kBg,
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: kNavy, width: 1.5)),
        ),
        items: items.map((e) => DropdownMenuItem(value: e, child: Text(e, overflow: TextOverflow.ellipsis))).toList(),
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
