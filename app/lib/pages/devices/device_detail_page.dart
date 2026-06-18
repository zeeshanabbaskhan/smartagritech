import 'package:flutter/material.dart';
import '../../app_theme.dart';
import '../../services/api_client.dart';
import '../../services/app_state.dart';
import '../../services/auth_service.dart';
import '../../services/ems_api.dart';
import '../../utils/api_mappers.dart';
import '../../widgets/api_state_views.dart';
import '../../widgets/chart_painters.dart';
import '../../widgets/metric_card.dart';
import '../ai_analytics/voltage_imbalance_page.dart';
import '../ai_analytics/current_imbalance_page.dart';
import '../ai_analytics/power_factor_page.dart';
import '../ai_analytics/energy_consumption_page.dart';
import '../ai_analytics/anomalies_page.dart';
import '../schedule_page.dart';
import '../alarm_template_page.dart';
import '../sensor_history_page.dart';

class DeviceDetailPage extends StatefulWidget {
  const DeviceDetailPage({super.key, required this.device});
  final Map<String, dynamic> device;

  @override
  State<DeviceDetailPage> createState() => _DeviceDetailPageState();
}

class _DeviceDetailPageState extends State<DeviceDetailPage>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;
  late Map<String, dynamic> _device;

  @override
  void initState() {
    super.initState();
    _device = Map<String, dynamic>.from(widget.device);
    _tabs = TabController(length: 5, vsync: this);
    final deviceId = _device['id'] as String?;
    if (deviceId != null) {
      AppState.instance.selectDevice(deviceId);
      _refreshDevice();
    }
  }

  Future<void> _refreshDevice() async {
    final id = _device['id'] as String?;
    if (id == null) return;
    try {
      final raw = await EmsApi.instance.getDevice(id);
      var mapped = ApiMappers.device(raw);
      try {
        final res = await EmsApi.instance.getDashboardSummary(deviceId: id, timeRange: '24h');
        mapped = ApiMappers.enrichDevice(
          mapped,
          Map<String, dynamic>.from(res['data'] as Map? ?? {}),
        );
      } catch (_) {}
      if (mounted) setState(() => _device = mapped);
    } catch (_) {}
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final d = _device;
    final isOnline = d['status'] == 'Online';

    return Scaffold(
      backgroundColor: kBg,
      body: NestedScrollView(
        headerSliverBuilder: (_, _) => [
          SliverAppBar(
            backgroundColor: kNavy,
            foregroundColor: Colors.white,
            expandedHeight: 200,
            floating: false,
            pinned: true,
            elevation: 0,
            title: Text(
              d['name'] as String,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white),
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.edit_outlined, size: 20),
                onPressed: () => _showEditModal(context),
              ),
              IconButton(
                icon: const Icon(Icons.more_vert, size: 20),
                onPressed: () => _showOptionsMenu(context),
              ),
            ],
            flexibleSpace: FlexibleSpaceBar(
              background: _DeviceHeader(device: d),
            ),
            bottom: TabBar(
              controller: _tabs,
              indicatorColor: Colors.white,
              indicatorWeight: 3,
              labelColor: Colors.white,
              unselectedLabelColor: Colors.white60,
              labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
              tabs: const [
                Tab(text: 'Overview'),
                Tab(text: 'Metrics'),
                Tab(text: 'Analytics'),
                Tab(text: 'Schedule'),
                Tab(text: 'Users'),
              ],
            ),
          ),
        ],
        body: TabBarView(
          controller: _tabs,
          children: [
            _OverviewTab(device: d, isOnline: isOnline),
            _MetricsTab(deviceId: d['id'] as String?),
            _AnalyticsTab(deviceId: d['id'] as String?),
            _ScheduleTab(deviceId: d['id'] as String?),
            _DeviceUsersTab(deviceId: d['id'] as String),
          ],
        ),
      ),
    );
  }

  void _showEditModal(BuildContext context) {
    if (AuthService.instance.user?.canManageOrg != true) return;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _EditDeviceSheet(
        device: _device,
        onSaved: () async {
          await _refreshDevice();
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: const Text('Device updated successfully'),
                backgroundColor: kGreen,
                behavior: SnackBarBehavior.floating,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
            );
          }
        },
      ),
    );
  }

  void _showOptionsMenu(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _OptionsSheet(deviceName: _device['name'] as String, deviceId: _device['id'] as String?),
    );
  }
}

// ── Device Header (collapsible) ───────────────────────────────────────────────
class _DeviceHeader extends StatelessWidget {
  const _DeviceHeader({required this.device});
  final Map<String, dynamic> device;

  @override
  Widget build(BuildContext context) {
    final isOnline = device['status'] == 'Online';
    return Container(
      color: kNavy,
      padding: const EdgeInsets.fromLTRB(16, 80, 16, 48),
      child: Row(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(Icons.memory_outlined, color: Colors.white, size: 28),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Row(
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: isOnline ? kGreen : kRed,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      device['status'] as String,
                      style: TextStyle(
                        fontSize: 12,
                        color: isOnline ? kGreen : kRed,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  '${device['gateway']}  ·  ${device['slave']}',
                  style: const TextStyle(color: Colors.white70, fontSize: 12),
                ),
                Text(
                  device['template'] as String,
                  style: const TextStyle(color: Colors.white54, fontSize: 11),
                ),
              ],
            ),
          ),
          Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                device['serialNo'] as String,
                style: const TextStyle(color: Colors.white70, fontSize: 11),
              ),
              const SizedBox(height: 4),
              Text(
                device['ipAddress'] as String,
                style: const TextStyle(color: Colors.white54, fontSize: 11),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Overview Tab ──────────────────────────────────────────────────────────────
class _OverviewTab extends StatelessWidget {
  const _OverviewTab({required this.device, required this.isOnline});
  final Map<String, dynamic> device;
  final bool isOnline;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Quick stats
          if (isOnline) ...[
            Row(
              children: [
                _StatCard('Power', '${(device['powerKwh'] as num?)?.toStringAsFixed(2) ?? '0'} kWh', Icons.bolt_outlined, kBlue),
                const SizedBox(width: 10),
                _StatCard('Power Factor', '${device['powerFactor']}', Icons.electric_bolt_outlined, kGreen),
                const SizedBox(width: 10),
                _StatCard('Anomalies', '${device['anomalies'] ?? 0}', Icons.warning_amber_outlined,
                    ((device['anomalies'] as num?) ?? 0) > 0 ? kOrange : kGreen),
              ],
            ),
            const SizedBox(height: 16),
          ],

          // Device info card
          _SectionCard(
            title: 'Device Information',
            child: Column(
              children: [
                _InfoRow('Device Name', device['name'] as String),
                _InfoRow('Serial Number', device['serialNo'] as String),
                _InfoRow('IP Address', device['ipAddress'] as String),
                _InfoRow('Gateway', device['gateway'] as String),
                _InfoRow('Template', device['template'] as String),
                _InfoRow('Organization', device['org'] as String),
                _InfoRow('Slave / Meter', device['slave'] as String),
                _InfoRow('Last Seen', device['lastSeen'] as String, isLast: true),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Status card
          _SectionCard(
            title: 'Connection Status',
            child: Column(
              children: [
                _StatusRow('MQTT Connection', isOnline),
                _StatusRow('Hub Connection', isOnline),
                _StatusRow('Data Streaming', isOnline),
                _StatusRow('Alert System', true, isLast: true),
              ],
            ),
          ),

          if (!isOnline) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: kRed.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: kRed.withValues(alpha: 0.2)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.warning_amber_outlined, color: kRed, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Device Offline',
                            style: TextStyle(color: kRed, fontWeight: FontWeight.w700, fontSize: 13)),
                        Text(
                          'Last seen: ${device['lastSeen']}',
                          style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 20),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard(this.label, this.value, this.icon, this.color);
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(color: kNavy.withValues(alpha: 0.05), blurRadius: 6, offset: const Offset(0, 2))
          ],
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(height: 6),
            Text(value,
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: color),
                overflow: TextOverflow.ellipsis),
            Text(label,
                style: TextStyle(fontSize: 10, color: Colors.grey.shade500),
                textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.child});
  final String title;
  final Widget child;

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
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
            child: Text(title,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: kNavy)),
          ),
          const SizedBox(height: 8),
          child,
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow(this.label, this.value, {this.isLast = false});
  final String label;
  final String value;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            children: [
              SizedBox(
                width: 120,
                child: Text(label, style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
              ),
              Expanded(
                child: Text(value,
                    style: const TextStyle(fontSize: 13, color: kNavy, fontWeight: FontWeight.w500),
                    overflow: TextOverflow.ellipsis),
              ),
            ],
          ),
        ),
        if (!isLast) Divider(height: 1, indent: 16, color: Colors.grey.shade100),
      ],
    );
  }
}

class _StatusRow extends StatelessWidget {
  const _StatusRow(this.label, this.active, {this.isLast = false});
  final String label;
  final bool active;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(label, style: TextStyle(fontSize: 13, color: Colors.grey.shade700)),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                decoration: BoxDecoration(
                  color: active
                      ? kGreen.withValues(alpha: 0.12)
                      : kRed.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  active ? 'Connected' : 'Disconnected',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: active ? kGreen : kRed,
                  ),
                ),
              ),
            ],
          ),
        ),
        if (!isLast) Divider(height: 1, indent: 16, color: Colors.grey.shade100),
      ],
    );
  }
}

// ── Metrics Tab ───────────────────────────────────────────────────────────────
class _MetricsTab extends StatefulWidget {
  const _MetricsTab({this.deviceId});
  final String? deviceId;

  @override
  State<_MetricsTab> createState() => _MetricsTabState();
}

class _MetricsTabState extends State<_MetricsTab> {
  bool _loading = true;
  Object? _error;
  Map<String, dynamic>? _summary;
  Map<String, dynamic> _latest = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (widget.deviceId == null) {
      setState(() => _loading = false);
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      final summaryRes = await EmsApi.instance.getDashboardSummary(deviceId: widget.deviceId!);
      final latestRes = await EmsApi.instance.getLatestSensorData(deviceId: widget.deviceId!);
      setState(() {
        _summary = Map<String, dynamic>.from(summaryRes['data'] as Map? ?? {});
        _latest = Map<String, dynamic>.from(latestRes['data'] as Map? ?? {});
      });
    } catch (e) {
      setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  double _metric(String key) {
    final block = _summary?[key];
    if (block is Map && block['value'] != null) {
      return double.tryParse(block['value'].toString()) ?? 0;
    }
    return 0;
  }

  List<double> _chart(String key) {
    final block = _summary?[key];
    if (block is! Map) return [];
    return ApiMappers.chartValues(block['chartData'] as List?);
  }

  String _reading(String key, {int decimals = 2}) =>
      ApiMappers.latestReading(_latest, key, decimals: decimals);

  @override
  Widget build(BuildContext context) {
    if (_loading) return const LoadingView();
    if (_error != null) return ErrorView.fromError(_error!, onRetry: _load);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          MetricCard(
            title: '⚡ Total Power Consumption',
            value: _metric('totalPowerConsumption').toStringAsFixed(2),
            unit: 'kWh',
            chart: MiniBarChart(data: _chart('totalPowerConsumption'), color: kBlue, height: 75),
          ),
          const SizedBox(height: 12),
          MetricCard(
            title: '⚡ Voltage Imbalance (%)',
            value: _metric('voltageImbalance').toStringAsFixed(2),
            unit: '',
            chart: MiniLineChart(data: _chart('voltageImbalance'), color: kOrange, height: 75),
          ),
          const SizedBox(height: 12),
          MetricCard(
            title: '⚖ Current Imbalance',
            value: _metric('currentImbalance').toStringAsFixed(2),
            unit: '',
            chart: MiniLineChart(data: _chart('currentImbalance'), color: kGreen, height: 75),
          ),
          const SizedBox(height: 12),
          MetricCard(
            title: '🔋 Power Factor',
            value: _metric('powerFactor').toStringAsFixed(2),
            unit: '',
            chart: MiniLineChart(data: _chart('powerFactor'), color: kBlue, height: 75),
          ),
          const SizedBox(height: 12),
          _SectionCard(
            title: 'Live Readings',
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
                childAspectRatio: 2.4,
                children: [
                  DetailTile(title: 'Voltage A', value: _reading('VoltageA', decimals: 1), unit: 'V'),
                  DetailTile(title: 'Voltage B', value: _reading('VoltageB', decimals: 1), unit: 'V'),
                  DetailTile(title: 'Voltage C', value: _reading('VoltageC', decimals: 1), unit: 'V'),
                  DetailTile(title: 'Current A', value: _reading('CurrentA'), unit: 'A'),
                  DetailTile(title: 'Current B', value: _reading('CurrentB'), unit: 'A'),
                  DetailTile(title: 'Current C', value: _reading('CurrentC'), unit: 'A'),
                  DetailTile(title: 'Active Power', value: _reading('ActivePower'), unit: 'kW'),
                  DetailTile(title: 'Power Factor', value: _reading('PowerFactor'), unit: ''),
                  DetailTile(title: 'Frequency', value: _reading('Frequency'), unit: 'Hz'),
                  DetailTile(title: 'THD-V A', value: _reading('THD_V', decimals: 1), unit: '%'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }
}

// ── Analytics Tab ─────────────────────────────────────────────────────────────
class _AnalyticsTab extends StatefulWidget {
  const _AnalyticsTab({this.deviceId});
  final String? deviceId;

  @override
  State<_AnalyticsTab> createState() => _AnalyticsTabState();
}

class _AnalyticsTabState extends State<_AnalyticsTab> {
  Map<String, dynamic>? _summary;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (widget.deviceId == null) return;
    try {
      final res = await EmsApi.instance.getDashboardSummary(deviceId: widget.deviceId!);
      if (mounted) setState(() => _summary = Map<String, dynamic>.from(res['data'] as Map? ?? {}));
    } catch (_) {}
  }

  double _metric(String key) {
    final block = _summary?[key];
    if (block is Map && block['value'] != null) {
      return double.tryParse(block['value'].toString()) ?? 0;
    }
    return 0;
  }

  int get _anomalyCount {
    final block = _summary?['anomalies'];
    if (block is Map && block['count'] != null) return (block['count'] as num).toInt();
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final items = [
      _AnalyticsItem('Voltage Imbalance', '${_metric('voltageImbalance').toStringAsFixed(1)}%',
          Icons.electric_bolt_outlined, kOrange, () {
        Navigator.push(context, MaterialPageRoute(builder: (_) => const VoltageImbalancePage()));
      }),
      _AnalyticsItem('Current Imbalance', '${_metric('currentImbalance').toStringAsFixed(1)}%',
          Icons.waves_outlined, kBlue, () {
        Navigator.push(context, MaterialPageRoute(builder: (_) => const CurrentImbalancePage()));
      }),
      _AnalyticsItem('Power Factor', _metric('powerFactor').toStringAsFixed(2),
          Icons.battery_charging_full_outlined, kGreen, () {
        Navigator.push(context, MaterialPageRoute(builder: (_) => const PowerFactorPage()));
      }),
      _AnalyticsItem('Energy Consumption', '${_metric('totalPowerConsumption').toStringAsFixed(1)} kWh',
          Icons.bolt_outlined, kNavy, () {
        Navigator.push(context, MaterialPageRoute(builder: (_) => const EnergyConsumptionPage()));
      }),
      _AnalyticsItem('Anomalies', '$_anomalyCount detected',
          Icons.warning_amber_outlined, kRed, () {
        Navigator.push(context, MaterialPageRoute(builder: (_) => const AnomaliesPage()));
      }),
    ];

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: kBlue.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              const Icon(Icons.auto_awesome_outlined, color: kBlue, size: 18),
              const SizedBox(width: 10),
              const Expanded(
                child: Text(
                  'AI-powered analytics for this device. Tap any card to see detailed predictions.',
                  style: TextStyle(fontSize: 12, color: kBlue),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        ...items.map((item) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _AnalyticsCard(item: item),
            )),
        const SizedBox(height: 8),
      ],
    );
  }
}

class _AnalyticsItem {
  const _AnalyticsItem(this.title, this.value, this.icon, this.color, this.onTap);
  final String title;
  final String value;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
}

class _AnalyticsCard extends StatelessWidget {
  const _AnalyticsCard({required this.item});
  final _AnalyticsItem item;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: item.onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(color: kNavy.withValues(alpha: 0.05), blurRadius: 8, offset: const Offset(0, 2))
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: item.color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(item.icon, color: item.color, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item.title,
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: kNavy)),
                  Text(item.value,
                      style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                ],
              ),
            ),
            Icon(Icons.arrow_forward_ios, size: 14, color: Colors.grey.shade400),
          ],
        ),
      ),
    );
  }
}

// ── Schedule Tab ──────────────────────────────────────────────────────────────
class _ScheduleTab extends StatefulWidget {
  const _ScheduleTab({this.deviceId});
  final String? deviceId;

  @override
  State<_ScheduleTab> createState() => _ScheduleTabState();
}

class _ScheduleTabState extends State<_ScheduleTab> {
  bool _loading = true;
  List<Map<String, dynamic>> _tasks = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (widget.deviceId == null) {
      setState(() => _loading = false);
      return;
    }
    setState(() => _loading = true);
    try {
      final raw = await EmsApi.instance.getScheduledTasks(deviceId: widget.deviceId);
      setState(() => _tasks = raw.map(ApiMappers.scheduledTask).toList());
    } catch (_) {
      setState(() => _tasks = []);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Device Schedules',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: kNavy)),
              TextButton.icon(
                onPressed: () async {
                  await Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const SchedulePage()),
                  );
                  _load();
                },
                icon: const Icon(Icons.open_in_new, size: 14),
                label: const Text('Manage All', style: TextStyle(fontSize: 12)),
                style: TextButton.styleFrom(foregroundColor: kBlue),
              ),
            ],
          ),
        ),
        Expanded(
          child: _loading
              ? const LoadingView()
              : _tasks.isEmpty
                  ? Center(
                      child: Text('No schedules for this device',
                          style: TextStyle(color: Colors.grey.shade500, fontSize: 13)),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: _tasks.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 10),
                      itemBuilder: (_, i) {
                        final t = _tasks[i];
                        return _ScheduleItem(
                          variable: t['variable'] as String,
                          action: t['action'] as String,
                          schedule: '${t['repeat']} · ${t['time']}',
                          status: t['status'] as String,
                        );
                      },
                    ),
        ),
      ],
    );
  }
}

class _ScheduleItem extends StatelessWidget {
  const _ScheduleItem({
    required this.variable,
    required this.action,
    required this.schedule,
    required this.status,
  });
  final String variable;
  final String action;
  final String schedule;
  final String status;

  @override
  Widget build(BuildContext context) {
    final active = status == 'Active';
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(color: kNavy.withValues(alpha: 0.05), blurRadius: 6, offset: const Offset(0, 2))
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: kNavy.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.schedule_outlined, color: kNavy, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(variable,
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: kNavy)),
                Text('$action · $schedule',
                    style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: active ? kGreen.withValues(alpha: 0.1) : Colors.grey.shade100,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              status,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: active ? kGreen : Colors.grey.shade500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Edit Device Sheet ─────────────────────────────────────────────────────────
class _EditDeviceSheet extends StatefulWidget {
  const _EditDeviceSheet({required this.device, required this.onSaved});
  final Map<String, dynamic> device;
  final VoidCallback onSaved;

  @override
  State<_EditDeviceSheet> createState() => _EditDeviceSheetState();
}

class _EditDeviceSheetState extends State<_EditDeviceSheet> {
  late final TextEditingController _nameCtrl;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController(text: widget.device['name']?.toString() ?? '');
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final id = widget.device['id'] as String?;
    if (id == null || _nameCtrl.text.trim().isEmpty) return;
    setState(() => _saving = true);
    try {
      await EmsApi.instance.updateDevice(id, {'name': _nameCtrl.text.trim()});
      if (mounted) {
        Navigator.pop(context);
        widget.onSaved();
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
            Center(
              child: Container(
                width: 40, height: 4,
                decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Edit Device',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: kNavy)),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.pop(context),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
              ],
            ),
            const SizedBox(height: 20),
            _Field('Device Name', _nameCtrl),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _saving ? null : _save,
                style: ElevatedButton.styleFrom(
                  backgroundColor: kNavy,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: Text(_saving ? 'Saving…' : 'Save Changes',
                    style: const TextStyle(fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field(this.label, this.ctrl);
  final String label;
  final TextEditingController ctrl;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: kNavy)),
        const SizedBox(height: 6),
        TextField(
          controller: ctrl,
          style: const TextStyle(fontSize: 14, color: kNavy),
          decoration: InputDecoration(
            filled: true,
            fillColor: kBg,
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
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

// ── Options Sheet ─────────────────────────────────────────────────────────────
class _OptionsSheet extends StatelessWidget {
  const _OptionsSheet({required this.deviceName, this.deviceId});
  final String deviceName;
  final String? deviceId;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 40, height: 4,
            decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)),
          ),
          const SizedBox(height: 16),
          Text(deviceName,
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: kNavy)),
          const SizedBox(height: 16),
          _OptionTile(Icons.alarm_outlined, 'Manage Alarms', kOrange, () {
            Navigator.pop(context);
            Navigator.push(context, MaterialPageRoute(builder: (_) => const AlarmTemplatePage()));
          }),
          _OptionTile(Icons.schedule_outlined, 'Manage Schedule', kBlue, () {
            Navigator.pop(context);
            Navigator.push(context, MaterialPageRoute(builder: (_) => const SchedulePage()));
          }),
          _OptionTile(Icons.download_outlined, 'Download Data', kGreen, () {
            Navigator.pop(context);
            Navigator.push(context, MaterialPageRoute(
              builder: (_) => SensorHistoryPage(deviceId: deviceId)));
          }),
          _OptionTile(Icons.restart_alt_outlined, 'Restart Device', kOrange, () => Navigator.pop(context)),
          _OptionTile(Icons.delete_outline, 'Delete Device', kRed, () => Navigator.pop(context)),
        ],
      ),
    );
  }
}

class _OptionTile extends StatelessWidget {
  const _OptionTile(this.icon, this.label, this.color, this.onTap);
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: color, size: 20),
      title: Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w500, fontSize: 14)),
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 4),
    );
  }
}

// ── Device Users Tab ──────────────────────────────────────────────────────────
class _DeviceUsersTab extends StatefulWidget {
  const _DeviceUsersTab({required this.deviceId});
  final String deviceId;

  @override
  State<_DeviceUsersTab> createState() => _DeviceUsersTabState();
}

class _DeviceUsersTabState extends State<_DeviceUsersTab> {
  List<Map<String, dynamic>> _users = [];
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
      _users = await EmsApi.instance.getDeviceUsers(widget.deviceId);
    } catch (e) {
      setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _assign() async {
    final allUsers = await EmsApi.instance.getUsers();
    final assigned = _users.map((u) => u['userId'] ?? u['user']?['id']).toSet();
    final available = allUsers.where((u) => !assigned.contains(u['id'])).toList();
    if (!mounted) return;
    final picked = await showDialog<String>(
      context: context,
      builder: (_) => SimpleDialog(
        title: const Text('Assign User'),
        children: available.map((u) => SimpleDialogOption(
          child: Text('${u['fullName'] ?? u['name'] ?? ''}  (${u['email'] ?? ''})'),
          onPressed: () => Navigator.pop(context, u['id'] as String?),
        )).toList(),
      ),
    );
    if (picked != null) {
      try {
        await EmsApi.instance.assignDeviceUser(widget.deviceId, picked);
        await _load();
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(e.toString()), backgroundColor: kRed));
        }
      }
    }
  }

  Future<void> _remove(String userId) async {
    try {
      await EmsApi.instance.removeDeviceUser(widget.deviceId, userId);
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: kRed));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const LoadingView();
    if (_error != null) return ErrorView.fromError(_error!, onRetry: _load);
    return Scaffold(
      backgroundColor: kBg,
      floatingActionButton: FloatingActionButton.small(
        onPressed: _assign,
        backgroundColor: kNavy,
        child: const Icon(Icons.person_add_outlined, color: Colors.white),
      ),
      body: _users.isEmpty
        ? Center(child: Text('No users assigned', style: TextStyle(color: Colors.grey.shade500)))
        : ListView.separated(
            padding: const EdgeInsets.all(16),
            separatorBuilder: (context, index) => const SizedBox(height: 8),
            itemCount: _users.length,
            itemBuilder: (_, i) {
              final u = _users[i]['user'] ?? _users[i];
              final userId = (_users[i]['userId'] ?? u['id']) as String?;
              final name = u['fullName'] ?? u['name'] ?? '—';
              final email = u['email'] ?? '';
              final initials = (name as String).split(' ').take(2).map((w) => w.isNotEmpty ? w[0] : '').join().toUpperCase();
              return Card(
                margin: EdgeInsets.zero,
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: kNavy,
                    child: Text(initials, style: const TextStyle(color: Colors.white, fontSize: 13))),
                  title: Text(name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                  subtitle: Text(email as String, style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                  trailing: IconButton(
                    icon: const Icon(Icons.remove_circle_outline, color: kRed, size: 20),
                    onPressed: userId != null ? () => _remove(userId) : null,
                  ),
                ),
              );
            },
          ),
    );
  }
}
