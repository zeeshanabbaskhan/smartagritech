import 'package:flutter/material.dart';
import '../app_theme.dart';
import '../services/api_client.dart';
import '../services/ems_api.dart';
import '../widgets/api_state_views.dart';
import 'org/org_helpers.dart';

class AlarmSettingsPage extends StatefulWidget {
  const AlarmSettingsPage({super.key});

  @override
  State<AlarmSettingsPage> createState() => _AlarmSettingsPageState();
}

class _AlarmSettingsPageState extends State<AlarmSettingsPage> {
  bool _loading = true;
  Object? _error;
  List<Map<String, dynamic>> _items = [];

  static const _cols = ['Push Type', 'Status', 'Created', 'Ops'];
  static const _widths = [110.0, 90.0, 140.0, 72.0];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final raw = await EmsApi.instance.getAlarmSettings();
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
      builder: (_) => _AlarmSettingModal(
        item: item,
        onSave: (data) async {
          try {
            if (item != null) {
              await EmsApi.instance.updateAlarmSetting(item['id'] as String, data);
              _snack('Setting updated');
            } else {
              await EmsApi.instance.createAlarmSetting(data);
              _snack('Setting added');
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
        title: 'Delete Setting',
        message: 'Delete this alarm setting?',
        onConfirm: () async {
          try {
            await EmsApi.instance.deleteAlarmSetting(item['id'] as String);
            _snack('Setting deleted');
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
        title: const Text('Alarm Settings',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Colors.white)),
        elevation: 0,
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showModal(),
        backgroundColor: kNavy,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add, size: 18),
        label: const Text('Add Setting', style: TextStyle(fontWeight: FontWeight.w600)),
      ),
      body: _items.isEmpty
          ? Center(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Icon(Icons.notifications_none_outlined, size: 52, color: Colors.grey.shade300),
                const SizedBox(height: 12),
                Text('No alarm settings', style: TextStyle(color: Colors.grey.shade400, fontSize: 14)),
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
    );
  }

  Widget _row(Map<String, dynamic> item) {
    final pushType = (item['pushType'] as String? ?? '').toUpperCase();
    final status = item['status'] as String? ?? '';
    final createdAt = item['createdAt'] as String? ?? '';
    final isActive = status == 'ACTIVE';

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
      child: Row(children: [
        SizedBox(
          width: _widths[0],
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: kBlue.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(pushType,
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: kBlue)),
          ),
        ),
        SizedBox(
          width: _widths[1],
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: isActive ? kGreen.withValues(alpha: 0.12) : Colors.grey.shade100,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(status,
                style: TextStyle(
                    fontSize: 11, fontWeight: FontWeight.w600,
                    color: isActive ? kGreen : Colors.grey.shade500)),
          ),
        ),
        SizedBox(
          width: _widths[2],
          child: Text(createdAt.length > 10 ? createdAt.substring(0, 10) : createdAt,
              style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
        ),
        SizedBox(
          width: _widths[3],
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
class _AlarmSettingModal extends StatefulWidget {
  const _AlarmSettingModal({this.item, required this.onSave});
  final Map<String, dynamic>? item;
  final void Function(Map<String, dynamic>) onSave;

  @override
  State<_AlarmSettingModal> createState() => _AlarmSettingModalState();
}

class _AlarmSettingModalState extends State<_AlarmSettingModal> {
  String _pushType = 'email';
  String _status = 'ACTIVE';

  @override
  void initState() {
    super.initState();
    if (widget.item != null) {
      _pushType = (widget.item!['pushType'] as String? ?? 'email').toLowerCase();
      _status = widget.item!['status'] as String? ?? 'ACTIVE';
    }
  }

  @override
  Widget build(BuildContext context) {
    return ModalShell(
      title: widget.item != null ? 'Edit Setting' : 'Add Setting',
      child: Column(children: [
        ModalDropdown('Push Type', _pushType, ['email', 'sms', 'push'],
            (v) => setState(() => _pushType = v!)),
        const SizedBox(height: 14),
        ModalDropdown('Status', _status, ['ACTIVE', 'INACTIVE'],
            (v) => setState(() => _status = v!)),
        const SizedBox(height: 24),
        ModalActions(
          onCancel: () => Navigator.pop(context),
          onSave: () {
            Navigator.pop(context);
            widget.onSave({'pushType': _pushType, 'status': _status});
          },
        ),
      ]),
    );
  }
}
