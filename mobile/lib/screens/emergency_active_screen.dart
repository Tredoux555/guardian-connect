import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:geolocator/geolocator.dart';
import '../providers/emergency_provider.dart';
import '../models/emergency.dart';
import '../services/api_service.dart';
import '../services/socket_service.dart';
import '../services/location_service.dart';
import 'dart:async';
import 'dart:convert';

class EmergencyActiveScreen extends StatefulWidget {
  final String emergencyId;

  const EmergencyActiveScreen({super.key, required this.emergencyId});

  @override
  State<EmergencyActiveScreen> createState() => _EmergencyActiveScreenState();
}

class _EmergencyActiveScreenState extends State<EmergencyActiveScreen> {
  GoogleMapController? _mapController;
  final Set<Marker> _markers = {};
  Position? _currentPosition;
  StreamSubscription<Position>? _locationSubscription;
  Timer? _locationUpdateTimer;

  @override
  void initState() {
    super.initState();
    _initializeEmergency();
  }

  Future<void> _initializeEmergency() async {
    // Connect to socket
    final socket = await SocketService.connect();
    SocketService.joinEmergency(widget.emergencyId);

    // Set up socket listeners
    SocketService.on('participant_accepted', (data) {
      _loadEmergencyData();
    });

    SocketService.on('location_update', (data) {
      _updateLocationMarker(data);
    });

    SocketService.on('emergency_ended', (_) {
      Navigator.of(context).pop();
    });

    // Request location permissions
    await LocationService.requestPermissions();
    _currentPosition = await LocationService.getCurrentLocation();

    // Start location tracking
    _startLocationTracking();

    // Load initial emergency data
    _loadEmergencyData();
  }

  void _startLocationTracking() {
    // Update location every 5 seconds
    _locationUpdateTimer = Timer.periodic(const Duration(seconds: 5), (_) async {
      final position = await LocationService.getCurrentLocation();
      if (position != null && mounted) {
        setState(() {
          _currentPosition = position;
        });
        _updateMyLocation(position);
      }
    });
  }

  Future<void> _updateMyLocation(Position position) async {
    try {
      await ApiService.post('/emergencies/${widget.emergencyId}/location', {
        'latitude': position.latitude,
        'longitude': position.longitude,
      });
    } catch (e) {
      print('Error updating location: $e');
    }
  }

  Future<void> _loadEmergencyData() async {
    try {
      final response = await ApiService.get('/emergencies/${widget.emergencyId}');
      final data = jsonDecode(response.body);
      _updateMapMarkers(data);
    } catch (e) {
      print('Error loading emergency data: $e');
    }
  }

  void _updateLocationMarker(dynamic data) {
    setState(() {
      _markers.add(
        Marker(
          markerId: MarkerId(data['userId']),
          position: LatLng(data['latitude'], data['longitude']),
          infoWindow: InfoWindow(title: data['userName'] ?? 'Responder'),
        ),
      );
    });
  }

  void _updateMapMarkers(dynamic data) {
    // Update markers from emergency data
    setState(() {
      _markers.clear();
      if (_currentPosition != null) {
        _markers.add(
          Marker(
            markerId: const MarkerId('me'),
            position: LatLng(_currentPosition!.latitude, _currentPosition!.longitude),
            infoWindow: const InfoWindow(title: 'You'),
            icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
          ),
        );
      }
      
      // Add markers for other participants
      if (data['locations'] != null) {
        for (var location in data['locations']) {
          _markers.add(
            Marker(
              markerId: MarkerId(location['user_id']),
              position: LatLng(
                double.parse(location['latitude'].toString()),
                double.parse(location['longitude'].toString()),
              ),
              infoWindow: InfoWindow(title: location['user_email'] ?? 'Responder'),
            ),
          );
        }
      }
    });
  }

  Future<void> _endEmergency() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('End Emergency?'),
        content: const Text('Are you sure you want to end this emergency?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('End Emergency'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        await ApiService.post('/emergencies/${widget.emergencyId}/end', {});
        Navigator.of(context).pop();
      } catch (e) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error ending emergency: $e')),
        );
      }
    }
  }

  @override
  void dispose() {
    _locationUpdateTimer?.cancel();
    _locationSubscription?.cancel();
    SocketService.leaveEmergency(widget.emergencyId);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Active Emergency'),
        actions: [
          IconButton(
            icon: const Icon(Icons.chat),
            onPressed: () {
              // TODO: Navigate to chat screen
            },
          ),
        ],
      ),
      body: Stack(
        children: [
          GoogleMap(
            initialCameraPosition: CameraPosition(
              target: _currentPosition != null
                  ? LatLng(_currentPosition!.latitude, _currentPosition!.longitude)
                  : const LatLng(0, 0),
              zoom: 15,
            ),
            markers: _markers,
            myLocationEnabled: true,
            myLocationButtonEnabled: true,
            onMapCreated: (controller) {
              _mapController = controller;
            },
          ),
          Positioned(
            bottom: 20,
            left: 20,
            right: 20,
            child: ElevatedButton(
              onPressed: _endEmergency,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.red,
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              child: const Text('END EMERGENCY'),
            ),
          ),
        ],
      ),
    );
  }
}

