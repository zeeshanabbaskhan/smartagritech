import 'package:flutter/material.dart';
import '../../app_theme.dart';
import '../../services/api_client.dart';
import '../../services/ems_api.dart';
import '../../utils/api_mappers.dart';
import '../../widgets/api_state_views.dart';
import 'org_helpers.dart';

class UsersTab extends StatefulWidget {
  const UsersTab({super.key});

  @override
  State<UsersTab> createState() => _UsersTabState();
}

class _UsersTabState extends State<UsersTab> {
  List<Map<String, dynamic>> _users = [];
  bool _loading = true;
  Object? _error;
  String _roleFilter = 'All';
  String _statusFilter = 'All';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final raw = await EmsApi.instance.getUsers();
      setState(() => _users = raw.map(ApiMappers.user).toList());
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
      builder: (_) => _UserFormModal(
        title: index != null ? 'Edit User' : 'Add User',
        user: index != null ? _users[index] : null,
        onSave: (data) async {
          try {
            if (index != null) {
              final id = _users[index]['id'] as String;
              await EmsApi.instance.updateUser(id, {
                'fullName': data['name'],
                'phone': data['phone'],
                if (data['roleRaw'] != null) 'role': data['roleRaw'],
                if (data['statusRaw'] != null) 'status': data['statusRaw'],
              });
            } else {
              await EmsApi.instance.createUser({
                'fullName': data['name'],
                'email': data['email'],
                'password': data['password'],
                'role': data['roleRaw'] ?? 'USER',
                if (data['phone'] != null) 'phone': data['phone'],
              });
            }
            await _load();
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                orgSnack(index != null ? 'User updated' : 'User added'),
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

  void _resetPassword(int index) {
    final pwCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Reset Password', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: kNavy)),
        content: TextField(
          controller: pwCtrl,
          obscureText: true,
          decoration: const InputDecoration(
            labelText: 'New Password',
            hintText: 'Min 8 characters',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: kNavy),
            onPressed: () async {
              final pw = pwCtrl.text;
              if (pw.length < 8) return;
              Navigator.pop(context);
              try {
                await EmsApi.instance.resetUserPassword(_users[index]['id'] as String, pw);
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(orgSnack('Password reset successfully'));
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(e is ApiException ? e.message : 'Reset failed'), backgroundColor: kRed),
                  );
                }
              }
            },
            child: const Text('Reset', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _confirmDelete(int index) {
    showDialog(
      context: context,
      builder: (_) => deleteConfirmDialog(
        context: context,
        title: 'Delete User',
        message: 'Remove "${_users[index]['name']}" from this organisation?',
        onConfirm: () async {
          try {
            await EmsApi.instance.updateUserStatus(
              _users[index]['id'] as String,
              'DELETED',
            );
            await _load();
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(orgSnack('User removed'));
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

  static const _cols = ['Name', 'Email', 'Role', 'Status', 'Last Login', 'Ops'];
  static const _widths = [130.0, 180.0, 85.0, 75.0, 145.0, 90.0];

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

    final active = _users.where((u) => u['status'] == 'Active').length;
    final filtered = _users.where((u) {
      if (_roleFilter != 'All' && u['role'] != _roleFilter) return false;
      if (_statusFilter != 'All' && u['status'] != _statusFilter) return false;
      return true;
    }).toList();

    return Scaffold(
      backgroundColor: kBg,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showModal(),
        backgroundColor: kNavy,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.person_add_outlined, size: 18),
        label: const Text('Add User', style: TextStyle(fontWeight: FontWeight.w600)),
      ),
      body: Column(
        children: [
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  StatChip('Total', _users.length, kNavy),
                  const SizedBox(width: 16),
                  StatChip('Active', active, kGreen),
                  const SizedBox(width: 16),
                  StatChip('Inactive', _users.length - active, Colors.grey),
                ]),
                const SizedBox(height: 10),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(children: [
                    _filterChip('All Roles', _roleFilter == 'All', () => setState(() => _roleFilter = 'All')),
                    const SizedBox(width: 6),
                    _filterChip('Org Admin', _roleFilter == 'Org Admin', () => setState(() => _roleFilter = 'Org Admin')),
                    const SizedBox(width: 6),
                    _filterChip('User', _roleFilter == 'User', () => setState(() => _roleFilter = 'User')),
                    const SizedBox(width: 14),
                    _filterChip('All Status', _statusFilter == 'All', () => setState(() => _statusFilter = 'All')),
                    const SizedBox(width: 6),
                    _filterChip('Active', _statusFilter == 'Active', () => setState(() => _statusFilter = 'Active')),
                    const SizedBox(width: 6),
                    _filterChip('Inactive', _statusFilter == 'Inactive', () => setState(() => _statusFilter = 'Inactive')),
                  ]),
                ),
              ],
            ),
          ),
          Expanded(
            child: filtered.isEmpty
                ? _empty()
                : Padding(
                    padding: const EdgeInsets.all(16),
                    child: TableCard(
                      cols: _cols,
                      widths: _widths,
                      header: tableHeader(_cols, _widths),
                      rows: filtered.asMap().entries.map((e) => Column(
                        children: [
                          Divider(height: 1, color: Colors.grey.shade100),
                          _userRow(e.key, e.value),
                        ],
                      )).toList(),
                      count: filtered.length,
                    ),
                  ),
          ),
        ],
      ),
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

  Widget _userRow(int index, Map<String, dynamic> u) {
    final active = u['status'] == 'Active';
    const roleColors = {
      'Org Admin': kRed,
      'User': kBlue,
    };
    final roleColor = roleColors[u['role'] as String] ?? kNavy;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
      child: Row(children: [
        SizedBox(
          width: _widths[0],
          child: Row(children: [
            CircleAvatar(
              radius: 14,
              backgroundColor: kNavy.withValues(alpha: 0.1),
              child: Text(
                (u['name'] as String).substring(0, 1),
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: kNavy),
              ),
            ),
            const SizedBox(width: 6),
            Expanded(
              child: Text(u['name'] as String,
                  style: const TextStyle(fontSize: 12, color: kNavy, fontWeight: FontWeight.w500),
                  overflow: TextOverflow.ellipsis),
            ),
          ]),
        ),
        SizedBox(
          width: _widths[1],
          child: Text(u['email'] as String,
              style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
              overflow: TextOverflow.ellipsis),
        ),
        SizedBox(
          width: _widths[2],
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: roleColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(u['role'] as String,
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: roleColor)),
          ),
        ),
        SizedBox(
          width: _widths[3],
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: active ? kGreen.withValues(alpha: 0.1) : Colors.grey.shade100,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(u['status'] as String,
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: active ? kGreen : Colors.grey.shade500)),
          ),
        ),
        SizedBox(
          width: _widths[4],
          child: Text(u['lastLogin'] as String,
              style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
              overflow: TextOverflow.ellipsis),
        ),
        SizedBox(
          width: _widths[5],
          child: Row(children: [
            GestureDetector(
              onTap: () => _showModal(index),
              child: const Icon(Icons.edit_outlined, size: 17, color: kBlue),
            ),
            const SizedBox(width: 8),
            GestureDetector(
              onTap: () => _resetPassword(index),
              child: const Icon(Icons.lock_reset_outlined, size: 17, color: kOrange),
            ),
            const SizedBox(width: 8),
            GestureDetector(
              onTap: () => _confirmDelete(index),
              child: const Icon(Icons.delete_outline, size: 17, color: kRed),
            ),
          ]),
        ),
      ]),
    );
  }

  Widget _empty() => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.people_outline, size: 52, color: Colors.grey.shade300),
            const SizedBox(height: 12),
            Text('No users found',
                style: TextStyle(color: Colors.grey.shade400, fontSize: 14)),
          ],
        ),
      );
}

// ── Form Modal ────────────────────────────────────────────────────────────────
class _UserFormModal extends StatefulWidget {
  const _UserFormModal({required this.title, this.user, required this.onSave});
  final String title;
  final Map<String, dynamic>? user;
  final void Function(Map<String, dynamic>) onSave;

  @override
  State<_UserFormModal> createState() => _UserFormModalState();
}

class _UserFormModalState extends State<_UserFormModal> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _email;
  late final TextEditingController _password;
  String _role = 'User';
  String _status = 'Active';
  bool get _isNew => widget.user == null;

  @override
  void initState() {
    super.initState();
    _name = TextEditingController(text: widget.user?['name'] ?? '');
    _email = TextEditingController(text: widget.user?['email'] ?? '');
    _password = TextEditingController();
    _role = widget.user?['role'] ?? 'User';
    _status = widget.user?['status'] ?? 'Active';
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
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
          ModalField('Email Address', _email,
              hint: 'user@company.com',
              keyboard: TextInputType.emailAddress,
              enabled: _isNew,
              validator: (v) => v!.isEmpty
                  ? 'Required'
                  : (!v.contains('@') ? 'Invalid email' : null)),
          if (_isNew) ...[
            const SizedBox(height: 14),
            ModalField('Password', _password,
                hint: 'Min 8 characters',
                validator: (v) => v!.length < 8 ? 'Min 8 characters' : null),
          ],
          const SizedBox(height: 14),
          ModalDropdown('Role', _role, ['Org Admin', 'User'],
              (v) => setState(() => _role = v!)),
          const SizedBox(height: 14),
          ModalDropdown('Status', _status, ['Active', 'Inactive'],
              (v) => setState(() => _status = v!)),
          const SizedBox(height: 24),
          ModalActions(
            onCancel: () => Navigator.pop(context),
            onSave: () {
              if (_formKey.currentState!.validate()) {
                Navigator.pop(context);
                widget.onSave({
                  'name': _name.text.trim(),
                  'email': _email.text.trim(),
                  'password': _password.text,
                  'role': _role,
                  'roleRaw': _role == 'Org Admin' ? 'ORG_ADMIN' : 'USER',
                  'status': _status,
                  'statusRaw': _status == 'Active' ? 'ACTIVE' : 'INACTIVE',
                });
              }
            },
          ),
        ]),
      ),
    );
  }
}
