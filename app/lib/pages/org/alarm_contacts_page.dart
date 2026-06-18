import 'package:flutter/material.dart';
import '../../app_theme.dart';
import '../../services/api_client.dart';
import '../../services/ems_api.dart';
import '../../utils/api_mappers.dart';
import '../../widgets/api_state_views.dart';
import 'org_helpers.dart';

class AlarmContactsTab extends StatefulWidget {
  const AlarmContactsTab({super.key});

  @override
  State<AlarmContactsTab> createState() => _AlarmContactsTabState();
}

class _AlarmContactsTabState extends State<AlarmContactsTab> {
  List<Map<String, dynamic>> _contacts = [];
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
      final raw = await EmsApi.instance.getAlarmContacts();
      setState(() => _contacts = raw.map(ApiMappers.alarmContact).toList());
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
      builder: (_) => _ContactFormModal(
        title: index != null ? 'Edit Contact' : 'Add Contact',
        contact: index != null ? _contacts[index] : null,
        onSave: (data) async {
          try {
            final body = {
              'name': data['name'],
              'email': data['email'],
              'mobile': data['phone'],
              'whatsapp': (data['method'] as String?)?.contains('WhatsApp') == true
                  ? data['phone']
                  : null,
              'remark': data['method'],
            };
            if (index != null) {
              await EmsApi.instance.updateAlarmContact(
                _contacts[index]['id'] as String,
                body,
              );
            } else {
              await EmsApi.instance.createAlarmContact(body);
            }
            await _load();
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                orgSnack(index != null ? 'Contact updated' : 'Contact added'),
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
        title: 'Delete Contact',
        message: 'Remove "${_contacts[index]['name']}" from alarm notifications?',
        onConfirm: () async {
          try {
            await EmsApi.instance.deleteAlarmContact(_contacts[index]['id'] as String);
            await _load();
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(orgSnack('Contact removed'));
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

  static const _cols = ['Name', 'Email', 'Phone', 'Method', 'Status', 'Ops'];
  static const _widths = [130.0, 180.0, 145.0, 110.0, 75.0, 64.0];

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

    final active = _contacts.where((c) => c['status'] == 'Active').length;

    return Scaffold(
      backgroundColor: kBg,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showModal(),
        backgroundColor: kNavy,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.person_add_outlined, size: 18),
        label: const Text('Add Contact', style: TextStyle(fontWeight: FontWeight.w600)),
      ),
      body: Column(
        children: [
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(children: [
              StatChip('Total', _contacts.length, kNavy),
              const SizedBox(width: 16),
              StatChip('Active', active, kGreen),
              const SizedBox(width: 16),
              StatChip('Inactive', _contacts.length - active, Colors.grey),
            ]),
          ),
          Expanded(
            child: _contacts.isEmpty
                ? _empty()
                : Padding(
                    padding: const EdgeInsets.all(16),
                    child: TableCard(
                      cols: _cols,
                      widths: _widths,
                      header: tableHeader(_cols, _widths),
                      rows: _contacts.asMap().entries.map((e) => Column(
                        children: [
                          Divider(height: 1, color: Colors.grey.shade100),
                          _row(e.key, e.value),
                        ],
                      )).toList(),
                      count: _contacts.length,
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _row(int idx, Map<String, dynamic> c) {
    final active = c['status'] == 'Active';
    final methodColors = {
      'Email': kBlue,
      'SMS': kGreen,
      'Email + SMS': kNavy,
    };
    final mc = methodColors[c['method']] ?? kNavy;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
      child: Row(children: [
        SizedBox(
          width: _widths[0],
          child: Text(c['name'] as String,
              style: const TextStyle(fontSize: 12, color: kNavy, fontWeight: FontWeight.w600),
              overflow: TextOverflow.ellipsis),
        ),
        SizedBox(
          width: _widths[1],
          child: Text(c['email'] as String,
              style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
              overflow: TextOverflow.ellipsis),
        ),
        SizedBox(
          width: _widths[2],
          child: Text(c['phone'] as String,
              style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
              overflow: TextOverflow.ellipsis),
        ),
        SizedBox(
          width: _widths[3],
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: mc.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(c['method'] as String,
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: mc)),
          ),
        ),
        SizedBox(
          width: _widths[4],
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: active ? kGreen.withValues(alpha: 0.1) : Colors.grey.shade100,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(c['status'] as String,
                style: TextStyle(
                    fontSize: 11, fontWeight: FontWeight.w600,
                    color: active ? kGreen : Colors.grey.shade500)),
          ),
        ),
        SizedBox(
          width: _widths[5],
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

  Widget _empty() => Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.contact_phone_outlined, size: 52, color: Colors.grey.shade300),
          const SizedBox(height: 12),
          Text('No contacts added',
              style: TextStyle(color: Colors.grey.shade400, fontSize: 14)),
        ]),
      );
}

class _ContactFormModal extends StatefulWidget {
  const _ContactFormModal({required this.title, this.contact, required this.onSave});
  final String title;
  final Map<String, dynamic>? contact;
  final void Function(Map<String, dynamic>) onSave;

  @override
  State<_ContactFormModal> createState() => _ContactFormModalState();
}

class _ContactFormModalState extends State<_ContactFormModal> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _email;
  late final TextEditingController _phone;
  String _method = 'Email';

  @override
  void initState() {
    super.initState();
    _name = TextEditingController(text: widget.contact?['name'] ?? '');
    _email = TextEditingController(text: widget.contact?['email'] ?? '');
    _phone = TextEditingController(text: widget.contact?['phone'] ?? '');
    _method = widget.contact?['method'] ?? 'Email';
  }

  @override
  void dispose() {
    _name.dispose(); _email.dispose(); _phone.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ModalShell(
      title: widget.title,
      child: Form(
        key: _formKey,
        child: Column(children: [
          ModalField('Full Name', _name,
              validator: (v) => v!.isEmpty ? 'Required' : null),
          const SizedBox(height: 14),
          ModalField('Email', _email,
              hint: 'contact@company.com',
              keyboard: TextInputType.emailAddress,
              validator: (v) => v!.isEmpty
                  ? 'Required'
                  : (!v.contains('@') ? 'Invalid email' : null)),
          const SizedBox(height: 14),
          ModalField('Phone', _phone,
              hint: '+92-300-0000000',
              keyboard: TextInputType.phone),
          const SizedBox(height: 14),
          ModalDropdown('Notification Method', _method,
              ['Email', 'SMS', 'Email + SMS'],
              (v) => setState(() => _method = v!)),
          const SizedBox(height: 24),
          ModalActions(
            onCancel: () => Navigator.pop(context),
            onSave: () {
              if (_formKey.currentState!.validate()) {
                Navigator.pop(context);
                widget.onSave({
                  'name': _name.text.trim(),
                  'email': _email.text.trim(),
                  'phone': _phone.text.trim(),
                  'method': _method,
                });
              }
            },
          ),
        ]),
      ),
    );
  }
}
