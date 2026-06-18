import 'package:flutter_test/flutter_test.dart';
import 'package:smartagritechapp/utils/api_mappers.dart';

void main() {
  group('ApiMappers.device', () {
    test('maps basic fields correctly', () {
      final raw = {
        'id': 'abc12345-0000-0000-0000-000000000000',
        'name': 'Main Panel',
        'status': 'ONLINE',
        'switchState': 'ON',
        'gateway': {'name': 'GW-01', 'model': '192.168.1.1'},
        'template': {'name': 'EMS Template'},
        'organization': {'name': 'Acme Corp'},
        'lastDataReceivedAt': '2024-01-15T10:30:00.000Z',
        'gatewayId': 'gw-id-1',
        'templateId': 'tmpl-id-1',
      };

      final result = ApiMappers.device(raw);

      expect(result['id'], equals('abc12345-0000-0000-0000-000000000000'));
      expect(result['name'], equals('Main Panel'));
      expect(result['status'], equals('Online'));
      expect(result['gateway'], equals('GW-01'));
      expect(result['template'], equals('EMS Template'));
      expect(result['org'], equals('Acme Corp'));
      expect(result['switchState'], equals('ON'));
      expect(result['ipAddress'], equals('192.168.1.1'));
      expect(result['serialNo'], equals('ABC12345'));
      expect(result['powerKwh'], equals(0.0));
      expect(result['anomalies'], equals(0));
    });

    test('handles missing optional fields with defaults', () {
      final raw = {
        'id': 'ffffffff-0000-0000-0000-000000000000',
        'name': null,
        'status': 'OFFLINE',
      };

      final result = ApiMappers.device(raw);

      expect(result['name'], equals('—'));
      expect(result['status'], equals('Offline'));
      expect(result['gateway'], equals('—'));
      expect(result['template'], equals('—'));
      expect(result['org'], equals('—'));
      expect(result['switchState'], equals('OFF'));
      expect(result['powerFactor'], equals('—'));
    });

    test('serialNo is first 8 chars of id uppercased', () {
      final raw = {'id': 'abcdef12-rest', 'status': 'ONLINE'};
      final result = ApiMappers.device(raw);
      expect(result['serialNo'], equals('ABCDEF12'));
    });

    test('preserves raw field', () {
      final raw = {'id': 'x', 'status': 'ONLINE', 'extra': 'data'};
      final result = ApiMappers.device(raw);
      expect(result['raw'], equals(raw));
    });
  });

  group('ApiMappers.chartValues', () {
    test('returns empty list for null input', () {
      expect(ApiMappers.chartValues(null), isEmpty);
    });

    test('returns empty list for empty input', () {
      expect(ApiMappers.chartValues([]), isEmpty);
    });

    test('extracts numeric values from list of maps', () {
      final points = [
        {'value': 10.5},
        {'value': 20},
        {'value': '30.0'},
      ];
      final result = ApiMappers.chartValues(points);
      expect(result, equals([10.5, 20.0, 30.0]));
    });

    test('falls back to predictedValue when value is absent', () {
      final points = [
        {'predictedValue': 42.0},
        {'predictedValue': 55},
      ];
      final result = ApiMappers.chartValues(points);
      expect(result, equals([42.0, 55.0]));
    });

    test('uses custom valueKey', () {
      final points = [
        {'avg': 100.0},
        {'avg': 200.0},
      ];
      final result = ApiMappers.chartValues(points, valueKey: 'avg');
      expect(result, equals([100.0, 200.0]));
    });

    test('handles raw numeric entries (non-map)', () {
      final points = [1.0, 2.5, 3.0];
      final result = ApiMappers.chartValues(points);
      expect(result, equals([1.0, 2.5, 3.0]));
    });

    test('returns 0.0 for unparseable values', () {
      final points = [
        {'value': 'not-a-number'},
      ];
      final result = ApiMappers.chartValues(points);
      expect(result, equals([0.0]));
    });
  });
}
