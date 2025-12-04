import 'dart:async';
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// Service to play loud emergency alarm sounds that bypass silent mode
/// This is critical for emergency alerts - they MUST be heard
class EmergencyAlarmService {
  static final AudioPlayer _audioPlayer = AudioPlayer();
  static final FlutterLocalNotificationsPlugin _notifications = FlutterLocalNotificationsPlugin();
  static bool _isPlaying = false;
  static bool _initialized = false;
  static Timer? _alarmTimer;
  
  /// Initialize the alarm service
  static Future<void> initialize() async {
    if (_initialized) return;
    
    try {
      debugPrint('🔊 Initializing emergency alarm service...');
      
      // Configure audio player for maximum volume
      await _audioPlayer.setReleaseMode(ReleaseMode.loop); // Loop the alarm
      await _audioPlayer.setVolume(1.0); // Maximum volume
      
      // Initialize local notifications for critical alerts (iOS)
      const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
      const iosSettings = DarwinInitializationSettings(
        requestAlertPermission: true,
        requestBadgePermission: true,
        requestSoundPermission: true,
        requestCriticalPermission: true, // Critical alerts bypass Do Not Disturb
      );
      
      const initSettings = InitializationSettings(
        android: androidSettings,
        iOS: iosSettings,
      );
      
      await _notifications.initialize(
        initSettings,
        onDidReceiveNotificationResponse: (response) {
          debugPrint('🔔 Notification tapped: ${response.payload}');
        },
      );
      
      _initialized = true;
      debugPrint('✅ Emergency alarm service initialized');
    } catch (e) {
      debugPrint('❌ Failed to initialize emergency alarm: $e');
    }
  }
  
  /// Play emergency alarm - loud, continuous, bypasses silent mode
  static Future<void> playEmergencyAlarm({String? senderName}) async {
    if (_isPlaying) {
      debugPrint('🔊 Emergency alarm already playing');
      return;
    }
    
    try {
      debugPrint('🚨 PLAYING EMERGENCY ALARM');
      _isPlaying = true;
      
      // On iOS, use critical alert notification to bypass silent mode
      if (Platform.isIOS) {
        await _showCriticalAlertNotification(senderName ?? 'Someone');
      }
      
      // Play the alarm sound using system sounds
      // Using a loud, attention-grabbing pattern
      await _playAlarmPattern();
      
      // Auto-stop after 60 seconds to prevent battery drain
      _alarmTimer?.cancel();
      _alarmTimer = Timer(const Duration(seconds: 60), () {
        stopAlarm();
      });
      
    } catch (e) {
      debugPrint('❌ Failed to play emergency alarm: $e');
      _isPlaying = false;
    }
  }
  
  /// Play alarm pattern using system sounds and haptics
  static Future<void> _playAlarmPattern() async {
    try {
      // Try to play an alarm sound
      // First try a bundled asset, then fall back to URL
      try {
        // Play a loud alarm tone from URL (works cross-platform)
        await _audioPlayer.play(
          UrlSource('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg'),
          mode: PlayerMode.mediaPlayer,
        );
        await _audioPlayer.setVolume(1.0);
      } catch (e) {
        debugPrint('⚠️ Could not play audio URL: $e');
        // Fall back to system sound
        await _playSystemSound();
      }
      
      // Also trigger haptic feedback for vibration
      _startVibrationPattern();
      
    } catch (e) {
      debugPrint('❌ Failed to play alarm pattern: $e');
      // Fall back to system sound
      await _playSystemSound();
    }
  }
  
  /// Play system sound as fallback
  static Future<void> _playSystemSound() async {
    try {
      // Use platform channel to play system alert sound
      if (Platform.isIOS) {
        // iOS system sounds
        await SystemSound.play(SystemSoundType.alert);
      } else {
        // Android notification sound
        await SystemSound.play(SystemSoundType.click);
      }
    } catch (e) {
      debugPrint('⚠️ Could not play system sound: $e');
    }
  }
  
  /// Start vibration pattern
  static void _startVibrationPattern() {
    Timer.periodic(const Duration(milliseconds: 500), (timer) {
      if (!_isPlaying) {
        timer.cancel();
        return;
      }
      HapticFeedback.heavyImpact();
    });
  }
  
  /// Show critical alert notification on iOS (bypasses silent mode)
  static Future<void> _showCriticalAlertNotification(String senderName) async {
    try {
      const androidDetails = AndroidNotificationDetails(
        'emergency_channel',
        'Emergency Alerts',
        channelDescription: 'Critical emergency alerts that require immediate attention',
        importance: Importance.max,
        priority: Priority.max,
        playSound: true,
        enableVibration: true,
        ongoing: true,
        autoCancel: false,
        fullScreenIntent: true, // Shows on lock screen
        category: AndroidNotificationCategory.alarm,
        visibility: NotificationVisibility.public,
      );
      
      // iOS critical alert - plays sound even on silent mode
      const iosDetails = DarwinNotificationDetails(
        presentAlert: true,
        presentBadge: true,
        presentSound: true,
        sound: 'default', // Use default critical alert sound
        interruptionLevel: InterruptionLevel.critical, // CRITICAL - bypasses DND
      );
      
      const details = NotificationDetails(
        android: androidDetails,
        iOS: iosDetails,
      );
      
      await _notifications.show(
        999, // Use fixed ID for emergency notifications
        '🚨 EMERGENCY ALERT',
        '$senderName needs help immediately!',
        details,
        payload: 'emergency',
      );
      
      debugPrint('✅ Critical alert notification shown');
    } catch (e) {
      debugPrint('❌ Failed to show critical alert: $e');
    }
  }
  
  /// Stop the emergency alarm
  static Future<void> stopAlarm() async {
    if (!_isPlaying) return;
    
    try {
      debugPrint('🔇 Stopping emergency alarm');
      _isPlaying = false;
      _alarmTimer?.cancel();
      _alarmTimer = null;
      
      await _audioPlayer.stop();
      
      // Cancel the notification
      await _notifications.cancel(999);
      
      debugPrint('✅ Emergency alarm stopped');
    } catch (e) {
      debugPrint('❌ Failed to stop alarm: $e');
    }
  }
  
  /// Check if alarm is currently playing
  static bool get isPlaying => _isPlaying;
  
  /// Dispose resources
  static Future<void> dispose() async {
    await stopAlarm();
    await _audioPlayer.dispose();
  }
}

