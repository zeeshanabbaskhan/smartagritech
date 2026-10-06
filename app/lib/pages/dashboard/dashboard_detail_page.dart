import 'package:flutter/material.dart';
import '../../app_theme.dart';
import '../../data/ems_mock_data.dart';
import '../../widgets/ems_ui/ems_device_slave_selector.dart';
import '../../widgets/ems_ui/ems_stat_card.dart';
import '../../widgets/ems_ui/ems_filter_chips.dart';
import '../../widgets/ems_ui/ems_button.dart';
import '../../widgets/ems_ui/ems_modal.dart';

class DashboardDetailPage extends StatefulWidget {
  const DashboardDetailPage({super.key});

  @override
  State<DashboardDetailPage> createState() => _DashboardDetailPageState();
}

class _DashboardDetailPageState extends State<DashboardDetailPage> {
  String _selectedRange = 'Today';
  static const List<String> _ranges = ['Today', 'Yesterday', '7 Days', '30 Days'];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Filter Row: Device Selector + Date Range + Export
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: isDark ? kEmsCardDark : Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isDark ? kEmsBorderDark : kEmsBorderLight,
              ),
            ),
            child: Wrap(
              spacing: 12,
              runSpacing: 10,
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                const EmsDeviceSlaveSelector(),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    EmsFilterChips(
                      options: _ranges,
                      selected: _selectedRange,
                      onSelected: (val) => setState(() => _selectedRange = val),
                    ),
                    const SizedBox(width: 8),
                    EmsButton(
                      label: 'Export CSV',
                      icon: Icons.download_outlined,
                      variant: EmsButtonVariant.secondary,
                      onPressed: () {
                        EmsModal.show(
                          context: context,
                          title: 'Export Telemetry Data',
                          confirmLabel: 'Download',
                          content: const Text(
                            'Generate full interval CSV report for this device across the selected timeframe?',
                            style: TextStyle(fontSize: 13),
                          ),
                        );
                      },
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // 4 Summary Stat Cards
          LayoutBuilder(
            builder: (context, constraints) {
              final w = constraints.maxWidth;
              int cols = 4;
              if (w < 600) {
                cols = 1;
              } else if (w < 900) {
                cols = 2;
              }

              final statCards = [
                const EmsStatCard(
                  label: 'Operating Power',
                  value: '124.5 kW',
                  trend: 4.8,
                  icon: Icons.bolt,
                  color: EmsStatColor.primary,
                  sparklineData: [90, 95, 110, 105, 124.5],
                ),
                const EmsStatCard(
                  label: 'Accumulated Energy',
                  value: '48,294 kWh',
                  trend: 2.1,
                  icon: Icons.electric_meter_outlined,
                  color: EmsStatColor.info,
                  sparklineData: [45000, 46200, 47100, 47900, 48294],
                ),
                const EmsStatCard(
                  label: 'Voltage Imbalance',
                  value: '0.84 %',
                  trend: -0.3,
                  icon: Icons.speed,
                  color: EmsStatColor.success,
                  sparklineData: [1.2, 1.1, 0.95, 0.9, 0.84],
                ),
                const EmsStatCard(
                  label: 'Power Factor',
                  value: '0.96 PF',
                  trend: 1.2,
                  icon: Icons.trending_up,
                  color: EmsStatColor.primary,
                  sparklineData: [0.93, 0.94, 0.95, 0.95, 0.96],
                ),
              ];

              return GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: statCards.length,
                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: cols,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  mainAxisExtent: 135,
                ),
                itemBuilder: (ctx, i) => statCards[i],
              );
            },
          ),
          const SizedBox(height: 16),

          // 18 Comprehensive Electrical Telemetry Readout Grid
          Container(
            decoration: BoxDecoration(
              color: isDark ? kEmsCardDark : Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isDark ? kEmsBorderDark : kEmsBorderLight,
              ),
            ),
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Live Electrical Readouts (25 Parameters)',
                      style: TextStyle(
                        color: isDark ? kEmsTextPrimaryDark : kEmsTextPrimaryLight,
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: kEmsSuccess.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.circle, size: 6, color: kEmsSuccess),
                          SizedBox(width: 5),
                          Text(
                            'LIVE TELEMETRY',
                            style: TextStyle(
                              color: kEmsSuccess,
                              fontSize: 9.5,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                LayoutBuilder(
                  builder: (context, constraints) {
                    final w = constraints.maxWidth;
                    int cols = 3;
                    if (w < 500) {
                      cols = 1;
                    } else if (w < 820) {
                      cols = 2;
                    }

                    return GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: EmsMockData.electricalReadouts.length,
                      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: cols,
                        mainAxisSpacing: 10,
                        crossAxisSpacing: 10,
                        mainAxisExtent: 68,
                      ),
                      itemBuilder: (ctx, i) {
                        final item = EmsMockData.electricalReadouts[i];
                        return Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(
                            color: isDark ? kEmsBgDark : kEmsSurface100Light,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: isDark ? kEmsBorderDark : kEmsBorderLight,
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                (item['label'] as String).toUpperCase(),
                                style: const TextStyle(
                                  color: kEmsTextMuted,
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.6,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 3),
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.baseline,
                                textBaseline: TextBaseline.alphabetic,
                                children: [
                                  Text(
                                    item['value'] as String,
                                    style: TextStyle(
                                      color: isDark ? kEmsTextPrimaryDark : kEmsTextPrimaryLight,
                                      fontSize: 16,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                  if ((item['unit'] as String).isNotEmpty) ...[
                                    const SizedBox(width: 4),
                                    Text(
                                      item['unit'] as String,
                                      style: const TextStyle(
                                        color: kEmsTextMuted,
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ],
                          ),
                        );
                      },
                    );
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
