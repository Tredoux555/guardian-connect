import 'package:flutter/material.dart';
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
  Timer? _statusCheckTimer;
  String _senderName = 'Someone'; // Default if not provided
  
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
      
      // Stop status polling since we're navigating away
      _statusCheckTimer?.cancel();

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
    _startStatusPolling();
  }

  @override
  void dispose() {
    _statusCheckTimer?.cancel();
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

  void _startStatusPolling() {
    // Poll emergency status every 10 seconds as fallback if socket fails
    _statusCheckTimer = Timer.periodic(const Duration(seconds: 10), (timer) async {
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
            _hasNavigatedAway = true;
            
            if (mounted) {
              Navigator.of(context).pop();
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('Emergency has been ${status}'),
                  backgroundColor: Colors.orange,
                  duration: const Duration(seconds: 3),
                ),
              );
            }
          }
        }
      } catch (e) {
        debugPrint('⚠️ Error checking emergency status: $e');
        // Don't cancel timer on error - keep polling
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
                  child: ElevatedButton(
                    onPressed: _isLoading ? null : _acceptEmergency,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.green,
                      padding: const EdgeInsets.symmetric(vertical: 20),
                    ),
                    child: _isLoading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text(
                            'I CAN HELP',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                  ),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: _isLoading ? null : _rejectEmergency,
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 20),
                      side: const BorderSide(color: Colors.grey),
                    ),
                    child: const Text(
                      'UNAVAILABLE',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Colors.grey,
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






