import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/emergency_provider.dart';
import '../models/emergency.dart';
import '../services/api_service.dart';
import '../services/socket_service.dart';
import '../services/emergency_service.dart';
import '../services/push_notification_service.dart';
import '../services/emergency_alarm_service.dart';
import '../services/location_service.dart';
import 'emergency_active_screen.dart';
import 'settings_screen.dart';
import 'auth/login_screen.dart';
import 'diagnostic_screen.dart';
import 'dart:convert';
import 'dart:async';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  bool _hasInitialized = false; // Add flag to prevent multiple initializations
  
  List<Map<String, dynamic>> _pendingEmergencies = [];
  bool _isCheckingPending = false;
  Set<String> _seenEmergencyIds = {};
  bool _hasNavigatedToEmergency = false;
  bool _isCreatingEmergency = false; // Prevent double emergency creation
  bool _pollingPaused = false; // Pause polling during emergency creation
  DateTime? _lastDependencyCheck; // Debounce didChangeDependencies calls

  @override
  void initState() {
    super.initState();
    // Register for app lifecycle changes
    WidgetsBinding.instance.addObserver(this);
    // Delay initialization to ensure widget is fully mounted
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_hasInitialized) {
        _hasInitialized = true;
        _setupSocketListener();
        _setupPushNotificationHandlers();
        _checkActiveEmergency();
        _checkPendingEmergencies();
        // Real-time updates via Socket.IO and push notifications - no polling needed
      }
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    // When app comes to foreground, immediately check for emergencies
    if (state == AppLifecycleState.resumed) {
      debugPrint('📱 App resumed - immediately checking for emergencies');
      if (mounted && !_isCreatingEmergency && !_pollingPaused) {
        _checkPendingEmergencies();
        _checkActiveEmergency();
      }
    }
  }
  
  /// Set up push notification handlers for emergency alerts
  void _setupPushNotificationHandlers() {
    // Handle emergency notifications received while app is open
    PushNotificationService.onEmergencyReceived = (emergencyId, senderName) {
      debugPrint('🚨 Push notification: Emergency from $senderName');
      if (mounted && !_hasNavigatedToEmergency) {
        // 🔊 PLAY LOUD EMERGENCY ALARM - bypasses silent mode
        EmergencyAlarmService.playEmergencyAlarm(senderName: senderName);
        
        // Refresh pending emergencies to show the new one
        _checkPendingEmergencies();
        
        // Show a prominent alert dialog instead of just a snackbar
        _showEmergencyAlertDialog(emergencyId, senderName);
      }
    };
    
    // Handle notification taps (app was in background)
    PushNotificationService.onNotificationTapped = (emergencyId) {
      debugPrint('🚨 Notification tapped: Emergency $emergencyId');
      if (mounted && !_hasNavigatedToEmergency) {
        // Play alarm and show dialog when tapping notification
        EmergencyAlarmService.playEmergencyAlarm();
        _showEmergencyAlertDialog(emergencyId, 'Someone');
      }
    };
  }
  
  /// Respond directly to emergency - skip confirmation screen, go straight to map
  Future<void> _respondToEmergencyDirectly(String emergencyId) async {
    if (_hasNavigatedToEmergency) return;
    _hasNavigatedToEmergency = true;
    
    debugPrint('🚀 Responding directly to emergency: $emergencyId');
    
    try {
      // Request location permission first
      final hasPermission = await LocationService.requestPermissions();
      if (!hasPermission && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Location permission is required to help'),
            backgroundColor: Colors.red,
          ),
        );
        _hasNavigatedToEmergency = false;
        return;
      }

      // Accept emergency immediately
      debugPrint('📡 Accepting emergency...');
      await ApiService.post('/emergencies/$emergencyId/accept', {});
      debugPrint('✅ Emergency accepted');

      // Connect to socket and join emergency room
      try {
        final socket = await SocketService.connect();
        if (socket != null) {
          SocketService.joinEmergency(emergencyId);
          debugPrint('✅ Joined emergency room');
        }
      } catch (e) {
        debugPrint('⚠️ Socket connection failed, continuing: $e');
      }

      // Start sharing location
      _startLocationSharingForEmergency(emergencyId);

      if (!mounted) return;

      // Navigate directly to active emergency screen (map with directions)
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (context) => EmergencyActiveScreen(emergencyId: emergencyId),
        ),
      ).then((_) {
        _hasNavigatedToEmergency = false;
        _checkPendingEmergencies();
      });
    } catch (e) {
      debugPrint('❌ Error responding to emergency: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error responding: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
      _hasNavigatedToEmergency = false;
    }
  }

  /// Start location sharing for emergency
  void _startLocationSharingForEmergency(String emergencyId) {
    LocationService.getEmergencyLocationStream().listen((position) async {
      try {
        await ApiService.post('/emergencies/$emergencyId/location', {
          'latitude': position.latitude,
          'longitude': position.longitude,
          'accuracy': position.accuracy,
        });
      } catch (e) {
        debugPrint('❌ Error updating location: $e');
      }
    });
  }
  
  /// Show prominent emergency alert dialog with loud alarm
  void _showEmergencyAlertDialog(String emergencyId, String senderName) {
    showDialog(
      context: context,
      barrierDismissible: false, // Must respond or dismiss
      builder: (context) => AlertDialog(
        backgroundColor: Colors.red.shade50,
        title: Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: Colors.red, size: 32),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                '🚨 EMERGENCY',
                style: TextStyle(
                  color: Colors.red.shade900,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              '$senderName needs help!',
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            const Text(
              'Tap RESPOND to help them immediately.',
              textAlign: TextAlign.center,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              // Stop the alarm
              EmergencyAlarmService.stopAlarm();
              Navigator.of(context).pop();
            },
            child: const Text('DISMISS'),
          ),
          ElevatedButton(
            onPressed: () {
              // Stop the alarm and respond directly (go straight to map)
              EmergencyAlarmService.stopAlarm();
              Navigator.of(context).pop();
              _respondToEmergencyDirectly(emergencyId);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
            ),
            child: const Text(
              'RESPOND NOW',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }

  // Refresh active emergency check when returning to this screen
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Reset navigation flag when returning to this screen
    _hasNavigatedToEmergency = false;
    
    // Debounce: Only check if it's been at least 3 seconds since last check
    final now = DateTime.now();
    if (_lastDependencyCheck != null && 
        now.difference(_lastDependencyCheck!).inSeconds < 3) {
      return; // Skip if called too frequently
    }
    _lastDependencyCheck = now;
    
    // Don't check if creating emergency or polling is paused
    if (_isCreatingEmergency || _pollingPaused) {
      return;
    }
    
    // Only refresh emergency check, don't re-setup socket listener
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_isCreatingEmergency && !_pollingPaused && mounted) {
        _checkActiveEmergency();
        _checkPendingEmergencies();
      }
    });
  }


  Future<void> _checkPendingEmergencies() async {
    // Skip if already checking, creating emergency, or polling is paused
    if (_isCheckingPending || _isCreatingEmergency || _pollingPaused) {
      return;
    }
    
    _isCheckingPending = true;
    try {
      final response = await ApiService.get('/emergencies/pending');
      if (response.statusCode == 200 && mounted) {
        final data = jsonDecode(response.body);
        if (data is List) {
          final newPending = List<Map<String, dynamic>>.from(data);
          
          // Check for NEW emergencies we haven't seen before
          for (final emergency in newPending) {
            final emergencyId = emergency['id'] as String?;
            if (emergencyId != null && !_seenEmergencyIds.contains(emergencyId)) {
              _seenEmergencyIds.add(emergencyId);
              debugPrint('🚨🚨🚨 NEW EMERGENCY DETECTED: $emergencyId');
              
              // Auto-navigate to the first new emergency
              if (!_hasNavigatedToEmergency && mounted) {
                _hasNavigatedToEmergency = true;
                _showEmergencyAlert(emergency);
              }
            }
          }
          
          setState(() {
            _pendingEmergencies = newPending;
          });
          
          if (_pendingEmergencies.isNotEmpty) {
            debugPrint('📢 Found ${_pendingEmergencies.length} pending emergency(ies)');
          }
        }
      }
    } catch (e) {
      debugPrint('Could not check pending emergencies: $e');
    } finally {
      _isCheckingPending = false;
    }
  }

  void _showEmergencyAlert(Map<String, dynamic> emergency) {
    final emergencyId = emergency['id'] as String;
    final senderName = (emergency['sender_display_name'] as String?) ?? 
                       (emergency['sender_email'] as String?) ?? 
                       'Someone';
    
    // Show a prominent dialog
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: Colors.red.shade50,
        title: Row(
          children: [
            Icon(Icons.warning, color: Colors.red.shade700, size: 32),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'EMERGENCY ALERT!',
                style: TextStyle(
                  color: Colors.red.shade700,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '$senderName needs help!',
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'Your emergency contact has triggered an alert and needs your assistance.',
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(dialogContext).pop();
              _hasNavigatedToEmergency = false; // Allow showing again later
            },
            child: const Text('Dismiss'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(dialogContext).pop();
              // Go directly to map with directions
              _respondToEmergencyDirectly(emergencyId);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
            ),
            child: const Text('RESPOND NOW'),
          ),
        ],
      ),
    );
  }

  bool _isCheckingEmergency = false; // Prevent duplicate simultaneous checks
  
  /// Safe provider access helper - checks context.mounted before accessing provider
  EmergencyProvider? _getEmergencyProviderSafely() {
    if (!mounted) {
      debugPrint('⚠️ Widget not mounted, cannot access EmergencyProvider');
      return null;
    }
    return Provider.of<EmergencyProvider>(context, listen: false);
  }
  
  Future<void> _checkActiveEmergency() async {
    // Prevent duplicate simultaneous requests
    if (_isCheckingEmergency) {
      debugPrint('⚠️ Emergency check already in progress, skipping...');
      return;
    }
    
    _isCheckingEmergency = true;
    try {
      final response = await ApiService.get('/emergencies/active');
      
      // Use safe provider access
      final emergencyProvider = _getEmergencyProviderSafely();
      if (emergencyProvider == null) {
        debugPrint('⚠️ Cannot access provider, widget may be disposed');
        return;
      }
      
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['emergency'] != null && mounted) {
          final emergency = data['emergency'];
          emergencyProvider.setActiveEmergency(Emergency(
            id: emergency['id'] as String,
            userId: emergency['user_id'] as String,
            createdAt: DateTime.parse(emergency['created_at'] as String),
            status: emergency['status'] as String,
          ));
        } else if (mounted) {
          // No active emergency - clear the provider
          emergencyProvider.clearEmergency();
        }
      } else if (mounted) {
        // No active emergency (404 or other status) - clear the provider
        emergencyProvider.clearEmergency();
      }
    } catch (e) {
      debugPrint('Could not check active emergency: $e');
      // If we get a 404 or similar, clear the emergency provider
      final emergencyProvider = _getEmergencyProviderSafely();
      if (emergencyProvider != null) {
        emergencyProvider.clearEmergency();
      }
    } finally {
      _isCheckingEmergency = false;
    }
  }

  void _setupSocketListener() async {
    try {
      // Connect to socket (won't block if it fails)
      final socket = await SocketService.connect();
      if (socket == null) {
        debugPrint('⚠️ Socket connection failed - emergency alerts may not work in real-time');
        // Continue - app still works without sockets for basic functionality
      }

      // Listen for incoming emergency alerts
      SocketService.on('emergency_created', (data) async {
        if (!mounted) return;
        
        // Get current user to check if we're the sender
        final authProvider = Provider.of<AuthProvider>(context, listen: false);
        String? currentUserId;
        
        try {
          final userData = await ApiService.getCurrentUser();
          currentUserId = userData['id'] as String?;
        } catch (e) {
          debugPrint('Could not get current user: $e');
          // Continue without user ID check - will show all emergencies
        }
        
        // Check if we're the sender - don't show our own emergency
        final senderUserId = data['userId'] as String?;
        if (currentUserId != null && 
            senderUserId != null && 
            currentUserId == senderUserId) {
          debugPrint('⚠️ User is the sender - skipping emergency alert');
          return;
        }
        
        final emergencyId = data['emergencyId'] as String?;
        final senderName = data['senderName'] as String? ?? 
                          data['userEmail'] as String? ?? 
                          'Someone';
        
        if (emergencyId != null && mounted) {
          // Play alarm and show dialog for new emergency
          EmergencyAlarmService.playEmergencyAlarm(senderName: senderName);
          _showEmergencyAlertDialog(emergencyId, senderName);
        }
      });
    } catch (e) {
      debugPrint('⚠️ Error setting up socket listener, emergency alerts may not work: $e');
      // Continue - app still works without sockets
    }
  }

  Future<void> _triggerEmergency(BuildContext context) async {
    // Prevent double emergency creation
    if (_isCreatingEmergency) {
      debugPrint('⚠️ Emergency creation already in progress, ignoring request');
      return;
    }
    
    // Set flag to prevent double creation
    _isCreatingEmergency = true;
    _pollingPaused = true; // Pause polling during emergency creation
    debugPrint('⏸️ Pausing polling during emergency creation');
    
    // Store the navigator reference BEFORE showing dialog
    final navigator = Navigator.of(context);
    BuildContext? dialogContext;
    
    try {
      // Show loading indicator
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (dialogBuildContext) {
          dialogContext = dialogBuildContext;
          return const Center(
            child: CircularProgressIndicator(),
          );
        },
      );

      // Get emergency location using service
      final position = await EmergencyService.getEmergencyLocation();
      if (position == null) {
        if (context.mounted) {
          try {
            Navigator.of(context, rootNavigator: true).pop(); // Close loading
          } catch (e) {
            debugPrint('⚠️ Error closing dialog: $e');
          }
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Could not get your location. Please try again.'),
              backgroundColor: Colors.red,
            ),
          );
        }
        return;
      }

      // Create emergency using service (handles location sharing with retry)
      // Add timeout wrapper to prevent stuck loading screen
      final result = await EmergencyService.createEmergency(
        position: position,
        locationRetries: 2,
      ).timeout(
        const Duration(seconds: 20), // Add 20 second timeout
        onTimeout: () {
          throw TimeoutException('Emergency creation timed out. Please check your connection and try again.');
        },
      );

      // Handle existing emergency case
      if (!result.success && result.existingEmergencyId != null) {
        final existingEmergencyId = result.existingEmergencyId!;
        debugPrint('⚠️ Active emergency exists: $existingEmergencyId');
        
        // Update emergency provider - use safe access
        if (context.mounted) {
          final emergencyProvider = _getEmergencyProviderSafely();
          if (emergencyProvider != null) {
            emergencyProvider.setActiveEmergency(Emergency(
              id: existingEmergencyId,
              userId: '',
              createdAt: DateTime.now(),
              status: 'active',
            ));
          }
        }
        
        // Navigate to existing emergency instead
        if (context.mounted) {
          try {
            Navigator.of(context, rootNavigator: true).pop(); // Close loading
          } catch (e) {
            debugPrint('⚠️ Error closing dialog: $e');
          }
          // Show info message
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('You already have an active emergency'),
              backgroundColor: Colors.orange,
              duration: Duration(seconds: 2),
            ),
          );
          Navigator.of(context, rootNavigator: true).push(
            MaterialPageRoute(
              builder: (context) => EmergencyActiveScreen(emergencyId: existingEmergencyId),
            ),
          );
        }
        return;
      }

      // Handle creation failure
      if (!result.success || result.emergency == null) {
        if (context.mounted) {
          try {
            Navigator.of(context, rootNavigator: true).pop(); // Close loading
          } catch (e) {
            debugPrint('⚠️ Error closing dialog: $e');
          }
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(result.errorMessage ?? 'Failed to create emergency'),
              backgroundColor: Colors.red,
            ),
          );
        }
        return;
      }

      final emergency = result.emergency!;
      debugPrint('✅ Emergency created successfully: ${emergency.id}');
      if (!result.locationShared) {
        debugPrint('⚠️ Location sharing failed, but emergency was created');
      }

      // Update emergency provider - use safe access
      if (context.mounted) {
        final emergencyProvider = _getEmergencyProviderSafely();
        if (emergencyProvider != null) {
          emergencyProvider.setActiveEmergency(emergency);
          debugPrint('✅ Emergency provider updated successfully');
        } else {
          debugPrint('⚠️ Could not access provider, but emergency was created: ${emergency.id}');
        }
      }
      
      // CRITICAL: Close loading dialog BEFORE navigation
      // Use stored navigator reference instead of context.mounted (context may be disposed)
      debugPrint('🔄 Attempting to close loading dialog and navigate...');
      try {
        // Close dialog using stored dialog context or navigator
        if (dialogContext != null && dialogContext!.mounted) {
          Navigator.of(dialogContext!, rootNavigator: true).pop();
          debugPrint('✅ Loading dialog closed via dialogContext');
        } else if (navigator.canPop()) {
          navigator.pop();
          debugPrint('✅ Loading dialog closed via stored navigator');
        } else {
          debugPrint('⚠️ Could not close dialog - navigator cannot pop');
        }
      } catch (e) {
        debugPrint('⚠️ Error closing dialog (continuing anyway): $e');
      }
      
      // Small delay to ensure dialog is fully dismissed
      await Future.delayed(const Duration(milliseconds: 200));
      
      // Navigate to active emergency screen using stored navigator
      // Don't rely on context.mounted - use the navigator we stored earlier
      try {
        debugPrint('🚀 Navigating to EmergencyActiveScreen with ID: ${emergency.id}');
        navigator.push(
          MaterialPageRoute(
            builder: (context) => EmergencyActiveScreen(emergencyId: emergency.id),
          ),
        );
        debugPrint('✅ Navigation complete');
      } catch (e) {
        debugPrint('❌ Navigation failed: $e');
        // Try with rootNavigator as fallback if context is still available
        try {
          if (context.mounted) {
            Navigator.of(context, rootNavigator: true).push(
              MaterialPageRoute(
                builder: (context) => EmergencyActiveScreen(emergencyId: emergency.id),
              ),
            );
            debugPrint('✅ Navigation succeeded with rootNavigator fallback');
          } else {
            debugPrint('❌ Context not mounted, cannot navigate');
            // Last resort: try to navigate using the stored navigator without checking canPop
            try {
              navigator.push(
                MaterialPageRoute(
                  builder: (context) => EmergencyActiveScreen(emergencyId: emergency.id),
                ),
              );
              debugPrint('✅ Navigation succeeded with direct navigator push');
            } catch (lastResortError) {
              debugPrint('❌ Last resort navigation also failed: $lastResortError');
            }
          }
        } catch (fallbackError) {
          debugPrint('❌ Fallback navigation also failed: $fallbackError');
        }
      }
    } catch (e) {
      debugPrint('❌ Error triggering emergency: $e');
      // Don't use context.mounted here - widget might be disposed
      // Just try to close dialog safely
      try {
        if (dialogContext != null && dialogContext!.mounted) {
          Navigator.of(dialogContext!, rootNavigator: true).pop();
        } else if (navigator.canPop()) {
          navigator.pop();
        }
      } catch (popError) {
        debugPrint('⚠️ Error closing dialog: $popError');
      }
      
      // Only use context if we're sure it's safe
      final safeContext = context;
      if (safeContext.mounted) {
        ScaffoldMessenger.of(safeContext).showSnackBar(
          SnackBar(
            content: Text(e is TimeoutException 
              ? 'Request timed out. Please check your connection and try again.'
              : 'Failed to create emergency: ${e.toString()}'),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 5),
          ),
        );
      }
    } finally {
      // Always reset the flag, even if there was an error
      _isCreatingEmergency = false;
      debugPrint('✅ Emergency creation flag reset');
      
      // Reset polling pause flag
      Future.delayed(const Duration(seconds: 2), () {
        if (mounted) {
          _pollingPaused = false;
          debugPrint('▶️ Polling pause flag reset (polling removed - using real-time only)');
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final screenHeight = MediaQuery.of(context).size.height;
    
    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Guardian Connect',
          style: TextStyle(
            fontWeight: FontWeight.w600,
            color: Color(0xFF2D3436),
          ),
        ),
        actions: [
          IconButton(
            icon: Icon(Icons.bug_report, color: Colors.grey[600]),
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (context) => const DiagnosticScreen(),
                ),
              );
            },
            tooltip: 'System Diagnostics',
          ),
          IconButton(
            icon: Icon(Icons.settings, color: Colors.grey[600]),
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (context) => const SettingsScreen(),
                ),
              );
            },
          ),
          IconButton(
            icon: Icon(Icons.logout, color: Colors.grey[600]),
            onPressed: () async {
              try {
                final authProvider = Provider.of<AuthProvider>(context, listen: false);
                await authProvider.logout();
                
                if (context.mounted) {
                  Navigator.of(context).pushAndRemoveUntil(
                    MaterialPageRoute(builder: (context) => const LoginScreen()),
                    (route) => false,
                  );
                }
              } catch (e) {
                debugPrint('Logout error: $e');
                await ApiService.clearTokens();
                if (context.mounted) {
                  Navigator.of(context).pushAndRemoveUntil(
                    MaterialPageRoute(builder: (context) => const LoginScreen()),
                    (route) => false,
                  );
                }
              }
            },
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Top spacer - positions content at ~1/3 from top (following the rule of thirds)
            SizedBox(height: screenHeight * 0.12),
            
            // Main content
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    // Title text
                    const Text(
                      'Emergency Alert',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF2D3436),
                        letterSpacing: 0.5,
                      ),
                    ),
                    
                    const SizedBox(height: 8),
                    
                    Text(
                      'Press and hold to alert your contacts',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 15,
                        color: Colors.grey[600],
                        fontWeight: FontWeight.w400,
                      ),
                    ),
                    
                    // Spacer to push button to 1/3 position
                    SizedBox(height: screenHeight * 0.06),
                    
                    // Show pending emergencies if any
                    if (_pendingEmergencies.isNotEmpty) ...[
                      Container(
                        constraints: const BoxConstraints(maxWidth: 500),
                        width: double.infinity,
                        margin: const EdgeInsets.only(bottom: 32),
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              Colors.orange.shade50,
                              Colors.orange.shade100.withOpacity(0.5),
                            ],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          border: Border.all(
                            color: Colors.orange.shade300,
                            width: 1.5,
                          ),
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.orange.withOpacity(0.15),
                              blurRadius: 20,
                              offset: const Offset(0, 8),
                            ),
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: Colors.orange.shade400,
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: const Icon(
                                    Icons.warning_amber_rounded,
                                    color: Colors.white,
                                    size: 20,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Text(
                                  'Pending Alerts',
                                  style: TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.w700,
                                    color: Colors.orange.shade800,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            ..._pendingEmergencies.map((emergency) {
                              return Padding(
                                padding: const EdgeInsets.only(bottom: 10),
                                child: ElevatedButton(
                                  onPressed: () {
                                    // Go directly to map with directions
                                    _respondToEmergencyDirectly(emergency['id'] as String);
                                  },
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: Colors.orange.shade600,
                                    foregroundColor: Colors.white,
                                    minimumSize: const Size(double.infinity, 52),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    elevation: 0,
                                  ),
                                  child: Text(
                                    'Respond to ${emergency['sender_display_name'] ?? emergency['sender_email'] ?? 'Emergency'}',
                                    style: const TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              );
                            }),
                          ],
                        ),
                      ),
                    ],
                    
                    // Emergency button with Consumer - centered
                    Center(
                      child: Consumer<EmergencyProvider>(
                        builder: (context, emergencyProvider, _) {
                        if (emergencyProvider.activeEmergency != null) {
                          return Container(
                            padding: const EdgeInsets.all(24),
                            decoration: BoxDecoration(
                              color: Colors.green.shade50,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: Colors.green.shade200,
                                width: 2,
                              ),
                            ),
                            child: Column(
                              children: [
                                Icon(
                                  Icons.check_circle,
                                  size: 60,
                                  color: Colors.green.shade600,
                                ),
                                const SizedBox(height: 16),
                                const Text(
                                  'Emergency Active',
                                  style: TextStyle(
                                    fontSize: 20,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF2D3436),
                                  ),
                                ),
                                const SizedBox(height: 20),
                                ElevatedButton(
                                  onPressed: () {
                                    Navigator.of(context).push(
                                      MaterialPageRoute(
                                        builder: (context) => EmergencyActiveScreen(
                                          emergencyId: emergencyProvider.activeEmergency!.id,
                                        ),
                                      ),
                                    );
                                  },
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: Colors.green.shade600,
                                    foregroundColor: Colors.white,
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 32,
                                      vertical: 14,
                                    ),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                  ),
                                  child: const Text(
                                    'View Active Emergency',
                                    style: TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          );
                        }
                        
                        return _EmergencyButton(
                          isCreatingEmergency: _isCreatingEmergency,
                          onTriggerEmergency: _triggerEmergency,
                        );
                      },
                      ),
                    ),
                    
                    const SizedBox(height: 40),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmergencyButton extends StatefulWidget {
  final bool isCreatingEmergency;
  final Future<void> Function(BuildContext) onTriggerEmergency;
  
  const _EmergencyButton({
    required this.isCreatingEmergency,
    required this.onTriggerEmergency,
  });
  
  @override
  State<_EmergencyButton> createState() => _EmergencyButtonState();
}

class _EmergencyButtonState extends State<_EmergencyButton> 
    with SingleTickerProviderStateMixin {
  bool _isPressed = false;
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    )..repeat(reverse: true);
    
    _pulseAnimation = Tween<double>(begin: 1.0, end: 1.08).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // The emergency button with pulse animation
        AnimatedBuilder(
          animation: _pulseAnimation,
          builder: (context, child) {
            return Transform.scale(
              scale: widget.isCreatingEmergency ? 1.0 : _pulseAnimation.value,
              child: child,
            );
          },
          child: GestureDetector(
            onTapDown: (_) {
              setState(() => _isPressed = true);
            },
            onTapUp: (_) {
              setState(() => _isPressed = false);
            },
            onTapCancel: () {
              setState(() => _isPressed = false);
            },
            onLongPress: widget.isCreatingEmergency ? null : () {
              _showEmergencyConfirmation(context);
            },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              width: 200,
              height: 200,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: widget.isCreatingEmergency 
                    ? LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [Colors.grey.shade400, Colors.grey.shade500],
                      )
                    : LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: _isPressed 
                            ? [const Color(0xFFC62828), const Color(0xFFB71C1C)]
                            : [const Color(0xFFEF5350), const Color(0xFFE53935), const Color(0xFFD32F2F)],
                      ),
                boxShadow: [
                  // Outer glow
                  BoxShadow(
                    color: widget.isCreatingEmergency 
                        ? Colors.grey.withOpacity(0.3)
                        : Colors.red.withOpacity(0.4),
                    blurRadius: 30,
                    spreadRadius: 8,
                  ),
                  // Inner shadow for depth
                  BoxShadow(
                    color: Colors.black.withOpacity(0.2),
                    blurRadius: 15,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // Inner circle highlight
                  Positioned(
                    top: 15,
                    child: Container(
                      width: 120,
                      height: 60,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(60),
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.white.withOpacity(0.25),
                            Colors.white.withOpacity(0.0),
                          ],
                        ),
                      ),
                    ),
                  ),
                  // Icon
                  Icon(
                    Icons.emergency,
                    size: 90,
                    color: Colors.white.withOpacity(widget.isCreatingEmergency ? 0.7 : 1.0),
                  ),
                ],
              ),
            ),
          ),
        ),
        
        const SizedBox(height: 24),
        
        // "Hold to activate" hint
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
          decoration: BoxDecoration(
            color: Colors.grey.shade200,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.touch_app,
                size: 18,
                color: Colors.grey.shade600,
              ),
              const SizedBox(width: 8),
              Text(
                'Hold to activate',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: Colors.grey.shade700,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  void _showEmergencyConfirmation(BuildContext context) {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.red.shade100,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                Icons.warning_amber_rounded,
                color: Colors.red.shade700,
                size: 24,
              ),
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Text(
                'Trigger Emergency?',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
        content: const Text(
          'This will immediately alert all your emergency contacts with your location.',
          style: TextStyle(
            fontSize: 15,
            height: 1.5,
          ),
        ),
        actionsPadding: const EdgeInsets.fromLTRB(24, 0, 24, 20),
        actions: [
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.of(dialogContext).pop(),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    side: BorderSide(color: Colors.grey.shade300),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: Text(
                    'Cancel',
                    style: TextStyle(
                      color: Colors.grey.shade700,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: () async {
                    Navigator.of(dialogContext).pop();
                    await widget.onTriggerEmergency(context);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFE53935),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text(
                    'Alert Now',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

