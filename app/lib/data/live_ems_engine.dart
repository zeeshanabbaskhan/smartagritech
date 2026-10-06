import 'dart:math';

/// Device model replicating D:\embed dashboard working\src\data\dummy.js
class LiveDeviceItem {
  final int id;
  String status; // 'Online' | 'Offline'
  final String name;
  final String org;
  final String gateway;
  final String template;
  bool switchOn;
  final String? deviceType;

  LiveDeviceItem({
    required this.id,
    required this.status,
    required this.name,
    required this.org,
    required this.gateway,
    required this.template,
    required this.switchOn,
    this.deviceType = 'ems',
  });

  Map<String, dynamic> toMap() => {
        'id': id,
        'status': status,
        'name': name,
        'org': org,
        'gateway': gateway,
        'template': template,
        'switchOn': switchOn,
        'deviceType': deviceType,
      };
}

/// Source item for Power Flow Mind Map
class LiveSourceItem {
  final String id;
  final String name;
  final String type; // 'Grid' | 'Solar' | 'Generator' | 'Battery' | 'Other'
  double capacity;
  bool overridden;

  LiveSourceItem({
    required this.id,
    required this.name,
    required this.type,
    required this.capacity,
    this.overridden = false,
  });
}

/// Device Group for Mind Map & Charts
class LiveDeviceGroup {
  final String id;
  final String name;
  final String org;
  final List<int> deviceIds;

  const LiveDeviceGroup({
    required this.id,
    required this.name,
    required this.org,
    required this.deviceIds,
  });
}

/// Access Group for KPI Filter dropdown
class LiveAccessGroup {
  final int id;
  final String name;
  final String org;
  final List<int> deviceIds;
  final String createdBy;

  const LiveAccessGroup({
    required this.id,
    required this.name,
    required this.org,
    required this.deviceIds,
    required this.createdBy,
  });
}

class SourceSeriesPoint {
  final String time;
  final double solar;
  final double generator;
  final double grid;
  final double load;

  const SourceSeriesPoint({
    required this.time,
    required this.solar,
    required this.generator,
    required this.grid,
    required this.load,
  });
}

/// Central Engine providing live dynamic calculations exactly as in D:\embed dashboard working
class LiveEmsEngine {
  LiveEmsEngine._() {
    _initDevices();
    _initSources();
  }
  static final LiveEmsEngine instance = LiveEmsEngine._();

  late List<LiveDeviceItem> devices;
  late List<LiveSourceItem> sources;

  final List<Map<String, dynamic>> historicalData = const [
    {'time': '00:00', 'voltageA': 224, 'voltageB': 222, 'voltageC': 226, 'currentA': 12.1, 'power': 8200},
    {'time': '02:00', 'voltageA': 225, 'voltageB': 223, 'voltageC': 225, 'currentA': 11.8, 'power': 7900},
    {'time': '04:00', 'voltageA': 223, 'voltageB': 221, 'voltageC': 224, 'currentA': 10.5, 'power': 7100},
    {'time': '06:00', 'voltageA': 226, 'voltageB': 224, 'voltageC': 227, 'currentA': 13.2, 'power': 8900},
    {'time': '08:00', 'voltageA': 228, 'voltageB': 226, 'voltageC': 229, 'currentA': 18.5, 'power': 12400},
    {'time': '10:00', 'voltageA': 230, 'voltageB': 228, 'voltageC': 231, 'currentA': 22.1, 'power': 14800},
    {'time': '12:00', 'voltageA': 231, 'voltageB': 229, 'voltageC': 232, 'currentA': 24.3, 'power': 16100},
    {'time': '14:00', 'voltageA': 229, 'voltageB': 227, 'voltageC': 230, 'currentA': 23.8, 'power': 15700},
    {'time': '16:00', 'voltageA': 227, 'voltageB': 225, 'voltageC': 228, 'currentA': 21.2, 'power': 14200},
    {'time': '18:00', 'voltageA': 225, 'voltageB': 223, 'voltageC': 226, 'currentA': 19.5, 'power': 13100},
    {'time': '20:00', 'voltageA': 224, 'voltageB': 222, 'voltageC': 225, 'currentA': 16.8, 'power': 11200},
    {'time': '22:00', 'voltageA': 223, 'voltageB': 221, 'voltageC': 224, 'currentA': 14.1, 'power': 9500},
  ];

  final List<LiveAccessGroup> accessGroups = const [
    LiveAccessGroup(id: 1, name: 'CF Panel Group', org: 'Ambition', deviceIds: [2, 4, 7], createdBy: 'admin'),
    LiveAccessGroup(id: 2, name: 'AFL Production Floor', org: 'Ambition', deviceIds: [100, 101, 102, 108, 117], createdBy: 'org'),
    LiveAccessGroup(id: 3, name: 'AFL Utilities & Solar', org: 'Ambition', deviceIds: [112, 119, 127, 133, 134], createdBy: 'org'),
    LiveAccessGroup(id: 4, name: 'Delicia Cold Storage', org: 'Delicia Warehouse', deviceIds: [1], createdBy: 'org'),
    LiveAccessGroup(id: 5, name: 'FICO Industrial', org: 'FICO', deviceIds: [3], createdBy: 'admin'),
  ];

  final List<LiveDeviceGroup> deviceGroups = const [
    LiveDeviceGroup(id: 'grp-1', name: 'Compressors All', org: 'Ambition', deviceIds: [108, 109, 127]),
    LiveDeviceGroup(id: 'grp-2', name: 'SEWING ALL', org: 'Ambition', deviceIds: [101, 102]),
    LiveDeviceGroup(id: 'grp-3', name: 'FINSHING All', org: 'Ambition', deviceIds: [121]),
    LiveDeviceGroup(id: 'grp-4', name: 'Solar', org: 'Ambition', deviceIds: [112, 133, 134]),
    LiveDeviceGroup(id: 'grp-5', name: 'spray booth', org: 'Ambition', deviceIds: [105, 106, 107]),
    LiveDeviceGroup(id: 'grp-6', name: 'DRYER HALL', org: 'Ambition', deviceIds: [117, 125]),
    LiveDeviceGroup(id: 'grp-7', name: 'Boiler', org: 'Ambition', deviceIds: [119]),
    LiveDeviceGroup(id: 'grp-8', name: 'LAUNDRY TOTAL', org: 'Ambition', deviceIds: [117]),
    LiveDeviceGroup(id: 'grp-9', name: 'Office', org: 'Ambition', deviceIds: [104, 118, 126]),
  ];

  void _initDevices() {
    devices = [
      LiveDeviceItem(id: 2, status: 'Online', name: 'CF Smart Panel', org: 'Ambition', gateway: 'CF-GW-001', template: 'CF Smart Main Panel', switchOn: true),
      LiveDeviceItem(id: 4, status: 'Online', name: 'PV Genset Sync', org: 'Ambition', gateway: 'CF-GW-001', template: 'PV GENSET SYNC', switchOn: true),
      LiveDeviceItem(id: 7, status: 'Online', name: 'Imran House Main', org: 'Ambition', gateway: 'CF-GW-001', template: "IMRAN's HOUSE", switchOn: true),
      LiveDeviceItem(id: 100, status: 'Online', name: 'AFL B - Ground Floor DB', org: 'Ambition', gateway: 'AFL-GW-BSIDE', template: '200A TP MCCB B-Side Breaker', switchOn: true),
      LiveDeviceItem(id: 101, status: 'Online', name: 'AFL B - First Floor DB', org: 'Ambition', gateway: 'AFL-GW-BSIDE', template: '630A TP MCCB B-Side Breaker', switchOn: true),
      LiveDeviceItem(id: 102, status: 'Online', name: 'AFL B - Second Floor DB', org: 'Ambition', gateway: 'AFL-GW-BSIDE', template: '630A TP MCCB B-Side Breaker', switchOn: true),
      LiveDeviceItem(id: 104, status: 'Online', name: 'AFL B - Offices DB', org: 'Ambition', gateway: 'AFL-GW-BSIDE', template: '63A TP MCCB B-Side Breaker', switchOn: true),
      LiveDeviceItem(id: 105, status: 'Online', name: 'AFL B - Spray Booth 01', org: 'Ambition', gateway: 'AFL-GW-BSIDE', template: '63A TP MCCB B-Side Breaker', switchOn: true),
      LiveDeviceItem(id: 106, status: 'Online', name: 'AFL B - Spray Booth 02', org: 'Ambition', gateway: 'AFL-GW-BSIDE', template: '63A TP MCCB B-Side Breaker', switchOn: true),
      LiveDeviceItem(id: 108, status: 'Online', name: 'AFL B - Compressor 132kW', org: 'Ambition', gateway: 'AFL-GW-BSIDE', template: '160A TP MCCB B-Side Breaker', switchOn: true),
      LiveDeviceItem(id: 109, status: 'Online', name: 'AFL B - Compressor 55kW', org: 'Ambition', gateway: 'AFL-GW-BSIDE', template: '160A TP MCCB B-Side Breaker', switchOn: true),
      LiveDeviceItem(id: 112, status: 'Online', name: 'AFL B - Solar', org: 'Ambition', gateway: 'AFL-GW-BSIDE', template: '400A TP MCCB B-Side Breaker', switchOn: true),
      LiveDeviceItem(id: 115, status: 'Offline', name: 'AFL B - Spare', org: 'Ambition', gateway: 'AFL-GW-BSIDE', template: '100A TP MCCB B-Side Breaker', switchOn: false),
      LiveDeviceItem(id: 117, status: 'Online', name: 'AFL Main - G.F Washing Main Panels', org: 'Ambition', gateway: 'AFL-GW-MAIN', template: 'MCCB 1600A (CT: 1600/5A)', switchOn: true),
      LiveDeviceItem(id: 118, status: 'Online', name: 'AFL Main - G.F Main DB Offices Control', org: 'Ambition', gateway: 'AFL-GW-MAIN', template: 'MCCB 250A (CT: 250/5A)', switchOn: true),
      LiveDeviceItem(id: 119, status: 'Online', name: 'AFL Main - G.F Boiler Main-DB', org: 'Ambition', gateway: 'AFL-GW-MAIN', template: 'MCCB 680A (CT: 800/5)', switchOn: true),
      LiveDeviceItem(id: 121, status: 'Online', name: 'AFL Main - S.F Main-DB Finishing', org: 'Ambition', gateway: 'AFL-GW-MAIN', template: 'MCCB 400A (CT: 400/5)', switchOn: true),
      LiveDeviceItem(id: 127, status: 'Online', name: 'AFL Main - G.F main Compressor', org: 'Ambition', gateway: 'AFL-GW-MAIN', template: 'MCCB 630A (CT: 800/5)', switchOn: true),
      LiveDeviceItem(id: 133, status: 'Online', name: 'AFL Main - Solar Inverter 04', org: 'Ambition', gateway: 'AFL-GW-MAIN', template: 'Breaker Feed 250A (CT: 250/5)', switchOn: true),
      LiveDeviceItem(id: 134, status: 'Online', name: 'AFL Main - Solar Inverter 05', org: 'Ambition', gateway: 'AFL-GW-MAIN', template: 'Breaker Feed 250A (CT: 250/5)', switchOn: true),
      LiveDeviceItem(id: 136, status: 'Online', name: 'AFL Main - Main', org: 'Ambition', gateway: 'AFL-GW-MAIN', template: 'ACB 2500A (CT: 2500/5)', switchOn: true),
      LiveDeviceItem(id: 137, status: 'Online', name: 'AFL Main - G1', org: 'Ambition', gateway: 'AFL-GW-MAIN', template: 'ACB 1250A (CT: 1250/5)', switchOn: true),
      LiveDeviceItem(id: 138, status: 'Online', name: 'AFL Main - G2', org: 'Ambition', gateway: 'AFL-GW-MAIN', template: 'ACB 1250A (CT: 1250/5)', switchOn: true),
      // Other org devices
      LiveDeviceItem(id: 1, status: 'Online', name: 'Main Wapda', org: 'Delicia Warehouse', gateway: 'DELI-GW-001', template: 'DELICIA WAREHOUSE', switchOn: true),
      LiveDeviceItem(id: 3, status: 'Offline', name: 'Fico Furnace 1', org: 'FICO', gateway: 'FICO-GW-001', template: 'Fico Furnace', switchOn: false),
      LiveDeviceItem(id: 5, status: 'Offline', name: 'EMS Panel', org: 'NUST', gateway: 'NUST-GW-001', template: 'EMS PANEL', switchOn: false),
    ];
  }

  void _initSources() {
    sources = [
      LiveSourceItem(id: 'src-1', name: 'Grid Utility', type: 'Grid', capacity: 575.8),
      LiveSourceItem(id: 'src-2', name: 'Solar Rooftop', type: 'Solar', capacity: 72.4),
      LiveSourceItem(id: 'src-3', name: 'Diesel Generator', type: 'Generator', capacity: 0.0),
      LiveSourceItem(id: 'src-4', name: 'Battery ESS', type: 'Battery', capacity: 24.0),
    ];
  }

  void toggleDeviceSwitch(int deviceId) {
    final dev = devices.firstWhere((d) => d.id == deviceId, orElse: () => devices.first);
    dev.switchOn = !dev.switchOn;
    dev.status = dev.switchOn ? 'Online' : 'Offline';
  }

  String getLiveTelemetry(String deviceName, String metricKey, bool isOffline, int tick) {
    if (isOffline) {
      if (metricKey == 'status') return 'Offline';
      return '0.0';
    }
    final codeSum = deviceName.codeUnits.fold(0, (acc, c) => acc + c);
    final seed = codeSum + tick * 7.3;
    final rand = (sin(seed) + 1.0) / 2.0;

    switch (metricKey) {
      case 'power':
        return (rand * 100.0 + 10.0).toStringAsFixed(1);
      case 'voltage':
        return (218.0 + rand * 22.0).toStringAsFixed(1);
      case 'current':
        return (6.0 + rand * 64.0).toStringAsFixed(1);
      case 'pf':
        return (0.85 + rand * 0.14).toStringAsFixed(2);
      case 'consumption':
        return (DateTime.now().hour * 9.0 + rand * 8.0 + 25.0).toStringAsFixed(1);
      case 'status':
        return 'Online';
      default:
        return '0.0';
    }
  }

  double getLiveTelemetryNum(String deviceName, String metricKey, bool isOffline, int tick) {
    if (isOffline) return 0.0;
    final codeSum = deviceName.codeUnits.fold(0, (acc, c) => acc + c);
    final seed = codeSum + tick * 7.3;
    final rand = (sin(seed) + 1.0) / 2.0;
    switch (metricKey) {
      case 'power':
        return rand * 100.0 + 10.0;
      case 'voltage':
        return 218.0 + rand * 22.0;
      case 'current':
        return 6.0 + rand * 64.0;
      case 'pf':
        return 0.85 + rand * 0.14;
      default:
        return 0.0;
    }
  }

  Map<String, dynamic> computeKpiValues(List<LiveDeviceItem> activeDevices, int tick) {
    final online = activeDevices.where((d) => d.status == 'Online' && d.switchOn).toList();
    double totalPower = 0.0;
    double totalCurrent = 0.0;
    double sumVoltage = 0.0;
    double sumPf = 0.0;

    for (final d in online) {
      totalPower += getLiveTelemetryNum(d.name, 'power', false, tick);
      totalCurrent += getLiveTelemetryNum(d.name, 'current', false, tick);
      sumVoltage += getLiveTelemetryNum(d.name, 'voltage', false, tick);
      sumPf += getLiveTelemetryNum(d.name, 'pf', false, tick);
    }

    final avgVoltage = online.isNotEmpty ? (sumVoltage / online.length) : 0.0;
    final avgPf = online.isNotEmpty ? (sumPf / online.length) : 0.0;

    return {
      'totalPower': totalPower,
      'totalCurrent': totalCurrent,
      'avgVoltage': avgVoltage,
      'avgPF': avgPf,
      'onlineCount': online.length,
      'totalCount': activeDevices.length,
    };
  }

  Map<String, dynamic> computePowerFlow(String orgName, double totalPower, int tick) {
    final codeSum = orgName.codeUnits.fold(0, (acc, c) => acc + c);
    final hour = DateTime.now().hour;
    final daylight = max(0.0, sin(((hour - 6.0) / 12.0) * pi));
    final rand = (sin(codeSum + tick * 4.1) + 1.0) / 2.0;
    final solar = double.parse((daylight * (totalPower * 0.6 + rand * 3.0)).toStringAsFixed(1));
    final generator = tick % 9 == 0 ? double.parse((rand * 2.0).toStringAsFixed(1)) : 0.0;
    final net = double.parse((totalPower - solar - generator).toStringAsFixed(1));

    return {
      'solar': solar,
      'generator': generator,
      'grid': net.abs(),
      'gridMode': net >= 0 ? 'Importing' : 'Exporting',
      'load': totalPower,
    };
  }

  List<SourceSeriesPoint> buildSourceSeries(String orgName) {
    final codeSum = orgName.codeUnits.fold(0, (acc, c) => acc + c);
    return List.generate(historicalData.length, (i) {
      final row = historicalData[i];
      final hour = i * 2;
      final daylight = max(0.0, sin(((hour - 6.0) / 12.0) * pi));
      final solar = max(0.0, daylight * (6 + (codeSum % 5)) * (0.85 + 0.3 * sin(codeSum + i)));
      final generator = i % 5 == 0 ? ((codeSum % 3) * 0.4) : 0.0;
      final load = (row['power'] as num) / 1000.0;
      final grid = max(0.0, load - solar - generator);
      return SourceSeriesPoint(
        time: row['time'] as String,
        solar: double.parse(solar.toStringAsFixed(2)),
        generator: double.parse(generator.toStringAsFixed(2)),
        grid: double.parse(grid.toStringAsFixed(2)),
        load: double.parse(load.toStringAsFixed(2)),
      );
    });
  }

  List<Map<String, dynamic>> buildDeviceGroupSeries(List<Map<String, dynamic>> groupsWithLoad) {
    return List.generate(historicalData.length, (i) {
      final row = historicalData[i];
      final hour = i * 2;
      final entry = <String, dynamic>{'time': row['time']};
      for (final g in groupsWithLoad) {
        final gId = g['id'].toString();
        final gName = (g['name'] ?? '').toString();
        final seed = gName.codeUnits.fold(0, (acc, c) => acc + c);
        final dayCurve = 0.55 + 0.45 * sin(((hour - 6.0) / 12.0) * pi + (seed % 6));
        final base = max(0.4, (g['load'] as num?)?.toDouble() ?? 0.4);
        entry[gId] = double.parse(max(0.0, base * (0.35 + dayCurve * 0.9)).toStringAsFixed(2));
      }
      return entry;
    });
  }

  Map<String, dynamic> computeSavings(List<SourceSeriesPoint> sourceSeries) {
    const tariffPkrPerKwh = 28.0;
    const sampleIntervalHours = 2.0;
    final dailyOffsetKwh = sourceSeries.fold(
      0.0,
      (sum, row) => sum + (row.solar + row.generator) * sampleIntervalHours,
    );
    return {
      'dailyKWh': double.parse(dailyOffsetKwh.toStringAsFixed(1)),
      'daily': (dailyOffsetKwh * tariffPkrPerKwh).round(),
      'weekly': (dailyOffsetKwh * 7 * tariffPkrPerKwh).round(),
      'monthly': (dailyOffsetKwh * 30 * tariffPkrPerKwh).round(),
    };
  }
}
