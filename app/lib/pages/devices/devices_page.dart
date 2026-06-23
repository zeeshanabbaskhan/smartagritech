import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show Clipboard, ClipboardData;
import '../../app_theme.dart';
import '../../services/api_client.dart';
import '../../services/auth_service.dart';
import '../../services/ems_api.dart';
import '../../widgets/api_state_views.dart';
import 'device_detail_page.dart';

class DevicesPage extends StatefulWidget {
  const DevicesPage({super.key});

  @override
  State<DevicesPage> createState() => _DevicesPageState();
}

class _DevicesPageState extends State<DevicesPage> {
  String _filter = 'All';
  String _search = '';
  bool _loading = true;
  Object? _error;
  List<Map<String, dynamic>> _devices = [];
  // Device deletes are processed asynchronously (queued) on the server, so a row
  // can still be present on the immediate reload. Track deleted ids and hide them
  // locally so they don't reappear before the background purge finishes.
  final Set<String> _removedIds = {};

  bool get _canManage => AuthService.instance.user?.canManageOrg == true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      _devices = await EmsApi.instance.getDevicesForUi(withMetrics: false);
    } catch (e) {
      _error = e;
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _filtered {
    return _devices.where((d) {
      if (_removedIds.contains(d['id'])) return false;
      final matchStatus = _filter == 'All' || d['status'] == _filter;
      final matchSearch = _search.isEmpty ||
          (d['name'] as String).toLowerCase().contains(_search.toLowerCase()) ||
          (d['gateway'] as String).toLowerCase().contains(_search.toLowerCase());
      return matchStatus && matchSearch;
    }).toList();
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

    final devices = _filtered;
    final onlineCount = _devices.where((d) => d['status'] == 'Online').length;
    final offlineCount = _devices.where((d) => d['status'] == 'Offline').length;

    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kNavy,
        foregroundColor: Colors.white,
        automaticallyImplyLeading: false,
        title: const Text(
          'Devices',
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Colors.white),
        ),
        actions: [
          if (_canManage)
            IconButton(
              icon: const Icon(Icons.add_circle_outline, size: 22, color: kOrange),
              onPressed: () => _showAddDeviceModal(context),
            ),
        ],
        elevation: 0,
      ),
      body: Column(
        children: [
          // ── Summary chips ──
          Container(
            color: kNavy,
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: Row(
              children: [
                _SummaryChip(
                  label: 'Total',
                  count: _devices.length,
                  color: Colors.white,
                  textColor: kNavy,
                ),
                const SizedBox(width: 8),
                _SummaryChip(
                  label: 'Online',
                  count: onlineCount,
                  color: kGreen,
                  textColor: Colors.white,
                ),
                const SizedBox(width: 8),
                _SummaryChip(
                  label: 'Offline',
                  count: offlineCount,
                  color: kRed,
                  textColor: Colors.white,
                ),
              ],
            ),
          ),

          // ── Search + Filter ──
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Column(
              children: [
                // Search
                TextField(
                  onChanged: (v) => setState(() => _search = v),
                  decoration: InputDecoration(
                    hintText: 'Search devices...',
                    hintStyle: TextStyle(fontSize: 13, color: Colors.grey.shade400),
                    prefixIcon: Icon(Icons.search, size: 18, color: Colors.grey.shade400),
                    filled: true,
                    fillColor: kBg,
                    contentPadding: const EdgeInsets.symmetric(vertical: 10),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide.none,
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(color: kOrange, width: 1.5),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                // Filter chips
                Row(
                  children: ['All', 'Online', 'Offline'].map((f) {
                    final active = _filter == f;
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: GestureDetector(
                        onTap: () => setState(() => _filter = f),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                          decoration: BoxDecoration(
                            color: active ? kOrange : Colors.grey.shade100,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            f,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: active ? Colors.white : Colors.grey.shade600,
                            ),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ],
            ),
          ),

          // ── Device list ──
          Expanded(
            child: devices.isEmpty
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.devices_other, size: 56, color: Colors.grey.shade300),
                        const SizedBox(height: 12),
                        Text('No devices found',
                            style: TextStyle(color: Colors.grey.shade400, fontSize: 15)),
                      ],
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: devices.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 12),
                    itemBuilder: (_, i) => _DeviceCard(
                      device: devices[i],
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => DeviceDetailPage(device: devices[i]),
                        ),
                      ),
                      onEdit: _canManage ? () => _showEditDeviceModal(context, devices[i]) : () {},
                      onDelete: _canManage
                          ? () => _showDeleteConfirm(context, devices[i])
                          : () {},
                      showActions: _canManage,
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  void _showAddDeviceModal(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _DeviceFormModal(
        title: 'Add Device',
        onSaved: () {
          _load();
        },
        onMqttConfig: (config) {
          _load();
          showDialog(
            context: context,
            barrierDismissible: false,
            builder: (_) => _MqttConfigDialog(config: config),
          );
        },
      ),
    );
  }

  void _showEditDeviceModal(BuildContext context, Map<String, dynamic> device) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _DeviceFormModal(
        title: 'Edit Device',
        device: device,
        onSaved: () {
          _load();
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Device updated'), backgroundColor: kGreen),
          );
        },
      ),
    );
  }

  void _showDeleteConfirm(BuildContext context, Map<String, dynamic> device) {
    final name = device['name'] as String;
    final id = device['id'] as String;
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Delete Device', style: TextStyle(color: kNavy, fontWeight: FontWeight.w700)),
        content: Text('Are you sure you want to delete "$name"? This action cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Cancel', style: TextStyle(color: Colors.grey.shade600)),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(context);
              try {
                await EmsApi.instance.deleteDevice(id);
                if (mounted) setState(() => _removedIds.add(id));
                await _load();
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Device deleted'), backgroundColor: kGreen),
                  );
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
            style: ElevatedButton.styleFrom(
              backgroundColor: kRed,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }
}

// ── Device Card ───────────────────────────────────────────────────────────────
class _DeviceCard extends StatelessWidget {
  const _DeviceCard({
    required this.device,
    required this.onTap,
    required this.onEdit,
    required this.onDelete,
    this.showActions = true,
  });
  final Map<String, dynamic> device;
  final VoidCallback onTap;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final bool showActions;

  @override
  Widget build(BuildContext context) {
    final isOnline = device['status'] == 'Online';
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: kNavy.withValues(alpha: 0.06),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Column(
          children: [
            // Header bar
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: isOnline
                    ? kNavy.withValues(alpha: 0.03)
                    : Colors.grey.shade50,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
                border: Border(
                  bottom: BorderSide(color: Colors.grey.shade100),
                ),
              ),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: isOnline
                          ? kNavy.withValues(alpha: 0.08)
                          : Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      Icons.memory_outlined,
                      color: isOnline ? kNavy : Colors.grey.shade400,
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          device['name'] as String,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: kNavy,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          device['serialNo'] as String,
                          style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
                        ),
                      ],
                    ),
                  ),
                  // Status badge
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: isOnline
                          ? kGreen.withValues(alpha: 0.12)
                          : kRed.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 6,
                          height: 6,
                          decoration: BoxDecoration(
                            color: isOnline ? kGreen : kRed,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 5),
                        Text(
                          device['status'] as String,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: isOnline ? kGreen : kRed,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // Body
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                children: [
                  Row(
                    children: [
                      _InfoItem(icon: Icons.router_outlined, label: 'Gateway', value: device['gateway'] as String),
                      const SizedBox(width: 12),
                      _InfoItem(icon: Icons.description_outlined, label: 'Template', value: device['template'] as String),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      _InfoItem(icon: Icons.electrical_services_outlined, label: 'Slave', value: device['slave'] as String),
                      const SizedBox(width: 12),
                      _InfoItem(icon: Icons.access_time_outlined, label: 'Last Seen', value: device['lastSeen'] as String),
                    ],
                  ),

                  // Metrics row (only for online devices)
                  if (isOnline) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: kBg,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(
                        children: [
                          _MetricPill('Power', '${device['powerKwh']} kWh', kBlue),
                          _vDivider(),
                          _MetricPill('PF', '${device['powerFactor']}', kGreen),
                          _vDivider(),
                          _MetricPill('Anomalies', '${device['anomalies']}',
                              ((device['anomalies'] as num?) ?? 0) > 0 ? kOrange : kGreen),
                        ],
                      ),
                    ),
                  ],

                  // Action buttons
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: onTap,
                          icon: const Icon(Icons.bar_chart_outlined, size: 15),
                          label: const Text('View Details'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: kOrange,
                            side: BorderSide(color: kOrange.withValues(alpha: 0.5)),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      if (showActions) ...[
                        _IconBtn(icon: Icons.edit_outlined, color: kBlue, onTap: onEdit),
                        const SizedBox(width: 6),
                        _IconBtn(icon: Icons.delete_outline, color: kRed, onTap: onDelete),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _vDivider() => Container(
        width: 1,
        height: 30,
        color: Colors.grey.shade200,
        margin: const EdgeInsets.symmetric(horizontal: 8),
      );
}

class _InfoItem extends StatelessWidget {
  const _InfoItem({required this.icon, required this.label, required this.value});
  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 13, color: Colors.grey.shade400),
          const SizedBox(width: 5),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: TextStyle(fontSize: 10, color: Colors.grey.shade400)),
                Text(
                  value,
                  style: const TextStyle(fontSize: 12, color: kNavy, fontWeight: FontWeight.w500),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MetricPill extends StatelessWidget {
  const _MetricPill(this.label, this.value, this.color);
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(value,
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: color)),
          Text(label, style: TextStyle(fontSize: 10, color: Colors.grey.shade500)),
        ],
      ),
    );
  }
}

class _IconBtn extends StatelessWidget {
  const _IconBtn({required this.icon, required this.color, required this.onTap});
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(icon, size: 16, color: color),
      ),
    );
  }
}

class _SummaryChip extends StatelessWidget {
  const _SummaryChip({
    required this.label,
    required this.count,
    required this.color,
    required this.textColor,
  });
  final String label;
  final int count;
  final Color color;
  final Color textColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: color == Colors.white ? 1.0 : 0.2),
        borderRadius: BorderRadius.circular(20),
        border: color == Colors.white
            ? Border.all(color: Colors.white.withValues(alpha: 0.3))
            : null,
      ),
      child: Row(
        children: [
          Text(
            '$count',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: color == Colors.white ? kNavy : Colors.white,
            ),
          ),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: color == Colors.white ? kNavy : Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Add / Edit Device Modal ────────────────────────────────────────────────────
class _DeviceFormModal extends StatefulWidget {
  const _DeviceFormModal({
    required this.title,
    this.device,
    required this.onSaved,
    this.onMqttConfig,
  });
  final String title;
  final Map<String, dynamic>? device;
  final VoidCallback onSaved;
  final void Function(Map<String, dynamic>)? onMqttConfig;

  @override
  State<_DeviceFormModal> createState() => _DeviceFormModalState();
}

class _DeviceFormModalState extends State<_DeviceFormModal> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  String? _gatewayId;
  String? _templateId;
  String _status = 'OFFLINE';
  bool _loadingMeta = true;
  bool _saving = false;
  List<Map<String, dynamic>> _gateways = [];
  List<Map<String, dynamic>> _templates = [];

  @override
  void initState() {
    super.initState();
    final d = widget.device;
    final raw = d?['raw'] as Map<String, dynamic>?;
    _name = TextEditingController(text: d?['name'] ?? '');
    _gatewayId = raw?['gatewayId'] as String?;
    _templateId = raw?['templateId'] as String?;
    _status = raw?['status'] as String? ?? 'OFFLINE';
    _loadMeta();
  }

  Future<void> _loadMeta() async {
    try {
      final g = await EmsApi.instance.getGateways();
      final t = await EmsApi.instance.getDeviceTemplates();
      setState(() {
        _gateways = g;
        _templates = t;
        _gatewayId ??= g.isNotEmpty ? g.first['id'] as String? : null;
        _templateId ??= t.isNotEmpty ? t.first['id'] as String? : null;
        _loadingMeta = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loadingMeta = false);
    }
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate() || _templateId == null) return;
    setState(() => _saving = true);
    try {
      final body = {
        'name': _name.text.trim(),
        'templateId': _templateId,
        if (_gatewayId != null) 'gatewayId': _gatewayId,
        'status': _status,
      };
      if (widget.device == null) {
        final res = await EmsApi.instance.createDevice(body);
        if (mounted) {
          Navigator.pop(context);
          final deviceId = (res['data'] as Map?)?['id'] as String? ?? '';
          final ingestApiKey = res['ingestApiKey'] as String? ?? '';
          if (widget.onMqttConfig != null) {
            widget.onMqttConfig!({'deviceId': deviceId, 'ingestApiKey': ingestApiKey});
          } else {
            widget.onSaved();
          }
        }
      } else {
        await EmsApi.instance.updateDevice(widget.device!['id'] as String, body);
        if (mounted) {
          Navigator.pop(context);
          widget.onSaved();
        }
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
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

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
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
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
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(widget.title,
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: kNavy)),
                  IconButton(
                    icon: const Icon(Icons.close, size: 20),
                    onPressed: () => Navigator.pop(context),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              if (_loadingMeta)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Center(child: CircularProgressIndicator(color: kNavy)),
                )
              else ...[
                _FormField(
                  label: 'Device Name',
                  controller: _name,
                  hint: 'e.g. Energy Meter 01',
                  validator: (v) => v!.isEmpty ? 'Required' : null,
                ),
                const SizedBox(height: 14),
                if (_gateways.isNotEmpty)
                  _IdDropdownFormField(
                    label: 'Gateway',
                    value: _gatewayId,
                    items: _gateways,
                    labelOf: (g) => g['name'] as String? ?? '—',
                    onChanged: (v) => setState(() => _gatewayId = v),
                  ),
                if (_gateways.isNotEmpty) const SizedBox(height: 14),
                _IdDropdownFormField(
                  label: 'Template',
                  value: _templateId,
                  items: _templates,
                  labelOf: (t) => t['name'] as String? ?? '—',
                  enabled: widget.device == null,
                  onChanged: (v) => setState(() => _templateId = v),
                ),
                const SizedBox(height: 14),
                _DropdownFormField(
                  label: 'Status',
                  value: _status == 'ONLINE' ? 'Online' : 'Offline',
                  items: const ['Online', 'Offline'],
                  onChanged: (v) => setState(() => _status = v == 'Online' ? 'ONLINE' : 'OFFLINE'),
                ),
              ],
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(context),
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
                      onPressed: _saving || _loadingMeta ? null : _save,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: kNavy,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: _saving
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Text('Save Device', style: TextStyle(fontWeight: FontWeight.w600)),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FormField extends StatelessWidget {
  const _FormField({
    required this.label,
    required this.controller,
    required this.hint,
    this.validator,
  });
  final String label;
  final TextEditingController controller;
  final String hint;
  final String? Function(String?)? validator;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: kNavy)),
        const SizedBox(height: 6),
        TextFormField(
          controller: controller,
          validator: validator,
          style: const TextStyle(fontSize: 14, color: kNavy),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13),
            filled: true,
            fillColor: kBg,
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide.none,
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: kNavy, width: 1.5),
            ),
          ),
        ),
      ],
    );
  }
}

class _IdDropdownFormField extends StatelessWidget {
  const _IdDropdownFormField({
    required this.label,
    required this.value,
    required this.items,
    required this.labelOf,
    required this.onChanged,
    this.enabled = true,
  });
  final String label;
  final String? value;
  final List<Map<String, dynamic>> items;
  final String Function(Map<String, dynamic>) labelOf;
  final ValueChanged<String?> onChanged;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: kNavy)),
        const SizedBox(height: 6),
        DropdownButtonFormField<String>(
          initialValue: value,
          onChanged: enabled ? onChanged : null,
          style: const TextStyle(fontSize: 14, color: kNavy),
          decoration: InputDecoration(
            filled: true,
            fillColor: kBg,
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide.none,
            ),
          ),
          items: items
              .map((e) => DropdownMenuItem(
                    value: e['id'] as String,
                    child: Text(labelOf(e)),
                  ))
              .toList(),
        ),
      ],
    );
  }
}

class _DropdownFormField extends StatelessWidget {
  const _DropdownFormField({
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
  });
  final String label;
  final String value;
  final List<String> items;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: kNavy)),
        const SizedBox(height: 6),
        DropdownButtonFormField<String>(
          initialValue: value,
          onChanged: onChanged,
          style: const TextStyle(fontSize: 14, color: kNavy),
          decoration: InputDecoration(
            filled: true,
            fillColor: kBg,
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide.none,
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: kNavy, width: 1.5),
            ),
          ),
          items: items
              .map((e) => DropdownMenuItem(value: e, child: Text(e)))
              .toList(),
        ),
      ],
    );
  }
}

// ── MQTT Config Dialog ────────────────────────────────────────────────────────
class _MqttConfigDialog extends StatefulWidget {
  const _MqttConfigDialog({required this.config});
  final Map<String, dynamic> config;

  @override
  State<_MqttConfigDialog> createState() => _MqttConfigDialogState();
}

class _MqttConfigDialogState extends State<_MqttConfigDialog> {
  // Broker settings are operator-supplied (defaults shown) and editable before copying.
  final _brokerIp = TextEditingController(text: '10.3.20.218');
  final _brokerPort = TextEditingController(text: '1883');
  final _topic = TextEditingController(text: 'SMM/Soil_Data');

  String get _deviceId => widget.config['deviceId'] as String? ?? '';
  String get _ingestApiKey => widget.config['ingestApiKey'] as String? ?? '';

  String get _allEnv => [
        'EMS_DEVICE_ID=$_deviceId',
        'EMS_INGEST_API_KEY=$_ingestApiKey',
        'MQTT_BROKER_IP=${_brokerIp.text}',
        'MQTT_BROKER_PORT=${_brokerPort.text}',
        'MQTT_TOPIC=${_topic.text}',
      ].join('\n');

  @override
  void dispose() {
    _brokerIp.dispose();
    _brokerPort.dispose();
    _topic.dispose();
    super.dispose();
  }

  void _copy(String text, String label) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$label copied'), backgroundColor: kGreen, duration: const Duration(seconds: 2)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: kNavy.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(8)),
            child: const Icon(Icons.terminal_outlined, color: kNavy, size: 18),
          ),
          const SizedBox(width: 10),
          const Expanded(
            child: Text('MQTT Script Config', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: kNavy)),
          ),
        ],
      ),
      content: SizedBox(
        width: double.maxFinite,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: kOrange.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: kOrange.withValues(alpha: 0.3)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.warning_amber_rounded, size: 16, color: kOrange),
                    const SizedBox(width: 8),
                    const Expanded(
                      child: Text(
                        'API key shown once — copy it now.',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: kOrange),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              // Backend-issued credentials (read-only)
              _EnvRow(name: 'EMS_DEVICE_ID', value: _deviceId, onCopy: () => _copy(_deviceId, 'EMS_DEVICE_ID')),
              _EnvRow(name: 'EMS_INGEST_API_KEY', value: _ingestApiKey, onCopy: () => _copy(_ingestApiKey, 'EMS_INGEST_API_KEY')),
              const SizedBox(height: 6),
              Text('MQTT BROKER', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.grey.shade500, letterSpacing: 0.5)),
              const SizedBox(height: 8),
              _BrokerField(label: 'Broker IP / Host', controller: _brokerIp),
              const SizedBox(height: 10),
              _BrokerField(label: 'Broker Port', controller: _brokerPort, keyboardType: TextInputType.number),
              const SizedBox(height: 10),
              _BrokerField(label: 'Topic', controller: _topic),
            ],
          ),
        ),
      ),
      actions: [
        TextButton.icon(
          onPressed: () => _copy(_allEnv, 'All env vars'),
          icon: const Icon(Icons.copy_all_outlined, size: 16),
          label: const Text('Copy .env'),
          style: TextButton.styleFrom(foregroundColor: kNavy),
        ),
        ElevatedButton(
          onPressed: () => Navigator.pop(context),
          style: ElevatedButton.styleFrom(
            backgroundColor: kNavy,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
          child: const Text('Done'),
        ),
      ],
    );
  }
}

class _BrokerField extends StatelessWidget {
  const _BrokerField({required this.label, required this.controller, this.keyboardType});
  final String label;
  final TextEditingController controller;
  final TextInputType? keyboardType;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: kNavy)),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          keyboardType: keyboardType,
          style: const TextStyle(fontSize: 13, color: kNavy),
          decoration: InputDecoration(
            isDense: true,
            filled: true,
            fillColor: kBg,
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: kNavy, width: 1.5),
            ),
          ),
        ),
      ],
    );
  }
}

class _EnvRow extends StatelessWidget {
  const _EnvRow({required this.name, required this.value, required this.onCopy});
  final String name;
  final String value;
  final VoidCallback onCopy;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(color: kBg, borderRadius: BorderRadius.circular(8)),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: TextStyle(fontSize: 10, color: Colors.grey.shade500, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 2),
                  Text(
                    value,
                    style: const TextStyle(fontSize: 12, color: kNavy, fontFamily: 'monospace'),
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            GestureDetector(
              onTap: onCopy,
              child: Icon(Icons.copy_outlined, size: 16, color: Colors.grey.shade400),
            ),
          ],
        ),
      ),
    );
  }
}
