import 'package:flutter/material.dart';
import '../../app_theme.dart';
import '../../services/api_client.dart';
import '../../services/ems_api.dart';
import '../../widgets/api_state_views.dart';
import 'users_page.dart';
import 'gateways_page.dart';
import 'device_templates_page.dart';
import 'alarm_contacts_page.dart';
import 'widget_templates_page.dart';

class OrganizationPage extends StatefulWidget {
  const OrganizationPage({super.key, this.initialTab = 0});
  final int initialTab;

  @override
  State<OrganizationPage> createState() => _OrganizationPageState();
}

class _OrganizationPageState extends State<OrganizationPage>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 6, vsync: this, initialIndex: widget.initialTab);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kNavy,
        foregroundColor: Colors.white,
        title: const Text('Organisation',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Colors.white)),
        elevation: 0,
        bottom: TabBar(
          controller: _tabs,
          indicatorColor: Colors.white,
          indicatorWeight: 3,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white60,
          labelStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
          isScrollable: true,
          tabAlignment: TabAlignment.start,
          tabs: const [
            Tab(text: 'Profile'),
            Tab(text: 'Users'),
            Tab(text: 'Gateways'),
            Tab(text: 'Templates'),
            Tab(text: 'Contacts'),
            Tab(text: 'Widgets'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: const [
          _ProfileTab(),
          UsersTab(),
          GatewaysTab(),
          DeviceTemplatesTab(),
          AlarmContactsTab(),
          WidgetTemplatesTab(),
        ],
      ),
    );
  }
}

// ── Profile Tab ───────────────────────────────────────────────────────────────
class _ProfileTab extends StatefulWidget {
  const _ProfileTab();

  @override
  State<_ProfileTab> createState() => _ProfileTabState();
}

class _ProfileTabState extends State<_ProfileTab> {
  late final TextEditingController _name;
  late final TextEditingController _description;
  late final TextEditingController _logoUrl;
  Map<String, dynamic>? _org;
  bool _loading = true;
  Object? _error;
  bool _editing = false;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _name = TextEditingController();
    _description = TextEditingController();
    _logoUrl = TextEditingController();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final data = await EmsApi.instance.getMyOrganization();
      _org = data;
      _name.text = data['name']?.toString() ?? '';
      _description.text = data['description']?.toString() ?? '';
      _logoUrl.text = data['logoUrl']?.toString() ?? '';
    } catch (e) {
      _error = e;
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final data = await EmsApi.instance.updateMyOrganization({
        'name': _name.text.trim(),
        'description': _description.text.trim(),
        if (_logoUrl.text.trim().isNotEmpty) 'logoUrl': _logoUrl.text.trim(),
      });
      _org = data;
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Organisation updated successfully'),
            backgroundColor: kGreen,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
        );
        setState(() => _editing = false);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e is ApiException ? e.message : 'Update failed'),
            backgroundColor: kRed,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _description.dispose();
    _logoUrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const LoadingView();
    }
    if (_error != null) {
      return ErrorView.fromError(_error!, onRetry: _load);
    }

    final o = _org ?? {};
    final status = o['status']?.toString() ?? 'ACTIVE';

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Plan banner ──
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [kNavy, Color(0xFF1E3A6E)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.business, color: Colors.white, size: 26),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(o['name']?.toString() ?? '—',
                          style: const TextStyle(
                              color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                            decoration: BoxDecoration(
                              color: kGreen.withValues(alpha: 0.25),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              status,
                              style: const TextStyle(
                                  color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // ── Edit form ──
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              boxShadow: [
                BoxShadow(color: kNavy.withValues(alpha: 0.05), blurRadius: 8, offset: const Offset(0, 2))
              ],
            ),
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Organisation Details',
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: kNavy)),
                      TextButton.icon(
                        onPressed: _saving
                            ? null
                            : () {
                                if (_editing) {
                                  _save();
                                } else {
                                  setState(() => _editing = true);
                                }
                              },
                        icon: Icon(_editing ? Icons.check : Icons.edit_outlined, size: 14),
                        label: Text(_editing ? (_saving ? 'Saving…' : 'Save') : 'Edit',
                            style: const TextStyle(fontSize: 12)),
                        style: TextButton.styleFrom(
                          foregroundColor: _editing ? kGreen : kBlue,
                          padding: EdgeInsets.zero,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  child: Column(
                    children: [
                      _EditableRow('Organisation Name', _name, _editing),
                      const SizedBox(height: 12),
                      _EditableRow('Description', _description, _editing, maxLines: 3),
                      const SizedBox(height: 12),
                      _EditableRow('Logo URL', _logoUrl, _editing, hint: 'https://example.com/logo.png'),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 14),

          // ── Read-only info ──
          _InfoCard([
            _Row('Status', status),
            _Row('Theme', o['theme']?['name']?.toString() ?? '—'),
            _Row('Created', o['createdAt']?.toString().split('T').first ?? '—'),
          ]),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

class _EditableRow extends StatelessWidget {
  const _EditableRow(this.label, this.ctrl, this.editing, {this.maxLines = 1, this.hint});
  final String label;
  final TextEditingController ctrl;
  final bool editing;
  final int maxLines;
  final String? hint;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: TextStyle(fontSize: 11, color: Colors.grey.shade500, fontWeight: FontWeight.w500)),
        const SizedBox(height: 4),
        editing
            ? TextField(
                controller: ctrl,
                maxLines: maxLines,
                style: const TextStyle(fontSize: 14, color: kNavy),
                decoration: InputDecoration(
                  hintText: hint,
                  hintStyle: TextStyle(fontSize: 13, color: Colors.grey.shade400),
                  filled: true,
                  fillColor: kBg,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide.none,
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: kNavy, width: 1.5),
                  ),
                ),
              )
            : Text(ctrl.text,
                style: const TextStyle(fontSize: 14, color: kNavy, fontWeight: FontWeight.w500)),
      ],
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard(this.rows);
  final List<_Row> rows;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(color: kNavy.withValues(alpha: 0.05), blurRadius: 8, offset: const Offset(0, 2))
        ],
      ),
      child: Column(
        children: List.generate(rows.length, (i) {
          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(
                  children: [
                    SizedBox(
                      width: 110,
                      child: Text(rows[i].label,
                          style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                    ),
                    Expanded(
                      child: Text(rows[i].value,
                          style: const TextStyle(
                              fontSize: 13, color: kNavy, fontWeight: FontWeight.w500)),
                    ),
                  ],
                ),
              ),
              if (i < rows.length - 1)
                Divider(height: 1, indent: 16, color: Colors.grey.shade100),
            ],
          );
        }),
      ),
    );
  }
}

class _Row {
  const _Row(this.label, this.value);
  final String label;
  final String value;
}
