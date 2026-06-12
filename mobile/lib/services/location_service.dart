import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';
import 'log_collector.dart';

class LocationService {
  static Future<bool> requestPermissions() async {
    final status = await Permission.location.request();
    return status.isGranted;
  }

  static Future<bool> checkPermissions() async {
    final status = await Permission.location.status;
    return status.isGranted;
  }

  // Standard location (good accuracy for general use)
  static Future<Position?> getCurrentLocation() async {
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        LogCollector.logLocation('Location services are disabled', level: LogLevel.warning);
        return null;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          LogCollector.logLocation('Location permission denied', level: LogLevel.error);
          return null;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        LogCollector.logLocation('Location permission denied forever', level: LogLevel.error);
        return null;
      }

      // OPTIMIZED: Maximum GPS accuracy
      LogCollector.logLocation('Requesting location with maximum GPS accuracy');
      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.best, // Maximum GPS accuracy
        timeLimit: const Duration(seconds: 30), // Give GPS time for cold start
      );
      
      LogCollector.logLocation(
        'Location obtained: ${position.latitude}, ${position.longitude} (accuracy: ${position.accuracy}m)',
        level: LogLevel.info,
        metadata: {
          'latitude': position.latitude,
          'longitude': position.longitude,
          'accuracy': position.accuracy,
          'altitude': position.altitude,
          'speed': position.speed,
          'heading': position.heading,
          'timestamp': position.timestamp.toIso8601String(),
        },
      );
      
      return position;
    } catch (e) {
      LogCollector.logError(
        'Error getting location',
        source: LogSource.location,
        error: e,
      );
      return null;
    }
  }

  // Emergency location (maximum accuracy for critical situations)
  static Future<Position?> getEmergencyLocation() async {
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        LogCollector.logLocation('Location services are disabled', level: LogLevel.warning);
        return null;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          LogCollector.logLocation('Location permission denied', level: LogLevel.error);
          return null;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        LogCollector.logLocation('Location permission denied forever', level: LogLevel.error);
        return null;
      }

      // MAXIMUM ACCURACY for emergencies - forces GPS usage
      LogCollector.logLocation('Requesting emergency location with best-for-navigation accuracy');
      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.bestForNavigation, // Best possible GPS accuracy
        timeLimit: const Duration(seconds: 30), // Give GPS time for cold start
      );
      
      LogCollector.logLocation(
        'Emergency location obtained: ${position.latitude}, ${position.longitude} (accuracy: ${position.accuracy}m)',
        level: LogLevel.info,
        metadata: {
          'latitude': position.latitude,
          'longitude': position.longitude,
          'accuracy': position.accuracy,
          'altitude': position.altitude,
          'speed': position.speed,
          'heading': position.heading,
          'timestamp': position.timestamp.toIso8601String(),
          'isEmergency': true,
        },
      );
      
      return position;
    } catch (e) {
      LogCollector.logError(
        'Error getting emergency location',
        source: LogSource.location,
        error: e,
      );
      return null;
    }
  }

  // STATIC LOCATION MODEL (Jun 2026 backend revamp):
  // The backend no longer expects continuous location polling. Location is
  // captured ONCE at emergency trigger/accept, and only updated when the
  // user explicitly presses the "update my location" button. The old
  // continuous position streams (getLocationStream /
  // getEmergencyLocationStream / getActiveEmergencyLocationStream) have
  // been removed — use getCurrentLocation() / getEmergencyLocation() for
  // one-shot reads instead.

  // Check if location accuracy is GPS-quality (≤20m typically indicates GPS)
  static bool isGPSQuality(Position position) {
    // GPS typically provides 3-20m accuracy
    // WiFi/cell tower: 50-100m+ accuracy
    return position.accuracy <= 20;
  }
}






