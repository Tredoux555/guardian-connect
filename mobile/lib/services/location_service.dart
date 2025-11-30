import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';

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
        print('⚠️ Location services are disabled');
        return null;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          print('❌ Location permission denied');
          return null;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        print('❌ Location permission denied forever');
        return null;
      }

      // OPTIMIZED: Maximum GPS accuracy
      print('📍 Requesting location with maximum GPS accuracy...');
      return await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.best, // Maximum GPS accuracy
        timeLimit: const Duration(seconds: 30), // Give GPS time for cold start
      );
    } catch (e) {
      print('❌ Error getting location: $e');
      return null;
    }
  }

  // Emergency location (maximum accuracy for critical situations)
  static Future<Position?> getEmergencyLocation() async {
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        print('⚠️ Location services are disabled');
        return null;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          print('❌ Location permission denied');
          return null;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        print('❌ Location permission denied forever');
        return null;
      }

      // MAXIMUM ACCURACY for emergencies - forces GPS usage
      print('🚨 Requesting emergency location with best-for-navigation accuracy...');
      return await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.bestForNavigation, // Best possible GPS accuracy
        timeLimit: const Duration(seconds: 30), // Give GPS time for cold start
      );
    } catch (e) {
      print('❌ Error getting emergency location: $e');
      return null;
    }
  }

  // Standard location stream (good accuracy)
  static Stream<Position> getLocationStream() {
    print('📍 Starting location stream with maximum GPS accuracy...');
    return Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.best, // Maximum GPS accuracy
        distanceFilter: 5, // Update every 5 meters (more frequent)
        timeLimit: const Duration(seconds: 30),
      ),
    );
  }

  // Emergency location stream (maximum accuracy for active emergencies)
  static Stream<Position> getEmergencyLocationStream() {
    print('🚨 Starting emergency location stream with best-for-navigation accuracy...');
    return Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.bestForNavigation, // Best possible GPS accuracy
        distanceFilter: 3, // Update every 3 meters (very frequent for emergencies)
        timeLimit: const Duration(seconds: 30),
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






