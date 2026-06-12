import 'package:home_widget/home_widget.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'emergency_service.dart';
import 'location_service.dart';

/// Panic button service for home screen widgets
/// Allows one-tap emergency trigger from home screen
class PanicButtonService {
  static const FlutterSecureStorage _storage = FlutterSecureStorage();
  static const String _widgetName = 'PanicButtonWidget';

  /// Initialize panic button widget
  static Future<void> initialize() async {
    try {
      // Set up callback for widget tap
      HomeWidget.setAppGroupId('group.guardianconnect'); // iOS App Group ID
      
      // Register callback
      HomeWidget.registerInteractivityCallback(_handlePanicButtonPress);

      // Update widget with current status
      await updateWidget();

      debugPrint('✅ Panic button widget initialized');
    } catch (e) {
      debugPrint('❌ Error initializing panic button widget: $e');
    }
  }

  /// Handle panic button press from widget
  static Future<void> _handlePanicButtonPress(Uri? uri) async {
    try {
      debugPrint('🚨 Panic button pressed from widget!');
      
      // Check if user is authenticated
      final token = await _storage.read(key: 'access_token');
      if (token == null) {
        debugPrint('⚠️ User not authenticated - cannot trigger emergency');
        await _showWidgetError('Please log in to use panic button');
        return;
      }

      // Get current location
      final position = await LocationService.getCurrentLocation();
      if (position == null) {
        await _showWidgetError('Could not get location');
        return;
      }
      
      // Trigger emergency immediately
      try {
        final result = await EmergencyService.createEmergency(
          position: position,
        );
        
        if (result.success && result.emergency != null) {
          debugPrint('✅ Emergency triggered from panic button: ${result.emergency!.id}');

          // Update widget to show emergency active
          await updateWidget(emergencyActive: true);

          // ALERT-DELIVERY HONESTY: show how many contacts were actually
          // reached (or the backend's warning) — never a blind success.
          if (result.warning != null) {
            await _showWidgetMessage('Emergency active — ${result.warning}');
          } else {
            final reached = result.reachedCount;
            await _showWidgetMessage(
              'Emergency active — $reached contact${reached == 1 ? '' : 's'} alerted',
            );
          }
        } else {
          debugPrint('❌ Failed to create emergency: ${result.errorMessage}');
          await _showWidgetError(result.errorMessage ?? 'Failed to trigger emergency');
        }
      } catch (e) {
        debugPrint('❌ Error triggering emergency: $e');
        await _showWidgetError('Failed to trigger emergency');
      }
    } catch (e) {
      debugPrint('❌ Error handling panic button press: $e');
    }
  }

  /// Update widget display
  static Future<void> updateWidget({bool? emergencyActive}) async {
    try {
      final token = await _storage.read(key: 'access_token');
      final isAuthenticated = token != null;

      await HomeWidget.saveWidgetData<String>('status', 
        emergencyActive == true 
          ? 'EMERGENCY ACTIVE' 
          : isAuthenticated 
            ? 'Ready' 
            : 'Not logged in'
      );

      await HomeWidget.saveWidgetData<String>('buttonText', 
        emergencyActive == true 
          ? 'Emergency Active' 
          : 'PANIC BUTTON'
      );

      await HomeWidget.saveWidgetData<String>('buttonColor', 
        emergencyActive == true 
          ? 'red' 
          : 'red'
      );

      // Update widget
      await HomeWidget.updateWidget(
        name: _widgetName,
        iOSName: 'PanicButtonWidget',
        androidName: 'PanicButtonWidget',
      );

      debugPrint('✅ Widget updated');
    } catch (e) {
      debugPrint('❌ Error updating widget: $e');
    }
  }

  /// Show message on widget
  static Future<void> _showWidgetMessage(String message) async {
    try {
      await HomeWidget.saveWidgetData<String>('message', message);
      await HomeWidget.updateWidget(
        name: _widgetName,
        iOSName: 'PanicButtonWidget',
        androidName: 'PanicButtonWidget',
      );
    } catch (e) {
      debugPrint('❌ Error showing widget message: $e');
    }
  }

  /// Show error on widget
  static Future<void> _showWidgetError(String error) async {
    try {
      await HomeWidget.saveWidgetData<String>('error', error);
      await HomeWidget.updateWidget(
        name: _widgetName,
        iOSName: 'PanicButtonWidget',
        androidName: 'PanicButtonWidget',
      );
    } catch (e) {
      debugPrint('❌ Error showing widget error: $e');
    }
  }
}

