import 'package:flutter/material.dart';
import '../../app_theme.dart';
import '../../services/api_client.dart';
import '../../services/ems_api.dart';
import '../../utils/api_mappers.dart';
import '../../widgets/api_state_views.dart';
import 'org_helpers.dart';
import 'template_slaves_page.dart';

class DeviceTemplatesTab extends StatefulWidget {
  const DeviceTemplatesTab({super.key});

  @override
  State<DeviceTemplatesTab> createState() => _DeviceTemplatesTabState();
}

class _DeviceTemplatesTabState extends State<DeviceTemplatesTab> {
  List<Map<String, dynamic>> _templates = [];
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
      final raw = await EmsApi.instance.getDeviceTemplates();
      setState(() => _templates = raw.map(ApiMappers.deviceTemplate).toList());
    } catch (e) {
      setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _showModal([int? index]) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _TemplateFormModal(
        title: index != null ? 'Edit Template' : 'Add Template',
        template: index != null ? _templates[index] : null,
        onSave: (data) async {
          try {
            final body = {
              'name': data['name'],
              'acquisitionMethod': data['protocol'],
            };
            if (index != null) {
              await EmsApi.instance.updateDeviceTemplate(
                _templates[index]['id'] as String,
                body,
              );
            } else {
              await EmsApi.instance.createDeviceTemplate(body);
            }
            await _load();
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                orgSnack(index != null ? 'Template updated' : 'Template added'),
              );
            }
          } catch (e) {
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(e is ApiException ? e.message : 'Save failed'),
                  backgroundColor: kRed,
                ),
              );
            }
          }
        },
      ),
    );
  }

  void _confirmDelete(int index) {
    showDialog(
      context: context,
      builder: (_) => deleteConfirmDialog(
        context: context,
        title: 'Delete Template',
        message: 'Delete "${_templates[index]['name']}"? Devices using this template will be affected.',
        onConfirm: () async {
          try {
            await EmsApi.instance.deleteDeviceTemplate(_templates[index]['id'] as String);
            await _load();
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(orgSnack('Template deleted'));
            }
          } catch (e) {
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(e is ApiException ? e.message : 'Delete failed'),
                  backgroundColor: kRed,
                ),
              );
            }
          }
        },
      ),
    );
  }

  static const _cols = ['Name', 'Protocol', 'Slaves', 'Variables', 'Updated', 'Ops'];
  static const _widths = [160.0, 110.0, 70.0, 85.0, 110.0, 100.0];

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
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showModal(),
        backgroundColor: kNavy,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add, size: 18),
        label: const Text('Add Template', style: TextStyle(fontWeight: FontWeight.w600)),
      ),
      body: Column(
        children: [
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(children: [
              StatChip('Templates', _templates.length, kNavy),
              const SizedBox(width: 16),
              StatChip('Variables',
                  _templates.fold(0, (s, t) => s + (t['variables'] as int)), kBlue),
            ]),
          ),
          Expanded(
            child: _templates.isEmpty
                ? _empty()
                : Padding(
                    padding: const EdgeInsets.all(16),
                    child: TableCard(
                      cols: _cols,
                      widths: _widths,
                      header: tableHeader(_cols, _widths),
                      rows: _templates.asMap().entries.map((e) => Column(
                        children: [
                          Divider(height: 1, color: Colors.grey.shade100),
                          _row(e.key, e.value),
                        ],
                      )).toList(),
                      count: _templates.length,
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _row(int idx, Map<String, dynamic> t) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
        child: Row(children: [
          SizedBox(
            width: _widths[0],
            child: Text(t['name'] as String,
                style: const TextStyle(fontSize: 12, color: kNavy, fontWeight: FontWeight.w600),
                overflow: TextOverflow.ellipsis),
          ),
          SizedBox(
            width: _widths[1],
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: kBlue.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(t['protocol'] as String,
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: kBlue)),
            ),
          ),
          SizedBox(
            width: _widths[2],
            child: Text('${t['slaves']}',
                style: TextStyle(fontSize: 12, color: Colors.grey.shade700)),
          ),
          SizedBox(
            width: _widths[3],
            child: Text('${t['variables']}',
                style: TextStyle(fontSize: 12, color: Colors.grey.shade700)),
          ),
          SizedBox(
            width: _widths[4],
            child: Text(t['updatedAt'] as String,
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
          ),
          SizedBox(
            width: _widths[5],
            child: Row(children: [
              GestureDetector(
                onTap: () async {
                  try {
                    await EmsApi.instance.cloneDeviceTemplate(t['id'] as String);
                    await _load();
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(orgSnack('Template cloned'));
                    }
                  } catch (e) {
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(e is ApiException ? e.message : 'Clone failed'),
                          backgroundColor: kRed,
                        ),
                      );
                    }
                  }
                },
                child: const Icon(Icons.copy_outlined, size: 17, color: kGreen),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => TemplateSlavesPage(
                      templateId: t['id'] as String,
                      templateName: t['name'] as String,
                    ),
                  ),
                ),
                child: const Icon(Icons.list_outlined, size: 17, color: kNavy),
              ),
              const SizedBox(width: 8),
              GestureDetector(onTap: () => _showModal(idx),
                  child: const Icon(Icons.edit_outlined, size: 17, color: kBlue)),
              const SizedBox(width: 8),
              GestureDetector(onTap: () => _confirmDelete(idx),
                  child: const Icon(Icons.delete_outline, size: 17, color: kRed)),
            ]),
          ),
        ]),
      );

  Widget _empty() => Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.description_outlined, size: 52, color: Colors.grey.shade300),
          const SizedBox(height: 12),
          Text('No templates found',
              style: TextStyle(color: Colors.grey.shade400, fontSize: 14)),
        ]),
      );
}

class _TemplateFormModal extends StatefulWidget {
  const _TemplateFormModal({required this.title, this.template, required this.onSave});
  final String title;
  final Map<String, dynamic>? template;
  final void Function(Map<String, dynamic>) onSave;

  @override
  State<_TemplateFormModal> createState() => _TemplateFormModalState();
}

class _TemplateFormModalState extends State<_TemplateFormModal> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  String _protocol = 'Modbus RTU';

  @override
  void initState() {
    super.initState();
    _name = TextEditingController(text: widget.template?['name'] ?? '');
    _protocol = widget.template?['protocol'] ?? 'Modbus RTU';
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ModalShell(
      title: widget.title,
      child: Form(
        key: _formKey,
        child: Column(children: [
          ModalField('Template Name', _name,
              hint: 'e.g. Industrial Meter v2',
              validator: (v) => v!.isEmpty ? 'Required' : null),
          const SizedBox(height: 14),
          ModalDropdown('Protocol', _protocol,
              ['Modbus RTU', 'Modbus TCP', 'MQTT', 'BACnet'],
              (v) => setState(() => _protocol = v!)),
          if (widget.template != null) ...[
            const SizedBox(height: 14),
            Text(
              'Slaves: ${widget.template!['slaves']} · Variables: ${widget.template!['variables']}',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
            ),
            const SizedBox(height: 6),
            Text(
              'Add slaves and variables from the admin console after creating the template.',
              style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
            ),
          ],
          const SizedBox(height: 24),
          ModalActions(
            onCancel: () => Navigator.pop(context),
            onSave: () {
              if (_formKey.currentState!.validate()) {
                Navigator.pop(context);
                widget.onSave({
                  'name': _name.text.trim(),
                  'protocol': _protocol,
                });
              }
            },
          ),
        ]),
      ),
    );
  }
}
