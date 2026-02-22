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

  // Standard location stream (good accuracy)
  static Stream<Position> getLocationStream() {
    LogCollector.logLocation('Starting location stream with maximum GPS accuracy');
    return Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.best, // Maximum GPS accuracy
        distanceFilter: 5, // Update every 5 meters (more frequent)
        timeLimit: const Duration(seconds: 30),
      ),
    );
  }

  // Emergency location stream (maximum accuracy for active emergencies)
  static Stream<Position> getEmergencyLocationStream({bool isActiveEmergency = false}) {
    LogCollector.logLocation('Starting emergency location stream with best-for-navigation accuracy');
    
    // During active emergency, update more frequently
    final distanceFilter = isActiveEmergency ? 1 : 3; // Every 1 meter during active emergency
    
    return Geolocator.getPositionStream(
      locationSettings: LocationSettings(
        accuracy: LocationAccuracy.bestForNavigation, // Best possible GPS accuracy
        distanceFilter: distanceFilter, // Very frequent updates
        timeLimit: const Duration(seconds: 60),
      ),
    ).timeout(
      const Duration(seconds: 60),
      onTimeout: (sink) {
        LogCollector.logLocation('Location stream timeout - continuing with last known position', level: LogLevel.warning);
        sink.close();
      },
    );
  }
  
  /// Get high-frequency location stream for active emergency (updates every 1 meter)
  static Stream<Position> getActiveEmergencyLocationStream() {
    LogCollector.logLocation('Starting HIGH-FREQUENCY location stream for active emergency');
    return Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.bestForNavigation,
        distanceFilter: 1, // Update every 1 meter
      ),
    );
  }

  // Check if location accuracy is GPS-quality (≤20m typically indicates GPS)
  static bool isGPSQuality(Position position) {
    // GPS typically provides 3-20m accuracy
    // WiFi/cell tower: 50-100m+ accuracy
    return position.accuracy <= 20;
  }
}






