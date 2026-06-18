import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:smartagritechapp/services/cache_service.dart';

void main() {
  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await CacheService.instance.init();
  });

  group('CacheService.setList / getList', () {
    test('round-trips a list of maps', () async {
      final data = [
        {'id': '1', 'name': 'Device A', 'status': 'Online'},
        {'id': '2', 'name': 'Device B', 'status': 'Offline'},
      ];

      await CacheService.instance.setList('test_key', data);
      final result = await CacheService.instance.getList('test_key');

      expect(result, isNotNull);
      expect(result!.length, equals(2));
      expect(result[0]['id'], equals('1'));
      expect(result[0]['name'], equals('Device A'));
      expect(result[1]['status'], equals('Offline'));
    });

    test('returns null when key does not exist', () async {
      final result = await CacheService.instance.getList('nonexistent_key');
      expect(result, isNull);
    });

    test('overwrites existing value on second setList', () async {
      await CacheService.instance.setList('overwrite_key', [
        {'id': 'old'},
      ]);
      await CacheService.instance.setList('overwrite_key', [
        {'id': 'new1'},
        {'id': 'new2'},
      ]);

      final result = await CacheService.instance.getList('overwrite_key');
      expect(result!.length, equals(2));
      expect(result[0]['id'], equals('new1'));
    });

    test('stores and retrieves empty list', () async {
      await CacheService.instance.setList('empty_key', []);
      final result = await CacheService.instance.getList('empty_key');
      expect(result, isNotNull);
      expect(result, isEmpty);
    });
  });

  group('CacheService.setJson / getJson', () {
    test('round-trips a map', () async {
      final data = {'foo': 'bar', 'count': 42, 'nested': true};
      await CacheService.instance.setJson('json_key', data);
      final result = await CacheService.instance.getJson('json_key');

      expect(result, isNotNull);
      expect(result!['foo'], equals('bar'));
      expect(result['count'], equals(42));
      expect(result['nested'], equals(true));
    });

    test('returns null when key does not exist', () async {
      final result = await CacheService.instance.getJson('missing_json');
      expect(result, isNull);
    });
  });

  group('CacheService.clear', () {
    test('removes the stored value so getList returns null', () async {
      await CacheService.instance.setList('clear_key', [
        {'id': 'x'},
      ]);
      await CacheService.instance.clear('clear_key');
      final result = await CacheService.instance.getList('clear_key');
      expect(result, isNull);
    });

    test('clearing a non-existent key does not throw', () async {
      await expectLater(
        CacheService.instance.clear('does_not_exist'),
        completes,
      );
    });
  });

  group('CacheService constants', () {
    test('kDevicesCache has expected value', () {
      expect(kDevicesCache, equals('cache_devices'));
    });

    test('kDashboardPrefix has expected value', () {
      expect(kDashboardPrefix, equals('cache_dashboard_'));
    });
  });
}
