import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'dart:async';
import '../services/api_service.dart';
import '../services/socket_service.dart';
import '../services/location_service.dart';
import 'emergency_active_screen.dart';
import 'dart:convert';

class EmergencyResponseScreen extends StatefulWidget {
  final String emergencyId;
  final String? senderName; // Optional - will be fetched if not provided

  const EmergencyResponseScreen({
    super.key,
    required this.emergencyId,
    this.senderName,
  });

  @override
  State<EmergencyResponseScreen> createState() => _EmergencyResponseScreenState();
}

class _EmergencyResponseScreenState extends State<EmergencyResponseScreen> {
  bool _isLoading = false;
  bool _hasNavigatedAway = false;
  String _senderName = 'Someone'; // Default if not provided
  bool _isVideoCallLoading = false;
  
  /// Generate a unique video call room URL based on emergency ID
  String _getVideoCallUrl() {
    final roomId = widget.emergencyId.replaceAll('-', '').substring(0, 12);
    return 'https://meet.jit.si/guardian-emergency-$roomId';
  }
  
  /// Launch video call
  Future<void> _launchVideoCall() async {
    final url = Uri.parse(_getVideoCallUrl());
    
    try {
      setState(() => _isVideoCallLoading = true);
      
      if (await canLaunchUrl(url)) {
        await launchUrl(url, mode: LaunchMode.externalApplication);
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Could not open video call'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    } catch (e) {
      debugPrint('❌ Error launching video call: $e');
    } finally {
      if (mounted) {
        setState(() => _isVideoCallLoading = false);
      }
    }
  }
  
  Future<void> _fetchEmergencyDetails() async {
    try {
      final response = await ApiService.get('/emergencies/${widget.emergencyId}');
      if (response.statusCode == 200 && mounted) {
        final data = jsonDecode(response.body);
        setState(() {
          _senderName = data['user_display_name'] ?? data['user_email'] ?? 'Someone';
        });
      }
    } catch (e) {
      debugPrint('⚠️ Failed to fetch emergency details: $e');
    }
  }

  Future<void> _acceptEmergency() async {
    setState(() {
      _isLoading = true;
    });

    try {
      // Request location permission first
      final hasPermission = await LocationService.requestPermissions();
      if (!hasPermission) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Location permission is required to help'),
            backgroundColor: Colors.red,
          ),
        );
        setState(() {
          _isLoading = false;
        });
        return;
      }

      // Accept emergency
      await ApiService.post('/emergencies/${widget.emergencyId}/accept', {});

      // Connect to socket and join emergency room (won't block if it fails)
      try {
        final socket = await SocketService.connect();
        if (socket != null) {
          SocketService.joinEmergency(widget.emergencyId);
          debugPrint('✅ Joined emergency room: ${widget.emergencyId}');
        } else {
          debugPrint('⚠️ Socket connection failed, continuing without real-time features');
        }
      } catch (e) {
        debugPrint('⚠️ Socket connection failed, continuing without real-time features: $e');
      }

      // Start sharing location
      _startLocationSharing();

      if (!mounted) return;

      // Navigate to active emergency screen
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (context) => EmergencyActiveScreen(emergencyId: widget.emergencyId),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error accepting emergency: $e'),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  void _startLocationSharing() {
    // Start emergency location stream for maximum GPS accuracy
    LocationService.getEmergencyLocationStream().listen((position) async {
      try {
        // Log GPS quality
        if (LocationService.isGPSQuality(position)) {
          print('✅ GPS-quality location: ${position.accuracy.toStringAsFixed(1)}m accuracy');
        } else {
          print('⚠️ Location accuracy: ${position.accuracy.toStringAsFixed(1)}m');
        }
        
        await ApiService.post('/emergencies/${widget.emergencyId}/location', {
          'latitude': position.latitude,
          'longitude': position.longitude,
          'accuracy': position.accuracy, // Include accuracy for backend validation
        });
      } catch (e) {
        print('❌ Error updating location: $e');
      }
    });
  }

  Future<void> _rejectEmergency() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Mark as Unavailable?'),
        content: const Text('You will not receive further updates about this emergency.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Mark Unavailable'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        await ApiService.post('/emergencies/${widget.emergencyId}/reject', {});
        if (!mounted) return;
        Navigator.of(context).pop();
      } catch (e) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  void initState() {
    super.initState();
    _senderName = widget.senderName ?? 'Someone';
    if (widget.senderName == null) {
      _fetchEmergencyDetails();
    }
    _setupSocketListener();
    // Real-time updates via Socket.IO - no polling needed
  }

  @override
  void dispose() {
    super.dispose();
  }

  void _setupSocketListener() {
    // Listen for emergency_ended event even before accepting
    SocketService.on('emergency_ended', (data) {
      if (_hasNavigatedAway || !mounted) return;
      
      final eventEmergencyId = data is Map ? data['emergencyId'] as String? : null;
      if (eventEmergencyId == widget.emergencyId) {
        debugPrint('🛑 Emergency ended by sender while on response screen');
        _hasNavigatedAway = true;
        
        if (mounted) {
          Navigator.of(context).pop();
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Emergency has been ended by sender'),
              backgroundColor: Colors.orange,
              duration: Duration(seconds: 3),
            ),
          );
        }
      }
    });
  }


  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Emergency Alert'),
        backgroundColor: Colors.red,
      ),
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(
                  Icons.emergency,
                  size: 100,
                  color: Colors.red,
                ),
                const SizedBox(height: 32),
                const Text(
                  'Emergency Alert',
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  '$_senderName needs help!',
                  style: const TextStyle(
                    fontSize: 20,
                    color: Colors.red,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 48),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _isLoading ? null : _acceptEmergency,
                    icon: const Icon(Icons.check_circle, color: Colors.white),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.green,
                      padding: const EdgeInsets.symmetric(vertical: 18),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    label: _isLoading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text(
                            'I CAN HELP',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                  ),
                ),
                const SizedBox(height: 12),
                // Video Call Button
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _isVideoCallLoading ? null : _launchVideoCall,
                    icon: Icon(
                      Icons.videocam,
                      color: _isVideoCallLoading ? Colors.grey : Colors.white,
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _isVideoCallLoading 
                          ? Colors.grey.shade300 
                          : const Color(0xFF1976D2),
                      padding: const EdgeInsets.symmetric(vertical: 18),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    label: Text(
                      _isVideoCallLoading ? 'OPENING...' : 'JOIN VIDEO CALL',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: _isVideoCallLoading ? Colors.grey : Colors.white,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: _isLoading ? null : _rejectEmergency,
                    icon: Icon(Icons.close, color: Colors.grey.shade600),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 18),
                      side: BorderSide(color: Colors.grey.shade400),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    label: Text(
                      'UNAVAILABLE',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Colors.grey.shade600,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}






