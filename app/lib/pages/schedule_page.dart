import 'package:flutter/material.dart';
import '../app_theme.dart';
import '../services/api_client.dart';
import '../services/app_state.dart';
import '../services/ems_api.dart';
import '../utils/api_mappers.dart';
import '../utils/device_helpers.dart';
import '../widgets/api_state_views.dart';

class SchedulePage extends StatefulWidget {
  const SchedulePage({super.key});

  @override
  State<SchedulePage> createState() => _SchedulePageState();
}

class _SchedulePageState extends State<SchedulePage> {
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
      final raw = await EmsApi.instance.getScheduledTasks();
      setState(() => _items = raw.map(ApiMappers.scheduledTask).toList());
    } catch (e) {
      setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  static const _cols = ['Slave', 'Variable', 'Action', 'Scheduled Time', 'Repeat', 'Status', 'Ops'];
  static const _widths = [85.0, 100.0, 80.0, 145.0, 85.0, 80.0, 100.0];

  void _showModal([int? index]) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ScheduleFormModal(
        title: index != null ? 'Edit Task' : 'Add Task',
        item: index != null ? _items[index] : null,
        onSave: (data) async {
          try {
            final repeatMap = {
              'Daily': 'DAILY',
              'Weekly': 'WEEKLY',
              'Once': 'ONCE',
              'Monthly': 'DAILY',
            };
            final body = {
              'deviceId': data['deviceId'],
              'deviceConfigSlaveId': data['slaveId'],
              'variableName': data['variable'],
              'action': data['action'] == 'Control' ? 'ON' : 'OFF',
              'scheduledTime': data['time'],
              'repeatType': repeatMap[data['repeat']] ?? 'DAILY',
              if (index != null) 'status': data['status'] == 'Active' ? 'ACTIVE' : 'INACTIVE',
            };
            if (index != null) {
              await EmsApi.instance.updateScheduledTask(_items[index]['id'] as String, body);
            } else {
              await EmsApi.instance.createScheduledTask(body);
            }
            await _load();
            _snack(index != null ? 'Task updated' : 'Task added');
          } catch (e) {
            _snack(e is ApiException ? e.message : 'Save failed', error: true);
          }
        },
      ),
    );
  }

  Future<void> _toggleTask(int index) async {
    try {
      await EmsApi.instance.toggleScheduledTask(_items[index]['id'] as String);
      await _load();
      _snack('Task status updated');
    } catch (e) {
      _snack(e is ApiException ? e.message : 'Toggle failed', error: true);
    }
  }

  void _confirmDelete(int index) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Delete Task',
            style: TextStyle(color: kNavy, fontWeight: FontWeight.w700)),
        content: const Text('Remove this scheduled task?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Cancel', style: TextStyle(color: Colors.grey.shade600)),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(context);
              try {
                await EmsApi.instance.deleteScheduledTask(_items[index]['id'] as String);
                await _load();
                _snack('Task deleted');
              } catch (e) {
                _snack(e is ApiException ? e.message : 'Delete failed', error: true);
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: kRed, foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  void _showLogsSheet(String taskId) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _TaskLogsSheet(taskId: taskId),
    );
  }

  void _snack(String msg, {bool error = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: error ? kRed : kGreen,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
    ));
  }

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
        title: const Text('Manage Schedule',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Colors.white)),
        elevation: 0,
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: ElevatedButton.icon(
              onPressed: () => _showModal(),
              icon: const Icon(Icons.add, size: 16),
              label: const Text('Add Task'),
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
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Device filter
            _FilterRow(),
            const SizedBox(height: 16),
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [BoxShadow(color: kNavy.withValues(alpha: 0.05), blurRadius: 8, offset: const Offset(0, 2))],
                ),
                child: Column(
                  children: [
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
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

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

  Widget _row(int idx, Map<String, dynamic> item) {
    final active = item['status'] == 'Active';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
      child: Row(children: [
        SizedBox(width: _widths[0],
            child: Text(item['slave'] as String,
                style: TextStyle(fontSize: 12, color: Colors.grey.shade700), overflow: TextOverflow.ellipsis)),
        SizedBox(width: _widths[1],
            child: Text(item['variable'] as String,
                style: const TextStyle(fontSize: 12, color: kNavy, fontWeight: FontWeight.w500),
                overflow: TextOverflow.ellipsis)),
        SizedBox(width: _widths[2],
            child: Text(item['action'] as String,
                style: TextStyle(fontSize: 12, color: Colors.grey.shade700))),
        SizedBox(width: _widths[3],
            child: Text(item['time'] as String,
                style: TextStyle(fontSize: 12, color: Colors.grey.shade700))),
        SizedBox(width: _widths[4],
            child: Text(item['repeat'] as String,
                style: TextStyle(fontSize: 12, color: Colors.grey.shade700))),
        SizedBox(
          width: _widths[5],
          child: GestureDetector(
            onTap: () => _toggleTask(idx),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: active ? kGreen.withValues(alpha: 0.12) : Colors.grey.shade100,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(item['status'] as String,
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600,
                      color: active ? kGreen : Colors.grey.shade500)),
            ),
          ),
        ),
        SizedBox(
          width: _widths[6],
          child: Row(children: [
            GestureDetector(
              onTap: () => _showLogsSheet(item['id'] as String),
              child: const Icon(Icons.history_outlined, size: 17, color: kNavy),
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
  }

  Widget _footer() => Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(border: Border(top: BorderSide(color: Colors.grey.shade100))),
        child: Text('Showing 1 to ${_items.length} of ${_items.length} entries',
            style: TextStyle(color: Colors.grey.shade500, fontSize: 12)),
      );
}

class _FilterRow extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          const Text('All locations', style: TextStyle(fontSize: 13, color: kNavy)),
          Icon(Icons.keyboard_arrow_down, size: 18, color: Colors.grey.shade500),
        ],
      ),
    );
  }
}

// ── Form Modal ─────────────────────────────────────────────────────────────────
class _ScheduleFormModal extends StatefulWidget {
  const _ScheduleFormModal({required this.title, this.item, required this.onSave});
  final String title;
  final Map<String, dynamic>? item;
  final void Function(Map<String, dynamic>) onSave;

  @override
  State<_ScheduleFormModal> createState() => _ScheduleFormModalState();
}

class _ScheduleFormModalState extends State<_ScheduleFormModal> {
  final _formKey = GlobalKey<FormState>();
  final _appState = AppState.instance;
  late final TextEditingController _time;
  String? _deviceId;
  String? _slaveId;
  String _variable = 'VoltageA';
  String _action = 'Control';
  String _repeat = 'Daily';
  String _status = 'Active';
  List<Map<String, dynamic>> _slaves = [];

  @override
  void initState() {
    super.initState();
    _time = TextEditingController(text: widget.item?['time'] ?? '08:00');
    _variable = widget.item?['variable'] ?? 'VoltageA';
    _action = widget.item?['action'] == 'OFF' ? 'Alert' : 'Control';
    _repeat = widget.item?['repeat'] ?? 'Daily';
    _status = widget.item?['status'] ?? 'Active';
    _initDevices();
  }

  Future<void> _initDevices() async {
    if (_appState.devices.isEmpty) await _appState.loadDevices();
    _deviceId = _appState.selectedDeviceId ?? _appState.devices.firstOrNull?['id'] as String?;
    _slaves = await DeviceHelpers.loadAllSlaves();
    if (_deviceId != null) {
      final match = _slaves.where((s) => s['deviceId'] == _deviceId);
      _slaveId = match.isEmpty ? null : match.first['id'] as String?;
    } else {
      _slaveId = _slaves.firstOrNull?['id'] as String?;
      _deviceId = _slaves.firstOrNull?['deviceId'] as String?;
    }
    if (mounted) setState(() {});
  }

  @override
  void dispose() { _time.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return _ModalShell(
      title: widget.title,
      child: Form(
        key: _formKey,
        child: Column(children: [
          _DropField(
              'Slave',
              _slaves.firstWhere((s) => s['id'] == _slaveId, orElse: () => {'label': '—'})['label']?.toString() ?? '—',
              _slaves.map((s) => s['label']?.toString() ?? '—').toList(),
              (v) => setState(() {
                final match = _slaves.where((s) => s['label'] == v);
                if (match.isEmpty) return;
                _slaveId = match.first['id'] as String?;
                _deviceId = match.first['deviceId'] as String?;
              })),
          const SizedBox(height: 14),
          _DropField('Variable', _variable,
              ['VoltageA', 'VoltageB', 'CurrentA', 'PowerFactor', 'THD_V', 'Frequency'],
              (v) => setState(() => _variable = v!)),
          const SizedBox(height: 14),
          _DropField('Action', _action, ['Control', 'Alert'],
              (v) => setState(() => _action = v!)),
          const SizedBox(height: 14),
          _TextField('Scheduled Time', _time, hint: '08:00 or 2025-06-10 08:00',
              validator: (v) => v!.isEmpty ? 'Required' : null),
          const SizedBox(height: 14),
          _DropField('Repeat Type', _repeat, ['Daily', 'Weekly', 'Monthly', 'Once'],
              (v) => setState(() => _repeat = v!)),
          const SizedBox(height: 14),
          _DropField('Status', _status, ['Active', 'Inactive'],
              (v) => setState(() => _status = v!)),
          const SizedBox(height: 24),
          _Actions(
            onCancel: () => Navigator.pop(context),
            onSave: () {
              if (_formKey.currentState!.validate()) {
                Navigator.pop(context);
                if (_deviceId == null) return;
                widget.onSave({
                  'deviceId': _deviceId,
                  'slaveId': _slaveId,
                  'variable': _variable,
                  'action': _action,
                  'time': _time.text.trim(),
                  'repeat': _repeat,
                  'status': _status,
                });
              }
            },
          ),
        ]),
      ),
    );
  }
}

// ── Shared inline helpers (reused across this file) ───────────────────────────
class _ModalShell extends StatelessWidget {
  const _ModalShell({required this.title, required this.child});
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
                decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)))),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: kNavy)),
                IconButton(icon: const Icon(Icons.close, size: 20), onPressed: () => Navigator.pop(context),
                    padding: EdgeInsets.zero, constraints: const BoxConstraints()),
              ],
            ),
            const SizedBox(height: 20),
            child,
          ],
        ),
      ),
    );
  }
}

class _TextField extends StatelessWidget {
  const _TextField(this.label, this.ctrl, {this.hint, this.validator});
  final String label;
  final TextEditingController ctrl;
  final String? hint;
  final String? Function(String?)? validator;

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: kNavy)),
      const SizedBox(height: 6),
      TextFormField(
        controller: ctrl, validator: validator,
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

class _DropField extends StatelessWidget {
  const _DropField(this.label, this.value, this.items, this.onChanged);
  final String label;
  final String value;
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

class _Actions extends StatelessWidget {
  const _Actions({required this.onCancel, required this.onSave});
  final VoidCallback onCancel;
  final VoidCallback onSave;

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

// ── Task Logs Sheet ───────────────────────────────────────────────────────────
class _TaskLogsSheet extends StatefulWidget {
  const _TaskLogsSheet({required this.taskId});
  final String taskId;

  @override
  State<_TaskLogsSheet> createState() => _TaskLogsSheetState();
}

class _TaskLogsSheetState extends State<_TaskLogsSheet> {
  bool _loading = true;
  List<Map<String, dynamic>> _logs = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final raw = await EmsApi.instance.getTaskLogs(widget.taskId);
      if (mounted) setState(() { _logs = raw; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40, height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          const Text('Execution Logs',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: kNavy)),
          const SizedBox(height: 12),
          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 32),
              child: Center(child: CircularProgressIndicator(color: kNavy)),
            )
          else if (_logs.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: Text('No logs found',
                    style: TextStyle(color: Colors.grey.shade500, fontSize: 13)),
              ),
            )
          else
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 350),
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: _logs.length,
                separatorBuilder: (_, _) => Divider(height: 1, color: Colors.grey.shade100),
                itemBuilder: (_, i) {
                  final log = _logs[i];
                  final isSuccess = log['result'] == 'SUCCESS';
                  final executedAt = log['executedAt'] as String? ?? '';
                  final displayTs = executedAt.length > 16 ? executedAt.substring(0, 16) : executedAt;
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(
                          isSuccess ? Icons.check_circle_outline : Icons.cancel_outlined,
                          size: 18,
                          color: isSuccess ? kGreen : kRed,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(log['action'] as String? ?? '',
                                      style: const TextStyle(
                                          fontSize: 13, fontWeight: FontWeight.w600, color: kNavy)),
                                  Text(displayTs,
                                      style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
                                ],
                              ),
                              if (!isSuccess && log['errorMessage'] != null) ...[
                                const SizedBox(height: 4),
                                Text(log['errorMessage'] as String,
                                    style: const TextStyle(fontSize: 11, color: kRed)),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}
