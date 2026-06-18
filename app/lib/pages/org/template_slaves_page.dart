import 'package:flutter/material.dart';
import '../../app_theme.dart';
import '../../services/api_client.dart';
import '../../services/ems_api.dart';
import '../../widgets/api_state_views.dart';
import 'org_helpers.dart';
import 'template_variables_page.dart';

class TemplateSlavesPage extends StatefulWidget {
  const TemplateSlavesPage({
    super.key,
    required this.templateId,
    required this.templateName,
  });
  final String templateId;
  final String templateName;

  @override
  State<TemplateSlavesPage> createState() => _TemplateSlavesPageState();
}

class _TemplateSlavesPageState extends State<TemplateSlavesPage> {
  bool _loading = true;
  Object? _error;
  List<Map<String, dynamic>> _items = [];

  static const _cols = ['Name', 'Slave ID', 'Baud Rate', 'Default', 'Ops'];
  static const _widths = [140.0, 80.0, 100.0, 70.0, 110.0];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final raw = await EmsApi.instance.getTemplateSlaves(widget.templateId);
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
      builder: (_) => _SlaveFormModal(
        item: item,
        onSave: (data) async {
          try {
            if (item != null) {
              await EmsApi.instance.updateTemplateSlave(
                  widget.templateId, item['id'] as String, data);
              _snack('Slave updated');
            } else {
              await EmsApi.instance.createTemplateSlave(widget.templateId, data);
              _snack('Slave added');
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
        title: 'Delete Slave',
        message: 'Delete slave "${item['name']}"?',
        onConfirm: () async {
          try {
            await EmsApi.instance.deleteTemplateSlave(
                widget.templateId, item['id'] as String);
            _snack('Slave deleted');
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
        title: Text(widget.templateName,
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Colors.white)),
        elevation: 0,
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showModal(),
        backgroundColor: kNavy,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add, size: 18),
        label: const Text('Add Slave', style: TextStyle(fontWeight: FontWeight.w600)),
      ),
      body: Column(children: [
        Container(
          color: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(children: [
            StatChip('Slaves', _items.length, kNavy),
          ]),
        ),
        Expanded(
          child: _items.isEmpty
              ? Center(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.device_hub_outlined, size: 52, color: Colors.grey.shade300),
                    const SizedBox(height: 12),
                    Text('No slaves defined',
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
          child: Text('${item['slaveId'] ?? ''}',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade700)),
        ),
        SizedBox(
          width: _widths[2],
          child: Text('${item['baudRate'] ?? ''}',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade700)),
        ),
        SizedBox(
          width: _widths[3],
          child: Icon(
            isDefault ? Icons.check_circle : Icons.radio_button_unchecked,
            size: 16,
            color: isDefault ? kGreen : Colors.grey.shade400,
          ),
        ),
        SizedBox(
          width: _widths[4],
          child: Row(children: [
            GestureDetector(
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => TemplateVariablesPage(
                  templateId: widget.templateId,
                  slaveId: item['id'] as String,
                  slaveName: item['name'] as String? ?? '',
                )),
              ),
              child: const Icon(Icons.list_outlined, size: 17, color: kNavy),
            ),
            const SizedBox(width: 8),
            GestureDetector(
              onTap: () => _showModal(item),
              child: const Icon(Icons.edit_outlined, size: 17, color: kBlue),
            ),
            const SizedBox(width: 8),
            GestureDetector(
              onTap: () => _confirmDelete(item),
              child: const Icon(Icons.delete_outline, size: 17, color: kRed),
            ),
          ]),
        ),
      ]),
    );
  }
}

// ── Form Modal ─────────────────────────────────────────────────────────────────
class _SlaveFormModal extends StatefulWidget {
  const _SlaveFormModal({this.item, required this.onSave});
  final Map<String, dynamic>? item;
  final void Function(Map<String, dynamic>) onSave;

  @override
  State<_SlaveFormModal> createState() => _SlaveFormModalState();
}

class _SlaveFormModalState extends State<_SlaveFormModal> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _slaveId;
  String _baudRate = '9600';
  bool _isDefault = false;

  @override
  void initState() {
    super.initState();
    _name = TextEditingController(text: widget.item?['name'] as String? ?? '');
    _slaveId = TextEditingController(text: '${widget.item?['slaveId'] ?? ''}');
    _baudRate = '${widget.item?['baudRate'] ?? 9600}';
    _isDefault = widget.item?['isDefault'] == true;
    // Normalise baudRate to one of the allowed values
    if (!['9600', '19200', '38400', '115200'].contains(_baudRate)) _baudRate = '9600';
  }

  @override
  void dispose() {
    _name.dispose();
    _slaveId.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ModalShell(
      title: widget.item != null ? 'Edit Slave' : 'Add Slave',
      child: Form(
        key: _formKey,
        child: Column(children: [
          ModalField('Name', _name,
              hint: 'e.g. Main Meter',
              validator: (v) => v!.trim().isEmpty ? 'Required' : null),
          const SizedBox(height: 14),
          ModalField('Slave ID (Modbus address)', _slaveId,
              hint: '1',
              keyboard: TextInputType.number,
              validator: (v) => int.tryParse(v ?? '') == null ? 'Enter a number' : null),
          const SizedBox(height: 14),
          ModalDropdown('Baud Rate', _baudRate,
              ['9600', '19200', '38400', '115200'],
              (v) => setState(() => _baudRate = v!)),
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
                  'slaveId': int.parse(_slaveId.text.trim()),
                  'baudRate': int.parse(_baudRate),
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
