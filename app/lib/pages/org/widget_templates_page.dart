import 'package:flutter/material.dart';
import '../../app_theme.dart';
import '../../services/api_client.dart';
import '../../services/ems_api.dart';
import '../../widgets/api_state_views.dart';
import 'org_helpers.dart';

class WidgetTemplatesTab extends StatefulWidget {
  const WidgetTemplatesTab({super.key});

  @override
  State<WidgetTemplatesTab> createState() => _WidgetTemplatesTabState();
}

class _WidgetTemplatesTabState extends State<WidgetTemplatesTab> {
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
      final raw = await EmsApi.instance.getWidgetTemplates();
      setState(() => _templates = raw);
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
      builder: (_) => _WidgetFormModal(
        title: index != null ? 'Edit Widget' : 'Add Widget',
        template: index != null ? _templates[index] : null,
        onSave: (data) async {
          try {
            final body = {
              'name': data['name'],
              'displayName': data['displayName'],
              'variableName': data['variableName'],
              'unit': data['unit'],
              'widgetType': data['widgetType'],
              'position': int.tryParse(data['position'] ?? '0') ?? 0,
            };
            if (index != null) {
              await EmsApi.instance.updateWidgetTemplate(_templates[index]['id'] as String, body);
            } else {
              await EmsApi.instance.createWidgetTemplate(body);
            }
            await _load();
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                orgSnack(index != null ? 'Widget updated' : 'Widget added'),
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
        title: 'Delete Widget',
        message: 'Remove "${_templates[index]['name'] ?? ''}" widget?',
        onConfirm: () async {
          try {
            await EmsApi.instance.deleteWidgetTemplate(_templates[index]['id'] as String);
            await _load();
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(orgSnack('Widget deleted'));
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

  static final _widgetTypeIcons = {
    'VALUE_CARD': Icons.credit_card_outlined,
    'BAR': Icons.bar_chart_outlined,
    'LINE': Icons.show_chart_outlined,
    'AREA': Icons.area_chart_outlined,
    'GAUGE': Icons.speed_outlined,
    'PIE': Icons.pie_chart_outline,
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
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showModal(),
        backgroundColor: kNavy,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add, size: 18),
        label: const Text('Add Widget', style: TextStyle(fontWeight: FontWeight.w600)),
      ),
      body: _templates.isEmpty
          ? Center(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Icon(Icons.widgets_outlined, size: 52, color: Colors.grey.shade300),
                const SizedBox(height: 12),
                Text('No widget templates',
                    style: TextStyle(color: Colors.grey.shade400, fontSize: 14)),
              ]),
            )
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: _templates.length,
              separatorBuilder: (context, i) => const SizedBox(height: 10),
              itemBuilder: (_, i) => _card(i, _templates[i]),
            ),
    );
  }

  Widget _card(int index, Map<String, dynamic> t) {
    final type = t['widgetType'] as String? ?? 'VALUE_CARD';
    final icon = _widgetTypeIcons[type] ?? Icons.widgets_outlined;
    final isActive = t['isActive'] != false;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [BoxShadow(color: kNavy.withValues(alpha: 0.05), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: kBlue.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: kBlue, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(
                  child: Text(t['displayName'] as String? ?? t['name'] as String? ?? '—',
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: kNavy),
                      overflow: TextOverflow.ellipsis),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: (isActive ? kGreen : Colors.grey).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(isActive ? 'Active' : 'Inactive',
                      style: TextStyle(
                          fontSize: 10, fontWeight: FontWeight.w600,
                          color: isActive ? kGreen : Colors.grey.shade500)),
                ),
              ]),
              const SizedBox(height: 4),
              Row(children: [
                _chip(type.replaceAll('_', ' '), kBlue),
                const SizedBox(width: 6),
                if ((t['variableName'] as String? ?? '').isNotEmpty)
                  _chip(t['variableName'] as String, kNavy),
                if ((t['unit'] as String? ?? '').isNotEmpty) ...[
                  const SizedBox(width: 6),
                  _chip(t['unit'] as String, kGreen),
                ],
              ]),
              if ((t['name'] as String? ?? '') != (t['displayName'] as String? ?? ''))
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text('Key: ${t['name'] ?? ''}',
                      style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
                ),
            ]),
          ),
          const SizedBox(width: 8),
          Column(mainAxisSize: MainAxisSize.min, children: [
            Text('Pos ${t['position'] ?? 0}',
                style: TextStyle(fontSize: 10, color: Colors.grey.shade400)),
            const SizedBox(height: 8),
            Row(children: [
              GestureDetector(
                onTap: () => _showModal(index),
                child: const Icon(Icons.edit_outlined, size: 18, color: kBlue),
              ),
              const SizedBox(width: 10),
              GestureDetector(
                onTap: () => _confirmDelete(index),
                child: const Icon(Icons.delete_outline, size: 18, color: kRed),
              ),
            ]),
          ]),
        ]),
      ),
    );
  }

  Widget _chip(String label, Color color) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(label, style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.w600)),
      );
}

// ── Form Modal ─────────────────────────────────────────────────────────────────
class _WidgetFormModal extends StatefulWidget {
  const _WidgetFormModal({required this.title, this.template, required this.onSave});
  final String title;
  final Map<String, dynamic>? template;
  final void Function(Map<String, dynamic>) onSave;

  @override
  State<_WidgetFormModal> createState() => _WidgetFormModalState();
}

class _WidgetFormModalState extends State<_WidgetFormModal> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _displayName;
  late final TextEditingController _variableName;
  late final TextEditingController _unit;
  late final TextEditingController _position;
  String _widgetType = 'VALUE_CARD';

  static const _types = ['VALUE_CARD', 'BAR', 'LINE', 'AREA', 'GAUGE', 'PIE'];

  @override
  void initState() {
    super.initState();
    final t = widget.template;
    _name = TextEditingController(text: t?['name'] ?? '');
    _displayName = TextEditingController(text: t?['displayName'] ?? '');
    _variableName = TextEditingController(text: t?['variableName'] ?? '');
    _unit = TextEditingController(text: t?['unit'] ?? '');
    _position = TextEditingController(text: '${t?['position'] ?? 0}');
    _widgetType = t?['widgetType'] ?? 'VALUE_CARD';
  }

  @override
  void dispose() {
    _name.dispose(); _displayName.dispose(); _variableName.dispose();
    _unit.dispose(); _position.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ModalShell(
      title: widget.title,
      child: Form(
        key: _formKey,
        child: Column(children: [
          ModalField('Internal Name (key)', _name,
              hint: 'e.g. voltage_card',
              validator: (v) => v!.isEmpty ? 'Required' : null),
          const SizedBox(height: 14),
          ModalField('Display Name', _displayName,
              hint: 'e.g. Voltage',
              validator: (v) => v!.isEmpty ? 'Required' : null),
          const SizedBox(height: 14),
          ModalField('Variable Name', _variableName,
              hint: 'e.g. Voltage_L1 (from device readings)'),
          const SizedBox(height: 14),
          ModalField('Unit', _unit, hint: 'e.g. V, A, kWh'),
          const SizedBox(height: 14),
          ModalDropdown('Widget Type', _widgetType, _types,
              (v) => setState(() => _widgetType = v!)),
          const SizedBox(height: 14),
          ModalField('Position', _position,
              hint: '0',
              keyboard: TextInputType.number),
          const SizedBox(height: 24),
          ModalActions(
            onCancel: () => Navigator.pop(context),
            onSave: () {
              if (_formKey.currentState!.validate()) {
                Navigator.pop(context);
                widget.onSave({
                  'name': _name.text.trim(),
                  'displayName': _displayName.text.trim(),
                  'variableName': _variableName.text.trim(),
                  'unit': _unit.text.trim(),
                  'widgetType': _widgetType,
                  'position': _position.text.trim(),
                });
              }
            },
          ),
        ]),
      ),
    );
  }
}
