import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter/foundation.dart'; // For debugPrint
import 'dart:async'; // For Completer and TimeoutException
import 'dart:math'; // For exponential backoff
import '../config/app_config.dart';

class SocketService {
  static IO.Socket? _socket;
  static const FlutterSecureStorage _storage = FlutterSecureStorage();
  static String get socketUrl => AppConfig.socketUrl;
  static bool _isConnecting = false;
  static int _retryCount = 0;
  static const int _maxRetries = 2; // Reduced to 2 retries (3 total attempts) to prevent accumulation
  static DateTime? _lastConnectionAttempt;
  static const Duration _minRetryInterval = Duration(seconds: 30); // Don't retry more than once per 30 seconds

  static Future<IO.Socket?> connect() async {
    try {
      // If already connected, return existing socket
      if (_socket != null && _socket!.connected) {
        debugPrint('✅ Socket already connected');
        return _socket!;
      }

      // Rate limiting: Don't retry too frequently if we've exhausted retries
      if (_lastConnectionAttempt != null && _retryCount >= _maxRetries) {
        final timeSinceLastAttempt = DateTime.now().difference(_lastConnectionAttempt!);
        if (timeSinceLastAttempt < _minRetryInterval) {
          debugPrint('⚠️ Socket connection retries exhausted, waiting ${_minRetryInterval.inSeconds - timeSinceLastAttempt.inSeconds}s before next attempt');
          return null; // Return null instead of retrying immediately
        } else {
          // Enough time has passed, reset retry count
          _retryCount = 0;
        }
      }

      // Prevent multiple simultaneous connection attempts
      if (_isConnecting) {
        debugPrint('⚠️ Socket connection already in progress, waiting...');
        // Wait for existing connection attempt
        int attempts = 0;
        while (_isConnecting && attempts < 30) {
          await Future.delayed(const Duration(milliseconds: 500));
          if (_socket != null && _socket!.connected) {
            return _socket!;
          }
          attempts++;
        }
        // If we waited and still not connected, return null
        if (_socket == null || !_socket!.connected) {
          return null;
        }
      }

      _lastConnectionAttempt = DateTime.now();

      _isConnecting = true;
      final token = await _storage.read(key: 'access_token');
      
      if (token == null || token.isEmpty) {
        debugPrint('❌ No access token available for socket connection');
        _isConnecting = false;
        throw Exception('No access token available');
      }
      
      debugPrint('🔌 Attempting socket connection to $socketUrl');
      debugPrint('   Token available: ${token.isNotEmpty}');
      debugPrint('   Token length: ${token.length}');
      debugPrint('   Socket path: /socket.io/');
      
      // Disconnect existing socket if any
      if (_socket != null) {
        _socket!.disconnect();
        _socket!.dispose();
        _socket = null;
      }
      
      // Build socket options
      // For Railway compatibility, use polling only (WebSocket upgrades may fail)
      final options = IO.OptionBuilder()
          .setTransports(['polling']) // Use polling only for Railway compatibility
          .setAuth({'token': token})
          .enableAutoConnect()
          .setTimeout(60000) // Increase timeout to 60 seconds for Railway
          .setPath('/socket.io/'); // Explicit path for socket.io
      
      // Only add ngrok headers if configured (for development/ngrok)
      if (AppConfig.includeNgrokHeaders) {
        options.setExtraHeaders({'ngrok-skip-browser-warning': 'true'});
        options.setQuery({'ngrok-skip-browser-warning': 'true'});
      }
      
      _socket = IO.io(socketUrl, options.build());

      // Set up event listeners BEFORE connection attempt
      _socket!.onConnect((_) {
        debugPrint('✅ Socket connected successfully');
        _isConnecting = false;
      });

      _socket!.onDisconnect((reason) {
        debugPrint('⚠️ Socket disconnected: $reason');
        _isConnecting = false;
      });

      _socket!.onError((error) {
        debugPrint('❌ Socket error: $error');
        _isConnecting = false;
      });

      _socket!.onConnectError((error) {
        debugPrint('❌ Socket connection error: $error');
        debugPrint('   Socket URL: $socketUrl');
        debugPrint('   Token available: ${token.isNotEmpty}');
        debugPrint('   Error type: ${error.runtimeType}');
        debugPrint('   Error details: ${error.toString()}');
        _isConnecting = false;
      });
      
      // Add more detailed error handlers
      _socket!.onError((error) {
        debugPrint('❌ Socket error event: $error');
      });
      
      _socket!.onDisconnect((reason) {
        debugPrint('⚠️ Socket disconnected: $reason');
      });

      // Wait for connection with timeout
      final completer = Completer<IO.Socket?>();
      bool connectionHandled = false;

      _socket!.onConnect((_) {
        if (!connectionHandled) {
          connectionHandled = true;
          _isConnecting = false;
          _retryCount = 0; // Reset retry count on success
          completer.complete(_socket);
        }
      });

      _socket!.onConnectError((error) {
        if (!connectionHandled) {
          connectionHandled = true;
          _isConnecting = false;
          // Don't complete with error, complete with null instead
          debugPrint('⚠️ Socket connection failed, continuing without real-time features');
          debugPrint('   Error: $error');
          completer.complete(null);
        }
      });
      
      // Wait up to 45 seconds for connection (Railway may be slow)
      try {
        final connectedSocket = await completer.future.timeout(
          const Duration(seconds: 45),
          onTimeout: () {
            _isConnecting = false;
            debugPrint('⚠️ Socket connection timed out after 45 seconds');
            debugPrint('   Socket.io may not be available - app will work without real-time features');
            debugPrint('   This is common on Railway - polling will handle emergency detection');
            return null;
          },
        );
        if (connectedSocket != null) {
          debugPrint('✅ Socket connection established');
          _retryCount = 0; // Reset retry count on success
          return connectedSocket;
        } else {
          // Connection failed - retry with exponential backoff
          if (_retryCount < _maxRetries) {
            _retryCount++;
            final delaySeconds = min(3 * pow(2, _retryCount - 1).toInt(), 12); // 3s, 6s, 12s
            debugPrint('🔄 Socket connection failed, retrying in ${delaySeconds}s... (attempt $_retryCount/$_maxRetries)');
            await Future.delayed(Duration(seconds: delaySeconds));
            _isConnecting = false; // Reset flag to allow retry
            return connect(); // Recursive retry
          } else {
            debugPrint('⚠️ Socket connection failed after $_maxRetries attempts, continuing without real-time features');
            _retryCount = 0; // Reset for next connection attempt
            return null;
          }
        }
      } catch (e) {
        _isConnecting = false;
        final errorStr = e.toString();
        // Retry on handshake errors
        if ((errorStr.contains('HandshakeException') || 
             errorStr.contains('Connection terminated') ||
             errorStr.contains('TlsException')) && 
            _retryCount < _maxRetries) {
          _retryCount++;
          final delaySeconds = min(3 * pow(2, _retryCount - 1).toInt(), 12);
          debugPrint('🔄 SSL handshake failed, retrying in ${delaySeconds}s... (attempt $_retryCount/$_maxRetries)');
          await Future.delayed(Duration(seconds: delaySeconds));
          return connect(); // Recursive retry
        }
        debugPrint('❌ Failed to establish socket connection: $e');
        _retryCount = 0;
        return null;
      }
    } catch (e) {
      _isConnecting = false;
      final errorStr = e.toString();
      // Retry on handshake errors
      if ((errorStr.contains('HandshakeException') || 
           errorStr.contains('Connection terminated') ||
           errorStr.contains('TlsException')) && 
          _retryCount < _maxRetries) {
        _retryCount++;
        final delaySeconds = min(3 * pow(2, _retryCount - 1).toInt(), 12);
        debugPrint('🔄 SSL handshake failed, retrying in ${delaySeconds}s... (attempt $_retryCount/$_maxRetries)');
        await Future.delayed(Duration(seconds: delaySeconds));
        return connect(); // Recursive retry
      }
      debugPrint('❌ Error connecting to socket: $e');
      _retryCount = 0;
      return null;
    }
  }

  static void disconnect() {
    _isConnecting = false;
    _retryCount = 0; // Reset retry count on disconnect
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
  }

  static void joinEmergency(String emergencyId) {
    if (_socket != null && _socket!.connected) {
      _socket!.emit('join_emergency', emergencyId);
      debugPrint('📡 Joined emergency room: $emergencyId');
    } else {
      debugPrint('⚠️ Cannot join emergency - socket not connected');
    }
  }

  static void leaveEmergency(String emergencyId) {
    if (_socket != null && _socket!.connected) {
      _socket!.emit('leave_emergency', emergencyId);
      debugPrint('📡 Left emergency room: $emergencyId');
    }
  }

  static void on(String event, Function(dynamic) callback) {
    _socket?.on(event, callback);
  }

  static void off(String event) {
    _socket?.off(event);
  }

  static void emit(String event, dynamic data) {
    if (_socket != null && _socket!.connected) {
      _socket!.emit(event, data);
    } else {
      debugPrint('⚠️ Cannot emit event - socket not connected: $event');
    }
  }
}






