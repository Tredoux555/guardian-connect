/// Application configuration
/// 
/// This file contains all configurable URLs and settings.
/// Update these values to point to your production domain.
import 'package:flutter/foundation.dart';

class AppConfig {
  // Base URL for your API (without trailing slash)
  // Examples:
  // - Production: 'https://api.yourdomain.com'
  // - Development: 'https://your-ngrok-url.ngrok-free.dev'
  // - Local: 'http://localhost:3001'
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.guardianconnect.icu', // Production domain
  );
  
  // Full API URL (includes /api path)
  static String get apiUrl => '$apiBaseUrl/api';
  
  // Socket URL (same as base URL, without /api)
  static String get socketUrl => apiBaseUrl;
  
  // Whether to include ngrok headers (set to false for production domains)
  static const bool includeNgrokHeaders = bool.fromEnvironment(
    'INCLUDE_NGROK_HEADERS',
    defaultValue: false, // Set to false for localhost and production
  );
  
  // Environment detection
  static bool get isProduction => !apiBaseUrl.contains('ngrok') && 
                                  !apiBaseUrl.contains('localhost') &&
                                  !apiBaseUrl.contains('127.0.0.1');
  
  static bool get isDevelopment => !isProduction;
  
  // Debug logging
  static void logConfig() {
    debugPrint('📱 App Configuration:');
    debugPrint('   API Base URL: $apiBaseUrl');
    debugPrint('   API URL: $apiUrl');
    debugPrint('   Socket URL: $socketUrl');
    debugPrint('   Include Ngrok Headers: $includeNgrokHeaders');
    debugPrint('   Environment: ${isProduction ? "Production" : "Development"}');
  }
}

