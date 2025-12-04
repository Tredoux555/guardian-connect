import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:geolocator/geolocator.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/api_service.dart';
import '../services/socket_service.dart';
import '../services/location_service.dart';
import '../services/log_collector.dart';
import '../providers/emergency_provider.dart';
import '../widgets/emergency_chat.dart';
import 'dart:async';
import 'dart:convert';
import 'dart:io' show Platform;

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
  String? _senderUserId; // Store sender user ID from emergency
  bool get _isSender => _currentUserId != null && _senderUserId != null && _currentUserId == _senderUserId;
  Timer? _statusCheckTimer; // Poll emergency status as fallback
  bool _locationWarning = false; // Flag to show location accuracy warning
  List<Map<String, dynamic>> _responders = []; // List of people responding to help
  
  // Colors for responder markers (cycle through these)
  static const List<Color> _responderColors = [
    Color(0xFF4CAF50), // Green
    Color(0xFF9C27B0), // Purple
    Color(0xFF2196F3), // Blue
    Color(0xFFFF9800), // Orange
    Color(0xFF00BCD4), // Cyan
    Color(0xFFE91E63), // Pink
    Color(0xFF795548), // Brown
    Color(0xFF607D8B), // Blue Grey
  ];
  
  // Get color for responder by index
  Color _getResponderColor(int index) {
    return _responderColors[index % _responderColors.length];
  }
  
  // Get initials from name
  String _getInitials(String name) {
    if (name.isEmpty) return '?';
    final parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return name[0].toUpperCase();
  }

  @override
  void initState() {
    super.initState();
    _initializeEmergency();
    _startStatusPolling();
  }

  Future<void> _initializeEmergency() async {
    debugPrint('📍 Starting emergency initialization...');
    
    // Get current user ID to check if we're the sender
    try {
      final userData = await ApiService.getCurrentUser();
      debugPrint('👤 User data received: $userData');
      _currentUserId = userData['id'] as String?;
      
      // Try alternative keys if 'id' is null
      if (_currentUserId == null) {
        _currentUserId = userData['user_id'] as String?;
        debugPrint('👤 Trying user_id key: $_currentUserId');
      }
      if (_currentUserId == null) {
        _currentUserId = userData['userId'] as String?;
        debugPrint('👤 Trying userId key: $_currentUserId');
      }
      
      if (_currentUserId == null) {
        debugPrint('⚠️ WARNING: Current user ID is null - sender detection may not work');
        debugPrint('   User data keys: ${userData.keys.toList()}');
      } else {
        debugPrint('👤 Current user ID: $_currentUserId');
      }
    } catch (e) {
      debugPrint('⚠️ Could not get current user ID: $e');
      debugPrint('   This may affect sender detection and button visibility');
      // Continue anyway - app can still work without knowing if we're the sender
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
          debugPrint('👤 Responder accepted: $data');
          // Add responder to list
          if (data is Map) {
            final responderName = data['userName'] ?? data['userEmail'] ?? 'Someone';
            setState(() {
              _responders.add({
                'userId': data['userId'],
                'name': responderName,
                'acceptedAt': DateTime.now().toIso8601String(),
              });
            });
            
            // Show notification to sender
            if (_isSender) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('🙌 $responderName is coming to help!'),
                  backgroundColor: Colors.green,
                  duration: const Duration(seconds: 5),
                ),
              );
            }
          }
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
        
        _handleEmergencyEnded();
      });
    } catch (e) {
      debugPrint('⚠️ Socket connection failed (continuing without real-time updates): $e');
      // Continue without socket - app still works
    }
  }

  void _startStatusPolling() {
    // Poll emergency status every 15 seconds as fallback if socket fails
    _statusCheckTimer = Timer.periodic(const Duration(seconds: 15), (timer) async {
      if (_hasNavigatedAway || !mounted) {
        timer.cancel();
        return;
      }
      
      try {
        final response = await ApiService.get('/emergencies/${widget.emergencyId}');
        if (response.statusCode == 200) {
          final data = jsonDecode(response.body);
          final status = data['emergency']?['status'] as String?;
          
          if (status == 'ended' || status == 'cancelled') {
            timer.cancel();
            debugPrint('🛑 Emergency status check: Emergency has been $status');
            _handleEmergencyEnded();
          }
        } else if (response.statusCode == 404) {
          // Emergency not found - might have been ended
          timer.cancel();
          debugPrint('🛑 Emergency status check: Emergency not found (likely ended)');
          _handleEmergencyEnded();
        }
      } catch (e) {
        debugPrint('⚠️ Error checking emergency status: $e');
        // Don't cancel timer on error - keep polling
      }
    });
  }

  void _handleEmergencyEnded() {
    if (_hasNavigatedAway || !mounted) return;
    
    // Set flag to prevent multiple navigation attempts
    _hasNavigatedAway = true;
    _statusCheckTimer?.cancel();
    
    if (mounted) {
      // Clear the active emergency from the provider
      try {
        final emergencyProvider = Provider.of<EmergencyProvider>(context, listen: false);
        emergencyProvider.clearEmergency();
        debugPrint('✅ Cleared active emergency from provider');
      } catch (e) {
        debugPrint('⚠️ Error clearing emergency provider: $e');
      }
      
      Navigator.of(context).pop();
      
      // Show notification
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Emergency has been ended'),
          backgroundColor: Colors.orange,
          duration: Duration(seconds: 3),
        ),
      );
    }
  }

  // Helper method to detect known bad/cached locations
  bool _isKnownBadLocation(double lat, double lng) {
    // Beijing area (likely VPN/cached location from China)
    // Beijing coordinates: ~39.9 to 40.1 lat, ~116.0 to 116.5 lng
    if (lat >= 39.0 && lat <= 41.0 && lng >= 115.0 && lng <= 117.0) {
      debugPrint('⚠️ Detected Beijing-area coordinates ($lat, $lng) - likely VPN/cached location');
      return true;
    }
    
    // San Francisco test coordinates (common fallback)
    if ((lat - 37.7749).abs() < 0.1 && (lng - (-122.4194)).abs() < 0.1) {
      debugPrint('⚠️ Detected San Francisco test coordinates ($lat, $lng)');
      return true;
    }
    
    // Null Island (0,0)
    if (lat.abs() < 0.01 && lng.abs() < 0.01) {
      debugPrint('⚠️ Detected Null Island (0,0) coordinates');
      return true;
    }
    
    return false;
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
        
        // IMPORTANT: Use setState to ensure UI rebuilds with new _senderUserId
        // This is critical for the "Get Directions" button visibility
        setState(() {
          _senderUserId = senderUserId;
        });
        
        debugPrint('🔍 DEBUG: Sender user_id from emergency: $senderUserId');
        debugPrint('🔍 DEBUG: Current user ID: $_currentUserId');
        debugPrint('🔍 DEBUG: Current user is sender: $_isSender');
        
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
              
              // Check for known bad/cached locations (Beijing VPN, San Francisco test, Null Island)
              if (_isKnownBadLocation(lat, lng)) {
                debugPrint('⚠️ WARNING: Sender location appears to be cached/VPN/test coordinates: $lat, $lng');
                
                // For Null Island (0,0) - always reject
                if (lat.abs() < 0.01 && lng.abs() < 0.01) {
                  debugPrint('   Null Island detected - REJECTING');
                  if (_isSender && _currentPosition != null) {
                    setState(() {
                      _emergencyLocation = LatLng(
                        _currentPosition!.latitude,
                        _currentPosition!.longitude,
                      );
                      _locationWarning = false;
                    });
                  } else {
                    return; // Don't set location
                  }
                } else {
                  // For Beijing/San Francisco: Use the location but show warning
                  // It might be correct, or better than nothing
                  debugPrint('   Using location with warning - might be VPN but could be correct');
                  setState(() {
                    _emergencyLocation = LatLng(lat, lng);
                    _locationWarning = true; // Flag to show warning banner
                  });
                }
              } else {
                // Good location - use it
                setState(() {
                  _emergencyLocation = LatLng(lat, lng);
                  _locationWarning = false; // Clear warning
                });
              }
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
    final userId = data['userId'] as String?;
    if (userId == null) return;
    
    // Don't update our own marker via socket (we handle that locally)
    if (userId == _currentUserId) return;
    
    // Don't update sender marker via socket for responders
    if (userId == _senderUserId && !_isSender) return;
    
    final lat = data['latitude'] is num 
        ? (data['latitude'] as num).toDouble() 
        : double.tryParse(data['latitude'].toString()) ?? 0.0;
    final lng = data['longitude'] is num 
        ? (data['longitude'] as num).toDouble() 
        : double.tryParse(data['longitude'].toString()) ?? 0.0;
    
    if (lat == 0.0 && lng == 0.0) return;
    
    final responderName = data['user_display_name'] ?? data['userName'] ?? data['user_email'] ?? 'Responder';
    final timestamp = DateTime.now();
    
    setState(() {
      // Remove existing marker for this user (if any)
      _markers.removeWhere((m) => m.markerId.value == userId);
      
      // Find responder index for color assignment
      int responderIndex = _responders.indexWhere((r) => r['userId'] == userId);
      
      // Update or add to responders list
      if (responderIndex == -1) {
        // New responder
        responderIndex = _responders.length;
        _responders.add({
          'userId': userId,
          'name': responderName,
          'latitude': lat,
          'longitude': lng,
          'lastUpdate': timestamp,
        });
        
        // Show notification to sender about new responder
        if (_isSender) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('🙌 $responderName is coming to help!'),
              backgroundColor: Colors.green,
              duration: const Duration(seconds: 3),
            ),
          );
        }
      } else {
        // Update existing responder location
        _responders[responderIndex] = {
          ..._responders[responderIndex],
          'latitude': lat,
          'longitude': lng,
          'lastUpdate': timestamp,
        };
      }
      
      // Add updated marker with custom color
      final color = _getResponderColor(responderIndex);
      _markers.add(
        Marker(
          markerId: MarkerId(userId),
          position: LatLng(lat, lng),
          infoWindow: InfoWindow(
            title: responderName,
            snippet: 'Tap to focus',
          ),
          icon: BitmapDescriptor.defaultMarkerWithHue(
            _colorToHue(color),
          ),
        ),
      );
    });
    
    debugPrint('📍 Updated location for $responderName: $lat, $lng');
  }
  
  // Convert Color to BitmapDescriptor hue value
  double _colorToHue(Color color) {
    // Map our colors to Google Maps marker hues
    if (color == const Color(0xFF4CAF50)) return BitmapDescriptor.hueGreen;
    if (color == const Color(0xFF9C27B0)) return BitmapDescriptor.hueViolet;
    if (color == const Color(0xFF2196F3)) return BitmapDescriptor.hueAzure;
    if (color == const Color(0xFFFF9800)) return BitmapDescriptor.hueOrange;
    if (color == const Color(0xFF00BCD4)) return BitmapDescriptor.hueCyan;
    if (color == const Color(0xFFE91E63)) return BitmapDescriptor.hueRose;
    if (color == const Color(0xFF795548)) return BitmapDescriptor.hueYellow; // Brown fallback
    if (color == const Color(0xFF607D8B)) return BitmapDescriptor.hueBlue;
    return BitmapDescriptor.hueGreen; // Default
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
      
      // Add receiver's location marker (only if not sender - sender sees their own location as emergency)
      if (_currentPosition != null && !_isSender) {
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
      // Also track responders for the sender to see
      final List<Map<String, dynamic>> newResponders = [];
      
      if (data['emergency'] != null && data['locations'] != null) {
        final emergency = data['emergency'];
        final senderUserId = emergency['user_id'] as String?;
        
        int responderIndex = 0;
        for (var location in data['locations']) {
          final locationUserId = location['user_id'] as String?;
          // Skip sender's location (already added as emergency marker)
          if (locationUserId == senderUserId) continue;
          // Skip our own location (already added as 'me' marker)
          if (locationUserId == _currentUserId) continue;
          
          // This is a responder
          final responderName = location['user_display_name'] ?? location['user_email'] ?? 'Responder';
          final lat = double.parse(location['latitude'].toString());
          final lng = double.parse(location['longitude'].toString());
          final timestamp = location['timestamp'] != null 
              ? DateTime.tryParse(location['timestamp'].toString()) ?? DateTime.now()
              : DateTime.now();
          
          newResponders.add({
            'userId': locationUserId,
            'name': responderName,
            'latitude': lat,
            'longitude': lng,
            'lastUpdate': timestamp,
          });
          
          // Use custom color for this responder
          final color = _getResponderColor(responderIndex);
          _markers.add(
            Marker(
              markerId: MarkerId(location['user_id']),
              position: LatLng(lat, lng),
              infoWindow: InfoWindow(
                title: responderName,
                snippet: 'Tap to focus',
              ),
              icon: BitmapDescriptor.defaultMarkerWithHue(_colorToHue(color)),
            ),
          );
          
          responderIndex++;
        }
      }
      
      // Update responders list
      _responders = newResponders;
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
        content: const Text(
          'Are you sure you want to end this emergency?\n\n'
          'This will notify all responders that the emergency has ended.'
        ),
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
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
            ),
            child: const Text('End Emergency'),
          ),
        ],
      ),
    );

    debugPrint('🛑 Dialog result: $confirmed');

    if (confirmed == true && mounted && !_hasNavigatedAway) {
      // Show loading indicator
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Row(
              children: [
                SizedBox(
                  width: 20, 
                  height: 20, 
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                ),
                SizedBox(width: 16),
                Text('Ending emergency...'),
              ],
            ),
            backgroundColor: Colors.orange,
            duration: Duration(seconds: 10),
          ),
        );
      }
      
      try {
        debugPrint('📡 Sending end emergency request...');
        final response = await ApiService.post('/emergencies/${widget.emergencyId}/end', {});
        debugPrint('✅ End emergency response: ${response.statusCode}');
        
        // Hide loading snackbar
        if (mounted) {
          ScaffoldMessenger.of(context).hideCurrentSnackBar();
        }
        
        if (response.statusCode == 200 || response.statusCode == 201) {
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
                content: Text('✅ Emergency ended successfully'),
                backgroundColor: Colors.green,
              ),
            );
          }
        } else if (response.statusCode == 403) {
          // User is not authorized to end this emergency
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('⚠️ Only the person who created the emergency can end it'),
                backgroundColor: Colors.orange,
                duration: Duration(seconds: 4),
              ),
            );
          }
        } else {
          // Other error
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Error ending emergency: ${response.statusCode}'),
                backgroundColor: Colors.red,
              ),
            );
          }
        }
      } catch (e) {
        debugPrint('❌ Error ending emergency: $e');
        // Hide loading snackbar
        if (mounted) {
          ScaffoldMessenger.of(context).hideCurrentSnackBar();
        }
        
        if (mounted && !_hasNavigatedAway) {
          // Show user-friendly error message
          final errorMessage = e.toString().replaceFirst('Exception: ', '');
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                errorMessage.contains('interrupted') || errorMessage.contains('unstable')
                  ? 'Connection interrupted. Please try again.'
                  : errorMessage.contains('403') || errorMessage.contains('authorized')
                    ? 'Only the person who created the emergency can end it'
                    : 'Error ending emergency. Please try again.'
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
    
    // Validate coordinates are reasonable (not fallback/test coordinates)
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      debugPrint('❌ Invalid coordinates: $lat, $lng');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Invalid location coordinates'),
            backgroundColor: Colors.red,
          ),
        );
      }
      return;
    }
    
    // Check for known fallback coordinates
    final isSanFranciscoFallback = 
      (lat >= 37.785 && lat <= 37.786 && lng >= -122.407 && lng <= -122.406);
    final isNullIsland = (lat.abs() < 0.001 && lng.abs() < 0.001);
    
    if (isSanFranciscoFallback || isNullIsland) {
      debugPrint('❌ Detected fallback coordinates: $lat, $lng');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Location appears to be invalid. Please use a mobile device with GPS.'),
            backgroundColor: Colors.red,
          ),
        );
      }
      return;
    }
    
    // Format coordinates to 6 decimal places (~10cm accuracy) to avoid URL issues
    final formattedLat = lat.toStringAsFixed(6);
    final formattedLng = lng.toStringAsFixed(6);
    
    debugPrint('📍 Opening Google Maps with coordinates: $formattedLat, $formattedLng');
    
    // Create Google Maps directions URL
    // For mobile: Use dir_action=navigate to open directly in navigation mode
    // Format: destination as coordinates (not geocoded address)
    final urlString = 'https://www.google.com/maps/dir/?api=1&destination=$formattedLat,$formattedLng&travelmode=driving&dir_action=navigate';
    final url = Uri.parse(urlString);

    try {
      if (await canLaunchUrl(url)) {
        await launchUrl(url, mode: LaunchMode.externalApplication);
        debugPrint('✅ Opened Google Maps directions to: $formattedLat, $formattedLng');
      } else {
        throw Exception('Could not launch Google Maps');
      }
    } catch (e) {
      debugPrint('❌ Error opening Google Maps: $e');
      debugPrint('   URL attempted: $urlString');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Could not open Google Maps: ${e.toString()}'),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 4),
          ),
        );
      }
    }
  }

  Future<void> _openGoogleMapsDirectionsToLocation(double lat, double lng) async {
    // Same logic as _openGoogleMapsDirections but accepts coordinates directly
    final formattedLat = lat.toStringAsFixed(6);
    final formattedLng = lng.toStringAsFixed(6);
    final urlString = 'https://www.google.com/maps/dir/?api=1&destination=$formattedLat,$formattedLng&travelmode=driving&dir_action=navigate';
    final url = Uri.parse(urlString);
    
    debugPrint('📍 Opening Google Maps with coordinates: $formattedLat, $formattedLng');
    
    try {
      if (await canLaunchUrl(url)) {
        await launchUrl(url, mode: LaunchMode.externalApplication);
        debugPrint('✅ Opened Google Maps directions to: $formattedLat, $formattedLng');
      } else {
        throw Exception('Could not launch Google Maps');
      }
    } catch (e) {
      debugPrint('❌ Error opening Google Maps: $e');
      debugPrint('   URL attempted: $urlString');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Could not open Google Maps: ${e.toString()}'),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 4),
          ),
        );
      }
    }
  }

  Future<void> _openAppleMapsDirections(double lat, double lng) async {
    final formattedLat = lat.toStringAsFixed(6);
    final formattedLng = lng.toStringAsFixed(6);
    final coords = '$formattedLat,$formattedLng';
    
    // Use native maps:// URL scheme on iOS, web URL on Android/fallback
    final urlString = Platform.isIOS 
        ? 'maps://?q=$coords'
        : 'https://maps.apple.com/?q=$coords';
    final url = Uri.parse(urlString);
    
    debugPrint('📍 Opening Apple Maps with coordinates: $formattedLat, $formattedLng');
    
    try {
      if (await canLaunchUrl(url)) {
        await launchUrl(url, mode: LaunchMode.externalApplication);
        debugPrint('✅ Opened Apple Maps directions to: $formattedLat, $formattedLng');
      } else {
        throw Exception('Could not launch Apple Maps');
      }
    } catch (e) {
      debugPrint('❌ Error opening Apple Maps: $e');
      debugPrint('   URL attempted: $urlString');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Could not open Apple Maps: ${e.toString()}'),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 4),
          ),
        );
      }
    }
  }

  // Show dialog to choose between Google Maps and Apple Maps
  Future<void> _showMapSelectionDialog() async {
    if (_emergencyLocation == null && _currentPosition == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Location not available yet'),
            backgroundColor: Colors.orange,
          ),
        );
      }
      return;
    }

    final targetLocation = _emergencyLocation ?? 
        LatLng(_currentPosition!.latitude, _currentPosition!.longitude);
    
    final lat = targetLocation.latitude;
    final lng = targetLocation.longitude;

    // Validate coordinates
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      debugPrint('❌ Invalid coordinates: $lat, $lng');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Invalid location coordinates'),
            backgroundColor: Colors.red,
          ),
        );
      }
      return;
    }

    // Check for known fallback coordinates
    final isSanFranciscoFallback = 
      (lat >= 37.785 && lat <= 37.786 && lng >= -122.407 && lng <= -122.406);
    final isNullIsland = (lat.abs() < 0.001 && lng.abs() < 0.001);
    
    if (isSanFranciscoFallback || isNullIsland) {
      debugPrint('❌ Detected fallback coordinates: $lat, $lng');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Location appears to be invalid. Please use a mobile device with GPS.'),
            backgroundColor: Colors.red,
          ),
        );
      }
      return;
    }

    if (!mounted) return;

    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Text('Choose Navigation App'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Google Maps option
              ListTile(
                leading: const Icon(Icons.map, color: Color(0xFF4285F4)),
                title: const Text('Google Maps'),
                subtitle: const Text('Open in Google Maps'),
                onTap: () {
                  Navigator.of(context).pop();
                  if (_emergencyLocation != null) {
                    _openGoogleMapsDirections();
                  } else if (_currentPosition != null) {
                    _openGoogleMapsDirectionsToLocation(
                      _currentPosition!.latitude,
                      _currentPosition!.longitude,
                    );
                  }
                },
              ),
              // Apple Maps option (show on iOS, or as fallback on Android)
              ListTile(
                leading: const Icon(Icons.map_outlined, color: Color(0xFF007AFF)),
                title: const Text('Apple Maps'),
                subtitle: const Text('Open in Apple Maps'),
                onTap: () {
                  Navigator.of(context).pop();
                  _openAppleMapsDirections(lat, lng);
                },
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancel'),
            ),
          ],
        );
      },
    );
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

  // Show bottom sheet with list of responders
  void _showRespondersBottomSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(20),
            topRight: Radius.circular(20),
          ),
        ),
        child: DraggableScrollableSheet(
          initialChildSize: 0.4,
          minChildSize: 0.2,
          maxChildSize: 0.7,
          expand: false,
          builder: (context, scrollController) => Column(
            children: [
              // Handle bar
              Container(
                margin: const EdgeInsets.only(top: 12, bottom: 8),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              // Title
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: Row(
                  children: [
                    const Icon(Icons.people, color: Colors.green, size: 24),
                    const SizedBox(width: 12),
                    Text(
                      _responders.isEmpty 
                          ? 'Waiting for responders...'
                          : '${_responders.length} ${_responders.length == 1 ? "Person" : "People"} Coming to Help',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
              const Divider(),
              // Show All button
              if (_responders.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  child: SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: () {
                        Navigator.pop(context);
                        _showAllRespondersOnMap();
                      },
                      icon: const Icon(Icons.zoom_out_map),
                      label: const Text('Show All on Map'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.blue,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                    ),
                  ),
                ),
              // Responders list
              Expanded(
                child: _responders.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.hourglass_empty, size: 48, color: Colors.grey[400]),
                            const SizedBox(height: 16),
                            Text(
                              'No responders yet',
                              style: TextStyle(
                                fontSize: 16,
                                color: Colors.grey[600],
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Your emergency contacts have been notified',
                              style: TextStyle(
                                fontSize: 14,
                                color: Colors.grey[500],
                              ),
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        controller: scrollController,
                        itemCount: _responders.length,
                        itemBuilder: (context, index) {
                          final responder = _responders[index];
                          final name = responder['name'] as String? ?? 'Responder';
                          final lat = responder['latitude'] as double?;
                          final lng = responder['longitude'] as double?;
                          final lastUpdate = responder['lastUpdate'] as DateTime?;
                          final color = _getResponderColor(index);
                          final initials = _getInitials(name);
                          
                          String timeAgo = 'Unknown';
                          if (lastUpdate != null) {
                            final diff = DateTime.now().difference(lastUpdate);
                            if (diff.inSeconds < 60) {
                              timeAgo = '${diff.inSeconds}s ago';
                            } else if (diff.inMinutes < 60) {
                              timeAgo = '${diff.inMinutes}m ago';
                            } else {
                              timeAgo = '${diff.inHours}h ago';
                            }
                          }
                          
                          return ListTile(
                            leading: CircleAvatar(
                              backgroundColor: color,
                              child: Text(
                                initials,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                            title: Text(
                              name,
                              style: const TextStyle(fontWeight: FontWeight.w600),
                            ),
                            subtitle: Text(
                              'Last updated: $timeAgo',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.grey[600],
                              ),
                            ),
                            trailing: lat != null && lng != null
                                ? IconButton(
                                    icon: const Icon(Icons.my_location, color: Colors.blue),
                                    tooltip: 'Focus on map',
                                    onPressed: () {
                                      Navigator.pop(context);
                                      _focusOnResponder(lat, lng, name);
                                    },
                                  )
                                : null,
                            onTap: lat != null && lng != null
                                ? () {
                                    Navigator.pop(context);
                                    _focusOnResponder(lat, lng, name);
                                  }
                                : null,
                          );
                        },
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
  
  // Focus map camera on a specific responder
  void _focusOnResponder(double lat, double lng, String name) {
    if (_mapController == null) {
      debugPrint('⚠️ Map controller not available');
      return;
    }
    
    _mapController!.animateCamera(
      CameraUpdate.newLatLngZoom(LatLng(lat, lng), 16),
    );
    
    debugPrint('📍 Focused on $name at $lat, $lng');
  }
  
  // Fit all responders and emergency location in view
  void _showAllRespondersOnMap() {
    if (_mapController == null || _responders.isEmpty) {
      debugPrint('⚠️ Cannot show all: map controller or responders not available');
      return;
    }
    
    // Collect all points to include in bounds
    final List<LatLng> points = [];
    
    // Add emergency location (sender)
    if (_emergencyLocation != null) {
      points.add(_emergencyLocation!);
    }
    
    // Add all responder locations
    for (final responder in _responders) {
      final lat = responder['latitude'] as double?;
      final lng = responder['longitude'] as double?;
      if (lat != null && lng != null) {
        points.add(LatLng(lat, lng));
      }
    }
    
    if (points.isEmpty) {
      debugPrint('⚠️ No points to fit in bounds');
      return;
    }
    
    if (points.length == 1) {
      // Only one point, just center on it
      _mapController!.animateCamera(
        CameraUpdate.newLatLngZoom(points.first, 15),
      );
      return;
    }
    
    // Calculate bounds that include all points
    double minLat = points.first.latitude;
    double maxLat = points.first.latitude;
    double minLng = points.first.longitude;
    double maxLng = points.first.longitude;
    
    for (final point in points) {
      if (point.latitude < minLat) minLat = point.latitude;
      if (point.latitude > maxLat) maxLat = point.latitude;
      if (point.longitude < minLng) minLng = point.longitude;
      if (point.longitude > maxLng) maxLng = point.longitude;
    }
    
    final bounds = LatLngBounds(
      southwest: LatLng(minLat, minLng),
      northeast: LatLng(maxLat, maxLng),
    );
    
    _mapController!.animateCamera(
      CameraUpdate.newLatLngBounds(bounds, 80), // 80px padding
    );
    
    debugPrint('📍 Showing all ${points.length} locations on map');
  }

  @override
  void dispose() {
    _statusCheckTimer?.cancel();
    _locationUpdateTimer?.cancel();
    _locationSubscription?.cancel();
    SocketService.leaveEmergency(widget.emergencyId);
    _hasNavigatedAway = true; // Prevent any further navigation attempts
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    debugPrint('🗺️ Building EmergencyActiveScreen - _currentPosition: ${_currentPosition != null ? "SET" : "NULL"}');
    
    // Check if we have an active emergency in the provider (indicates we're the sender)
    final emergencyProvider = Provider.of<EmergencyProvider>(context, listen: false);
    final hasActiveEmergency = emergencyProvider.hasActiveEmergency && 
                               emergencyProvider.activeEmergency?.id == widget.emergencyId;
    
    // Debug sender detection
    debugPrint('🔍 Sender detection: _currentUserId=$_currentUserId, _senderUserId=$_senderUserId');
    debugPrint('   _isSender=$_isSender, hasActiveEmergency=$hasActiveEmergency');
    
    // Determine if we should show the End Emergency button
    // Show if: we're confirmed as sender, OR we have this emergency as active in provider
    final shouldShowEndButton = _isSender || hasActiveEmergency;
    
    // Determine if we should show the Get Directions button
    // Show ONLY for receivers (NOT the sender)
    // We are the sender if hasActiveEmergency is true (we created this emergency)
    // We don't need _currentUserId for this check - hasActiveEmergency is sufficient
    // hasActiveEmergency is set when we create an emergency, so it's reliable
    final shouldShowGetDirections = !hasActiveEmergency && // NOT the sender (we didn't create it)
                                    _senderUserId != null && // Must have sender info
                                    (_emergencyLocation != null || _currentPosition != null); // Must have location
    
    debugPrint('   shouldShowGetDirections=$shouldShowGetDirections, shouldShowEndButton=$shouldShowEndButton');

    return Scaffold(
      appBar: AppBar(
        title: const Text('Active Emergency'),
        actions: [
          // End Emergency button in app bar - ALWAYS show for easy access
          // Backend will validate if user is authorized to end it
          IconButton(
            icon: const Icon(Icons.stop_circle, color: Colors.red, size: 28),
            tooltip: 'End Emergency',
            onPressed: _endEmergency,
          ),
        ],
      ),
      // Floating action button for ending emergency - always visible
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _endEmergency,
        backgroundColor: Colors.red,
        icon: const Icon(Icons.stop, color: Colors.white),
        label: const Text('END', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.endTop,
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
              : (_emergencyLocation == null && _currentPosition == null)
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
                              'Waiting for location...',
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
                            // Center on emergency location (sender's location) if available
                            // Otherwise use current position as fallback
                            // Never use (0,0) - that's Null Island
                            target: _emergencyLocation ?? 
                                   (_currentPosition != null 
                                     ? LatLng(_currentPosition!.latitude, _currentPosition!.longitude)
                                     : const LatLng(37.7749, -122.4194)), // San Francisco as last resort
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
                            // If emergency location is unavailable, center on current position as fallback
                            try {
                              if (_emergencyLocation != null) {
                                controller.animateCamera(
                                  CameraUpdate.newLatLng(_emergencyLocation!),
                                );
                                debugPrint('✅ Map centered on sender location: ${_emergencyLocation!.latitude}, ${_emergencyLocation!.longitude}');
                              } else if (_currentPosition != null) {
                                // Fallback: center on current position if emergency location unavailable
                                controller.animateCamera(
                                  CameraUpdate.newLatLng(
                                    LatLng(_currentPosition!.latitude, _currentPosition!.longitude),
                                  ),
                                );
                                debugPrint('⚠️ Sender location not available - centered on current position: ${_currentPosition!.latitude}, ${_currentPosition!.longitude}');
                              } else {
                                debugPrint('⚠️ No location available - map will show default location');
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
                    // Responders banner for sender - show who's coming to help (TAPPABLE)
                    if (_isSender || hasActiveEmergency)
                      Positioned(
                        top: 60,
                        left: 10,
                        right: 70,
                        child: GestureDetector(
                          onTap: _showRespondersBottomSheet,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                            decoration: BoxDecoration(
                              color: _responders.isNotEmpty 
                                  ? Colors.green.withOpacity(0.95)
                                  : Colors.blue.withOpacity(0.95),
                              borderRadius: BorderRadius.circular(12),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withOpacity(0.2),
                                  blurRadius: 8,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: Row(
                              children: [
                                // Responder avatars preview (show up to 3)
                                if (_responders.isNotEmpty)
                                  SizedBox(
                                    width: _responders.length >= 3 ? 60 : (_responders.length * 24).toDouble(),
                                    height: 28,
                                    child: Stack(
                                      children: List.generate(
                                        _responders.length > 3 ? 3 : _responders.length,
                                        (index) {
                                          final responder = _responders[index];
                                          final name = responder['name'] as String? ?? '?';
                                          final color = _getResponderColor(index);
                                          return Positioned(
                                            left: index * 18.0,
                                            child: Container(
                                              width: 28,
                                              height: 28,
                                              decoration: BoxDecoration(
                                                color: color,
                                                shape: BoxShape.circle,
                                                border: Border.all(color: Colors.white, width: 2),
                                              ),
                                              child: Center(
                                                child: Text(
                                                  _getInitials(name),
                                                  style: const TextStyle(
                                                    color: Colors.white,
                                                    fontSize: 10,
                                                    fontWeight: FontWeight.bold,
                                                  ),
                                                ),
                                              ),
                                            ),
                                          );
                                        },
                                      ),
                                    ),
                                  )
                                else
                                  const Icon(
                                    Icons.hourglass_empty,
                                    color: Colors.white, 
                                    size: 20,
                                  ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        _responders.isNotEmpty
                                            ? '${_responders.length} ${_responders.length == 1 ? "person" : "people"} coming'
                                            : 'Waiting for responders...',
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 13,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                      if (_responders.isNotEmpty)
                                        Text(
                                          'Tap to see who\'s coming →',
                                          style: TextStyle(
                                            color: Colors.white.withOpacity(0.9),
                                            fontSize: 11,
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                                const Icon(
                                  Icons.chevron_right,
                                  color: Colors.white,
                                  size: 20,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    // Warning banner if sender location is unavailable
                    if (_emergencyLocation == null && _currentPosition != null && !_isSender)
                      Positioned(
                        top: 10,
                        left: 10,
                        right: 70, // Leave space for map type button
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(
                            color: Colors.orange.withOpacity(0.9),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.warning_amber_rounded, color: Colors.white, size: 20),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'Sender location unavailable. Showing your location.',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    // Warning banner if location might be inaccurate (Beijing/VPN)
                    // Only show for responders, not for sender
                    if (_locationWarning && _emergencyLocation != null && !_isSender)
                      Positioned(
                        top: _emergencyLocation == null && _currentPosition != null && !_isSender ? 60 : 10,
                        left: 10,
                        right: 70,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(
                            color: Colors.orange.withOpacity(0.9),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.warning_amber_rounded, color: Colors.white, size: 20),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'Location may be inaccurate (VPN/cached).',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    // Get Directions button (just above chat widget) - shows dialog with map options
                    // Only show for responders, not for sender
                    if (shouldShowGetDirections)
                      Positioned(
                        bottom: 300, // Just above chat widget (chat is 300px tall)
                        left: 20,
                        right: 20,
                        child: ElevatedButton.icon(
                          onPressed: _showMapSelectionDialog,
                          icon: const Icon(Icons.directions, color: Colors.white),
                          label: const Text(
                            'Get Directions',
                            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF4285F4), // Google Maps blue
                            padding: const EdgeInsets.symmetric(vertical: 16),
                          ),
                        ),
                      ),
                    // END EMERGENCY button (just above chat widget) - Always visible
                    // Backend will validate if user is authorized to end it
                    Positioned(
                      bottom: 310, // Just above chat widget (chat is 300px tall)
                      left: 20,
                      right: 20,
                      child: ElevatedButton.icon(
                        onPressed: _endEmergency,
                        icon: const Icon(Icons.stop_circle, color: Colors.white),
                        label: const Text(
                          'END EMERGENCY',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.red,
                          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(30),
                          ),
                          elevation: 4,
                        ),
                      ),
                    ),
                    // Emergency Chat Widget (fixed at bottom)
                    Positioned(
                      bottom: 0,
                      left: 0,
                      right: 0,
                      child: EmergencyChat(
                        emergencyId: widget.emergencyId,
                        currentUserId: _currentUserId,
                      ),
                    ),
                  ],
                ),
    );
  }
}

