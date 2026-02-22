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
  static Future<IO.Socket?> connect() async {
    // Already connected
    if (_socket != null && _socket!.connected) {
      debugPrint('✅ Socket: Already connected');
      return _socket!;
    }

    // Connection in progress - wait for it
    if (_isConnecting && _connectionCompleter != null) {
      debugPrint('⏳ Socket: Connection in progress, waiting...');
      return _connectionCompleter!.future;
    }

    _isConnecting = true;
    _connectionCompleter = Completer<IO.Socket?>();

    try {
      final token = await _storage.read(key: 'access_token');
      
      if (token == null || token.isEmpty) {
        debugPrint('❌ Socket: No auth token available');
        _completeConnection(null);
        return null;
      }

      debugPrint('🔌 Socket: Connecting to $socketUrl');
      debugPrint('   Token length: ${token.length}');

      // Clean up old socket
      if (_socket != null) {
        _socket!.dispose();
        _socket = null;
      }

      // Create socket - DO NOT auto connect yet
      // WebSocket-only for instant real-time communication
      _socket = IO.io(
        socketUrl,
        IO.OptionBuilder()
            .setTransports(['websocket'])
            .setPath('/socket.io/')
            .setAuth({'token': token})
            .disableAutoConnect() // Important: don't connect until handlers are set up
            .enableReconnection()
            .setReconnectionAttempts(5)
            .setReconnectionDelay(500)
            .setReconnectionDelayMax(2000)
            .build(),
      );

      // Set up ALL event handlers BEFORE connecting
      _socket!.onConnect((_) {
        debugPrint('✅ Socket: Connected successfully');
        if (!_connectionCompleter!.isCompleted) {
          _isConnecting = false;
          _connectionCompleter!.complete(_socket);
        }
      });

      _socket!.onConnectError((error) {
        debugPrint('❌ Socket: Connection error - $error');
        if (!_connectionCompleter!.isCompleted) {
          _completeConnection(null);
        }
      });

      _socket!.onError((error) {
        debugPrint('❌ Socket: Error - $error');
      });

      _socket!.onDisconnect((reason) {
        debugPrint('⚠️ Socket: Disconnected - $reason');
      });

      _socket!.on('reconnect', (_) {
        debugPrint('✅ Socket: Reconnected');
      });

      _socket!.on('reconnect_attempt', (attempt) {
        debugPrint('🔄 Socket: Reconnect attempt $attempt');
      });

      _socket!.on('reconnect_error', (error) {
        debugPrint('❌ Socket: Reconnect error - $error');
      });

      // NOW connect after handlers are set up
      debugPrint('🔌 Socket: Initiating connection...');
      _socket!.connect();

      // Wait for connection with timeout
      try {
        final result = await _connectionCompleter!.future.timeout(
          const Duration(seconds: 8),
          onTimeout: () {
            debugPrint('⚠️ Socket: Connection timeout after 8s');
            debugPrint('   Socket connected: ${_socket?.connected}');
            debugPrint('   Socket ID: ${_socket?.id}');
            _completeConnection(null);
            return null;
          },
        );
        return result;
      } catch (e) {
        debugPrint('❌ Socket: Connection exception - $e');
        _completeConnection(null);
        return null;
      }
    } catch (e) {
      debugPrint('❌ Socket: Setup exception - $e');
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
    debugPrint('🔌 Socket: Disconnecting');
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _isConnecting = false;
    if (_connectionCompleter != null && !_connectionCompleter!.isCompleted) {
      _connectionCompleter!.complete(null);
    }
    _connectionCompleter = null;
  }

  /// Join an emergency room
  static void joinEmergency(String emergencyId) {
    if (_socket?.connected ?? false) {
      _socket!.emit('join_emergency', emergencyId);
      debugPrint('📍 Socket: Joined emergency $emergencyId');
    } else {
      debugPrint('⚠️ Socket: Cannot join - not connected, attempting reconnect...');
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
  
  /// Get socket ID (for debugging)
  static String? get socketId => _socket?.id;
}
