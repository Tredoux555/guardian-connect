import 'package:workmanager/workmanager.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'dart:convert';
import 'dart:io' show Platform;
import 'package:http/http.dart' as http;
import 'api_service.dart';
import 'log_collector.dart';

/// Background task service for battery-efficient emergency polling
/// Uses WorkManager (Android) / Background Fetch (iOS) to check for emergencies
/// when the app is in the background
class BackgroundTaskService {
  static const String taskName = 'emergencyCheckTask';
  
  /// Initialize background tasks
  static Future<void> initialize() async {
    try {
      // Check if running on iOS simulator - workmanager doesn't support periodic tasks on simulator
      if (Platform.isIOS && !kReleaseMode) {
        // Check if running on simulator by checking for simulator-specific environment
        final isSimulator = Platform.environment.containsKey('SIMULATOR_DEVICE_NAME') ||
                           Platform.environment.containsKey('SIMULATOR_ROOT');
        
        if (isSimulator) {
          debugPrint('⚠️ Skipping background task registration - iOS simulator detected');
          debugPrint('   Background tasks will work on physical devices');
          return;
        }
      }
      
      await Workmanager().initialize(
        callbackDispatcher,
        isInDebugMode: kDebugMode,
      );
      debugPrint('✅ Background task service initialized');
      
      // Register periodic task (runs every 15 minutes minimum)
      // Note: registerPeriodicTask is not available on iOS simulator
      try {
        await Workmanager().registerPeriodicTask(
          taskName,
          taskName,
          frequency: const Duration(minutes: 15), // Minimum frequency
          constraints: Constraints(
            networkType: NetworkType.connected,
            requiresBatteryNotLow: false, // Run even on low battery
            requiresCharging: false,
            requiresDeviceIdle: false,
            requiresStorageNotLow: false,
          ),
        );
        debugPrint('✅ Background emergency check task registered');
      } catch (e) {
        // Handle case where periodic tasks aren't supported (e.g., iOS simulator)
        if (e.toString().contains('registerPeriodicTask') || 
            e.toString().contains('unhandledMethod')) {
          debugPrint('⚠️ Periodic tasks not supported on this platform/device');
          debugPrint('   This is normal on iOS simulator - will work on physical devices');
        } else {
          rethrow;
        }
      }
      
      LogCollector.logMobile(
        'Background task service initialized',
        level: LogLevel.info,
        category: 'BackgroundTask',
      );
    } catch (e) {
      debugPrint('❌ Failed to initialize background tasks: $e');
      LogCollector.logError(
        'Failed to initialize background tasks',
        source: LogSource.mobile,
        error: e,
      );
    }
  }
  
  /// Cancel background tasks (call on logout)
  static Future<void> cancel() async {
    try {
      await Workmanager().cancelByUniqueName(taskName);
      debugPrint('✅ Background tasks cancelled');
    } catch (e) {
      debugPrint('⚠️ Error cancelling background tasks: $e');
    }
  }
  
  /// Register one-time task for immediate execution
  static Future<void> registerOneOffTask() async {
    try {
      await Workmanager().registerOneOffTask(
        '${taskName}_immediate',
        taskName,
        initialDelay: const Duration(seconds: 5),
        constraints: Constraints(
          networkType: NetworkType.connected,
        ),
      );
    } catch (e) {
      debugPrint('⚠️ Error registering one-off task: $e');
    }
  }
}

/// Background task callback - runs in isolate
@pragma('vm:entry-point')
void callbackDispatcher() {
  Workmanager().executeTask((task, inputData) async {
    debugPrint('🔄 Background task executing: $task');
    
    try {
      // Get access token
      const storage = FlutterSecureStorage();
      final token = await storage.read(key: 'access_token');
      
      if (token == null) {
        debugPrint('⚠️ No access token - skipping background check');
        return Future.value(true);
      }
      
      // Check for pending emergencies
      final apiUrl = '${ApiService.baseUrl}/emergencies/pending';
      final response = await http.get(
        Uri.parse(apiUrl),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      ).timeout(const Duration(seconds: 10));
      
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data is List && data.isNotEmpty) {
          debugPrint('🚨 Background check found ${data.length} pending emergencies');
          
          // Trigger local notification (handled by push notification service)
          // The push notification service will handle showing the notification
          return Future.value(true);
        }
      }
      
      debugPrint('✅ Background check complete - no emergencies');
      return Future.value(true);
    } catch (e) {
      debugPrint('❌ Background task error: $e');
      return Future.value(false);
    }
  });
}
