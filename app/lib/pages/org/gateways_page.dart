import 'package:flutter/material.dart';
import '../../app_theme.dart';
import '../../services/api_client.dart';
import '../../services/ems_api.dart';
import '../../utils/api_mappers.dart';
import '../../widgets/api_state_views.dart';
import 'org_helpers.dart';

class GatewaysTab extends StatefulWidget {
  const GatewaysTab({super.key});

  @override
  State<GatewaysTab> createState() => _GatewaysTabState();
}

class _GatewaysTabState extends State<GatewaysTab> {
  List<Map<String, dynamic>> _gateways = [];
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
      final raw = await EmsApi.instance.getGateways();
      setState(() => _gateways = raw.map((g) => ApiMappers.gateway(g)).toList());
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
      builder: (_) => _GatewayFormModal(
        title: index != null ? 'Edit Gateway' : 'Add Gateway',
        gateway: index != null ? _gateways[index] : null,
        onSave: (data) async {
          try {
            final body = {
              'name': data['name'],
              'serialNumber': data['serialNo'],
              'model': data['ipAddress'],
              'status': data['status'] == 'Online' ? 'ONLINE' : 'OFFLINE',
            };
            if (index != null) {
              await EmsApi.instance.updateGateway(_gateways[index]['id'] as String, body);
            } else {
              await EmsApi.instance.createGateway(body);
            }
            await _load();
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                orgSnack(index != null ? 'Gateway updated' : 'Gateway added'),
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
        title: 'Delete Gateway',
        message: 'Delete "${_gateways[index]['name']}"? All device connections will be lost.',
        onConfirm: () async {
          try {
            await EmsApi.instance.deleteGateway(_gateways[index]['id'] as String);
            await _load();
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(orgSnack('Gateway deleted'));
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

  static const _cols = ['Name', 'IP Address', 'Location', 'Devices', 'Status', 'Last Seen', 'Ops'];
  static const _widths = [110.0, 125.0, 135.0, 70.0, 75.0, 145.0, 64.0];

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

    final online = _gateways.where((g) => g['status'] == 'Online').length;

    return Scaffold(
      backgroundColor: kBg,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showModal(),
        backgroundColor: kNavy,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add, size: 18),
        label: const Text('Add Gateway', style: TextStyle(fontWeight: FontWeight.w600)),
      ),
      body: Column(
        children: [
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(children: [
              StatChip('Total', _gateways.length, kNavy),
              const SizedBox(width: 16),
              StatChip('Online', online, kGreen),
              const SizedBox(width: 16),
              StatChip('Offline', _gateways.length - online, kRed),
            ]),
          ),
          Expanded(
            child: _gateways.isEmpty
                ? _empty()
                : Padding(
                    padding: const EdgeInsets.all(16),
                    child: TableCard(
                      cols: _cols,
                      widths: _widths,
                      header: tableHeader(_cols, _widths),
                      rows: _gateways.asMap().entries.map((e) => Column(
                        children: [
                          Divider(height: 1, color: Colors.grey.shade100),
                          _row(e.key, e.value),
                        ],
                      )).toList(),
                      count: _gateways.length,
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _row(int idx, Map<String, dynamic> g) {
    final online = g['status'] == 'Online';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
      child: Row(children: [
        SizedBox(
          width: _widths[0],
          child: Text(g['name'] as String,
              style: const TextStyle(fontSize: 12, color: kNavy, fontWeight: FontWeight.w600),
              overflow: TextOverflow.ellipsis),
        ),
        SizedBox(
          width: _widths[1],
          child: Text(g['ipAddress'] as String,
              style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
              overflow: TextOverflow.ellipsis),
        ),
        SizedBox(
          width: _widths[2],
          child: Text(g['location'] as String,
              style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
              overflow: TextOverflow.ellipsis),
        ),
        SizedBox(
          width: _widths[3],
          child: Text('${g['devices']}',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade700)),
        ),
        SizedBox(
          width: _widths[4],
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: online ? kGreen.withValues(alpha: 0.12) : kRed.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(g['status'] as String,
                style: TextStyle(
                    fontSize: 11, fontWeight: FontWeight.w600,
                    color: online ? kGreen : kRed)),
          ),
        ),
        SizedBox(
          width: _widths[5],
          child: Text(g['lastSeen'] as String,
              style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
              overflow: TextOverflow.ellipsis),
        ),
        SizedBox(
          width: _widths[6],
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
          Icon(Icons.router_outlined, size: 52, color: Colors.grey.shade300),
          const SizedBox(height: 12),
          Text('No gateways found',
              style: TextStyle(color: Colors.grey.shade400, fontSize: 14)),
        ]),
      );
}

class _GatewayFormModal extends StatefulWidget {
  const _GatewayFormModal({required this.title, this.gateway, required this.onSave});
  final String title;
  final Map<String, dynamic>? gateway;
  final void Function(Map<String, dynamic>) onSave;

  @override
  State<_GatewayFormModal> createState() => _GatewayFormModalState();
}

class _GatewayFormModalState extends State<_GatewayFormModal> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _ip;
  late final TextEditingController _serial;
  String _status = 'Online';

  @override
  void initState() {
    super.initState();
    _name = TextEditingController(text: widget.gateway?['name'] ?? '');
    _ip = TextEditingController(text: widget.gateway?['ipAddress'] ?? '');
    _serial = TextEditingController(text: widget.gateway?['serialNo'] ?? '');
    _status = widget.gateway?['status'] ?? 'Online';
  }

  @override
  void dispose() {
    _name.dispose(); _ip.dispose(); _serial.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ModalShell(
      title: widget.title,
      child: Form(
        key: _formKey,
        child: Column(children: [
          ModalField('Gateway Name', _name,
              validator: (v) => v!.isEmpty ? 'Required' : null),
          const SizedBox(height: 14),
          ModalField('IP Address', _ip, hint: '192.168.x.x'),
          const SizedBox(height: 14),
          ModalField('Serial Number', _serial),
          const SizedBox(height: 14),
          ModalDropdown('Status', _status, ['Online', 'Offline'],
              (v) => setState(() => _status = v!)),
          const SizedBox(height: 24),
          ModalActions(
            onCancel: () => Navigator.pop(context),
            onSave: () {
              if (_formKey.currentState!.validate()) {
                Navigator.pop(context);
                widget.onSave({
                  'name': _name.text.trim(),
                  'ipAddress': _ip.text.trim(),
                  'serialNo': _serial.text.trim(),
                  'status': _status,
                  'lastSeen': 'Just now',
                });
              }
            },
          ),
        ]),
      ),
    );
  }
}
