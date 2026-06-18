import 'package:socket_io_client/socket_io_client.dart' as io;

import '../config/api_config.dart';
import 'app_state.dart';
import 'local_notification_service.dart';

class SocketService {
  SocketService._();
  static final SocketService instance = SocketService._();

  io.Socket? _socket;

  String get _serverUrl {
    return ApiConfig.baseUrl.replaceAll('/api', '');
  }

  void connect(String token) {
    if (_socket != null && _socket!.connected) return;

    final transports = ['websocket'];

    _socket = io.io(
      _serverUrl,
      io.OptionBuilder()
          .setTransports(transports)
          .disableAutoConnect()
          .setAuth({'token': token})
          .build(),
    );

    _socket!.connect();

    _socket!.onConnect((_) {
      _joinOrgRoom();
      _joinSelectedDevice();
    });

    _socket!.on('reading:new', (data) {
      if (data is Map<String, dynamic>) {
        AppState.instance.onLiveReading(data);
      } else if (data is Map) {
        AppState.instance.onLiveReading(Map<String, dynamic>.from(data));
      }
    });

    _socket!.on('alarm:new', (data) {
      final Map<String, dynamic> alarm;
      if (data is Map<String, dynamic>) {
        alarm = data;
      } else if (data is Map) {
        alarm = Map<String, dynamic>.from(data);
      } else {
        return;
      }
      AppState.instance.onLiveAlarm(alarm);
      LocalNotificationService.instance.showAlarmNotification(
        title: alarm['triggerName']?.toString() ?? 'New Alarm',
        body: alarm['description']?.toString() ?? 'A new alarm was triggered.',
      );
    });

    _socket!.on('device:switch', (data) {
      if (data is Map<String, dynamic>) {
        AppState.instance.onDeviceSwitch(data);
      } else if (data is Map) {
        AppState.instance.onDeviceSwitch(Map<String, dynamic>.from(data));
      }
    });

    _socket!.onDisconnect((_) {
      // Socket.IO client handles auto-reconnect internally
    });
  }

  void _joinOrgRoom() {
    _socket?.emit('join:org');
  }

  void _joinSelectedDevice() {
    final deviceId = AppState.instance.selectedDeviceId;
    if (deviceId != null) {
      _socket?.emit('join:device', deviceId);
    }
  }

  /// Call when the user switches devices so socket joins the device room (P-29).
  void subscribeDevice(String deviceId) {
    _socket?.emit('join:device', deviceId);
  }

  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
  }
}
