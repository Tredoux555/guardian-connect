// Agora RTC is optional - video calling requires Agora App ID
// Temporarily disabled due to CocoaPods download issues
// To enable: uncomment agora_rtc_engine in pubspec.yaml and run pod install
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'log_collector.dart' as logger;

// TODO: Re-enable when Agora is available
// import 'package:agora_rtc_engine/agora_rtc_engine.dart';

/// Video calling service for emergency communication
/// Uses Agora RTC for real-time video/audio calls during emergencies
/// NOTE: Currently disabled - requires Agora RTC package and App ID
class VideoCallService {
  // static RtcEngine? _engine; // Disabled until Agora is available
  static bool _isInitialized = false;
  static String? _currentChannelId;
  static bool _isInCall = false;
  
  // Callbacks
  static Function(String uid)? onUserJoined;
  static Function(String uid)? onUserOffline;
  static Function()? onCallEnded;
  
  /// Initialize Agora engine
  /// NOTE: Currently disabled - requires Agora RTC package
  static Future<bool> initialize(String appId) async {
    debugPrint('⚠️ Video calling is currently disabled - Agora RTC package not available');
    debugPrint('   To enable: Add agora_rtc_engine to pubspec.yaml and configure Agora App ID');
    return false;
    
    // TODO: Re-enable when Agora is available
    /*
    if (_isInitialized && _engine != null) {
      debugPrint('✅ Video call service already initialized');
      return true;
    }
    
    try {
      // Request camera and microphone permissions
      final cameraStatus = await Permission.camera.request();
      final micStatus = await Permission.microphone.request();
      
      if (!cameraStatus.isGranted || !micStatus.isGranted) {
        debugPrint('❌ Camera or microphone permission denied');
        return false;
      }
      
      // Create Agora engine
      _engine = createAgoraRtcEngine();
      await _engine!.initialize(RtcEngineContext(
        appId: appId,
        channelProfile: ChannelProfileType.channelProfileCommunication,
      ));
      
      // Enable video
      await _engine!.enableVideo();
      await _engine!.enableAudio();
      
      // Set up event handlers
      _engine!.registerEventHandler(
        RtcEngineEventHandler(
          onJoinChannelSuccess: (RtcConnection connection, int elapsed) {
            debugPrint('✅ Joined video call channel: ${connection.channelId}');
            _isInCall = true;
            logger.LogCollector.logMobile(
              'Joined video call channel',
              level: logger.LogLevel.info,
              category: 'VideoCall',
            );
          },
          onUserJoined: (RtcConnection connection, int remoteUid, int elapsed) {
            debugPrint('👤 User joined call: $remoteUid');
            onUserJoined?.call(remoteUid.toString());
          },
          onUserOffline: (RtcConnection connection, int remoteUid, UserOfflineReasonType reason) {
            debugPrint('👤 User left call: $remoteUid');
            onUserOffline?.call(remoteUid.toString());
          },
          onLeaveChannel: (RtcConnection connection, RtcStats stats) {
            debugPrint('📞 Left video call channel');
            _isInCall = false;
            _currentChannelId = null;
            onCallEnded?.call();
          },
          onError: (ErrorCodeType err, String msg) {
            debugPrint('❌ Agora error: $err - $msg');
            logger.LogCollector.logError(
              'Agora RTC error',
              source: logger.LogSource.mobile,
              error: '$err: $msg',
            );
          },
        ),
      );
      
      _isInitialized = true;
      debugPrint('✅ Video call service initialized');
      return true;
    } catch (e) {
      debugPrint('❌ Failed to initialize video call service: $e');
      logger.LogCollector.logError(
        'Failed to initialize video call service',
        source: logger.LogSource.mobile,
        error: e,
      );
      return false;
    }
    */
  }
  
  /// Join a video call channel
  /// NOTE: Currently disabled - requires Agora RTC package
  static Future<bool> joinChannel(String channelId, int uid) async {
    debugPrint('⚠️ Video calling is disabled - Agora RTC not available');
    return false;
  }
  
  /// Leave the current call
  static Future<void> leaveChannel() async {
    _currentChannelId = null;
    _isInCall = false;
  }
  
  /// Toggle camera on/off
  static Future<void> toggleCamera() async {
    debugPrint('⚠️ Video calling is disabled');
  }
  
  /// Toggle microphone on/off
  static Future<void> toggleMicrophone() async {
    debugPrint('⚠️ Video calling is disabled');
  }
  
  /// Switch camera (front/back)
  static Future<void> switchCamera() async {
    debugPrint('⚠️ Video calling is disabled');
  }
  
  /// Get local video view widget
  static Widget getLocalVideoView() {
    // This would typically use AgoraVideoView widget
    // For now, return a placeholder
    return Container(
      color: Colors.black,
      child: const Center(
        child: Text(
          'Local Video',
          style: TextStyle(color: Colors.white),
        ),
      ),
    );
  }
  
  /// Get remote video view widget
  static Widget getRemoteVideoView(int uid) {
    // This would typically use AgoraVideoView widget
    return Container(
      color: Colors.black,
      child: Center(
        child: Text(
          'Remote Video ($uid)',
          style: const TextStyle(color: Colors.white),
        ),
      ),
    );
  }
  
  static bool get _isCameraMuted => false; // Track state
  static bool get _isMicrophoneMuted => false; // Track state
  static bool get isInCall => _isInCall;
  static String? get currentChannelId => _currentChannelId;
  
  /// Dispose resources
  static Future<void> dispose() async {
    await leaveChannel();
    // await _engine?.release(); // Disabled until Agora is available
    // _engine = null;
    _isInitialized = false;
  }
}
