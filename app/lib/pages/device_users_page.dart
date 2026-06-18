import 'package:flutter/material.dart';
import '../app_theme.dart';
import '../services/api_client.dart';
import '../services/ems_api.dart';
import '../widgets/api_state_views.dart';

class DeviceUsersPage extends StatefulWidget {
  const DeviceUsersPage({
    super.key,
    required this.deviceId,
    required this.deviceName,
  });
  final String deviceId;
  final String deviceName;

  @override
  State<DeviceUsersPage> createState() => _DeviceUsersPageState();
}

class _DeviceUsersPageState extends State<DeviceUsersPage> {
  bool _loading = true;
  Object? _error;
  List<Map<String, dynamic>> _assigned = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final raw = await EmsApi.instance.getDeviceUsers(widget.deviceId);
      setState(() => _assigned = raw);
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

  Future<void> _remove(String userId) async {
    try {
      await EmsApi.instance.removeDeviceUser(widget.deviceId, userId);
      _snack('User removed');
      await _load();
    } catch (e) {
      _snack(e is ApiException ? e.message : 'Remove failed', error: true);
    }
  }

  void _showAssignSheet() async {
    List<Map<String, dynamic>> allUsers = [];
    try {
      allUsers = await EmsApi.instance.getUsers();
    } catch (_) {}

    final assignedIds = _assigned.map((u) => u['id'] as String?).toSet();
    final available = allUsers.where((u) => !assignedIds.contains(u['id'] as String?)).toList();

    if (!mounted) return;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _AssignUserSheet(
        users: available,
        onAssign: (userId) async {
          try {
            await EmsApi.instance.assignDeviceUser(widget.deviceId, userId);
            _snack('User assigned');
            await _load();
          } catch (e) {
            _snack(e is ApiException ? e.message : 'Assign failed', error: true);
          }
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kNavy,
        foregroundColor: Colors.white,
        title: Text('Device Users — ${widget.deviceName}',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white),
            overflow: TextOverflow.ellipsis),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.person_add_outlined),
            tooltip: 'Assign User',
            onPressed: _showAssignSheet,
          ),
        ],
      ),
      body: _loading
          ? const LoadingView()
          : _error != null
              ? ErrorView.fromError(_error!, onRetry: _load)
              : _assigned.isEmpty
                  ? Center(
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                        Icon(Icons.group_outlined, size: 52, color: Colors.grey.shade300),
                        const SizedBox(height: 12),
                        Text('No users assigned to this device',
                            style: TextStyle(color: Colors.grey.shade400, fontSize: 14)),
                        const SizedBox(height: 16),
                        ElevatedButton.icon(
                          onPressed: _showAssignSheet,
                          icon: const Icon(Icons.person_add_outlined, size: 16),
                          label: const Text('Assign User'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: kNavy, foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      ]),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: _assigned.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 8),
                      itemBuilder: (_, i) => _UserTile(
                        user: _assigned[i],
                        onRemove: () => _remove(_assigned[i]['id'] as String),
                      ),
                    ),
    );
  }
}

class _UserTile extends StatelessWidget {
  const _UserTile({required this.user, required this.onRemove});
  final Map<String, dynamic> user;
  final VoidCallback onRemove;

  String get _initials {
    final name = (user['fullName'] as String? ?? '').trim();
    final parts = name.split(RegExp(r'\s+'));
    if (parts.isEmpty || name.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final role = user['role'] as String? ?? '';
    final status = user['status'] as String? ?? '';
    final isActive = status == 'ACTIVE';

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(color: kNavy.withValues(alpha: 0.05), blurRadius: 6, offset: const Offset(0, 2))
        ],
      ),
      child: Row(children: [
        CircleAvatar(
          radius: 22,
          backgroundColor: kNavy.withValues(alpha: 0.1),
          child: Text(_initials,
              style: const TextStyle(color: kNavy, fontWeight: FontWeight.w700, fontSize: 14)),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(user['fullName'] as String? ?? '',
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: kNavy)),
            Text(user['email'] as String? ?? '',
                style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
            const SizedBox(height: 4),
            Row(children: [
              _Badge(role, kBlue),
              const SizedBox(width: 6),
              _Badge(status, isActive ? kGreen : Colors.grey),
            ]),
          ]),
        ),
        IconButton(
          icon: const Icon(Icons.person_remove_outlined, color: kRed, size: 20),
          tooltip: 'Remove',
          onPressed: onRemove,
        ),
      ]),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge(this.label, this.color);
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(label,
          style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: color)),
    );
  }
}

// ── Assign User Bottom Sheet ───────────────────────────────────────────────────
class _AssignUserSheet extends StatefulWidget {
  const _AssignUserSheet({required this.users, required this.onAssign});
  final List<Map<String, dynamic>> users;
  final void Function(String userId) onAssign;

  @override
  State<_AssignUserSheet> createState() => _AssignUserSheetState();
}

class _AssignUserSheetState extends State<_AssignUserSheet> {
  String _search = '';

  @override
  Widget build(BuildContext context) {
    final filtered = widget.users.where((u) {
      final name = (u['fullName'] as String? ?? '').toLowerCase();
      final email = (u['email'] as String? ?? '').toLowerCase();
      return name.contains(_search) || email.contains(_search);
    }).toList();

    return Padding(
      padding: EdgeInsets.only(
        left: 16, right: 16, top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 40, height: 4,
          decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)),
        ),
        const SizedBox(height: 16),
        const Text('Assign User',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: kNavy)),
        const SizedBox(height: 12),
        TextField(
          autofocus: true,
          onChanged: (v) => setState(() => _search = v.toLowerCase()),
          decoration: InputDecoration(
            hintText: 'Search by name or email',
            hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13),
            prefixIcon: Icon(Icons.search, size: 18, color: Colors.grey.shade500),
            filled: true, fillColor: kBg,
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
          ),
        ),
        const SizedBox(height: 8),
        if (filtered.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 24),
            child: Text('No users available',
                style: TextStyle(color: Colors.grey.shade500, fontSize: 13)),
          )
        else
          ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 300),
            child: ListView.separated(
              shrinkWrap: true,
              itemCount: filtered.length,
              separatorBuilder: (_, _) => Divider(height: 1, color: Colors.grey.shade100),
              itemBuilder: (_, i) {
                final u = filtered[i];
                return ListTile(
                  leading: CircleAvatar(
                    radius: 18,
                    backgroundColor: kNavy.withValues(alpha: 0.1),
                    child: Text(
                      ((u['fullName'] as String? ?? '').isNotEmpty
                          ? (u['fullName'] as String)[0].toUpperCase()
                          : '?'),
                      style: const TextStyle(color: kNavy, fontWeight: FontWeight.w700, fontSize: 13),
                    ),
                  ),
                  title: Text(u['fullName'] as String? ?? '',
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: kNavy)),
                  subtitle: Text(u['email'] as String? ?? '',
                      style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
                  trailing: const Icon(Icons.add_circle_outline, color: kNavy, size: 20),
                  onTap: () {
                    Navigator.pop(context);
                    widget.onAssign(u['id'] as String);
                  },
                  contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                );
              },
            ),
          ),
        const SizedBox(height: 8),
      ]),
    );
  }
}
