import 'dart:io' show Platform;
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'api_service.dart';
import 'log_collector.dart';

/// Handles Firebase Cloud Messaging (FCM) for push notifications
/// This eliminates the need for constant polling - the server pushes notifications directly
class PushNotificationService {
  static final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  static String? _fcmToken;
  static bool _initialized = false;
  static bool _fcmTokenObtained = false; // Track if FCM token was successfully obtained
  
  // Callback for when an emergency notification is received
  static Function(String emergencyId, String senderName)? onEmergencyReceived;
  
  // Callback for when user taps on a notification
  static Function(String emergencyId)? onNotificationTapped;

  /// Initialize push notifications - call this after Firebase.initializeApp()
  static Future<void> initialize() async {
    if (_initialized) {
      debugPrint('📱 Push notifications already initialized');
      return;
    }
    
    try {
      debugPrint('📱 Initializing push notifications...');
      
      // Request permission (required for iOS, optional for Android)
      final settings = await _messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        provisional: false,
        announcement: true,
        criticalAlert: true, // For emergency alerts
      );
      
      debugPrint('📱 Notification permission: ${settings.authorizationStatus}');
      
      if (settings.authorizationStatus == AuthorizationStatus.authorized ||
          settings.authorizationStatus == AuthorizationStatus.provisional) {
        
        // On iOS, wait for APNS token before getting FCM token
        // This prevents the "APNS token has not been received" error
        String? apnsToken;
        bool isSimulator = false;
        
        if (Platform.isIOS) {
          // Check if running on simulator
          isSimulator = Platform.environment.containsKey('SIMULATOR_DEVICE_NAME') ||
                       Platform.environment.containsKey('SIMULATOR_ROOT');
          
          if (isSimulator) {
            debugPrint('📱 iOS Simulator detected - skipping APNS token wait');
            debugPrint('   APNS tokens are not available on simulator');
            debugPrint('   Push notifications will work on physical devices');
          } else {
            debugPrint('📱 iOS device detected - waiting for APNS token...');
            try {
              // Wait up to 5 seconds for APNS token
              for (int i = 0; i < 10; i++) {
                apnsToken = await _messaging.getAPNSToken();
                if (apnsToken != null) {
                  debugPrint('✅ APNS token received: ${apnsToken.substring(0, 20)}...');
                  break;
                }
                await Future.delayed(const Duration(milliseconds: 500));
              }
              
              if (apnsToken == null) {
                debugPrint('⚠️ APNS token not received after 5 seconds');
                debugPrint('   This may indicate entitlements are not configured');
                debugPrint('   See mobile/ios/APNS_SETUP.md for setup instructions');
              }
            } catch (e) {
              debugPrint('⚠️ Error getting APNS token: $e');
              debugPrint('   Continuing with FCM token registration anyway');
            }
          }
        }
        
        // Get the FCM token
        try {
          _fcmToken = await _messaging.getToken();
          _fcmTokenObtained = true;
          debugPrint('📱 FCM Token obtained: ${_fcmToken?.substring(0, 20)}...');
          
          // Immediately register token with backend (don't wait for login)
          if (_fcmToken != null) {
            debugPrint('📱 Auto-registering FCM token with backend...');
            await _registerTokenWithBackend(_fcmToken!);
          }
        } catch (e) {
          _fcmTokenObtained = false;
          debugPrint('❌ Failed to get FCM token: $e');
          // Don't throw - app can still work without push notifications
          LogCollector.logError(
            'Failed to get FCM token',
            source: LogSource.mobile,
            error: e,
          );
        }
        
        // Listen for token refresh
        _messaging.onTokenRefresh.listen((newToken) {
          debugPrint('📱 FCM Token refreshed');
          _fcmToken = newToken;
          _registerTokenWithBackend(newToken);
        });
        
        // Handle foreground messages
        FirebaseMessaging.onMessage.listen(_handleForegroundMessage);
        
        // Handle background/terminated message taps
        FirebaseMessaging.onMessageOpenedApp.listen(_handleNotificationTap);
        
        // Check if app was opened from a notification
        final initialMessage = await _messaging.getInitialMessage();
        if (initialMessage != null) {
          debugPrint('📱 App opened from notification');
          _handleNotificationTap(initialMessage);
        }
        
        _initialized = true;
        
        // Report accurate initialization status
        if (_fcmTokenObtained) {
          debugPrint('✅ Push notifications initialized successfully (FCM token registered)');
        } else {
          debugPrint('⚠️ Push notifications partially initialized (FCM token not available)');
          debugPrint('   Push notifications will not work until FCM token is obtained');
          if (Platform.isIOS) {
            if (isSimulator) {
              debugPrint('   ℹ️ This is normal on iOS simulator - will work on physical device');
            } else {
              debugPrint('   💡 On iOS: Ensure APNS entitlements are configured in Xcode');
              debugPrint('   💡 See mobile/ios/APNS_SETUP.md for setup instructions');
            }
          }
        }
        
        // Print status summary
        debugPrint('\n📊 Push Notification Status:');
        debugPrint('   Permissions: ${settings.authorizationStatus == AuthorizationStatus.authorized || settings.authorizationStatus == AuthorizationStatus.provisional ? "✅ Granted" : "❌ Denied"}');
        if (Platform.isIOS) {
          debugPrint('   APNS Token: ${apnsToken != null ? "✅ Available" : isSimulator ? "ℹ️ Not available (simulator)" : "❌ Not available"}');
        }
        debugPrint('   FCM Token: ${_fcmTokenObtained ? "✅ Registered" : "❌ Failed"}');
        if (!_fcmTokenObtained && !isSimulator) {
          debugPrint('   ⚠️ Push notifications will not work until FCM token is obtained');
        }
        debugPrint('');
        
        LogCollector.logMobile(
          _fcmTokenObtained 
            ? 'Push notifications initialized successfully'
            : 'Push notifications partially initialized (FCM token not available)',
          level: _fcmTokenObtained ? LogLevel.info : LogLevel.warning,
          category: 'PushNotification',
        );
      } else {
        debugPrint('⚠️ Push notification permission denied');
        LogCollector.logMobile(
          'Push notification permission denied',
          level: LogLevel.warning,
          category: 'PushNotification',
        );
      }
    } catch (e) {
      debugPrint('❌ Failed to initialize push notifications: $e');
      LogCollector.logError(
        'Failed to initialize push notifications',
        source: LogSource.mobile,
        error: e,
      );
    }
  }
  
  /// Register FCM token with backend - call after login
  static Future<void> registerToken() async {
    if (_fcmToken == null) {
      debugPrint('⚠️ No FCM token available to register');
      // Try to get token again
      try {
        _fcmToken = await _messaging.getToken();
      } catch (e) {
        debugPrint('❌ Failed to get FCM token: $e');
        return;
      }
    }
    
    if (_fcmToken != null) {
      await _registerTokenWithBackend(_fcmToken!);
    }
  }
  
  /// Internal method to register token with backend
  static Future<void> _registerTokenWithBackend(String token) async {
    try {
      debugPrint('📱 Registering FCM token with backend...');
      
      final response = await ApiService.post('/user/fcm-token', {
        'token': token,
      });
      
      if (response.statusCode == 200) {
        debugPrint('✅ FCM token registered with backend');
        LogCollector.logApi(
          'FCM token registered with backend',
          level: LogLevel.info,
        );
      } else {
        debugPrint('❌ Failed to register FCM token: ${response.statusCode}');
        LogCollector.logApi(
          'Failed to register FCM token: ${response.statusCode}',
          level: LogLevel.error,
        );
      }
    } catch (e) {
      debugPrint('❌ Error registering FCM token: $e');
      // Don't throw - push notification registration failure shouldn't break the app
    }
  }
  
  /// Handle foreground messages (app is open)
  static void _handleForegroundMessage(RemoteMessage message) {
    debugPrint('📱 Foreground message received');
    debugPrint('   Title: ${message.notification?.title}');
    debugPrint('   Body: ${message.notification?.body}');
    debugPrint('   Data: ${message.data}');
    
    LogCollector.logMobile(
      'Push notification received: ${message.notification?.title}',
      level: LogLevel.info,
      category: 'PushNotification',
      metadata: message.data,
    );
    
    // Check if it's an emergency notification
    if (message.data['type'] == 'emergency') {
      final emergencyId = message.data['emergencyId'];
      final senderName = message.data['senderName'] ?? 'Someone';
      
      debugPrint('🚨 Emergency notification received!');
      debugPrint('   Emergency ID: $emergencyId');
      debugPrint('   Sender: $senderName');
      
      if (emergencyId != null && onEmergencyReceived != null) {
        onEmergencyReceived!(emergencyId, senderName);
      }
    }
  }
  
  /// Handle notification tap (app was in background/terminated)
  static void _handleNotificationTap(RemoteMessage message) {
    debugPrint('📱 Notification tapped');
    debugPrint('   Data: ${message.data}');
    
    LogCollector.logMobile(
      'Push notification tapped',
      level: LogLevel.info,
      category: 'PushNotification',
      metadata: message.data,
    );
    
    // Check if it's an emergency notification
    if (message.data['type'] == 'emergency') {
      final emergencyId = message.data['emergencyId'];
      
      if (emergencyId != null && onNotificationTapped != null) {
        onNotificationTapped!(emergencyId);
      }
    }
  }
  
  /// Get current FCM token (for debugging)
  static String? get token => _fcmToken;
  
  /// Check if push notifications are initialized
  static bool get isInitialized => _initialized;
  
  /// Unregister FCM token (call on logout)
  static Future<void> unregisterToken() async {
    try {
      debugPrint('📱 Unregistering FCM token...');
      
      // Tell backend to remove the token
      await ApiService.post('/user/fcm-token', {
        'token': null,
      });
      
      debugPrint('✅ FCM token unregistered');
    } catch (e) {
      debugPrint('⚠️ Error unregistering FCM token: $e');
    }
  }
}

/// Background message handler - must be a top-level function
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // This runs when the app is in background or terminated
  // Firebase will show the notification automatically
  // We just log it for debugging
  debugPrint('📱 Background message received: ${message.messageId}');
}

