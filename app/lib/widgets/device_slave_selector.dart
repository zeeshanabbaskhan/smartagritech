import 'package:flutter/material.dart';

import '../app_theme.dart';
import '../services/app_state.dart';

/// Device + slave dropdowns bound to [AppState].
class DeviceSlaveSelector extends StatefulWidget {
  const DeviceSlaveSelector({super.key, this.onChanged});

  final VoidCallback? onChanged;

  @override
  State<DeviceSlaveSelector> createState() => _DeviceSlaveSelectorState();
}

class _DeviceSlaveSelectorState extends State<DeviceSlaveSelector> {
  final _appState = AppState.instance;

  @override
  void initState() {
    super.initState();
    _appState.addListener(_onChange);
    if (_appState.devices.isEmpty) {
      _appState.loadDevices();
    }
  }

  @override
  void dispose() {
    _appState.removeListener(_onChange);
    super.dispose();
  }

  void _onChange() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final devices = _appState.devices;
    final slaves = _appState.configSlaves;

    return Row(
      children: [
        Expanded(
          child: _dropdown(
            label: 'Device',
            value: _appState.selectedDeviceId,
            items: devices
                .map((d) => DropdownMenuItem<String>(
                      value: d['id'] as String?,
                      child: Text(d['name']?.toString() ?? '—',
                          overflow: TextOverflow.ellipsis),
                    ))
                .toList(),
            onChanged: devices.isEmpty
                ? null
                : (id) async {
                    await _appState.selectDevice(id);
                    widget.onChanged?.call();
                  },
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _dropdown(
            label: 'Slave',
            value: _appState.selectedSlaveId,
            items: slaves
                .map((s) => DropdownMenuItem<String>(
                      value: s['id'] as String?,
                      child: Text(s['name']?.toString() ?? '—',
                          overflow: TextOverflow.ellipsis),
                    ))
                .toList(),
            onChanged: slaves.isEmpty
                ? null
                : (id) {
                    _appState.selectSlave(id);
                    widget.onChanged?.call();
                  },
          ),
        ),
      ],
    );
  }

  Widget _dropdown({
    required String label,
    required String? value,
    required List<DropdownMenuItem<String>> items,
    required ValueChanged<String?>? onChanged,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: TextStyle(
                fontSize: 12, color: Colors.grey.shade600, fontWeight: FontWeight.w500)),
        const SizedBox(height: 4),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: Colors.grey.shade300),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              isExpanded: true,
              value: items.any((i) => i.value == value) ? value : null,
              hint: Text(items.isEmpty ? 'No data' : 'Select',
                  style: TextStyle(fontSize: 13, color: Colors.grey.shade500)),
              items: items,
              onChanged: onChanged,
              style: const TextStyle(fontSize: 13, color: kNavy),
            ),
          ),
        ),
      ],
    );
  }
}
