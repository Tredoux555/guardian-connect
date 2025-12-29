import 'package:flutter/foundation.dart';
import 'dart:async';
import 'dart:convert';
import 'api_service.dart';
import 'log_collector.dart';

/// Emergency escalation service
/// Automatically escalates to emergency services if no one responds within X minutes
class EmergencyEscalationService {
  static Timer? _escalationTimer;
  static const Duration _escalationDelay = Duration(minutes: 5); // Escalate after 5 minutes
  
  /// Start escalation timer for an emergency
  static void startEscalationTimer(String emergencyId, String senderName) {
    // Cancel any existing timer
    _escalationTimer?.cancel();
    
    debugPrint('⏰ Starting escalation timer for emergency: $emergencyId');
    debugPrint('   Will escalate after ${_escalationDelay.inMinutes} minutes if no response');
    
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
  
  /// Check if emergency needs escalation and escalate if necessary
  static Future<void> _checkAndEscalate(String emergencyId, String senderName) async {
    try {
      debugPrint('🔍 Checking if emergency needs escalation: $emergencyId');
      
      // Check if emergency has been accepted by anyone
      final response = await ApiService.get('/emergencies/$emergencyId');
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final emergency = data['emergency'];
        final locations = data['locations'] as List?;
        
        // Count responders (locations excluding sender)
        final senderUserId = emergency['user_id'];
        final responderCount = locations?.where((loc) => loc['user_id'] != senderUserId).length ?? 0;
        
        if (responderCount == 0) {
          // No responders - escalate to emergency services
          debugPrint('🚨 NO RESPONDERS - Escalating to emergency services');
          await _escalateToEmergencyServices(emergencyId, senderName, emergency);
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
  
  /// Escalate to emergency services
  static Future<void> _escalateToEmergencyServices(
    String emergencyId,
    String senderName,
    Map<String, dynamic> emergency,
  ) async {
    try {
      debugPrint('🚨 ESCALATING TO EMERGENCY SERVICES');
      debugPrint('   Emergency ID: $emergencyId');
      debugPrint('   Sender: $senderName');
      
      // Get emergency location
      final locations = emergency['locations'] as List?;
      final senderLocation = locations?.firstWhere(
        (loc) => loc['user_id'] == emergency['user_id'],
        orElse: () => null,
      );
      
      if (senderLocation == null) {
        debugPrint('⚠️ No location data - cannot escalate');
        return;
      }
      
      // Call backend escalation endpoint
      final response = await ApiService.post('/emergencies/$emergencyId/escalate', {
        'reason': 'No responders within ${_escalationDelay.inMinutes} minutes',
        'latitude': senderLocation['latitude'],
        'longitude': senderLocation['longitude'],
        'sender_name': senderName,
      });
      
      if (response.statusCode == 200) {
        debugPrint('✅ Emergency escalated successfully');
        LogCollector.logMobile(
          'Emergency escalated to emergency services',
          level: LogLevel.warning,
          category: 'EmergencyEscalation',
          metadata: {'emergencyId': emergencyId},
        );
      } else {
        debugPrint('❌ Failed to escalate: ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('❌ Error escalating emergency: $e');
      LogCollector.logError(
        'Error escalating emergency to services',
        source: LogSource.mobile,
        error: e,
      );
    }
  }
}
