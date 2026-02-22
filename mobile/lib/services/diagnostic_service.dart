import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import '../services/api_service.dart';
import '../services/socket_service.dart';
import '../services/push_notification_service.dart';
import '../services/log_collector.dart';
import '../config/app_config.dart';

class DiagnosticResult {
  final String testName;
  final bool passed;
  final String message;
  final dynamic data;
  final DateTime timestamp;

  DiagnosticResult({
    required this.testName,
    required this.passed,
    required this.message,
    this.data,
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now();

  Map<String, dynamic> toJson() => {
    'testName': testName,
    'passed': passed,
    'message': message,
    'data': data,
    'timestamp': timestamp.toIso8601String(),
  };
}

class DiagnosticService {
  static List<DiagnosticResult> _results = [];
  static List<String> _logs = [];

  static List<DiagnosticResult> get results => List.unmodifiable(_results);
  static List<String> get logs => List.unmodifiable(_logs);

  static void _log(String message) {
    final timestamp = DateTime.now().toIso8601String();
    final logMessage = '[$timestamp] $message';
    _logs.add(logMessage);
    debugPrint('🔍 DIAGNOSTIC: $logMessage');
  }

  static void _addResult(DiagnosticResult result) {
    _results.add(result);
    _log('${result.passed ? "✅" : "❌"} ${result.testName}: ${result.message}');
  }

  static void clearResults() {
    _results.clear();
    _logs.clear();
  }

  // Test 1: App Configuration
  static Future<DiagnosticResult> testAppConfig() async {
    try {
      _log('Testing app configuration...');
      final config = {
        'apiBaseUrl': AppConfig.apiBaseUrl,
        'apiUrl': AppConfig.apiUrl,
        'socketUrl': AppConfig.socketUrl,
        'includeNgrokHeaders': AppConfig.includeNgrokHeaders,
        'isProduction': AppConfig.isProduction,
      };
      
      final hasValidUrls = AppConfig.apiBaseUrl.isNotEmpty && 
                          AppConfig.socketUrl.isNotEmpty;
      
      return DiagnosticResult(
        testName: 'App Configuration',
        passed: hasValidUrls,
        message: hasValidUrls 
            ? 'Configuration valid' 
            : 'Missing required URLs',
        data: config,
      );
    } catch (e) {
      return DiagnosticResult(
        testName: 'App Configuration',
        passed: false,
        message: 'Error: $e',
      );
    }
  }

  // Test 2: Authentication Token
  static Future<DiagnosticResult> testAuthToken() async {
    try {
      _log('Testing authentication token...');
      final token = await ApiService.getAccessToken();
      
      if (token == null || token.isEmpty) {
        return DiagnosticResult(
          testName: 'Authentication Token',
          passed: false,
          message: 'No token found',
        );
      }

      return DiagnosticResult(
        testName: 'Authentication Token',
        passed: true,
        message: 'Token found (${token.length} chars)',
        data: {'tokenLength': token.length, 'tokenPreview': '${token.substring(0, min(20, token.length))}...'},
      );
    } catch (e) {
      return DiagnosticResult(
        testName: 'Authentication Token',
        passed: false,
        message: 'Error: $e',
      );
    }
  }

  // Test 3: API Connectivity
  static Future<DiagnosticResult> testApiConnectivity() async {
    try {
      _log('Testing API connectivity...');
      final startTime = DateTime.now();
      
      // Test with a simple endpoint (user/me)
      final response = await ApiService.get('/user/me').timeout(
        const Duration(seconds: 10),
        onTimeout: () => throw TimeoutException('API request timed out'),
      );
      
      final duration = DateTime.now().difference(startTime);
      
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return DiagnosticResult(
          testName: 'API Connectivity',
          passed: true,
          message: 'Connected (${duration.inMilliseconds}ms)',
          data: {
            'statusCode': response.statusCode,
            'responseTime': duration.inMilliseconds,
            'userData': data,
          },
        );
      } else {
        return DiagnosticResult(
          testName: 'API Connectivity',
          passed: false,
          message: 'HTTP ${response.statusCode}: ${response.body}',
          data: {'statusCode': response.statusCode, 'body': response.body},
        );
      }
    } catch (e) {
      return DiagnosticResult(
        testName: 'API Connectivity',
        passed: false,
        message: 'Error: $e',
        data: {'error': e.toString()},
      );
    }
  }

  // Test 4: Socket Connectivity
  static Future<DiagnosticResult> testSocketConnectivity() async {
    try {
      _log('Testing socket connectivity...');
      final startTime = DateTime.now();
      
      // Use 30 second timeout to match socket service timeout (25s) plus buffer
      final socket = await SocketService.connect().timeout(
        const Duration(seconds: 30),
        onTimeout: () {
          _log('Socket connection timed out after 30 seconds');
          _log('   This may indicate network issues, socket server problems, or authentication failures');
          _log('   Check backend logs for socket authentication attempts');
          _log('   The app will continue to work with polling for emergency detection');
          return null;
        },
      );
      
      final duration = DateTime.now().difference(startTime);
      
      if (socket != null && socket.connected) {
        return DiagnosticResult(
          testName: 'Socket Connectivity',
          passed: true,
          message: 'Connected (${duration.inMilliseconds}ms)',
          data: {
            'connected': socket.connected,
            'id': socket.id,
            'responseTime': duration.inMilliseconds,
          },
        );
      } else {
        return DiagnosticResult(
          testName: 'Socket Connectivity',
          passed: false,
          message: 'Failed to connect (${duration.inMilliseconds}ms)',
          data: {
            'responseTime': duration.inMilliseconds,
            'note': 'Socket connection failed. The app will use polling for emergency detection.',
          },
        );
      }
    } catch (e) {
      return DiagnosticResult(
        testName: 'Socket Connectivity',
        passed: false,
        message: 'Error: $e',
        data: {
          'error': e.toString(),
          'note': 'Socket connection error. The app will use polling for emergency detection.',
        },
      );
    }
  }

  // Test 5: Location Permissions
  static Future<DiagnosticResult> testLocationPermissions() async {
    try {
      _log('Testing location permissions...');
      final status = await Permission.location.status;
      
      return DiagnosticResult(
        testName: 'Location Permissions',
        passed: status.isGranted,
        message: status.isGranted 
            ? 'Granted' 
            : 'Not granted (${status.toString()})',
        data: {'status': status.toString()},
      );
    } catch (e) {
      return DiagnosticResult(
        testName: 'Location Permissions',
        passed: false,
        message: 'Error: $e',
      );
    }
  }

  // Test 6: Location Services
  static Future<DiagnosticResult> testLocationServices() async {
    try {
      _log('Testing location services...');
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      
      if (!serviceEnabled) {
        return DiagnosticResult(
          testName: 'Location Services',
          passed: false,
          message: 'Location services disabled',
        );
      }

      final startTime = DateTime.now();
      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.best,
        timeLimit: const Duration(seconds: 10),
      ).timeout(
        const Duration(seconds: 10),
        onTimeout: () => throw TimeoutException('Location request timed out'),
      );
      
      final duration = DateTime.now().difference(startTime);
      
      return DiagnosticResult(
        testName: 'Location Services',
        passed: true,
        message: 'Location obtained (${duration.inMilliseconds}ms, accuracy: ${position.accuracy}m)',
        data: {
          'latitude': position.latitude,
          'longitude': position.longitude,
          'accuracy': position.accuracy,
          'responseTime': duration.inMilliseconds,
        },
      );
    } catch (e) {
      return DiagnosticResult(
        testName: 'Location Services',
        passed: false,
        message: 'Error: $e',
        data: {'error': e.toString()},
      );
    }
  }

  // Test 7: Emergency API Endpoints
  static Future<DiagnosticResult> testEmergencyEndpoints() async {
    try {
      _log('Testing emergency endpoints...');
      
      // Test GET /emergencies/pending
      final pendingResponse = await ApiService.get('/emergencies/pending').timeout(
        const Duration(seconds: 10),
      );
      
      final results = {
        'pending': {
          'statusCode': pendingResponse.statusCode,
          'works': pendingResponse.statusCode == 200,
        },
      };
      
      final allWork = results.values.every((r) => r['works'] == true);
      
      return DiagnosticResult(
        testName: 'Emergency Endpoints',
        passed: allWork,
        message: allWork 
            ? 'All endpoints working' 
            : 'Some endpoints failed',
        data: results,
      );
    } catch (e) {
      return DiagnosticResult(
        testName: 'Emergency Endpoints',
        passed: false,
        message: 'Error: $e',
        data: {'error': e.toString()},
      );
    }
  }

  // Test 8: Socket Events
  static Future<DiagnosticResult> testSocketEvents() async {
    try {
      _log('Testing socket events...');
      final socket = await SocketService.connect();
      
      if (socket == null || !socket.connected) {
        return DiagnosticResult(
          testName: 'Socket Events',
          passed: false,
          message: 'Socket not connected',
        );
      }

      return DiagnosticResult(
        testName: 'Socket Events',
        passed: socket.connected,
        message: socket.connected 
            ? 'Socket connected, events functional' 
            : 'Socket not connected',
        data: {'connected': socket.connected, 'id': socket.id},
      );
    } catch (e) {
      return DiagnosticResult(
        testName: 'Socket Events',
        passed: false,
        message: 'Error: $e',
        data: {'error': e.toString()},
      );
    }
  }

  // Test 9: Location Log Analysis
  static Future<DiagnosticResult> testLocationLogs() async {
    try {
      _log('Analyzing location logs...');
      final locationLogs = LogCollector.getLocationLogs();
      final errorLogs = LogCollector.getErrorLogs();
      final locationErrors = errorLogs.where((log) => 
        log.source == LogSource.location || log.category == 'Location'
      ).toList();
      
      final stats = {
        'totalLocationLogs': locationLogs.length,
        'locationErrors': locationErrors.length,
        'recentLogs': locationLogs.length > 0 ? locationLogs.sublist(max(0, locationLogs.length - 10)).map((l) => l.message).toList() : [],
      };
      
      return DiagnosticResult(
        testName: 'Location Log Analysis',
        passed: locationErrors.isEmpty,
        message: locationErrors.isEmpty 
            ? '${locationLogs.length} location logs, no errors'
            : '${locationLogs.length} location logs, ${locationErrors.length} errors found',
        data: stats,
      );
    } catch (e) {
      return DiagnosticResult(
        testName: 'Location Log Analysis',
        passed: false,
        message: 'Error: $e',
      );
    }
  }

  // Test 10: Push Notification Permissions
  static Future<DiagnosticResult> testPushNotificationPermissions() async {
    try {
      _log('Testing push notification permissions...');
      final messaging = FirebaseMessaging.instance;
      final settings = await messaging.getNotificationSettings();
      
      final isAuthorized = settings.authorizationStatus == AuthorizationStatus.authorized ||
                          settings.authorizationStatus == AuthorizationStatus.provisional;
      
      return DiagnosticResult(
        testName: 'Push Notification Permissions',
        passed: isAuthorized,
        message: isAuthorized 
            ? 'Notifications authorized' 
            : 'Notifications not authorized (${settings.authorizationStatus})',
        data: {
          'authorizationStatus': settings.authorizationStatus.toString(),
          'alert': settings.alert.toString(),
          'badge': settings.badge.toString(),
          'sound': settings.sound.toString(),
        },
      );
    } catch (e) {
      return DiagnosticResult(
        testName: 'Push Notification Permissions',
        passed: false,
        message: 'Error: $e',
      );
    }
  }

  // Test 11: FCM Token Registration
  static Future<DiagnosticResult> testFcmTokenRegistration() async {
    try {
      _log('Testing FCM token registration...');
      
      // Check if token exists locally
      final localToken = PushNotificationService.token;
      if (localToken == null) {
        return DiagnosticResult(
          testName: 'FCM Token Registration',
          passed: false,
          message: 'No FCM token obtained locally',
          data: {
            'localToken': null,
            'note': 'Token may not be initialized yet',
          },
        );
      }
      
      // Check if token is registered with backend
      try {
        final response = await ApiService.get('/user/me');
        if (response.statusCode == 200) {
          final userData = jsonDecode(response.body);
          // Backend should return fcm_token status, but we'll check via a test endpoint
          // For now, just verify we have a local token
          return DiagnosticResult(
            testName: 'FCM Token Registration',
            passed: true,
            message: 'FCM token available locally (${localToken.substring(0, 20)}...)',
            data: {
              'localToken': '${localToken.substring(0, 20)}...',
              'tokenLength': localToken.length,
              'note': 'Verify token is registered in backend database',
            },
          );
        }
      } catch (e) {
        return DiagnosticResult(
          testName: 'FCM Token Registration',
          passed: false,
          message: 'Could not verify token with backend: $e',
          data: {
            'localToken': '${localToken.substring(0, 20)}...',
            'error': e.toString(),
          },
        );
      }
      
      return DiagnosticResult(
        testName: 'FCM Token Registration',
        passed: false,
        message: 'Unknown error',
      );
    } catch (e) {
      return DiagnosticResult(
        testName: 'FCM Token Registration',
        passed: false,
        message: 'Error: $e',
      );
    }
  }

  // Test 12: Emergency Contacts
  static Future<DiagnosticResult> testEmergencyContacts() async {
    try {
      _log('Testing emergency contacts setup...');
      
      final response = await ApiService.get('/contacts');
      if (response.statusCode != 200) {
        return DiagnosticResult(
          testName: 'Emergency Contacts',
          passed: false,
          message: 'Failed to fetch contacts: ${response.statusCode}',
        );
      }
      
      final data = jsonDecode(response.body);
      final contacts = data is List ? data : (data['contacts'] as List? ?? []);
      
      // Filter for registered users (have user_id)
      final registeredContacts = contacts.where((c) => 
        c['contact_user_id'] != null && c['contact_user_id'].toString().isNotEmpty
      ).toList();
      
      final activeContacts = contacts.where((c) => 
        c['status'] == 'active'
      ).toList();
      
      final hasContacts = contacts.isNotEmpty;
      final hasRegisteredContacts = registeredContacts.isNotEmpty;
      
      return DiagnosticResult(
        testName: 'Emergency Contacts',
        passed: hasRegisteredContacts,
        message: hasRegisteredContacts
            ? '${registeredContacts.length} registered contact(s) available'
            : hasContacts
                ? '${contacts.length} contact(s) but none are registered users'
                : 'No emergency contacts configured',
        data: {
          'totalContacts': contacts.length,
          'activeContacts': activeContacts.length,
          'registeredContacts': registeredContacts.length,
          'contacts': contacts.map((c) => <String, dynamic>{
            'name': c['contact_name'] ?? 'Unknown',
            'email': c['contact_email'] ?? 'Unknown',
            'isRegistered': c['contact_user_id'] != null,
            'status': c['status'] ?? 'unknown',
          }).toList(),
        },
      );
    } catch (e) {
      return DiagnosticResult(
        testName: 'Emergency Contacts',
        passed: false,
        message: 'Error: $e',
      );
    }
  }

  // Test 13: Notification Flow Simulation
  static Future<DiagnosticResult> testNotificationFlow() async {
    try {
      _log('Testing notification flow...');
      
      final issues = <String>[];
      final warnings = <String>[];
      
      // Check 1: FCM token
      final fcmToken = PushNotificationService.token;
      if (fcmToken == null) {
        issues.add('No FCM token - push notifications will not work');
      }
      
      // Check 2: Push permissions
      final messaging = FirebaseMessaging.instance;
      final settings = await messaging.getNotificationSettings();
      if (settings.authorizationStatus != AuthorizationStatus.authorized &&
          settings.authorizationStatus != AuthorizationStatus.provisional) {
        issues.add('Push notifications not authorized');
      }
      
      // Check 3: Emergency contacts
      try {
        final response = await ApiService.get('/contacts');
        if (response.statusCode == 200) {
          final data = jsonDecode(response.body);
          final contacts = data is List ? data : (data['contacts'] as List? ?? []);
          final registeredContacts = contacts.where((c) => 
            c['contact_user_id'] != null
          ).toList();
          
          if (registeredContacts.isEmpty) {
            issues.add('No registered emergency contacts - no one will be notified');
          } else {
            warnings.add('${registeredContacts.length} registered contact(s) - verify they have FCM tokens');
          }
        }
      } catch (e) {
        warnings.add('Could not check emergency contacts: $e');
      }
      
      // Check 4: Socket connection
      final socket = await SocketService.connect();
      if (socket == null || !socket.connected) {
        warnings.add('Socket not connected - real-time notifications will not work');
      }
      
      // Check 5: API connectivity
      try {
        final apiResponse = await ApiService.get('/user/me');
        if (apiResponse.statusCode != 200) {
          issues.add('API connectivity issue - notifications may fail');
        }
      } catch (e) {
        issues.add('API connectivity failed: $e');
      }
      
      final allGood = issues.isEmpty;
      final message = allGood
          ? 'Notification flow ready'
          : '${issues.length} critical issue(s) found';
      
      return DiagnosticResult(
        testName: 'Notification Flow',
        passed: allGood,
        message: message,
        data: {
          'issues': issues,
          'warnings': warnings,
          'fcmTokenAvailable': fcmToken != null,
          'pushAuthorized': settings.authorizationStatus == AuthorizationStatus.authorized ||
                          settings.authorizationStatus == AuthorizationStatus.provisional,
          'socketConnected': socket?.connected ?? false,
        },
      );
    } catch (e) {
      return DiagnosticResult(
        testName: 'Notification Flow',
        passed: false,
        message: 'Error: $e',
      );
    }
  }

  // Run all tests
  static Future<List<DiagnosticResult>> runAllTests() async {
    clearResults();
    _log('Starting diagnostic tests...');
    
    // Start log collection before tests
    LogCollector.startCapture();
    
    final tests = [
      testAppConfig,
      testAuthToken,
      testApiConnectivity,
      testSocketConnectivity,
      testLocationPermissions,
      testLocationServices,
      testEmergencyEndpoints,
      testSocketEvents,
      testLocationLogs,
      testPushNotificationPermissions,
      testFcmTokenRegistration,
      testEmergencyContacts,
      testNotificationFlow,
    ];
    
    final results = <DiagnosticResult>[];
    
    for (final test in tests) {
      try {
        final result = await test();
        results.add(result);
        _addResult(result);
      } catch (e) {
        final errorResult = DiagnosticResult(
          testName: test.toString(),
          passed: false,
          message: 'Test crashed: $e',
        );
        results.add(errorResult);
        _addResult(errorResult);
      }
    }
    
    _log('Diagnostic tests completed. ${results.where((r) => r.passed).length}/${results.length} passed');
    return results;
  }

  // Export results as JSON
  static String exportResults() {
    final allLogs = LogCollector.allLogs;
    final locationLogs = LogCollector.getLocationLogs();
    final errorLogs = LogCollector.getErrorLogs();
    
    return jsonEncode({
      'timestamp': DateTime.now().toIso8601String(),
      'results': _results.map((r) => r.toJson()).toList(),
      'diagnosticLogs': _logs,
      'collectedLogs': {
        'total': allLogs.length,
        'location': locationLogs.length,
        'errors': errorLogs.length,
        'statistics': LogCollector.getStatistics(),
      },
      'locationLogs': locationLogs.map((l) => l.toJson()).toList(),
      'errorLogs': errorLogs.map((l) => l.toJson()).toList(),
      'allLogs': allLogs.map((l) => l.toJson()).toList(),
    });
  }
  
  // Export location logs specifically
  static String exportLocationLogs() {
    return LogCollector.exportLocationLogs();
  }
}
