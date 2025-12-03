import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter/foundation.dart';
import 'dart:async';
import '../config/app_config.dart';

class SocketService {
  static IO.Socket? _socket;
  static const FlutterSecureStorage _storage = FlutterSecureStorage();
  static String get socketUrl => AppConfig.socketUrl;
  static bool _isConnecting = false;
  static Completer<IO.Socket?>? _connectionCompleter;

  /// Connect to socket server
  /// Returns the socket if connected, null if failed
  static Future<IO.Socket?> connect() async {
    // Already connected
    if (_socket != null && _socket!.connected) {
      return _socket!;
    }

    // Connection in progress - wait for it
    if (_isConnecting && _connectionCompleter != null) {
      return _connectionCompleter!.future;
    }

    _isConnecting = true;
    _connectionCompleter = Completer<IO.Socket?>();

    try {
      final token = await _storage.read(key: 'access_token');
      
      if (token == null || token.isEmpty) {
        debugPrint('❌ Socket: No auth token');
        _completeConnection(null);
        return null;
      }

      debugPrint('🔌 Socket: Connecting to $socketUrl');

      // Clean up old socket
      _socket?.disconnect();
      _socket?.dispose();

      // Create socket with POLLING FIRST (more reliable through proxies)
      // Socket.io will auto-upgrade to websocket after initial connection
      _socket = IO.io(
        socketUrl,
        IO.OptionBuilder()
            .setTransports(['polling', 'websocket']) // Polling first!
            .setPath('/socket.io/')
            .setAuth({'token': token})
            .enableAutoConnect()
            .enableReconnection()
            .setReconnectionAttempts(5)
            .setReconnectionDelay(1000)
            .setReconnectionDelayMax(5000)
            .setTimeout(20000)
            .build(),
      );

      // Connection success
      _socket!.onConnect((_) {
        debugPrint('✅ Socket: Connected');
        _completeConnection(_socket);
      });

      // Connection error
      _socket!.onConnectError((error) {
        debugPrint('❌ Socket: Connection error - $error');
        _completeConnection(null);
      });

      // Disconnection
      _socket!.onDisconnect((reason) {
        debugPrint('⚠️ Socket: Disconnected - $reason');
      });

      // Reconnection
      _socket!.on('reconnect', (_) {
        debugPrint('✅ Socket: Reconnected');
      });

      // Error
      _socket!.onError((error) {
        debugPrint('❌ Socket: Error - $error');
      });

      // Wait for connection with timeout
      return await _connectionCompleter!.future.timeout(
        const Duration(seconds: 15),
        onTimeout: () {
          debugPrint('⚠️ Socket: Connection timeout');
          _completeConnection(null);
          return null;
        },
      );
    } catch (e) {
      debugPrint('❌ Socket: Exception - $e');
      _completeConnection(null);
      return null;
    }
  }

  static void _completeConnection(IO.Socket? result) {
    _isConnecting = false;
    if (_connectionCompleter != null && !_connectionCompleter!.isCompleted) {
      _connectionCompleter!.complete(result);
    }
    _connectionCompleter = null;
  }

  /// Disconnect from socket server
  static void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _isConnecting = false;
    _connectionCompleter = null;
  }

  /// Join an emergency room
  static void joinEmergency(String emergencyId) {
    if (_socket?.connected ?? false) {
      _socket!.emit('join_emergency', emergencyId);
      debugPrint('📍 Socket: Joined emergency $emergencyId');
    } else {
      debugPrint('⚠️ Socket: Cannot join emergency - not connected');
      // Try to connect and then join
      connect().then((socket) {
        if (socket?.connected ?? false) {
          socket!.emit('join_emergency', emergencyId);
          debugPrint('📍 Socket: Joined emergency $emergencyId (after reconnect)');
        }
      });
    }
  }

  /// Leave an emergency room
  static void leaveEmergency(String emergencyId) {
    if (_socket?.connected ?? false) {
      _socket!.emit('leave_emergency', emergencyId);
      debugPrint('📍 Socket: Left emergency $emergencyId');
    }
  }

  /// Listen for an event
  static void on(String event, Function(dynamic) callback) {
    _socket?.on(event, callback);
  }

  /// Remove event listener
  static void off(String event) {
    _socket?.off(event);
  }

  /// Emit an event
  static void emit(String event, dynamic data) {
    if (_socket?.connected ?? false) {
      _socket!.emit(event, data);
    } else {
      debugPrint('⚠️ Socket: Cannot emit $event - not connected');
    }
  }

  /// Check if connected
  static bool get isConnected => _socket?.connected ?? false;
}
