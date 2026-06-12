import 'package:flutter/foundation.dart';
import 'dart:async';
import 'dart:convert';
import 'api_service.dart';
import 'log_collector.dart';

/// Emergency escalation service.
///
/// HONESTY NOTE (Jun 2026 backend revamp): Guardian Connect CANNOT contact
/// 911 or any emergency service. The backend's POST
/// /emergencies/:id/escalate endpoint now returns 501 with:
///   { error, message: "...call your local emergency number directly.",
///     feature: "coming_soon" }
/// instead of the old fake "escalated to emergency services" success.
/// This service must NEVER claim escalation succeeded. If escalation is
/// requested and unavailable, surface the backend's honest message to the
/// user via [onEscalationUnavailable].
class EmergencyEscalationService {
  static Timer? _escalationTimer;
  static const Duration _escalationDelay = Duration(minutes: 5);

  /// UI hook: called with the backend's honest message when escalation is
  /// not available (the only current outcome). Wire this to a dialog/banner
  /// that tells the user to call their local emergency number.
  static void Function(String message)? onEscalationUnavailable;

  /// Default honest message, used if the backend response can't be parsed.
  static const String fallbackUnavailableMessage =
      'Guardian Connect cannot contact 911 or other emergency services. '
      'If you need emergency services, call your local emergency number directly.';

  /// Start escalation timer for an emergency.
  /// NOTE: escalation does NOT reach emergency services — if nobody responds,
  /// the user is told honestly to call their local emergency number.
  static void startEscalationTimer(String emergencyId, String senderName) {
    // Cancel any existing timer
    _escalationTimer?.cancel();

    debugPrint('⏰ Starting escalation check timer for emergency: $emergencyId');
    debugPrint('   Will check for responders after ${_escalationDelay.inMinutes} minutes');

    _escalationTimer = Timer(_escalationDelay, () async {
      await _checkAndEscalate(emergencyId, senderName);
    });

    LogCollector.logMobile(
      'Escalation timer started for emergency $emergencyId',
      level: LogLevel.info,
      category: 'EmergencyEscalation',
    );
  }

  /// Cancel escalation timer (if emergency was responded to)
  static void cancelEscalationTimer() {
    _escalationTimer?.cancel();
    _escalationTimer = null;
    debugPrint('✅ Escalation timer cancelled');
  }

  /// Check whether anyone has responded; if not, request escalation from the
  /// backend. The backend will refuse honestly (501) until a real
  /// emergency-services integration exists.
  static Future<void> _checkAndEscalate(String emergencyId, String senderName) async {
    try {
      debugPrint('🔍 Checking responders for emergency: $emergencyId');

      final response = await ApiService.get('/emergencies/$emergencyId');
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final emergency = data['emergency'];
        final locations = data['locations'] as List?;

        // Count responders (locations excluding sender)
        final senderUserId = emergency['user_id'];
        final responderCount = locations?.where((loc) => loc['user_id'] != senderUserId).length ?? 0;

        if (responderCount == 0) {
          debugPrint('⚠️ No responders after ${_escalationDelay.inMinutes} minutes — requesting escalation (backend will respond honestly)');
          await _requestEscalation(emergencyId, senderName);
        } else {
          debugPrint('✅ Emergency has $responderCount responder(s) - no escalation needed');
          cancelEscalationTimer();
        }
      }
    } catch (e) {
      debugPrint('❌ Error checking escalation: $e');
      LogCollector.logError(
        'Error checking emergency escalation',
        source: LogSource.mobile,
        error: e,
      );
    }
  }

  /// Ask the backend to escalate. The current backend ALWAYS returns 501
  /// (escalation not implemented) — we relay that truth to the user and log
  /// it as a failure. We never, under any circumstance, tell the user that
  /// emergency services were contacted.
  static Future<void> _requestEscalation(
    String emergencyId,
    String senderName,
  ) async {
    try {
      final response = await ApiService.post('/emergencies/$emergencyId/escalate', {});

      if (response.statusCode == 501) {
        // Honest refusal: feature not available. Show the real message.
        String message = fallbackUnavailableMessage;
        try {
          final body = jsonDecode(response.body);
          if (body is Map && body['message'] is String) {
            message = body['message'] as String;
          }
        } catch (_) {
          // keep fallback message
        }
        debugPrint('⚠️ Escalation not available (501): $message');
        LogCollector.logMobile(
          'Escalation unavailable — user must call local emergency number',
          level: LogLevel.warning,
          category: 'EmergencyEscalation',
          metadata: {'emergencyId': emergencyId, 'status': 501},
        );
        onEscalationUnavailable?.call(message);
      } else {
        // Any other status (including unexpected 200s from an old server):
        // do NOT claim success — treat as a failed/unknown escalation.
        debugPrint('❌ Escalation request returned unexpected status ${response.statusCode} — NOT claiming emergency services were contacted');
        LogCollector.logError(
          'Escalation request failed or returned unexpected status',
          source: LogSource.mobile,
          error: 'HTTP ${response.statusCode}: ${response.body}',
        );
        onEscalationUnavailable?.call(fallbackUnavailableMessage);
      }
    } catch (e) {
      debugPrint('❌ Error requesting escalation: $e');
      LogCollector.logError(
        'Error requesting emergency escalation',
        source: LogSource.mobile,
        error: e,
      );
      onEscalationUnavailable?.call(fallbackUnavailableMessage);
    }
  }
}
