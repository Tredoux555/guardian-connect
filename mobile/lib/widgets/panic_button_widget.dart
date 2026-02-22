import 'package:flutter/material.dart';
import 'package:home_widget/home_widget.dart';
import '../services/emergency_service.dart';
import '../services/location_service.dart';
import 'dart:async';

/// Panic Button Widget Service
/// Provides home screen widget for one-tap emergency trigger
class PanicButtonWidget {
  static const String _widgetName = 'PanicButtonWidget';
  static const String _channelId = 'com.guardianconnect.panicbutton';
  
  /// Initialize home widget
  static Future<void> initialize() async {
    try {
      await HomeWidget.setAppGroupId('group.com.guardianconnect');
      
      // Register callback for widget taps
      HomeWidget.registerInteractivityCallback(_onWidgetTap);
      
      debugPrint('✅ Panic button widget initialized');
    } catch (e) {
      debugPrint('⚠️ Failed to initialize panic button widget: $e');
      // Widget may not be available on all devices
    }
  }
  
  /// Update widget with current status
  static Future<void> updateWidget({
    required bool isEmergencyActive,
    String? emergencyId,
  }) async {
    try {
      await HomeWidget.saveWidgetData<String>('status', 
        isEmergencyActive ? 'active' : 'ready');
      
      if (emergencyId != null) {
        await HomeWidget.saveWidgetData<String>('emergencyId', emergencyId);
      }
      
      // Update widget UI
      await HomeWidget.updateWidget(
        name: _widgetName,
        iOSName: _widgetName,
        androidName: _widgetName,
      );
      
      debugPrint('✅ Panic button widget updated');
    } catch (e) {
      debugPrint('⚠️ Failed to update panic button widget: $e');
    }
  }
  
  /// Handle widget tap
  static Future<void> _onWidgetTap(Uri? uri) async {
    debugPrint('🚨 Panic button widget tapped!');
    
    if (uri?.host == 'panic' || uri == null) {
      // Trigger emergency immediately
      await _triggerEmergency();
    }
  }
  
  /// Trigger emergency from widget
  static Future<void> _triggerEmergency() async {
    try {
      debugPrint('🚨 Triggering emergency from panic button widget...');
      
      // Request location permission
      final hasPermission = await LocationService.requestPermissions();
      if (!hasPermission) {
        debugPrint('❌ Location permission denied');
        return;
      }
      
      // Get current location
      final position = await LocationService.getCurrentLocation();
      
      if (position == null) {
        debugPrint('❌ Could not get location');
        return;
      }
      
      // Create emergency
      final result = await EmergencyService.createEmergency(
        position: position,
      );
      
      if (result.success && result.emergency != null) {
        debugPrint('✅ Emergency created from panic button: ${result.emergency!.id}');
        
        // Update widget to show active status
        await updateWidget(
          isEmergencyActive: true,
          emergencyId: result.emergency!.id,
        );
      } else {
        debugPrint('❌ Failed to create emergency: ${result.errorMessage}');
      }
    } catch (e) {
      debugPrint('❌ Error triggering emergency from widget: $e');
    }
  }
  
  /// Set up widget UI (called from native code)
  static Future<void> setupWidgetUI() async {
    // This would typically be done in native iOS/Android code
    // For iOS: Create a widget extension
    // For Android: Create a widget provider
    debugPrint('📱 Setting up panic button widget UI');
  }
}

/// Panic Button Widget UI (for in-app display)
class PanicButtonWidgetUI extends StatelessWidget {
  final VoidCallback? onPressed;
  final bool isEmergencyActive;
  
  const PanicButtonWidgetUI({
    super.key,
    this.onPressed,
    this.isEmergencyActive = false,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onLongPress: onPressed, // Long press to trigger (prevents accidental taps)
      child: Container(
        width: 120,
        height: 120,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: isEmergencyActive ? Colors.grey : Colors.red,
          boxShadow: [
            BoxShadow(
              color: Colors.red.withOpacity(0.5),
              blurRadius: 20,
              spreadRadius: 5,
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              isEmergencyActive ? Icons.check_circle : Icons.warning,
              color: Colors.white,
              size: 48,
            ),
            const SizedBox(height: 8),
            Text(
              isEmergencyActive ? 'ACTIVE' : 'PANIC',
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 16,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

