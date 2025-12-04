import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/emergency_provider.dart';
import '../models/emergency.dart';
import '../services/api_service.dart';
import '../services/socket_service.dart';
import '../services/emergency_service.dart';
import '../services/push_notification_service.dart';
import 'emergency_active_screen.dart';
import 'emergency_response_screen.dart';
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
  int _pollCount = 0;
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
        // Start polling for emergencies (reduced frequency - push notifications are primary)
        _startPendingEmergencyPolling();
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
        // Refresh pending emergencies to show the new one
        _checkPendingEmergencies();
        
        // Show a snackbar notification
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('🚨 $senderName needs help!'),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 5),
            action: SnackBarAction(
              label: 'RESPOND',
              textColor: Colors.white,
              onPressed: () {
                _navigateToEmergencyResponse(emergencyId);
              },
            ),
          ),
        );
      }
    };
    
    // Handle notification taps (app was in background)
    PushNotificationService.onNotificationTapped = (emergencyId) {
      debugPrint('🚨 Notification tapped: Emergency $emergencyId');
      if (mounted && !_hasNavigatedToEmergency) {
        _navigateToEmergencyResponse(emergencyId);
      }
    };
  }
  
  /// Navigate to emergency response screen
  void _navigateToEmergencyResponse(String emergencyId) {
    if (_hasNavigatedToEmergency) return;
    _hasNavigatedToEmergency = true;
    
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => EmergencyResponseScreen(emergencyId: emergencyId),
      ),
    ).then((_) {
      _hasNavigatedToEmergency = false;
      _checkPendingEmergencies();
    });
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

  void _startPendingEmergencyPolling() {
    // Don't poll if paused or creating emergency
    if (_pollingPaused || _isCreatingEmergency || !mounted) {
      // Retry after a delay if paused
      Future.delayed(const Duration(seconds: 10), () {
        if (mounted && !_pollingPaused && !_isCreatingEmergency) {
          _startPendingEmergencyPolling();
        }
      });
      return;
    }
    
    // TEMPORARY: Increased polling frequency to catch emergencies faster
    // TODO: Reduce back to 10s/60s once push notifications are confirmed working
    // Poll every 3 seconds for first 20 polls (1 minute), then every 15 seconds
    // This ensures emergencies are caught within 3 seconds if push/socket fail
    final pollInterval = _pollCount < 20 ? 3 : 15;
    _pollCount++;
    
    Future.delayed(Duration(seconds: pollInterval), () {
      if (mounted && !_pollingPaused && !_isCreatingEmergency) {
        _checkPendingEmergencies();
        _startPendingEmergencyPolling();
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
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (context) => EmergencyResponseScreen(
                    emergencyId: emergencyId,
                    senderName: senderName,
                  ),
                ),
              );
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
          // Navigate to emergency response screen
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (context) => EmergencyResponseScreen(
                emergencyId: emergencyId,
                senderName: senderName,
              ),
            ),
          );
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
      
      // Resume polling after a short delay to avoid immediate checks
      Future.delayed(const Duration(seconds: 2), () {
        if (mounted) {
          _pollingPaused = false;
          debugPrint('▶️ Resuming polling after emergency creation');
          // Restart polling if it was stopped
          _startPendingEmergencyPolling();
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    // Calculate exact position to match splash screen spacing
    // Splash screen calculates: totalTopHeight + 40 + textHeight + 30 = icon position
    // Then text is 30px below icon
    // For home screen, we reverse: text where icon is, icon where text is
    final statusBarHeight = MediaQuery.of(context).padding.top;
    final appBarHeight = AppBar().preferredSize.height;
    final totalTopHeight = statusBarHeight + appBarHeight;
    
    // Match splash screen spacing exactly:
    // - Top padding (AppBar + status bar)
    // - SizedBox(height: 40)
    // - Text height (fontSize 32, approximate ~40px with line height)
    // - SizedBox(height: 30) - spacing between text and icon
    const topSpacing = 40.0;
    const textHeight = 40.0; // Approximate text height (fontSize 32)
    const spacingBetweenTextAndIcon = 30.0;
    
    // Calculate where text should be positioned (same as splash screen icon position)
    final textTopPosition = totalTopHeight + topSpacing;
    // Calculate where icon should be positioned (30px below text, matching splash screen spacing)
    final iconTopPosition = textTopPosition + textHeight + spacingBetweenTextAndIcon;
    
    return Scaffold(
      appBar: AppBar(
        title: const Text('Guardian Connect'),
        actions: [
          // Diagnostic button (always visible for debugging)
          IconButton(
            icon: const Icon(Icons.bug_report),
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
            icon: const Icon(Icons.settings),
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (context) => const SettingsScreen(),
                ),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              try {
                final authProvider = Provider.of<AuthProvider>(context, listen: false);
                await authProvider.logout();
                
                if (context.mounted) {
                  // Use pushAndRemoveUntil to clear navigation stack and go to login
                  Navigator.of(context).pushAndRemoveUntil(
                    MaterialPageRoute(builder: (context) => const LoginScreen()),
                    (route) => false, // Remove all previous routes
                  );
                }
              } catch (e) {
                debugPrint('Logout error: $e');
                // Even if logout fails, clear tokens and navigate
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
      body: Stack(
        children: [
          // Position text at calculated position (matching splash screen spacing)
          Positioned(
            top: textTopPosition,
            left: 0,
            right: 0,
            child: const Center(
              child: Text(
                'Emergency Alert',
                style: TextStyle(
                  fontSize: 32, // Match splash screen text size
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
          // Position icon/button at calculated position (matching splash screen)
          Positioned(
            top: iconTopPosition,
            left: 0,
            right: 0,
            child: Center(
              child: Column(
                children: [
                  // Show pending emergencies if any (above button)
                  if (_pendingEmergencies.isNotEmpty) ...[
                    Container(
                      margin: const EdgeInsets.only(bottom: 20),
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.orange.shade50,
                        border: Border.all(color: Colors.orange, width: 2),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            '⚠️ Pending Emergency Alerts',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: Colors.orange,
                            ),
                          ),
                          const SizedBox(height: 10),
                          ..._pendingEmergencies.map((emergency) {
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: ElevatedButton(
                                onPressed: () {
                                  Navigator.of(context).push(
                                    MaterialPageRoute(
                                      builder: (context) => EmergencyResponseScreen(
                                        emergencyId: emergency['id'] as String,
                                        senderName: (emergency['sender_display_name'] as String?) ?? 
                                                    (emergency['sender_email'] as String?) ?? 
                                                    'Someone',
                                      ),
                                    ),
                                  );
                                },
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.orange,
                                  minimumSize: const Size(double.infinity, 50),
                                ),
                                child: Text(
                                  'Respond to ${emergency['sender_display_name'] ?? emergency['sender_email'] ?? 'Emergency'}',
                                  style: const TextStyle(color: Colors.white, fontSize: 16),
                                ),
                              ),
                            );
                          }),
                        ],
                      ),
                    ),
                  ],
                  // Emergency button - same size as splash screen icon (200x200 container, 100px icon)
                  Consumer<EmergencyProvider>(
                    builder: (context, emergencyProvider, _) {
                      if (emergencyProvider.activeEmergency != null) {
                        return ElevatedButton(
                          onPressed: () {
                            Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (context) => EmergencyActiveScreen(
                                  emergencyId: emergencyProvider.activeEmergency!.id,
                                ),
                              ),
                            );
                          },
                          child: const Text('View Active Emergency'),
                        );
                      }
                      
                      return _EmergencyButton(
                        isCreatingEmergency: _isCreatingEmergency,
                        onTriggerEmergency: _triggerEmergency,
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
        ],
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

class _EmergencyButtonState extends State<_EmergencyButton> {
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) {
        setState(() {
          _isPressed = true;
        });
      },
      onTapUp: (_) {
        setState(() {
          _isPressed = false;
        });
      },
      onTapCancel: () {
        setState(() {
          _isPressed = false;
        });
      },
      onLongPress: widget.isCreatingEmergency ? null : () {
        _showEmergencyConfirmation(context);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 100),
        width: 200,
        height: 200,
        decoration: BoxDecoration(
          color: widget.isCreatingEmergency 
              ? Colors.grey 
              : (_isPressed ? Colors.red.shade700 : const Color(0xFFE53935)),
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: widget.isCreatingEmergency 
                  ? Colors.grey.withOpacity(0.3)
                  : Colors.red.withOpacity(0.3),
              blurRadius: 20,
              spreadRadius: 5,
            ),
          ],
        ),
        child: const Icon(
          Icons.emergency,
          size: 100,
          color: Colors.white,
        ),
      ),
    );
  }

  void _showEmergencyConfirmation(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Trigger Emergency?'),
        content: const Text('This will alert all your emergency contacts. Are you sure?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.of(context).pop();
              await widget.onTriggerEmergency(context);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
            ),
            child: const Text('Yes, Alert Now'),
          ),
        ],
      ),
    );
  }
}

