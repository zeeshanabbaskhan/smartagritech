import 'package:flutter/material.dart';
import '../../app_theme.dart';
import '../../services/app_state.dart';
import '../../services/ems_api.dart';
import '../../utils/api_mappers.dart';
import '../../utils/device_helpers.dart';
import '../../widgets/device_slave_selector.dart';

class AiAnalyticsPage extends StatefulWidget {
  const AiAnalyticsPage({super.key});

  @override
  State<AiAnalyticsPage> createState() => _AiAnalyticsPageState();
}

class _AiAnalyticsPageState extends State<AiAnalyticsPage> {
  List<Map<String, dynamic>> _variables = [];
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    AppState.instance.addListener(_load);
    if (AppState.instance.devices.isEmpty) AppState.instance.loadDevices();
    _load();
  }

  @override
  void dispose() {
    AppState.instance.removeListener(_load);
    super.dispose();
  }

  Future<void> _load() async {
    final deviceId = AppState.instance.selectedDeviceId;
    if (deviceId == null) {
      setState(() => _variables = []);
      return;
    }
    setState(() => _loading = true);
    try {
      final config = await EmsApi.instance.getDeviceConfig(deviceId);
      setState(() => _variables = DeviceHelpers.flattenVariables(config));
    } catch (_) {
      setState(() => _variables = []);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: const Text('AI Predictions',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: kNavy)),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  DeviceSlaveSelector(onChanged: _load),
                  const SizedBox(height: 16),
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: [
                        BoxShadow(
                            color: kNavy.withValues(alpha: 0.05),
                            blurRadius: 8,
                            offset: const Offset(0, 2)),
                      ],
                    ),
                    child: Column(
                      children: [
                        _tableHeader(['Variable Name', 'Current Value', 'Updated']),
                        if (_loading)
                          const Padding(
                            padding: EdgeInsets.all(24),
                            child: CircularProgressIndicator(color: kNavy),
                          )
                        else if (_variables.isEmpty)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 32),
                            child: Text('No variables configured for this device',
                                style: TextStyle(color: Colors.grey.shade500, fontSize: 13)),
                          )
                        else
                          ..._variables.map((v) => Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Text(v['name']?.toString() ?? '—',
                                          style: const TextStyle(fontSize: 13, color: kNavy)),
                                    ),
                                    Expanded(
                                      child: Text(v['currentValue']?.toString() ?? '—',
                                          style: TextStyle(fontSize: 13, color: Colors.grey.shade700)),
                                    ),
                                    Expanded(
                                      child: Text(
                                        ApiMappers.fmtDate(v['updatedAt']),
                                        style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                                      ),
                                    ),
                                  ],
                                ),
                              )),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _tableHeader(List<String> cols) {
    return Container(
      decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: Colors.grey.shade200))),
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
      child: Row(
        children: cols
            .map((c) => Expanded(
                  child: Text(c,
                      style: const TextStyle(
                          fontSize: 12, fontWeight: FontWeight.w600, color: kNavy)),
                ))
            .toList(),
      ),
    );
  }
}
