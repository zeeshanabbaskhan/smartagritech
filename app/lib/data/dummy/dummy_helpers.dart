import '../../data/dummy_data.dart';

class DummyHelpers {
  DummyHelpers._();

  static int _idSeq = 1000;
  static String nextId(String prefix) => '$prefix-${_idSeq++}';

  static String iso([DateTime? dt]) => (dt ?? DateTime.now()).toUtc().toIso8601String();

  static Map<String, dynamic> ok(dynamic data, {Map<String, dynamic>? extra}) => {
        'success': true,
        'data': data,
        ...?extra,
      };

  static Map<String, dynamic> paginated(
    List<Map<String, dynamic>> items,
    Map<String, String>? query, {
    Map<String, dynamic>? extra,
  }) {
    final page = int.tryParse(query?['page'] ?? '1') ?? 1;
    final limit = int.tryParse(query?['limit'] ?? '100') ?? 100;
    final start = (page - 1) * limit;
    final end = start + limit > items.length ? items.length : start + limit;
    final slice = start < items.length
        ? items.sublist(start, end)
        : <Map<String, dynamic>>[];
    final pages = items.isEmpty ? 1 : ((items.length + limit - 1) / limit).ceil();
    return {
      'success': true,
      'data': slice.map(_clone).toList(),
      'total': items.length,
      'page': page,
      'pages': pages,
      ...?extra,
    };
  }

  static Map<String, dynamic> clone(Map<String, dynamic> m) => _clone(m);

  static Map<String, dynamic> _clone(Map<String, dynamic> m) =>
      Map<String, dynamic>.from(m);

  static List<Map<String, dynamic>> chartPoints(
    List<double> values, {
    Duration step = const Duration(hours: 1),
  }) {
    final now = DateTime.now().toUtc();
    return List.generate(values.length, (i) {
      final ts = now.subtract(step * (values.length - 1 - i));
      return {'timestamp': ts.toIso8601String(), 'value': values[i]};
    });
  }

  static Map<String, dynamic> dashboardSummary() {
    return {
      'totalPowerConsumption': {
        'value': DummyData.totalPowerKwh,
        'chartData': chartPoints(DummyData.powerConsumptionChart),
      },
      'totalExportPower': {
        'value': DummyData.totalExportKwh,
        'chartData': chartPoints(DummyData.exportPowerChart),
      },
      'voltageImbalance': {
        'value': DummyData.voltageImbalancePct,
        'chartData': chartPoints(DummyData.voltageImbalanceChart, step: const Duration(minutes: 10)),
      },
      'currentImbalance': {
        'value': DummyData.currentImbalanceVal,
        'chartData': chartPoints(DummyData.currentImbalanceChart, step: const Duration(minutes: 10)),
      },
      'powerFactor': {
        'value': DummyData.powerFactorVal,
        'chartData': chartPoints(DummyData.powerFactorChart, step: const Duration(minutes: 10)),
      },
      'thdV': {'value': DummyData.thdV, 'chartData': <Map<String, dynamic>>[]},
      'thdI': {'value': DummyData.thdI, 'chartData': <Map<String, dynamic>>[]},
      'frequency': {'value': DummyData.frequencyHz, 'chartData': <Map<String, dynamic>>[]},
      'anomalies': {
        'count': DummyData.totalAnomalies,
        'breakdown': DummyData.anomalyTypes
            .map((e) => {'type': e['type'], 'count': e['count']})
            .toList(),
        'chartData': chartPoints(
          List<double>.generate(12, (i) => (i % 3 + 2).toDouble()),
          step: const Duration(hours: 2),
        ),
      },
      'energySavingsComparison': {
        'daily': {
          'current': 455.47,
          'previous': 385.77,
          'percentage': DummyData.dailySaving,
        },
        'weekly': {
          'current': 2493.65,
          'previous': 2382.19,
          'percentage': DummyData.weeklySaving,
        },
        'monthly': {
          'current': 9804.43,
          'previous': 2725.22,
          'percentage': DummyData.monthlySaving,
        },
      },
    };
  }

  static Map<String, dynamic> latestReadings() => {
        'VoltageA': {'value': DummyData.voltageA, 'unit': 'V'},
        'VoltageB': {'value': DummyData.voltageB, 'unit': 'V'},
        'VoltageC': {'value': DummyData.voltageC, 'unit': 'V'},
        'CurrentA': {'value': DummyData.currentA, 'unit': 'A'},
        'CurrentB': {'value': DummyData.currentB, 'unit': 'A'},
        'CurrentC': {'value': DummyData.currentC, 'unit': 'A'},
        'ActivePower': {'value': DummyData.activePower, 'unit': 'kW'},
        'ReactivePower': {'value': DummyData.reactivePower, 'unit': 'kVAr'},
        'ApparentPower': {'value': DummyData.apparentPower, 'unit': 'kVA'},
        'PowerConsumption': {'value': DummyData.powerConsumption, 'unit': 'kWh'},
        'ExportPower': {'value': DummyData.exportPower, 'unit': 'kWh'},
        'PowerFactor': {'value': DummyData.powerFactor, 'unit': ''},
        'Frequency': {'value': DummyData.frequency, 'unit': 'Hz'},
        'VoltageImbalance': {'value': DummyData.voltageImbalancePct, 'unit': '%'},
        'CurrentImbalance': {'value': DummyData.currentImbalanceVal, 'unit': '%'},
        'THD_V': {'value': DummyData.thdUa, 'unit': '%'},
        'THD_I': {'value': DummyData.thdIa, 'unit': '%'},
      };

  static List<Map<String, dynamic>> sensorReadings({int count = 30}) {
    final now = DateTime.now().toUtc();
    return List.generate(count, (i) {
      final ts = now.subtract(Duration(minutes: i * 15));
      return {
        'id': 'reading-$i',
        'deviceId': 'dev-1',
        'timestamp': ts.toIso8601String(),
        'readings': [
          {'variableName': 'PowerConsumption', 'value': 18.0 + (i % 5), 'unit': 'kWh'},
          {'variableName': 'PowerFactor', 'value': 0.90 + (i % 3) * 0.01, 'unit': ''},
        ],
      };
    });
  }

  static Map<String, dynamic> voltageAnalysis() => {
        'current': {
          'VoltageA': '${DummyData.voltageA}',
          'VoltageB': '${DummyData.voltageB}',
          'VoltageC': '${DummyData.voltageC}',
          'VoltageImbalance': '${DummyData.aiVoltageImbalance}',
          'THD_V': '${DummyData.thdUa}',
        },
        'chartData': {
          'voltageA': chartPoints(DummyData.voltageOverTime, step: const Duration(hours: 1)),
          'voltageB': chartPoints(DummyData.voltageOverTime.map((v) => v - 1).toList(), step: const Duration(hours: 1)),
          'voltageC': chartPoints(DummyData.voltageOverTime.map((v) => v - 2).toList(), step: const Duration(hours: 1)),
          'voltageImbalance': chartPoints(DummyData.predictedVoltage, step: const Duration(hours: 1)),
          'thdV': chartPoints(List<double>.generate(13, (i) => 0.8 + i * 0.05), step: const Duration(hours: 1)),
        },
        'alarms': DummyData.voltageAnomalies
            .map((a) => {
                  'triggerType': 'overvoltage',
                  'variableName': 'VoltageA',
                  'alarmTime': iso(DateTime.now().subtract(const Duration(hours: 2))),
                })
            .toList(),
      };

  static Map<String, dynamic> currentAnalysis() => {
        'current': {
          'CurrentA': '${DummyData.currentA}',
          'CurrentB': '${DummyData.currentB}',
          'CurrentC': '${DummyData.currentC}',
          'CurrentImbalance': '${DummyData.aiCurrentImbalance}',
          'THD_I': '${DummyData.thdIa}',
        },
        'chartData': {
          'currentA': chartPoints(DummyData.currentOverTime, step: const Duration(hours: 1)),
          'currentB': chartPoints(DummyData.currentOverTime.map((v) => v + 2).toList(), step: const Duration(hours: 1)),
          'currentC': chartPoints(DummyData.currentOverTime.map((v) => v + 5).toList(), step: const Duration(hours: 1)),
          'currentImbalance': chartPoints(DummyData.predictedCurrent, step: const Duration(hours: 1)),
          'thdI': chartPoints(List<double>.generate(13, (i) => 2.0 + i * 0.3), step: const Duration(hours: 1)),
        },
      };

  static Map<String, dynamic> powerFactorAnalysis() => {
        'current': '${DummyData.aiPowerFactor}',
        'chartData': chartPoints(DummyData.powerFactorOverTime, step: const Duration(hours: 1)),
        'alarms': DummyData.powerFactorAnomalies
            .map((a) => {
                  'id': nextId('alm'),
                  'variableName': 'PowerFactor',
                  'triggerType': 'low_power_factor',
                  'alarmTime': iso(DateTime.now().subtract(const Duration(hours: 3))),
                  'currentValue': 0.78,
                  'alarmState': 'ACTIVE',
                  'processState': 'UNPROCESSED',
                })
            .toList(),
        'predictedChart': chartPoints(DummyData.predictedPowerFactor, step: const Duration(hours: 1))
            .map((e) => {'timestamp': e['timestamp'], 'predictedValue': e['value']})
            .toList(),
      };

  static Map<String, dynamic> energyAnalysis() => {
        'totalConsumption': DummyData.aiTotalConsumption,
        'chartData': chartPoints(DummyData.predictedConsumptionChart, step: const Duration(hours: 1)),
        'current': {
          'PowerConsumption': '${DummyData.powerConsumption}',
          'ActivePower': '${DummyData.activePower}',
        },
        'predictedChart': chartPoints(DummyData.predictedConsumptionChart, step: const Duration(hours: 1))
            .map((e) => {'timestamp': e['timestamp'], 'predictedValue': e['value']})
            .toList(),
      };

  static Map<String, dynamic> anomalyTimeline() => {
        'total': DummyData.aiTotalAnomalies,
        'breakdown': [
          {'type': 'overvoltage', 'count': DummyData.aiOvervoltageCount},
          {'type': 'low_power_factor', 'count': DummyData.aiLowPFCount},
          {'type': 'overload', 'count': DummyData.aiOverloadCount},
        ],
        'chartData': chartPoints(
          DummyData.anomaliesTimeline.map((e) => e.toDouble()).toList(),
          step: const Duration(hours: 1),
        ),
      };
}
