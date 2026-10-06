import 'dart:async';
import 'package:flutter/material.dart';
import '../../app_theme.dart';
import '../../data/live_ems_engine.dart';

class EmsPowerFlow extends StatefulWidget {
  final Map<String, dynamic> powerFlow;
  final Map<String, dynamic> savings;
  final List<LiveSourceItem> sources;
  final List<Map<String, dynamic>> groups;
  final String orgName;
  final Function(String groupId)? onGroupClick;
  final Function(String sourceId, double newCapacity)? onUpdateSource;
  final VoidCallback? onManageSources;

  // Backward compatibility fields
  final double gridKw;
  final double solarKw;
  final double genKw;
  final double batteryKw;
  final double? totalLoadKw;
  final double? totalOrgLoadKw;
  final double tariffPkr;
  final List<dynamic>? sites;

  const EmsPowerFlow({
    super.key,
    this.powerFlow = const {},
    this.savings = const {},
    this.sources = const [],
    this.groups = const [],
    this.orgName = 'Ambition',
    this.onGroupClick,
    this.onUpdateSource,
    this.onManageSources,
    this.gridKw = 575.8,
    this.solarKw = 72.4,
    this.genKw = 0.0,
    this.batteryKw = 24.0,
    this.totalLoadKw,
    this.totalOrgLoadKw,
    this.tariffPkr = 28.0,
    this.sites,
  });

  @override
  State<EmsPowerFlow> createState() => _EmsPowerFlowState();
}

class _EmsPowerFlowState extends State<EmsPowerFlow> {
  late Timer _clockTimer;
  DateTime _currentTime = DateTime.now();
  bool _savingsOpen = false;

  @override
  void initState() {
    super.initState();
    _clockTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _currentTime = DateTime.now());
    });
  }

  @override
  void dispose() {
    _clockTimer.cancel();
    super.dispose();
  }

  String _formatTime(DateTime dt) {
    final hour = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
    final min = dt.minute.toString().padLeft(2, '0');
    final sec = dt.second.toString().padLeft(2, '0');
    final ampm = dt.hour >= 12 ? 'PM' : 'AM';
    return '$hour:$min:$sec $ampm';
  }

  String _formatPKR(num val) {
    return 'Rs ${val.toStringAsFixed(0).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}';
  }

  IconData _iconForGroup(String name) {
    final n = name.toLowerCase();
    if (n.contains('kitchen') || n.contains('cook')) return Icons.restaurant;
    if (n.contains('boiler') || n.contains('heat') || n.contains('flame')) return Icons.local_fire_department;
    if (n.contains('ev') || n.contains('car') || n.contains('charg')) return Icons.directions_car;
    if (n.contains('wash') || n.contains('laundry')) return Icons.local_laundry_service;
    if (n.contains('climate') || n.contains('hvac') || n.contains('cool')) return Icons.ac_unit;
    if (n.contains('compressor')) return Icons.air;
    if (n.contains('solar')) return Icons.wb_sunny;
    if (n.contains('spray')) return Icons.format_paint;
    if (n.contains('dryer')) return Icons.dry;
    if (n.contains('office')) return Icons.business;
    return Icons.widgets_outlined;
  }

  Map<String, dynamic> _metaForSourceType(String type) {
    switch (type.toLowerCase()) {
      case 'grid':
        return {'icon': Icons.bolt, 'from': const Color(0xFF60A5FA), 'to': const Color(0xFF2563EB)};
      case 'solar':
        return {'icon': Icons.wb_sunny, 'from': const Color(0xFFFCD34D), 'to': const Color(0xFFD97706)};
      case 'generator':
        return {'icon': Icons.local_gas_station, 'from': const Color(0xFF6EE7B7), 'to': const Color(0xFF059669)};
      case 'battery':
        return {'icon': Icons.battery_charging_full, 'from': const Color(0xFFC084FC), 'to': const Color(0xFF9333EA)};
      default:
        return {'icon': Icons.widgets_outlined, 'from': const Color(0xFF2DD4BF), 'to': const Color(0xFF0D9488)};
    }
  }

  void _showEditSourceDialog(LiveSourceItem s) {
    final ctrl = TextEditingController(text: s.capacity.toStringAsFixed(1));
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Edit ${s.name} Capacity', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
        content: TextField(
          controller: ctrl,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: const InputDecoration(labelText: 'Capacity (kW)', suffixText: 'kW'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              final val = double.tryParse(ctrl.text);
              if (val != null) {
                widget.onUpdateSource?.call(s.id, val);
              }
              Navigator.pop(ctx);
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final liveLoad = (widget.powerFlow['load'] as num?)?.toDouble() ?? widget.totalOrgLoadKw ?? widget.totalLoadKw ?? 648.2;
    final liveGrid = (widget.powerFlow['grid'] as num?)?.toDouble() ?? widget.gridKw;
    final liveSolar = (widget.powerFlow['solar'] as num?)?.toDouble() ?? widget.solarKw;
    final liveGen = (widget.powerFlow['generator'] as num?)?.toDouble() ?? widget.genKw;
    final gridMode = widget.powerFlow['gridMode']?.toString() ?? 'Importing';

    final dailySavings = (widget.savings['daily'] as num?)?.round() ?? 17400;
    final weeklySavings = (widget.savings['weekly'] as num?)?.round() ?? (dailySavings * 7);
    final monthlySavings = (widget.savings['monthly'] as num?)?.round() ?? (dailySavings * 30);
    final dailyKwh = (widget.savings['dailyKWh'] as num?)?.toDouble() ?? 621.4;

    // Use sources passed from engine or fallback defaults
    final sourceList = widget.sources.isNotEmpty
        ? widget.sources
        : [
            LiveSourceItem(id: 'src-1', name: 'Grid Utility', type: 'Grid', capacity: liveGrid),
            LiveSourceItem(id: 'src-2', name: 'Solar Rooftop', type: 'Solar', capacity: liveSolar),
            LiveSourceItem(id: 'src-3', name: 'Diesel Generator', type: 'Generator', capacity: liveGen),
            LiveSourceItem(id: 'src-4', name: 'Battery ESS', type: 'Battery', capacity: widget.batteryKw),
          ];

    return Container(
      decoration: BoxDecoration(
        color: isDark ? kEmsCardDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? kEmsBorderDark : kEmsBorder),
        boxShadow: kEmsCardShadow,
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Centered Gradient Header ──
          ShaderMask(
            shaderCallback: (bounds) => const LinearGradient(
              colors: [Color(0xFF8B5CF6), Color(0xFFEC4899), Color(0xFF3B82F6)],
            ).createShader(bounds),
            child: const Text(
              'Energy Flow Overview',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w900,
                color: Colors.white,
                letterSpacing: -0.4,
              ),
            ),
          ),
          const SizedBox(height: 12),

          // ── Top Bar: Live Clock & Today\'s Savings Pill ──
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Live Clock
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: isDark ? kEmsBgDark : kEmsSurfaceAlt,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: isDark ? kEmsBorderDark : kEmsBorder),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.schedule, size: 14, color: kEmsPrimary),
                    const SizedBox(width: 6),
                    Text(
                      _formatTime(_currentTime),
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: isDark ? kEmsTextMainDark : kEmsTextMain,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      width: 6,
                      height: 6,
                      decoration: const BoxDecoration(
                        color: Color(0xFF22C55E),
                        shape: BoxShape.circle,
                      ),
                    ),
                  ],
                ),
              ),

              // Today\'s Savings Button (matches D:\embed dashboard working PowerFlowMindMap.jsx)
              InkWell(
                onTap: () => setState(() => _savingsOpen = !_savingsOpen),
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF4F46E5), Color(0xFF7C3AED), Color(0xFF9333EA)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF7C3AED).withValues(alpha: 0.35),
                        blurRadius: 8,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.savings_outlined, color: Colors.white, size: 15),
                      const SizedBox(width: 8),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Text(
                            "TODAY'S SAVINGS",
                            style: TextStyle(
                              color: Colors.white70,
                              fontSize: 8,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.5,
                            ),
                          ),
                          Text(
                            _formatPKR(dailySavings),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 12,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(width: 6),
                      Icon(
                        _savingsOpen ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                        color: Colors.white70,
                        size: 16,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),

          // ── Expandable Savings Panel (matches PowerFlowMindMap.jsx) ──
          if (_savingsOpen) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1E1B4B) : const Color(0xFFEEF2FF),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFF818CF8).withValues(alpha: 0.4)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'SAVINGS REPORTS',
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFF6366F1), letterSpacing: 0.8),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFF6366F1).withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          '~$dailyKwh kWh/day offset @ PKR 28/kWh',
                          style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: isDark ? Colors.white70 : const Color(0xFF4338CA)),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: isDark ? kEmsCardDark : Colors.white,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: isDark ? kEmsBorderDark : kEmsBorder),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('WEEKLY SAVINGS', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: isDark ? kEmsTextMutedDark : kEmsTextMuted)),
                              const SizedBox(height: 2),
                              Text(_formatPKR(weeklySavings), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF6366F1))),
                              const SizedBox(height: 2),
                              Text('${(dailyKwh * 7).toStringAsFixed(1)} kWh offset / wk', style: TextStyle(fontSize: 8.5, color: isDark ? kEmsTextMutedDark : kEmsTextMuted)),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: isDark ? kEmsCardDark : Colors.white,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: isDark ? kEmsBorderDark : kEmsBorder),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('MONTHLY SAVINGS', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: isDark ? kEmsTextMutedDark : kEmsTextMuted)),
                              const SizedBox(height: 2),
                              Text(_formatPKR(monthlySavings), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF9333EA))),
                              const SizedBox(height: 2),
                              Text('${(dailyKwh * 30).toStringAsFixed(1)} kWh offset / mo', style: TextStyle(fontSize: 8.5, color: isDark ? kEmsTextMutedDark : kEmsTextMuted)),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 20),

          // ── LEVEL 1: SOURCES (Live cards from PowerFlowMindMap.jsx) ──
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 12,
            runSpacing: 10,
            children: [
              for (final s in sourceList) ...[
                Builder(builder: (context) {
                  final meta = _metaForSourceType(s.type);
                  final fromCol = meta['from'] as Color;
                  final toCol = meta['to'] as Color;
                  final icon = meta['icon'] as IconData;

                  // Read live value for source
                  double displayVal = s.capacity;
                  if (s.type.toLowerCase() == 'grid') displayVal = liveGrid;
                  if (s.type.toLowerCase() == 'solar') displayVal = liveSolar;
                  if (s.type.toLowerCase() == 'generator') displayVal = liveGen;

                  return InkWell(
                    onTap: () => _showEditSourceDialog(s),
                    borderRadius: BorderRadius.circular(16),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(colors: [fromCol, toCol], begin: Alignment.topLeft, end: Alignment.bottomRight),
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(color: toCol.withValues(alpha: 0.35), blurRadius: 10, offset: const Offset(0, 3)),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(icon, color: Colors.white, size: 20),
                          const SizedBox(width: 8),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(s.name, style: const TextStyle(color: Colors.white, fontSize: 10.5, fontWeight: FontWeight.w700)),
                              Row(
                                children: [
                                  Text(
                                    '${displayVal.toStringAsFixed(1)} kW',
                                    style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w900),
                                  ),
                                  const SizedBox(width: 4),
                                  const Icon(Icons.edit, color: Colors.white60, size: 10),
                                ],
                              ),
                              if (s.type.toLowerCase() == 'grid')
                                Text(gridMode, style: const TextStyle(color: Colors.white70, fontSize: 8.5, fontWeight: FontWeight.w600)),
                            ],
                          ),
                        ],
                      ),
                    ),
                  );
                }),
              ],
            ],
          ),

          // ── Connector Down ──
          Center(
            child: Container(
              width: 2,
              height: 22,
              color: isDark ? const Color(0xFF334155) : const Color(0xFFCBD5E1),
            ),
          ),

          // ── LEVEL 2: CENTRAL TOTAL ORGANIZATION LOAD HUB ──
          Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF34D399), Color(0xFF0EA5E9)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF0EA5E9).withValues(alpha: 0.45),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.business, color: Colors.white, size: 24),
                  ),
                  const SizedBox(width: 14),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text(
                        'Total Organization Load',
                        style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700),
                      ),
                      Text(
                        '${liveLoad.toStringAsFixed(1)} kW',
                        style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          // ── Connector Down ──
          Center(
            child: Container(
              width: 2,
              height: 22,
              color: isDark ? const Color(0xFF334155) : const Color(0xFFCBD5E1),
            ),
          ),

          // ── LEVEL 3: DEVICE GROUPS (Chips with live loads) ──
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 10,
            runSpacing: 10,
            children: [
              for (final g in widget.groups) ...[
                InkWell(
                  onTap: () => widget.onGroupClick?.call(g['id'].toString()),
                  borderRadius: BorderRadius.circular(14),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: isDark ? kEmsCardDark : Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: isDark ? const Color(0xFF4C1D95).withValues(alpha: 0.5) : const Color(0xFFDDD6FE),
                        width: 2,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF8B5CF6).withValues(alpha: 0.1),
                          blurRadius: 6,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 30,
                          height: 30,
                          decoration: BoxDecoration(
                            color: isDark ? const Color(0xFF2E1065) : const Color(0xFFEDE9FE),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Icon(
                            _iconForGroup(g['name']?.toString() ?? ''),
                            color: const Color(0xFF7C3AED),
                            size: 15,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              g['name']?.toString() ?? '',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                color: isDark ? kEmsTextMainDark : kEmsTextMain,
                              ),
                            ),
                            Text(
                              '${((g['load'] as num?)?.toDouble() ?? 0.0).toStringAsFixed(1)} kW',
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF7C3AED),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 14),

          // ── Bottom Legend ──
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _legendDot(const Color(0xFF3B82F6), 'Sources', isDark),
              const SizedBox(width: 16),
              _legendDot(const Color(0xFF22C55E), 'Load', isDark),
              const SizedBox(width: 16),
              _legendDot(const Color(0xFF8B5CF6), 'Groups', isDark),
            ],
          ),
        ],
      ),
    );
  }

  Widget _legendDot(Color color, String label, bool isDark) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 14, height: 3, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(2))),
        const SizedBox(width: 6),
        Text(
          label,
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w700,
            color: isDark ? kEmsTextMutedDark : kEmsTextMuted,
          ),
        ),
      ],
    );
  }
}
