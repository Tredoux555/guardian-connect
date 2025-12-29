import 'dart:async';
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// Service to play loud emergency alarm sounds that bypass silent mode
/// This is critical for emergency alerts - they MUST be heard
class EmergencyAlarmService {
  static AudioPlayer? _audioPlayer;
  static final FlutterLocalNotificationsPlugin _notifications = FlutterLocalNotificationsPlugin();
  static bool _isPlaying = false;
  static bool _initialized = false;
  static Timer? _alarmTimer;
  static Timer? _loopTimer;
  static Timer? _vibrationTimer;
  
  /// Initialize the alarm service
  static Future<void> initialize() async {
    if (_initialized) return;
    
    try {
      debugPrint('🔊 Initializing emergency alarm service...');
      
      // Create audio player with proper configuration
      _audioPlayer = AudioPlayer();
      
      // Set audio context for iOS - this is CRITICAL for playing on silent mode
      await _audioPlayer!.setAudioContext(AudioContext(
        iOS: AudioContextIOS(
          category: AVAudioSessionCategory.playback, // Plays even when silent switch is on
          options: {
            AVAudioSessionOptions.mixWithOthers,
            AVAudioSessionOptions.duckOthers,
          },
        ),
        android: const AudioContextAndroid(
          isSpeakerphoneOn: true,
          audioMode: AndroidAudioMode.normal,
          stayAwake: true,
          contentType: AndroidContentType.sonification,
          usageType: AndroidUsageType.alarm,
          audioFocus: AndroidAudioFocus.gainTransientMayDuck,
        ),
      ));
      
      await _audioPlayer!.setVolume(1.0); // Maximum volume
      
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
      debugPrint('🚨 PLAYING EMERGENCY ALARM for ${senderName ?? "Someone"}');
      _isPlaying = true;
      
      // Ensure initialized
      if (!_initialized) {
        await initialize();
      }
      
      // On iOS, show critical alert notification (bypasses silent mode with its own sound)
      if (Platform.isIOS) {
        await _showCriticalAlertNotification(senderName ?? 'Someone');
      }
      
      // Play the alarm sound
      await _playAlarmSound();
      
      // Start continuous vibration
      _startVibrationPattern();
      
      // Auto-stop after 60 seconds to prevent battery drain
      _alarmTimer?.cancel();
      _alarmTimer = Timer(const Duration(seconds: 60), () {
        stopAlarm();
      });
      
    } catch (e) {
      debugPrint('❌ Failed to play emergency alarm: $e');
      _isPlaying = false;
      // Even if sound fails, at least vibrate
      _startVibrationPattern();
    }
  }
  
  /// Play alarm sound - uses multiple methods to ensure it plays
  static Future<void> _playAlarmSound() async {
    try {
      // Recreate audio player if needed
      _audioPlayer ??= AudioPlayer();
      
      // Configure for alarm playback on iOS
      await _audioPlayer!.setAudioContext(AudioContext(
        iOS: AudioContextIOS(
          category: AVAudioSessionCategory.playback,
          options: {
            AVAudioSessionOptions.mixWithOthers,
            AVAudioSessionOptions.duckOthers,
          },
        ),
        android: const AudioContextAndroid(
          isSpeakerphoneOn: true,
          audioMode: AndroidAudioMode.normal,
          stayAwake: true,
          contentType: AndroidContentType.sonification,
          usageType: AndroidUsageType.alarm,
          audioFocus: AndroidAudioFocus.gainTransientMayDuck,
        ),
      ));
      
      await _audioPlayer!.setVolume(1.0);
      await _audioPlayer!.setReleaseMode(ReleaseMode.loop);
      
      // Try playing from a reliable URL source
      // Using a loud, recognizable emergency siren
      debugPrint('🔊 Attempting to play alarm sound...');
      
      try {
        // Use a data URI for a simple beep tone that's embedded
        // This guarantees it works without network
        await _audioPlayer!.play(
          AssetSource('sounds/emergency_alarm.mp3'),
          mode: PlayerMode.mediaPlayer,
        );
        debugPrint('✅ Playing alarm from asset');
      } catch (assetError) {
        debugPrint('⚠️ Asset not found, trying URL: $assetError');
        
        try {
          // Fallback to URL source
          await _audioPlayer!.play(
            UrlSource('https://www.soundjay.com/misc/sounds/fail-buzzer-01.mp3'),
            mode: PlayerMode.mediaPlayer,
          );
          debugPrint('✅ Playing alarm from URL');
        } catch (urlError) {
          debugPrint('⚠️ URL failed: $urlError');
          // Last resort: use system beeps in a loop
          _startBeepLoop();
        }
      }
      
    } catch (e) {
      debugPrint('❌ Failed to play alarm sound: $e');
      // Fallback to system beeps
      _startBeepLoop();
    }
  }
  
  /// Start a loop of system beeps as ultimate fallback
  static void _startBeepLoop() {
    debugPrint('🔊 Starting system beep loop as fallback');
    _loopTimer?.cancel();
    _loopTimer = Timer.periodic(const Duration(milliseconds: 800), (timer) {
      if (!_isPlaying) {
        timer.cancel();
        return;
      }
      // Play system alert sound
      SystemSound.play(SystemSoundType.alert);
    });
  }
  
  /// Start vibration pattern
  static void _startVibrationPattern() {
    debugPrint('📳 Starting vibration pattern');
    _vibrationTimer?.cancel();
    _vibrationTimer = Timer.periodic(const Duration(milliseconds: 400), (timer) {
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
        fullScreenIntent: true,
        category: AndroidNotificationCategory.alarm,
        visibility: NotificationVisibility.public,
      );
      
      // iOS critical alert - this WILL play sound even on silent mode
      // Note: Requires special entitlement from Apple for production
      const iosDetails = DarwinNotificationDetails(
        presentAlert: true,
        presentBadge: true,
        presentSound: true,
        sound: 'default',
        interruptionLevel: InterruptionLevel.critical,
      );
      
      const details = NotificationDetails(
        android: androidDetails,
        iOS: iosDetails,
      );
      
      await _notifications.show(
        999,
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
      
      // Cancel all timers
      _alarmTimer?.cancel();
      _alarmTimer = null;
      _loopTimer?.cancel();
      _loopTimer = null;
      _vibrationTimer?.cancel();
      _vibrationTimer = null;
      
      // Stop audio player
      try {
        await _audioPlayer?.stop();
      } catch (e) {
        debugPrint('⚠️ Error stopping audio: $e');
      }
      
      // Cancel the notification
      await _notifications.cancel(999);
      
      debugPrint('✅ Emergency alarm stopped');
    } catch (e) {
      debugPrint('❌ Failed to stop alarm: $e');
      _isPlaying = false;
    }
  }
  
  /// Check if alarm is currently playing
  static bool get isPlaying => _isPlaying;
  
  /// Dispose resources
  static Future<void> dispose() async {
    await stopAlarm();
    await _audioPlayer?.dispose();
    _audioPlayer = null;
  }
}
