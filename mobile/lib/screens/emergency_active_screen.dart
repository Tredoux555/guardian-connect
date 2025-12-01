import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:geolocator/geolocator.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
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
  bool _hasNavigatedAway = false; // Guard to prevent multiple navigation attempts
  int _locationLoadRetryCount = 0; // Track retry attempts for location loading
  static const int _maxLocationRetries = 3; // Maximum retries for loading location data
  MapType _mapType = MapType.normal; // Map type (normal or satellite)
  String? _currentUserId; // Store current user ID to check if sender

  @override
  void initState() {
    super.initState();
    _initializeEmergency();
  }

  Future<void> _initializeEmergency() async {
    debugPrint('📍 Starting emergency initialization...');
    
    // Get current user ID to check if we're the sender
    try {
      final userData = await ApiService.getCurrentUser();
      _currentUserId = userData['id'] as String?;
      debugPrint('👤 Current user ID: $_currentUserId');
    } catch (e) {
      debugPrint('⚠️ Could not get current user ID: $e');
    }
    
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
        if (mounted && !_hasNavigatedAway) {
          _loadEmergencyData();
        }
      });

      SocketService.on('location_update', (data) {
        if (mounted && !_hasNavigatedAway) {
          _updateLocationMarker(data);
        }
      });

      // Add emergency ID validation to prevent incorrect navigation
      SocketService.on('emergency_ended', (data) {
        if (!mounted || _hasNavigatedAway) return;
        
        // Validate that this event is for the current emergency
        final eventEmergencyId = data is Map ? data['emergencyId'] as String? : null;
        if (eventEmergencyId != null && eventEmergencyId != widget.emergencyId) {
          debugPrint('⚠️ emergency_ended event received for different emergency: $eventEmergencyId (current: ${widget.emergencyId}) - ignoring');
          return;
        }
        
        debugPrint('🛑 emergency_ended event received for current emergency: ${widget.emergencyId}');
        debugPrint('   Navigating away from EmergencyActiveScreen');
        
        // Set flag to prevent multiple navigation attempts
        _hasNavigatedAway = true;
        
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
          final timestamp = loc['timestamp'] as String?;
          final lat = loc['latitude'];
          final lng = loc['longitude'];
          final userId = loc['user_id'];
          debugPrint('   Location $i: user_id=$userId, lat=$lat, lng=$lng, timestamp=$timestamp');
          
          // Validate coordinates
          try {
            final latNum = double.parse(lat.toString());
            final lngNum = double.parse(lng.toString());
            if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
              debugPrint('      ⚠️ WARNING: Invalid coordinates for location $i');
            }
          } catch (e) {
            debugPrint('      ⚠️ WARNING: Could not parse coordinates for location $i: $e');
          }
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
            
            // Normalize user_id for comparison (handle UUID format differences)
            final normalizedSenderUserId = senderUserId.toString().trim().toLowerCase();
            
            // Find sender's location with normalized comparison
            dynamic senderLocation;
            try {
              senderLocation = locationsList.firstWhere(
                (loc) {
                  final locUserId = loc['user_id']?.toString().trim().toLowerCase() ?? '';
                  return locUserId == normalizedSenderUserId;
                },
                orElse: () => null,
              );
            } catch (e) {
              debugPrint('⚠️ Error finding sender location with firstWhere: $e');
              senderLocation = null;
            }
            
            // Fallback: try direct comparison if normalized didn't work
            if (senderLocation == null) {
              debugPrint('🔄 Trying direct user_id comparison as fallback...');
              try {
                senderLocation = locationsList.firstWhere(
                  (loc) => loc['user_id']?.toString() == senderUserId.toString(),
                  orElse: () => null,
                );
              } catch (e) {
                debugPrint('⚠️ Fallback comparison also failed: $e');
              }
            }
            
            if (senderLocation != null) {
              final lat = double.tryParse(senderLocation['latitude'].toString());
              final lng = double.tryParse(senderLocation['longitude'].toString());
              final timestamp = senderLocation['timestamp'] as String?;
              
              // Validate coordinates are reasonable
              if (lat == null || lng == null) {
                debugPrint('❌ Invalid coordinates in sender location: lat=$lat, lng=$lng');
                throw Exception('Invalid coordinates');
              }
              
              if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                debugPrint('❌ Coordinates out of valid range: lat=$lat, lng=$lng');
                throw Exception('Coordinates out of valid range');
              }
              
              // Check if location is recent (within last 24 hours) if timestamp is available
              if (timestamp != null) {
                try {
                  final locationTime = DateTime.parse(timestamp);
                  final now = DateTime.now();
                  final age = now.difference(locationTime);
                  if (age.inHours > 24) {
                    debugPrint('⚠️ WARNING: Sender location is ${age.inHours} hours old (older than 24 hours)');
                    debugPrint('   Location timestamp: $timestamp');
                    // Still use it, but log warning
                  } else {
                    debugPrint('✅ Sender location is recent: ${age.inMinutes} minutes old');
                  }
                } catch (e) {
                  debugPrint('⚠️ Could not parse timestamp: $timestamp, error: $e');
                }
              }
              
              // Validate coordinates are not default/test coordinates (0,0 or common test locations)
              final isTestLocation = (lat == 0.0 && lng == 0.0) ||
                  (lat == 37.785834 && lng == -122.406417); // San Francisco test coordinates
              
              if (isTestLocation) {
                debugPrint('⚠️ WARNING: Sender location appears to be test/default coordinates: $lat, $lng');
                debugPrint('   This may indicate incorrect location data');
              }
              
              _emergencyLocation = LatLng(lat, lng);
              debugPrint('📍 Emergency location found: ${_emergencyLocation!.latitude}, ${_emergencyLocation!.longitude}');
              
              // Reset retry count on success
              _locationLoadRetryCount = 0;
              
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
              debugPrint('❌ DEBUG: Available user_ids: ${locationsList.map((l) => l['user_id']?.toString()).toList()}');
              debugPrint('❌ DEBUG: Normalized sender user_id: $normalizedSenderUserId');
              
              // FALLBACK: If current user is the sender, use their current position
              if (_currentUserId != null && 
                  senderUserId != null && 
                  _currentUserId.toString().trim().toLowerCase() == normalizedSenderUserId &&
                  _currentPosition != null) {
                debugPrint('💡 Current user is the sender - using current position as fallback');
                _emergencyLocation = LatLng(
                  _currentPosition!.latitude,
                  _currentPosition!.longitude,
                );
                debugPrint('📍 Using sender\'s current position as emergency location: ${_emergencyLocation!.latitude}, ${_emergencyLocation!.longitude}');
                
                // Update state to show map
                if (mounted) {
                  setState(() {
                    // Trigger rebuild to show map
                  });
                }
                
                // Center map on emergency location
                if (_mapController != null && mounted) {
                  _mapController!.animateCamera(
                    CameraUpdate.newLatLng(_emergencyLocation!),
                  );
                  debugPrint('✅ Map centered on sender\'s current position');
                }
                
                // Still try to load from API in background (will update when available)
                if (_locationLoadRetryCount < _maxLocationRetries && mounted) {
                  _locationLoadRetryCount++;
                  final delaySeconds = 2 * _locationLoadRetryCount;
                  debugPrint('🔄 Will retry loading sender location from API in ${delaySeconds}s...');
                  Future.delayed(Duration(seconds: delaySeconds), () {
                    if (mounted && !_hasNavigatedAway) {
                      _loadEmergencyData();
                    }
                  });
                }
              } else {
                debugPrint('⚠️ WARNING: Sender location missing - map will not center correctly');
                debugPrint('💡 This may happen if sender has not shared location yet - will retry...');
                
                // Retry loading emergency data with exponential backoff
                if (_locationLoadRetryCount < _maxLocationRetries && mounted && _emergencyLocation == null) {
                  _locationLoadRetryCount++;
                  final delaySeconds = 2 * _locationLoadRetryCount; // 2s, 4s, 6s
                  debugPrint('🔄 Retrying to load sender location in ${delaySeconds}s... (attempt $_locationLoadRetryCount/$_maxLocationRetries)');
                  Future.delayed(Duration(seconds: delaySeconds), () {
                    if (mounted && _emergencyLocation == null && !_hasNavigatedAway) {
                      _loadEmergencyData();
                    }
                  });
                } else if (_locationLoadRetryCount >= _maxLocationRetries) {
                  debugPrint('❌ Max retries reached for loading sender location');
                  debugPrint('   Map will show without sender location marker');
                }
              }
            }
          } catch (e) {
            debugPrint('⚠️ Could not find sender location: $e');
            debugPrint('   Error type: ${e.runtimeType}');
            debugPrint('   Stack trace: ${StackTrace.current}');
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
    // Prevent multiple navigation attempts
    if (_hasNavigatedAway) {
      debugPrint('⚠️ Navigation already in progress, ignoring end emergency request');
      return;
    }
    
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

    if (confirmed == true && mounted && !_hasNavigatedAway) {
      try {
        debugPrint('📡 Sending end emergency request...');
        final response = await ApiService.post('/emergencies/${widget.emergencyId}/end', {});
        debugPrint('✅ End emergency response: ${response.statusCode}');
        
        if (mounted && !_hasNavigatedAway) {
          // Set flag to prevent multiple navigation attempts
          _hasNavigatedAway = true;
          
          // Clear the active emergency from the provider
          final emergencyProvider = Provider.of<EmergencyProvider>(context, listen: false);
          emergencyProvider.clearEmergency();
          debugPrint('✅ Cleared active emergency from provider');
          
          debugPrint('🧭 Navigating back to home screen...');
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
        if (mounted && !_hasNavigatedAway) {
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
      debugPrint('⚠️ End emergency not confirmed, widget not mounted, or navigation already in progress');
    }
  }

  Future<void> _openGoogleMapsDirections() async {
    if (_emergencyLocation == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Emergency location not available yet'),
            backgroundColor: Colors.orange,
          ),
        );
      }
      return;
    }

    final lat = _emergencyLocation!.latitude;
    final lng = _emergencyLocation!.longitude;
    
    // Create Google Maps directions URL
    final url = Uri.parse(
      'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng&travelmode=driving'
    );

    try {
      if (await canLaunchUrl(url)) {
        await launchUrl(url, mode: LaunchMode.externalApplication);
        debugPrint('✅ Opened Google Maps directions to: $lat, $lng');
      } else {
        throw Exception('Could not launch Google Maps');
      }
    } catch (e) {
      debugPrint('❌ Error opening Google Maps: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Could not open Google Maps: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
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
    _hasNavigatedAway = true; // Prevent any further navigation attempts
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
                          mapType: _mapType,
                          markers: _markers,
                          myLocationEnabled: true,
                          myLocationButtonEnabled: true,
                          onMapCreated: (controller) {
                            _mapController = controller;
                            setState(() {
                              _mapInitialized = true;
                            });
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
                    // Map type toggle button (top right)
                    Positioned(
                      top: 10,
                      right: 10,
                      child: FloatingActionButton(
                        mini: true,
                        onPressed: () {
                          setState(() {
                            _mapType = _mapType == MapType.normal 
                                ? MapType.satellite 
                                : MapType.normal;
                          });
                          debugPrint('🗺️ Map type changed to: $_mapType');
                        },
                        backgroundColor: Colors.white,
                        child: Icon(
                          _mapType == MapType.normal ? Icons.satellite : Icons.map,
                          color: Colors.blue,
                        ),
                      ),
                    ),
                    // Google Maps directions button (above END EMERGENCY button)
                    if (_emergencyLocation != null)
                      Positioned(
                        bottom: 100,
                        left: 20,
                        right: 20,
                        child: ElevatedButton.icon(
                          onPressed: _openGoogleMapsDirections,
                          icon: const Icon(Icons.directions, color: Colors.white),
                          label: const Text(
                            'Open in Google Maps',
                            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF4285F4), // Google Maps blue
                            padding: const EdgeInsets.symmetric(vertical: 16),
                          ),
                        ),
                      ),
                    // END EMERGENCY button
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

