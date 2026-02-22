import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'providers/auth_provider.dart';
import 'providers/emergency_provider.dart';
import 'screens/splash_screen.dart';
import 'screens/auth/login_screen.dart';
import 'screens/auth/register_screen.dart';
import 'screens/home_screen.dart';
import 'screens/emergency_response_screen.dart';
import 'services/api_service.dart';
import 'services/socket_service.dart';
import 'services/log_collector.dart';
import 'services/push_notification_service.dart';
import 'services/background_task_service.dart';
import 'services/offline_storage_service.dart';
import 'services/emergency_alarm_service.dart';
import 'widgets/panic_button_widget.dart';
import 'config/app_config.dart';

// Global navigator key for navigation from push notifications
final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize Firebase (optional - app will work without it for basic features)
  // Wrap in try-catch to prevent crashes if Firebase is not configured
  try {
    await Firebase.initializeApp();
    print('✅ Firebase initialized successfully');
    
    // Set up background message handler
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
    
    // Initialize push notifications
    await PushNotificationService.initialize();
  } catch (e) {
    print('⚠️ Firebase initialization error (continuing without Firebase): $e');
    // Continue without Firebase - app can still work for basic features
  }
  
  // Initialize log collection
  LogCollector.startCapture();
  LogCollector.logMobile('App starting', level: LogLevel.info, category: 'System');
  
  // Initialize offline storage
  await OfflineStorageService.initialize();
  
  // Initialize background tasks
  await BackgroundTaskService.initialize();
  
  // Initialize panic button widget
  await PanicButtonWidget.initialize();
  
  // Initialize emergency alarm service (for loud emergency alerts)
  await EmergencyAlarmService.initialize();
  
  // Run app with error handling
  FlutterError.onError = (FlutterErrorDetails details) {
    FlutterError.presentError(details);
    LogCollector.logError(
      'Flutter Error',
      source: LogSource.system,
      error: details.exception,
      stackTrace: details.stack,
    );
    print('❌ Flutter Error: ${details.exception}');
    print('Stack trace: ${details.stack}');
  };
  
  // Log app configuration on startup
  AppConfig.logConfig();
  
  runApp(const GuardianConnectApp());
}

class GuardianConnectApp extends StatelessWidget {
  const GuardianConnectApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => EmergencyProvider()),
      ],
      child: MaterialApp(
        title: 'Guardian Connect',
        navigatorKey: navigatorKey, // Global navigator for push notification navigation
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          primarySwatch: Colors.red,
          primaryColor: const Color(0xFFE53935),
          scaffoldBackgroundColor: Colors.white,
          appBarTheme: const AppBarTheme(
            backgroundColor: Color(0xFFE53935),
            foregroundColor: Colors.white,
            elevation: 0,
          ),
          elevatedButtonTheme: ElevatedButtonThemeData(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFE53935),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
          ),
        ),
        home: const SplashScreen(),
        routes: {
          '/login': (context) => const LoginScreen(),
          '/register': (context) => const RegisterScreen(),
          '/home': (context) => const HomeScreen(),
        },
        builder: (context, child) {
          // Add error boundary to catch any widget errors
          return MediaQuery(
            data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(1.0)),
            child: child!,
          );
        },
        // Add error widget for better debugging
        onGenerateRoute: (settings) {
          return MaterialPageRoute(
            builder: (context) => Scaffold(
              body: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.error_outline, size: 64, color: Colors.red),
                    const SizedBox(height: 16),
                    Text('Error: ${settings.name}'),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}






