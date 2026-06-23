import 'package:flutter/material.dart';
import '../../app_theme.dart';
import '../../services/api_client.dart';
import '../../services/ems_api.dart';
import '../../widgets/api_state_views.dart';
import 'org_helpers.dart';

class TemplateVariablesPage extends StatefulWidget {
  const TemplateVariablesPage({
    super.key,
    required this.templateId,
    required this.slaveId,
    required this.slaveName,
  });
  final String templateId;
  final String slaveId;
  final String slaveName;

  @override
  State<TemplateVariablesPage> createState() => _TemplateVariablesPageState();
}

class _TemplateVariablesPageState extends State<TemplateVariablesPage> {
  bool _loading = true;
  Object? _error;
  List<Map<String, dynamic>> _items = [];

  static const _cols = ['Name', 'Address', 'Type', 'Scale', 'Unit', 'Default', 'Ops'];
  static const _widths = [130.0, 75.0, 90.0, 65.0, 65.0, 65.0, 72.0];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final raw = await EmsApi.instance.getTemplateVariables(
          widget.templateId, widget.slaveId);
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

  void _showModal([Map<String, dynamic>? item]) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _VariableFormModal(
        item: item,
        onSave: (data) async {
          try {
            if (item != null) {
              await EmsApi.instance.updateTemplateVariable(
                  widget.templateId, widget.slaveId, item['id'] as String, data);
              _snack('Variable updated');
            } else {
              await EmsApi.instance.createTemplateVariable(
                  widget.templateId, widget.slaveId, data);
              _snack('Variable added');
            }
            await _load();
          } catch (e) {
            _snack(e is ApiException ? e.message : 'Save failed', error: true);
          }
        },
      ),
    );
  }

  void _confirmDelete(Map<String, dynamic> item) {
    showDialog(
      context: context,
      builder: (_) => deleteConfirmDialog(
        context: context,
        title: 'Delete Variable',
        message: 'Delete variable "${item['name']}"?',
        onConfirm: () async {
          try {
            await EmsApi.instance.deleteTemplateVariable(
                widget.templateId, widget.slaveId, item['id'] as String);
            _snack('Variable deleted');
            await _load();
          } catch (e) {
            _snack(e is ApiException ? e.message : 'Delete failed', error: true);
          }
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(backgroundColor: kBg, body: LoadingView());
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
        title: Text('${widget.slaveName} — Variables',
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Colors.white)),
        elevation: 0,
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showModal(),
        backgroundColor: kNavy,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add, size: 18),
        label: const Text('Add Variable', style: TextStyle(fontWeight: FontWeight.w600)),
      ),
      body: Column(children: [
        Container(
          color: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(children: [
            StatChip('Variables', _items.length, kBlue),
          ]),
        ),
        Expanded(
          child: _items.isEmpty
              ? Center(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.tune_outlined, size: 52, color: Colors.grey.shade300),
                    const SizedBox(height: 12),
                    Text('No variables defined',
                        style: TextStyle(color: Colors.grey.shade400, fontSize: 14)),
                  ]),
                )
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
      ]),
    );
  }

  Widget _row(Map<String, dynamic> item) {
    final isDefault = item['isDefault'] == true;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
      child: Row(children: [
        SizedBox(
          width: _widths[0],
          child: Text(item['name'] as String? ?? '',
              style: const TextStyle(fontSize: 12, color: kNavy, fontWeight: FontWeight.w600),
              overflow: TextOverflow.ellipsis),
        ),
        SizedBox(
          width: _widths[1],
          child: Text('${item['dataAddress'] ?? ''}',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade700)),
        ),
        SizedBox(
          width: _widths[2],
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: kBlue.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(item['dataType'] as String? ?? '',
                style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: kBlue)),
          ),
        ),
        SizedBox(
          width: _widths[3],
          child: Text('${item['scalingFactor'] ?? 1.0}',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade700)),
        ),
        SizedBox(
          width: _widths[4],
          child: Text(item['unit'] as String? ?? '',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade700)),
        ),
        SizedBox(
          width: _widths[5],
          child: Icon(
            isDefault ? Icons.check_circle : Icons.radio_button_unchecked,
            size: 16,
            color: isDefault ? kGreen : Colors.grey.shade400,
          ),
        ),
        SizedBox(
          width: _widths[6],
          child: Row(children: [
            GestureDetector(
                onTap: () => _showModal(item),
                child: const Icon(Icons.edit_outlined, size: 17, color: kBlue)),
            const SizedBox(width: 10),
            GestureDetector(
                onTap: () => _confirmDelete(item),
                child: const Icon(Icons.delete_outline, size: 17, color: kRed)),
          ]),
        ),
      ]),
    );
  }
}

// ── Form Modal ─────────────────────────────────────────────────────────────────
class _VariableFormModal extends StatefulWidget {
  const _VariableFormModal({this.item, required this.onSave});
  final Map<String, dynamic>? item;
  final void Function(Map<String, dynamic>) onSave;

  @override
  State<_VariableFormModal> createState() => _VariableFormModalState();
}

class _VariableFormModalState extends State<_VariableFormModal> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _dataAddress;
  late final TextEditingController _scalingFactor;
  late final TextEditingController _unit;
  String _dataType = 'FLOAT';
  bool _isDefault = false;

  @override
  void initState() {
    super.initState();
    _name = TextEditingController(text: widget.item?['name'] as String? ?? '');
    _dataAddress = TextEditingController(text: '${widget.item?['dataAddress'] ?? ''}');
    _scalingFactor = TextEditingController(
        text: '${widget.item?['scalingFactor'] ?? 1.0}');
    _unit = TextEditingController(text: widget.item?['unit'] as String? ?? '');
    _dataType = widget.item?['dataType'] as String? ?? 'INT16';
    if (!['INT16', 'UINT16', 'INT32', 'FLOAT32'].contains(_dataType)) _dataType = 'INT16';
    _isDefault = widget.item?['isDefault'] == true;
  }

  @override
  void dispose() {
    _name.dispose();
    _dataAddress.dispose();
    _scalingFactor.dispose();
    _unit.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ModalShell(
      title: widget.item != null ? 'Edit Variable' : 'Add Variable',
      child: Form(
        key: _formKey,
        child: Column(children: [
          ModalField('Name', _name,
              hint: 'e.g. VoltageA',
              validator: (v) => v!.trim().isEmpty ? 'Required' : null),
          const SizedBox(height: 14),
          ModalField('Data Address', _dataAddress,
              hint: '0',
              keyboard: TextInputType.number,
              validator: (v) => int.tryParse(v ?? '') == null ? 'Enter a number' : null),
          const SizedBox(height: 14),
          ModalDropdown('Data Type', _dataType,
              ['INT16', 'UINT16', 'INT32', 'FLOAT32'],
              (v) => setState(() => _dataType = v!)),
          const SizedBox(height: 14),
          ModalField('Scaling Factor', _scalingFactor,
              hint: '1.0',
              keyboard: const TextInputType.numberWithOptions(decimal: true),
              validator: (v) => double.tryParse(v ?? '') == null ? 'Enter a number' : null),
          const SizedBox(height: 14),
          ModalField('Unit', _unit, hint: 'V, A, kW, etc.'),
          const SizedBox(height: 14),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Is Default',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: kNavy)),
              Switch(
                value: _isDefault,
                onChanged: (v) => setState(() => _isDefault = v),
                activeThumbColor: Colors.white,
                activeTrackColor: kNavy,
              ),
            ],
          ),
          const SizedBox(height: 24),
          ModalActions(
            onCancel: () => Navigator.pop(context),
            onSave: () {
              if (_formKey.currentState!.validate()) {
                Navigator.pop(context);
                widget.onSave({
                  'name': _name.text.trim(),
                  'dataAddress': int.parse(_dataAddress.text.trim()),
                  'dataType': _dataType,
                  'scalingFactor': double.parse(_scalingFactor.text.trim()),
                  'unit': _unit.text.trim(),
                  'isDefault': _isDefault,
                });
              }
            },
          ),
        ]),
      ),
    );
  }
}
