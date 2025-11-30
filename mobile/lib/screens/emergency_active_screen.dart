import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:geolocator/geolocator.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../services/socket_service.dart';
import '../services/location_service.dart';
import '../providers/emergency_provider.dart';
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
  LatLng? _emergencyLocation; // Sender's location (where emergency happened)
  StreamSubscription<Position>? _locationSubscription;
  Timer? _locationUpdateTimer;
  String? _mapError;
  bool _mapInitialized = false;

  @override
  void initState() {
    super.initState();
    _initializeEmergency();
  }

  Future<void> _initializeEmergency() async {
    debugPrint('📍 Starting emergency initialization...');
    
    // Request location permissions first (most important)
    await LocationService.requestPermissions();
    debugPrint('📍 Location permissions granted');
    
    // Use emergency location for maximum GPS accuracy
    _currentPosition = await LocationService.getEmergencyLocation();
    debugPrint('📍 Location obtained: ${_currentPosition?.latitude}, ${_currentPosition?.longitude}');
    
    // Update UI immediately with location
    if (mounted) {
      debugPrint('📍 Updating UI with location...');
      setState(() {
        // Force rebuild
      });
      debugPrint('📍 UI updated, _currentPosition is: ${_currentPosition != null ? "NOT NULL" : "NULL"}');
    }

    // Start location tracking with emergency accuracy
    _startLocationTracking();

    // Load initial emergency data (don't wait for socket)
    _loadEmergencyData().catchError((e) {
      debugPrint('⚠️ Failed to load emergency data (continuing anyway): $e');
    });

    // Connect to socket in background (non-blocking)
    _connectSocketInBackground();
    
    // Set a timeout to detect if maps fail to initialize (give it 10 seconds)
    Future.delayed(const Duration(seconds: 10), () {
      if (mounted && !_mapInitialized && _mapError == null) {
        setState(() {
          _mapError = 'Google Maps unavailable. Location tracking is still active.';
        });
        debugPrint('⚠️ Maps did not initialize within 10 seconds - showing fallback UI');
      }
    });
  }

  void _connectSocketInBackground() async {
    try {
      // Try to connect but don't block
      await SocketService.connect();
      SocketService.joinEmergency(widget.emergencyId);

      // Set up socket listeners
      SocketService.on('participant_accepted', (data) {
        _loadEmergencyData();
      });

      SocketService.on('location_update', (data) {
        _updateLocationMarker(data);
      });

      SocketService.on('emergency_ended', (_) {
        if (mounted) {
          Navigator.of(context).pop();
        }
      });
    } catch (e) {
      debugPrint('⚠️ Socket connection failed (continuing without real-time updates): $e');
      // Continue without socket - app still works
    }
  }

  void _startLocationTracking() {
    // Use emergency location stream for maximum GPS accuracy
    _locationSubscription = LocationService.getEmergencyLocationStream().listen(
      (position) {
        if (mounted) {
          // Log GPS quality
          if (LocationService.isGPSQuality(position)) {
            debugPrint('✅ GPS-quality location: ${position.accuracy.toStringAsFixed(1)}m accuracy');
          } else {
            debugPrint('⚠️ Location accuracy: ${position.accuracy.toStringAsFixed(1)}m (may not be GPS)');
          }
          
          setState(() {
            _currentPosition = position;
          });
          _updateMyLocation(position);
        }
      },
      onError: (error) {
        debugPrint('❌ Location stream error: $error');
      },
    );
  }

  Future<void> _updateMyLocation(Position position) async {
    try {
      // Only send if accuracy is GPS-quality (≤20m)
      // This ensures we're using GPS, not WiFi/cell tower triangulation
      if (LocationService.isGPSQuality(position)) {
        debugPrint('✅ Sending GPS-quality location: ${position.accuracy.toStringAsFixed(1)}m');
        await ApiService.post('/emergencies/${widget.emergencyId}/location', {
          'latitude': position.latitude,
          'longitude': position.longitude,
          'accuracy': position.accuracy, // Include accuracy for backend validation
        });
      } else {
        // Still send, but log warning
        debugPrint('⚠️ Sending location with lower accuracy: ${position.accuracy.toStringAsFixed(1)}m');
        await ApiService.post('/emergencies/${widget.emergencyId}/location', {
          'latitude': position.latitude,
          'longitude': position.longitude,
          'accuracy': position.accuracy,
        });
      }
    } catch (e) {
      debugPrint('❌ Error updating location: $e');
    }
  }

  Future<void> _loadEmergencyData() async {
    try {
      debugPrint('📡 Loading emergency data for: ${widget.emergencyId}');
      final response = await ApiService.get('/emergencies/${widget.emergencyId}')
          .timeout(const Duration(seconds: 5), onTimeout: () {
        debugPrint('⚠️ Emergency data request timed out');
        throw TimeoutException('Emergency data request timed out');
      });
      
      debugPrint('📡 Emergency data response: ${response.statusCode}');
      final data = jsonDecode(response.body);
      debugPrint('📡 Emergency data loaded successfully');
      
      // DEBUG: Log the full response structure
      debugPrint('🔍 DEBUG: Emergency object: ${data['emergency']}');
      debugPrint('🔍 DEBUG: Locations array length: ${data['locations']?.length ?? 0}');
      if (data['locations'] != null && (data['locations'] as List).isNotEmpty) {
        debugPrint('🔍 DEBUG: Locations array:');
        for (var i = 0; i < (data['locations'] as List).length; i++) {
          final loc = data['locations'][i];
          debugPrint('   Location $i: user_id=${loc['user_id']}, lat=${loc['latitude']}, lng=${loc['longitude']}');
        }
      }
      
      // Extract emergency location (sender's location)
      if (data['emergency'] != null && data['locations'] != null) {
        final emergency = data['emergency'];
        final senderUserId = emergency['user_id'] as String?;
        debugPrint('🔍 DEBUG: Sender user_id from emergency: $senderUserId');
        
        // Find sender's location in the locations array
        if (senderUserId != null) {
          try {
            final locationsList = data['locations'] as List;
            debugPrint('🔍 DEBUG: Searching through ${locationsList.length} locations for sender: $senderUserId');
            
            final senderLocation = locationsList.firstWhere(
              (loc) => loc['user_id'] == senderUserId,
              orElse: () => null,
            );
            
            if (senderLocation != null) {
              _emergencyLocation = LatLng(
                double.parse(senderLocation['latitude'].toString()),
                double.parse(senderLocation['longitude'].toString()),
              );
              debugPrint('📍 Emergency location found: ${_emergencyLocation!.latitude}, ${_emergencyLocation!.longitude}');
              
              // Center map on emergency location
              if (_mapController != null && mounted) {
                _mapController!.animateCamera(
                  CameraUpdate.newLatLng(_emergencyLocation!),
                );
                debugPrint('✅ Map centered on emergency location');
              } else {
                debugPrint('⚠️ Map controller not ready yet, will center when map loads');
              }
            } else {
              debugPrint('❌ DEBUG: Sender location NOT found in locations array!');
              debugPrint('❌ DEBUG: Available user_ids: ${locationsList.map((l) => l['user_id']).toList()}');
              debugPrint('⚠️ WARNING: Sender location missing - map will not center correctly');
              debugPrint('💡 This may happen if sender has not shared location yet - will retry...');
              
              // Retry loading emergency data after a delay to get sender's location
              Future.delayed(const Duration(seconds: 2), () {
                if (mounted && _emergencyLocation == null) {
                  debugPrint('🔄 Retrying to load sender location...');
                  _loadEmergencyData();
                }
              });
            }
          } catch (e) {
            debugPrint('⚠️ Could not find sender location: $e');
            debugPrint('   Error type: ${e.runtimeType}');
          }
        } else {
          debugPrint('❌ DEBUG: senderUserId is null!');
        }
      } else {
        debugPrint('❌ DEBUG: Emergency or locations data missing!');
        debugPrint('   Emergency exists: ${data['emergency'] != null}');
        debugPrint('   Locations exists: ${data['locations'] != null}');
      }
      
      _updateMapMarkers(data);
    } catch (e) {
      debugPrint('❌ Error loading emergency data: $e');
      // Still show map even if data load fails
      if (mounted && _currentPosition != null) {
        setState(() {
          // Add at least the user's marker
          _markers.add(
            Marker(
              markerId: const MarkerId('me'),
              position: LatLng(_currentPosition!.latitude, _currentPosition!.longitude),
              infoWindow: const InfoWindow(title: 'You'),
              icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
            ),
          );
        });
        debugPrint('✅ Added user marker despite API failure');
      }
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
      
      // Add emergency location marker (sender's location) - most important!
      if (_emergencyLocation != null) {
        _markers.add(
          Marker(
            markerId: const MarkerId('emergency'),
            position: _emergencyLocation!,
            infoWindow: const InfoWindow(
              title: '🚨 Emergency Location',
              snippet: 'Person who needs help',
            ),
            icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
          ),
        );
      }
      
      // Add receiver's location marker
      if (_currentPosition != null) {
        _markers.add(
          Marker(
            markerId: const MarkerId('me'),
            position: LatLng(_currentPosition!.latitude, _currentPosition!.longitude),
            infoWindow: const InfoWindow(title: 'You'),
            icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueBlue),
          ),
        );
      }
      
      // Add markers for other participants (excluding sender if already added)
      if (data['emergency'] != null && data['locations'] != null) {
        final emergency = data['emergency'];
        final senderUserId = emergency['user_id'] as String?;
        
        for (var location in data['locations']) {
          final locationUserId = location['user_id'] as String?;
          // Skip sender's location (already added as emergency marker)
          if (locationUserId == senderUserId) continue;
          
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
    debugPrint('🛑 End emergency button pressed for: ${widget.emergencyId}');
    
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('End Emergency?'),
        content: const Text('Are you sure you want to end this emergency?'),
        actions: [
          TextButton(
            onPressed: () {
              debugPrint('❌ End emergency cancelled');
              Navigator.of(context).pop(false);
            },
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              debugPrint('✅ End emergency confirmed');
              Navigator.of(context).pop(true);
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('End Emergency'),
          ),
        ],
      ),
    );

    debugPrint('🛑 Dialog result: $confirmed');

    if (confirmed == true && mounted) {
      try {
        debugPrint('📡 Sending end emergency request...');
        final response = await ApiService.post('/emergencies/${widget.emergencyId}/end', {});
        debugPrint('✅ End emergency response: ${response.statusCode}');
        
      if (mounted) {
        // Clear the active emergency from the provider
        final emergencyProvider = Provider.of<EmergencyProvider>(context, listen: false);
        emergencyProvider.clearEmergency();
        debugPrint('✅ Cleared active emergency from provider');
        
        // Navigate back to home screen
        Navigator.of(context).pop();
        // Show success message
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Emergency ended successfully'),
            backgroundColor: Colors.green,
          ),
        );
      }
      } catch (e) {
        debugPrint('❌ Error ending emergency: $e');
        if (mounted) {
          // Show user-friendly error message
          final errorMessage = e.toString().replaceFirst('Exception: ', '');
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                errorMessage.contains('interrupted') || errorMessage.contains('unstable')
                  ? 'Connection interrupted. Please try again.'
                  : 'Error ending emergency: ${errorMessage.length > 50 ? errorMessage.substring(0, 50) + "..." : errorMessage}'
              ),
              backgroundColor: Colors.red,
              duration: const Duration(seconds: 4),
              action: SnackBarAction(
                label: 'Retry',
                textColor: Colors.white,
                onPressed: () => _endEmergency(), // Retry the operation
              ),
            ),
          );
        }
      }
    } else {
      debugPrint('⚠️ End emergency not confirmed or widget not mounted');
    }
  }

  Widget _buildMapFallback() {
    return Stack(
      children: [
        // Fallback UI when maps fail
        Container(
          color: Colors.grey[200],
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.map_outlined,
                  size: 64,
                  color: Colors.grey[400],
                ),
                const SizedBox(height: 16),
                Text(
                  'Maps Unavailable',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Colors.grey[600],
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Location tracking is still active',
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.grey[500],
                  ),
                ),
                const SizedBox(height: 24),
                if (_currentPosition != null)
                  Container(
                    padding: const EdgeInsets.all(16),
                    margin: const EdgeInsets.symmetric(horizontal: 24),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(8),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.1),
                          blurRadius: 4,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Column(
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.location_on, color: Colors.red, size: 20),
                            const SizedBox(width: 8),
                            const Text(
                              'Your Location:',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          '${_currentPosition!.latitude.toStringAsFixed(6)}, ${_currentPosition!.longitude.toStringAsFixed(6)}',
                          style: const TextStyle(
                            fontSize: 12,
                            fontFamily: 'monospace',
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Accuracy: ${_currentPosition!.accuracy.toStringAsFixed(1)}m',
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.grey[600],
                          ),
                        ),
                      ],
                    ),
                  ),
                const SizedBox(height: 16),
                if (_markers.length > 1)
                  Container(
                    padding: const EdgeInsets.all(12),
                    margin: const EdgeInsets.symmetric(horizontal: 24),
                    decoration: BoxDecoration(
                      color: Colors.blue[50],
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.people, color: Colors.blue, size: 20),
                        const SizedBox(width: 8),
                        Text(
                          '${_markers.length} participants',
                          style: const TextStyle(
                            color: Colors.blue,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ),
        // Still show the end emergency button
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
    );
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
    debugPrint('🗺️ Building EmergencyActiveScreen - _currentPosition: ${_currentPosition != null ? "SET" : "NULL"}');
    
    return Scaffold(
      appBar: AppBar(
        title: const Text('Active Emergency'),
        actions: [
          IconButton(
            icon: const Icon(Icons.chat),
            onPressed: () {
              // Emergency chat - coming soon
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Emergency chat coming soon')),
              );
            },
          ),
        ],
      ),
      body: _currentPosition == null
          ? const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 16),
                  Text('Getting your location...'),
                ],
              ),
            )
          : _mapError != null
              ? _buildMapFallback()
              : _emergencyLocation == null
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(20.0),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const CircularProgressIndicator(),
                            const SizedBox(height: 16),
                            const Text('Loading emergency location...'),
                            const SizedBox(height: 8),
                            const Text(
                              'Waiting for sender\'s location',
                              style: TextStyle(
                                color: Colors.grey,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                    )
                  : Stack(
                      children: [
                        GoogleMap(
                          initialCameraPosition: CameraPosition(
                            // ALWAYS center on emergency location (sender's location)
                            // Don't fall back to receiver's location - that's wrong!
                            target: _emergencyLocation ?? const LatLng(0, 0),
                            zoom: 15,
                          ),
                          markers: _markers,
                          myLocationEnabled: true,
                          myLocationButtonEnabled: true,
                          onMapCreated: (controller) {
                            _mapController = controller;
                            _mapInitialized = true;
                            // Clear any error if map successfully loads
                            if (_mapError != null) {
                              setState(() {
                                _mapError = null;
                              });
                            }
                            // Move camera to emergency location (sender's location) when map is ready
                            // IMPORTANT: Only use sender's location, NOT receiver's location
                            try {
                              if (_emergencyLocation != null) {
                                controller.animateCamera(
                                  CameraUpdate.newLatLng(_emergencyLocation!),
                                );
                                debugPrint('✅ Map centered on sender location: ${_emergencyLocation!.latitude}, ${_emergencyLocation!.longitude}');
                              } else {
                                debugPrint('⚠️ Sender location not available yet - map will center when location is loaded');
                                // Don't center on receiver's location - wait for sender's location
                              }
                            } catch (e) {
                              debugPrint('⚠️ Error animating camera: $e');
                            }
                          },
                      onCameraMoveStarted: () {
                        // Map is working
                        if (_mapError != null) {
                          setState(() {
                            _mapError = null;
                          });
                        }
                      },
                    ),
                    // Show loading indicator if map hasn't initialized yet
                    if (!_mapInitialized)
                      Container(
                        color: Colors.white.withOpacity(0.8),
                        child: const Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              CircularProgressIndicator(),
                              SizedBox(height: 16),
                              Text('Loading map...'),
                            ],
                          ),
                        ),
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

