import 'package:flutter/material.dart';
import '../../app_theme.dart';
import '../../data/ems_mock_data.dart';
import '../../widgets/ems_ui/ems_badge.dart';
import '../../widgets/ems_ui/ems_stat_card.dart';
import '../../widgets/ems_ui/ems_button.dart';
import '../../widgets/ems_ui/ems_modal.dart';

class EvChargersPage extends StatefulWidget {
  const EvChargersPage({super.key});

  @override
  State<EvChargersPage> createState() => _EvChargersPageState();
}

class _EvChargersPageState extends State<EvChargersPage> {
  late List<Map<String, dynamic>> _chargers;

  @override
  void initState() {
    super.initState();
    _chargers = List<Map<String, dynamic>>.from(EmsMockData.evChargers);
  }

  void _toggleCharging(Map<String, dynamic> charger) {
    final isCharging = charger['status'] == 'Charging';

    EmsModal.show(
      context: context,
      title: isCharging ? 'Stop Charging Session' : 'Initiate Charging',
      confirmLabel: isCharging ? 'Stop Session' : 'Start Session',
      content: Text(
        isCharging
            ? 'Are you sure you want to stop charging on ${charger['stationName']}?'
            : 'Initiate charging cycle on ${charger['stationName']}?',
        style: const TextStyle(fontSize: 13),
      ),
      onConfirm: () {
        setState(() {
          charger['status'] = isCharging ? 'Available' : 'Charging';
          if (!isCharging) {
            charger['vehicle'] = 'Electric Fleet #1';
            charger['soc'] = '45%';
            charger['power'] = '80.0 kW';
            charger['duration'] = '1 min';
          } else {
            charger['vehicle'] = 'None';
            charger['soc'] = '--';
            charger['power'] = '0.0 kW';
            charger['duration'] = '--';
          }
        });
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Stat Highlights
          GridView.count(
            crossAxisCount: MediaQuery.of(context).size.width > 700 ? 3 : 1,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 2.2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            children: const [
              EmsStatCard(
                label: 'Active EV Charging Load',
                value: '130.9 kW',
                sub: '2 Vehicles Connected',
                icon: Icons.electric_car,
                color: EmsStatColor.primary,
              ),
              EmsStatCard(
                label: 'Energy Dispensed Today',
                value: '57.0 kWh',
                sub: 'Avg Session: 38 mins',
                icon: Icons.battery_charging_full,
                color: EmsStatColor.success,
              ),
              EmsStatCard(
                label: 'V2G Export Support',
                value: '18.5 kW',
                sub: 'Bi-directional Grid Support',
                icon: Icons.sync_alt,
                color: EmsStatColor.info,
              ),
            ],
          ),
          const SizedBox(height: 18),

          Text(
            'Live Charging Sessions & Bays',
            style: TextStyle(
              color: isDark ? kEmsTextPrimaryDark : kEmsTextPrimaryLight,
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 12),

          // Chargers Cards
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _chargers.length,
            separatorBuilder: (ctx, i) => const SizedBox(height: 12),
            itemBuilder: (ctx, i) {
              final item = _chargers[i];
              final isCharging = item['status'] == 'Charging';
              final isV2g = item['status'] == 'Discharging (V2G)';

              return Container(
                decoration: BoxDecoration(
                  color: isDark ? kEmsCardDark : Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: isDark ? kEmsBorderDark : kEmsBorderLight),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(isDark ? 0.2 : 0.03),
                      blurRadius: 4,
                      offset: const Offset(0, 1),
                    ),
                  ],
                ),
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Top row
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Icon(
                              Icons.electric_bolt,
                              color: isCharging ? kEmsPrimary : (isV2g ? kEmsInfo : kEmsTextMuted),
                              size: 20,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              item['stationName'] as String,
                              style: TextStyle(
                                color: isDark ? kEmsTextPrimaryDark : kEmsTextPrimaryLight,
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                        EmsBadge(
                          label: item['status'] as String,
                          variant: isCharging
                              ? EmsBadgeVariant.warning
                              : (isV2g ? EmsBadgeVariant.info : EmsBadgeVariant.success),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),

                    // Metrics Strip
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: isDark ? kEmsBgDark : kEmsSurface100Light,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Wrap(
                        spacing: 24,
                        runSpacing: 10,
                        alignment: WrapAlignment.spaceBetween,
                        children: [
                          _chargerParam('VEHICLE', item['vehicle'] as String),
                          _chargerParam('BATTERY SOC', item['soc'] as String),
                          _chargerParam('OUTPUT POWER', item['power'] as String),
                          _chargerParam('DELIVERED', item['deliveredEnergy'] as String),
                          _chargerParam('SESSION TIME', item['duration'] as String),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Controls
                    Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        EmsButton(
                          label: isCharging ? 'Stop Charging' : 'Start Charging',
                          icon: isCharging ? Icons.stop_circle_outlined : Icons.play_circle_outlined,
                          variant: isCharging ? EmsButtonVariant.danger : EmsButtonVariant.primary,
                          onPressed: () => _toggleCharging(item),
                        ),
                      ],
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _chargerParam(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(color: kEmsTextMuted, fontSize: 9.5, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
        ),
      ],
    );
  }
}
