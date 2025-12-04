import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';
import '../services/location_service.dart';

class LocationSettingsScreen extends StatefulWidget {
  const LocationSettingsScreen({super.key});

  @override
  State<LocationSettingsScreen> createState() => _LocationSettingsScreenState();
}

class _LocationSettingsScreenState extends State<LocationSettingsScreen> {
  bool _isLoading = true;
  bool _locationEnabled = false;
  bool _locationPermissionGranted = false;
  bool _preciseLocationGranted = false;
  bool _backgroundLocationGranted = false;
  Position? _currentPosition;
  String? _lastError;

  @override
  void initState() {
    super.initState();
    _checkLocationStatus();
  }

  Future<void> _checkLocationStatus() async {
    setState(() {
      _isLoading = true;
      _lastError = null;
    });

    try {
      // Check if location services are enabled
      _locationEnabled = await Geolocator.isLocationServiceEnabled();

      // Check location permission
      final locationStatus = await Permission.location.status;
      _locationPermissionGranted = locationStatus.isGranted;

      // Check precise location (iOS 14+)
      final preciseStatus = await Permission.locationWhenInUse.status;
      _preciseLocationGranted = preciseStatus.isGranted;

      // Check background location
      final bgStatus = await Permission.locationAlways.status;
      _backgroundLocationGranted = bgStatus.isGranted;

      // Try to get current position
      if (_locationEnabled && _locationPermissionGranted) {
        try {
          _currentPosition = await LocationService.getEmergencyLocation();
        } catch (e) {
          debugPrint('Could not get position: $e');
        }
      }
    } catch (e) {
      _lastError = e.toString();
      debugPrint('Error checking location status: $e');
    }

    setState(() {
      _isLoading = false;
    });
  }

  Future<void> _requestLocationPermission() async {
    final status = await Permission.location.request();
    if (status.isGranted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Location permission granted'),
          backgroundColor: Colors.green,
        ),
      );
    } else if (status.isPermanentlyDenied) {
      _showOpenSettingsDialog('Location permission is permanently denied. Please enable it in Settings.');
    }
    _checkLocationStatus();
  }

  Future<void> _requestBackgroundLocation() async {
    // First ensure we have foreground location
    final fgStatus = await Permission.location.status;
    if (!fgStatus.isGranted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enable location permission first'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    final status = await Permission.locationAlways.request();
    if (status.isGranted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Background location enabled'),
          backgroundColor: Colors.green,
        ),
      );
    } else if (status.isPermanentlyDenied) {
      _showOpenSettingsDialog('Background location is denied. Please enable "Always" in Settings.');
    }
    _checkLocationStatus();
  }

  Future<void> _openLocationSettings() async {
    await Geolocator.openLocationSettings();
    // Check status again after a delay (user may have changed settings)
    await Future.delayed(const Duration(seconds: 1));
    _checkLocationStatus();
  }

  Future<void> _openAppSettings() async {
    await openAppSettings();
    await Future.delayed(const Duration(seconds: 1));
    _checkLocationStatus();
  }

  void _showOpenSettingsDialog(String message) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Permission Required'),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              _openAppSettings();
            },
            child: const Text('Open Settings'),
          ),
        ],
      ),
    );
  }

  Future<void> _testLocation() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final position = await LocationService.getEmergencyLocation();
      if (position != null) {
        setState(() {
          _currentPosition = position;
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                'Location: ${position.latitude.toStringAsFixed(6)}, ${position.longitude.toStringAsFixed(6)} (${position.accuracy.toStringAsFixed(1)}m accuracy)',
              ),
              backgroundColor: Colors.green,
              duration: const Duration(seconds: 5),
            ),
          );
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Could not get location'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }

    setState(() {
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Location Settings'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _checkLocationStatus,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _checkLocationStatus,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Status Card
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Location Status',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 16),
                          _buildStatusRow(
                            'Location Services',
                            _locationEnabled,
                            _locationEnabled ? null : _openLocationSettings,
                          ),
                          const Divider(),
                          _buildStatusRow(
                            'Location Permission',
                            _locationPermissionGranted,
                            _locationPermissionGranted ? null : _requestLocationPermission,
                          ),
                          const Divider(),
                          _buildStatusRow(
                            'Precise Location',
                            _preciseLocationGranted,
                            null,
                          ),
                          const Divider(),
                          _buildStatusRow(
                            'Background Location',
                            _backgroundLocationGranted,
                            _backgroundLocationGranted ? null : _requestBackgroundLocation,
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Current Location Card
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text(
                                'Current Location',
                                style: TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              ElevatedButton.icon(
                                onPressed: _testLocation,
                                icon: const Icon(Icons.my_location, size: 16),
                                label: const Text('Test'),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFFE53935),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          if (_currentPosition != null) ...[
                            _buildLocationRow('Latitude', _currentPosition!.latitude.toStringAsFixed(6)),
                            _buildLocationRow('Longitude', _currentPosition!.longitude.toStringAsFixed(6)),
                            _buildLocationRow('Accuracy', '${_currentPosition!.accuracy.toStringAsFixed(1)} meters'),
                            _buildLocationRow('Altitude', '${_currentPosition!.altitude.toStringAsFixed(1)} meters'),
                            const SizedBox(height: 8),
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: _currentPosition!.accuracy <= 20
                                    ? Colors.green.shade50
                                    : Colors.orange.shade50,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Row(
                                children: [
                                  Icon(
                                    _currentPosition!.accuracy <= 20
                                        ? Icons.check_circle
                                        : Icons.warning,
                                    color: _currentPosition!.accuracy <= 20
                                        ? Colors.green
                                        : Colors.orange,
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    _currentPosition!.accuracy <= 20
                                        ? 'GPS quality location'
                                        : 'Location may not be GPS quality',
                                    style: TextStyle(
                                      color: _currentPosition!.accuracy <= 20
                                          ? Colors.green.shade700
                                          : Colors.orange.shade700,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ] else
                            const Text(
                              'No location data available.\nTap "Test" to get your current location.',
                              style: TextStyle(color: Colors.grey),
                            ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Help Card
                  Card(
                    color: Colors.blue.shade50,
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Row(
                            children: [
                              Icon(Icons.info, color: Colors.blue),
                              SizedBox(width: 8),
                              Text(
                                'Tips for Best Location Accuracy',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.blue,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          const Text(
                            '• Enable GPS/Location Services\n'
                            '• Grant "Precise Location" permission\n'
                            '• Be outdoors or near a window\n'
                            '• Wait a few seconds for GPS lock\n'
                            '• For emergencies, accuracy under 20m is ideal',
                            style: TextStyle(fontSize: 14),
                          ),
                        ],
                      ),
                    ),
                  ),

                  if (_lastError != null) ...[
                    const SizedBox(height: 16),
                    Card(
                      color: Colors.red.shade50,
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Row(
                              children: [
                                Icon(Icons.error, color: Colors.red),
                                SizedBox(width: 8),
                                Text(
                                  'Error',
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    color: Colors.red,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(_lastError!),
                          ],
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
    );
  }

  Widget _buildStatusRow(String label, bool isEnabled, VoidCallback? onFix) {
    return Row(
      children: [
        Icon(
          isEnabled ? Icons.check_circle : Icons.cancel,
          color: isEnabled ? Colors.green : Colors.red,
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            label,
            style: const TextStyle(fontSize: 16),
          ),
        ),
        if (onFix != null)
          TextButton(
            onPressed: onFix,
            child: const Text('Enable'),
          ),
      ],
    );
  }

  Widget _buildLocationRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.grey)),
          Text(value, style: const TextStyle(fontFamily: 'monospace')),
        ],
      ),
    );
  }
}





