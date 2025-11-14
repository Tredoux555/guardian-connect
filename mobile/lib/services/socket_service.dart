import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SocketService {
  static IO.Socket? _socket;
  static const FlutterSecureStorage _storage = FlutterSecureStorage();
  static const String socketUrl = 'http://localhost:3000';

  static Future<IO.Socket> connect() async {
    if (_socket != null && _socket!.connected) {
      return _socket!;
    }

    final token = await _storage.read(key: 'access_token');
    
    _socket = IO.io(
      socketUrl,
      IO.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token})
          .enableAutoConnect()
          .build(),
    );

    _socket!.onConnect((_) {
      print('Socket connected');
    });

    _socket!.onDisconnect((_) {
      print('Socket disconnected');
    });

    _socket!.onError((error) {
      print('Socket error: $error');
    });

    return _socket!;
  }

  static void disconnect() {
    _socket?.disconnect();
    _socket = null;
  }

  static void joinEmergency(String emergencyId) {
    _socket?.emit('join_emergency', emergencyId);
  }

  static void leaveEmergency(String emergencyId) {
    _socket?.emit('leave_emergency', emergencyId);
  }

  static void on(String event, Function(dynamic) callback) {
    _socket?.on(event, callback);
  }

  static void off(String event) {
    _socket?.off(event);
  }

  static void emit(String event, dynamic data) {
    _socket?.emit(event, data);
  }
}


