import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import 'auth/login_screen.dart';
import 'home_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _checkAuth();
  }

  Future<void> _checkAuth() async {
    try {
      // Increased delay to 5 seconds so you can see the splash screen positioning
      await Future.delayed(const Duration(seconds: 5));
      
      if (!mounted) return;
      
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final isAuthenticated = await authProvider.checkAuth();
      
      if (!mounted) return;
      
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (context) => isAuthenticated ? const HomeScreen() : const LoginScreen(),
        ),
      );
    } catch (e) {
      print('❌ Error in splash screen: $e');
      // If there's an error, go to login screen
      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(
            builder: (context) => const LoginScreen(),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    // Calculate exact position to match home screen
    // Home screen has: AppBar + SizedBox(40) + "Emergency Alert" text + SizedBox(30) + icon
    final statusBarHeight = MediaQuery.of(context).padding.top;
    final appBarHeight = AppBar().preferredSize.height;
    final totalTopHeight = statusBarHeight + appBarHeight;
    
    // Match home screen spacing:
    // - Top padding (AppBar + status bar)
    // - SizedBox(height: 40)
    // - "Emergency Alert" text (fontSize: 24, approximate height ~32px with line height)
    // - SizedBox(height: 30)
    // Then icon starts at same position
    const emergencyTextHeight = 32.0; // Approximate text height
    const spacingBeforeIcon = 40.0 + emergencyTextHeight + 30.0;
    final iconTopPosition = totalTopHeight + spacingBeforeIcon;
    
    return Scaffold(
      backgroundColor: const Color(0xFFE53935),
      body: Stack(
        children: [
          // Position icon at exact same spot as home screen emergency button
          Positioned(
            top: iconTopPosition,
            left: 0,
            right: 0,
            child: Center(
              child: Column(
                children: [
                  // Icon - same size as home screen button (200x200 container, 100px icon)
                  Container(
                    width: 200,
                    height: 200,
                    alignment: Alignment.center,
                    child: const Icon(
                      Icons.emergency,
                      size: 100,
                      color: Colors.white,
                    ),
                  ),
                  // Text positioned below icon
                  const SizedBox(height: 30),
                  const Text(
                    'Guardian Connect',
                    style: TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 48),
                  const CircularProgressIndicator(
                    valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
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






