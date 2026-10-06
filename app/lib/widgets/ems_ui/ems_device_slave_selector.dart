import 'package:flutter/material.dart';
import '../../app_theme.dart';
import '../../data/ems_mock_data.dart';

class EmsDeviceSlaveSelector extends StatefulWidget {
  final String? initialDeviceId;
  final String? initialSlaveId;
  final ValueChanged<String>? onDeviceChanged;
  final ValueChanged<String>? onSlaveChanged;

  const EmsDeviceSlaveSelector({
    super.key,
    this.initialDeviceId,
    this.initialSlaveId,
    this.onDeviceChanged,
    this.onSlaveChanged,
  });

  @override
  State<EmsDeviceSlaveSelector> createState() => _EmsDeviceSlaveSelectorState();
}

class _EmsDeviceSlaveSelectorState extends State<EmsDeviceSlaveSelector> {
  late String _selectedDeviceId;
  late String _selectedSlaveId;

  @override
  void initState() {
    super.initState();
    _selectedDeviceId = widget.initialDeviceId ?? EmsMockData.devices.first['id'];
    _selectedSlaveId = widget.initialSlaveId ?? EmsMockData.slaves.first['id'];
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final deviceSlaves = EmsMockData.slaves
        .where((s) => s['deviceId'] == _selectedDeviceId)
        .toList();
    final availableSlaves = deviceSlaves.isNotEmpty ? deviceSlaves : EmsMockData.slaves;

    return Wrap(
      spacing: 10,
      runSpacing: 8,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        // Device Selector Dropdown
        Container(
          height: 38,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          decoration: BoxDecoration(
            color: isDark ? kEmsCardDark : Colors.white,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: isDark ? kEmsBorderDark : kEmsBorderLightDarker,
              width: 1,
            ),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: _selectedDeviceId,
              icon: const Icon(Icons.arrow_drop_down, size: 18, color: kEmsTextMuted),
              style: TextStyle(
                color: isDark ? kEmsTextPrimaryDark : kEmsTextPrimaryLight,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
              dropdownColor: isDark ? kEmsSidebarBg : Colors.white,
              onChanged: (newId) {
                if (newId != null) {
                  setState(() {
                    _selectedDeviceId = newId;
                    final match = EmsMockData.slaves.where((s) => s['deviceId'] == newId);
                    if (match.isNotEmpty) {
                      _selectedSlaveId = match.first['id'];
                    }
                  });
                  widget.onDeviceChanged?.call(newId);
                }
              },
              items: EmsMockData.devices.map((d) {
                final isOnline = d['status'] == 'Online';
                return DropdownMenuItem<String>(
                  value: d['id'] as String,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 7,
                        height: 7,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: isOnline ? kEmsSuccess : kEmsDanger,
                        ),
                      ),
                      const SizedBox(width: 7),
                      Text(
                        '${d['name']} (${d['status']})',
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
        ),

        // Slave Selector Dropdown
        Container(
          height: 38,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          decoration: BoxDecoration(
            color: isDark ? kEmsCardDark : Colors.white,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: isDark ? kEmsBorderDark : kEmsBorderLightDarker,
              width: 1,
            ),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: availableSlaves.any((s) => s['id'] == _selectedSlaveId)
                  ? _selectedSlaveId
                  : availableSlaves.first['id'],
              icon: const Icon(Icons.arrow_drop_down, size: 18, color: kEmsTextMuted),
              style: TextStyle(
                color: isDark ? kEmsTextPrimaryDark : kEmsTextPrimaryLight,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
              dropdownColor: isDark ? kEmsSidebarBg : Colors.white,
              onChanged: (newSlave) {
                if (newSlave != null) {
                  setState(() => _selectedSlaveId = newSlave);
                  widget.onSlaveChanged?.call(newSlave);
                }
              },
              items: availableSlaves.map((s) {
                return DropdownMenuItem<String>(
                  value: s['id'] as String,
                  child: Text(
                    s['name'] as String,
                    overflow: TextOverflow.ellipsis,
                  ),
                );
              }).toList(),
            ),
          ),
        ),
      ],
    );
  }
}
