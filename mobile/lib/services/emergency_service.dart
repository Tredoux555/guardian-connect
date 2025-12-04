import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import '../models/emergency.dart';
import 'api_service.dart';
import 'location_service.dart';
import 'dart:convert';

/// Result of emergency creation operation
class EmergencyCreationResult {
  final bool success;
  final Emergency? emergency;
  final String? errorMessage;
  final bool locationShared;
  final String? existingEmergencyId; // If emergency already exists

  EmergencyCreationResult({
    required this.success,
    this.emergency,
    this.errorMessage,
    this.locationShared = false,
    this.existingEmergencyId,
  });
}

/// Custom exceptions for emergency operations
class EmergencyException implements Exception {
  final String message;
  final int? statusCode;

  EmergencyException(this.message, [this.statusCode]);

  @override
  String toString() => message;
}

class EmergencyAlreadyExistsException extends EmergencyException {
  final String existingEmergencyId;

  EmergencyAlreadyExistsException(this.existingEmergencyId)
      : super('You already have an active emergency');
}

class EmergencyCreationFailedException extends EmergencyException {
  EmergencyCreationFailedException(String message, [int? statusCode])
      : super(message, statusCode);
}

class LocationSharingFailedException extends EmergencyException {
  LocationSharingFailedException(String message) : super(message);
}

/// Service class for emergency operations
/// Separates business logic from UI to prevent widget lifecycle issues
class EmergencyService {
  /// Create a new emergency with location
  /// Returns EmergencyCreationResult with success status and emergency data
  static Future<EmergencyCreationResult> createEmergency({
    required Position position,
    int locationRetries = 2,
  }) async {
    try {
      // Step 1: Create emergency
      debugPrint('📡 Creating emergency...');
      final response = await ApiService.post('/emergencies/create', {});
      debugPrint('📡 Emergency creation response: ${response.statusCode}');

      // Handle existing emergency case
      if (response.statusCode == 400) {
        final errorData = jsonDecode(response.body);
        if (errorData['error'] == 'You already have an active emergency' &&
            errorData['emergencyId'] != null) {
          final existingEmergencyId = errorData['emergencyId'] as String;
          debugPrint('⚠️ Active emergency exists: $existingEmergencyId');
          return EmergencyCreationResult(
            success: false,
            errorMessage: 'You already have an active emergency',
            existingEmergencyId: existingEmergencyId,
          );
        }
      }

      // Handle creation failure
      if (response.statusCode != 201) {
        final errorBody = response.body;
        debugPrint('❌ Emergency creation failed: $errorBody');
        throw EmergencyCreationFailedException(
          'Failed to create emergency: $errorBody',
          response.statusCode,
        );
      }

      // Parse emergency data
      final data = jsonDecode(response.body);
      debugPrint('📡 Emergency created: ${data.toString()}');
      final emergencyId = data['emergency']['id'] as String;
      debugPrint('📡 Emergency ID: $emergencyId');

      final emergency = Emergency(
        id: emergencyId,
        userId: '', // Will be set when we load emergency details
        createdAt: DateTime.parse(data['emergency']['createdAt'] as String),
        status: data['emergency']['status'] as String,
      );

      // Step 2: Share location with retry logic
      bool locationShared = false;
      debugPrint('📍 Attempting to share location...');
      
      for (int attempt = 0; attempt <= locationRetries; attempt++) {
        try {
          final locationResponse = await ApiService.post(
            '/emergencies/$emergencyId/location',
            {
              'latitude': position.latitude,
              'longitude': position.longitude,
              'accuracy': position.accuracy,
            },
          );

          if (locationResponse.statusCode == 200 || locationResponse.statusCode == 201) {
            debugPrint('✅ Location shared successfully (attempt ${attempt + 1})');
            locationShared = true;
            break;
          } else {
            debugPrint('⚠️ Location sharing attempt ${attempt + 1} failed: ${locationResponse.statusCode}');
            if (attempt < locationRetries) {
              // Wait before retry (exponential backoff)
              final delay = Duration(milliseconds: 1000 * (attempt + 1));
              debugPrint('⏳ Retrying location share in ${delay.inMilliseconds}ms...');
              await Future.delayed(delay);
            }
          }
        } catch (locationError) {
          debugPrint('⚠️ Location sharing attempt ${attempt + 1} failed: $locationError');
          if (attempt == locationRetries) {
            // Last attempt failed - log but don't throw (emergency was created)
            debugPrint('⚠️ Warning: Failed to send initial location after $locationRetries retries: $locationError');
            debugPrint('💡 Location can be sent later');
          } else {
            // Wait before retry
            final delay = Duration(milliseconds: 1000 * (attempt + 1));
            await Future.delayed(delay);
          }
        }
      }

      return EmergencyCreationResult(
        success: true,
        emergency: emergency,
        locationShared: locationShared,
      );
    } on EmergencyCreationFailedException catch (e) {
      return EmergencyCreationResult(
        success: false,
        errorMessage: e.message,
      );
    } catch (e) {
      debugPrint('❌ Unexpected error creating emergency: $e');
      return EmergencyCreationResult(
        success: false,
        errorMessage: 'Unexpected error: ${e.toString()}',
      );
    }
  }

  /// Get emergency location with maximum accuracy
  static Future<Position?> getEmergencyLocation() async {
    try {
      // Request location permission
      final hasPermission = await LocationService.requestPermissions();
      if (!hasPermission) {
        debugPrint('❌ Location permission denied');
        return null;
      }

      // Get emergency location with maximum GPS accuracy
      final position = await LocationService.getEmergencyLocation();
      
      if (position != null) {
        // Log GPS quality
        if (LocationService.isGPSQuality(position)) {
          debugPrint('✅ GPS-quality location obtained: ${position.accuracy.toStringAsFixed(1)}m accuracy');
        } else {
          debugPrint('⚠️ Location accuracy: ${position.accuracy.toStringAsFixed(1)}m');
        }
      }
      
      return position;
    } catch (e) {
      debugPrint('❌ Error getting emergency location: $e');
      return null;
    }
  }
}

