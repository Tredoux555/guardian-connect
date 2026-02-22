import 'dart:convert';
import 'dart:async';
import 'dart:io';
import 'dart:math';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter/foundation.dart';
import '../config/app_config.dart';
import 'push_notification_service.dart';

class ApiService {
  static String get baseUrl => AppConfig.apiUrl;
  static const FlutterSecureStorage _storage = FlutterSecureStorage();
  
  static Future<String?> getAccessToken() async {
    return await _storage.read(key: 'access_token');
  }
  
  static Future<void> setAccessToken(String token) async {
    await _storage.write(key: 'access_token', value: token);
  }
  
  static Future<void> setRefreshToken(String token) async {
    await _storage.write(key: 'refresh_token', value: token);
  }
  
  static Future<void> clearTokens() async {
    await _storage.delete(key: 'access_token');
    await _storage.delete(key: 'refresh_token');
  }
  
  static Future<Map<String, String>> _getHeaders({bool includeAuth = true}) async {
    final headers = <String, String>{
      'Content-Type': 'application/json',
    };
    
    // Only include ngrok headers if configured (for development/ngrok)
    if (AppConfig.includeNgrokHeaders) {
      headers['ngrok-skip-browser-warning'] = 'true';
    }
    
    if (includeAuth) {
      final token = await getAccessToken();
      if (token != null) {
        headers['Authorization'] = 'Bearer $token';
      }
    }
    
    return headers;
  }
  
  // Helper to handle connection errors with better diagnostics
  static Exception _handleConnectionError(dynamic e, String method, String endpoint) {
    final errorStr = e.toString();
    
    // Handle SSL/TLS handshake errors (common with ngrok)
    if (errorStr.contains('HandshakeException') || 
        errorStr.contains('Connection terminated during handshake') ||
        errorStr.contains('TlsException')) {
      debugPrint('❌ SSL/TLS handshake error ($method $endpoint): $e');
      debugPrint('   This usually means:');
      debugPrint('   • Network connection was interrupted during SSL handshake');
      debugPrint('   • ngrok tunnel is unstable or expired');
      debugPrint('   • Network is unstable (common in China without VPN)');
      return Exception('Connection interrupted. Please try again. If the problem persists, the network connection may be unstable.');
    }
    
    if (errorStr.contains('Connection closed') || errorStr.contains('ClientException')) {
      debugPrint('❌ Connection closed error ($method $endpoint): $e');
      debugPrint('   This usually means:');
      debugPrint('   • iPhone and Mac are on different networks');
      debugPrint('   • Firewall/router is blocking the connection');
      debugPrint('   • Backend server crashed or restarted');
      debugPrint('   • Network is unstable');
      return Exception('Connection closed: Cannot reach server.\n\nPlease check your network connection and try again.');
    }
    
    return Exception('Connection error: $e');
  }
  
  static Future<http.Response> get(String endpoint, {bool includeAuth = true, int maxRetries = 4}) async {
    final headers = await _getHeaders(includeAuth: includeAuth);
    int attempt = 0;

    while (attempt <= maxRetries) {
      try {
        debugPrint('📡 GET $endpoint (attempt ${attempt + 1}/${maxRetries + 1})');
        
        final response = await http.get(
          Uri.parse('$baseUrl$endpoint'),
          headers: headers,
        ).timeout(
          const Duration(seconds: 15), // Reduce from 30 to 15 seconds
          onTimeout: () {
            throw TimeoutException('Request timed out after 15 seconds');
          },
        );

        // Handle 401 (token expired) by refreshing and retrying
        if (response.statusCode == 401 && includeAuth) {
          return _handle401AndRetry(response, 'GET', '$baseUrl$endpoint', headers);
        }

        return response;
      } on SocketException catch (e) {
        debugPrint('❌ Network error: $e');
        if (attempt < maxRetries) {
          attempt++;
          final delay = _calculateRetryDelay(attempt);
          debugPrint('🔄 Retrying in ${delay.inSeconds}s... (attempt $attempt/$maxRetries)');
          await Future.delayed(delay);
          continue;
        }
        throw Exception('Network error: Unable to connect to server. Please check your internet connection.');
      } on TimeoutException catch (e) {
        debugPrint('❌ Request timeout: $e');
        if (attempt < maxRetries) {
          attempt++;
          final delay = _calculateRetryDelay(attempt);
          debugPrint('🔄 Retrying in ${delay.inSeconds}s... (attempt $attempt/$maxRetries)');
          await Future.delayed(delay);
          continue;
        }
        throw Exception('Request timed out. The server may be slow or unavailable.');
      } on HttpException catch (e) {
        debugPrint('❌ HTTP error: $e');
        throw Exception('HTTP error: ${e.message}');
      } catch (e) {
        final errorStr = e.toString();
        if ((errorStr.contains('HandshakeException') || 
             errorStr.contains('Connection terminated') ||
             errorStr.contains('TlsException')) && 
            attempt < maxRetries) {
          attempt++;
          final delay = _calculateRetryDelay(attempt, isHandshake: true);
          debugPrint('🔄 SSL handshake failed, retrying in ${delay.inSeconds}s... (attempt $attempt/$maxRetries)');
          await Future.delayed(delay);
          continue;
        }
        throw _handleConnectionError(e, 'GET', endpoint);
      }
    }
    
    throw Exception('Failed after ${maxRetries + 1} attempts');
  }
  
  // Helper to calculate exponential backoff delay with jitter
  static Duration _calculateRetryDelay(int attempt, {bool isHandshake = false}) {
    // Base delay: 2s for handshake errors, 1s for others
    int baseDelay = isHandshake ? 2 : 1;
    // Exponential backoff: baseDelay * 2^attempt (2, 4, 8, 16, 32)
    int delaySeconds = baseDelay * pow(2, attempt).toInt();
    // Cap at 30 seconds
    delaySeconds = min(delaySeconds, 30);
    // Add jitter (random 0-1 second) to prevent thundering herd
    final jitter = Random().nextInt(1000);
    return Duration(milliseconds: delaySeconds * 1000 + jitter);
  }

  static Future<http.Response> post(
    String endpoint,
    Map<String, dynamic> body, {
    bool includeAuth = true,
    int maxRetries = 4, // Retry up to 4 times (5 total attempts)
  }) async {
    final headers = await _getHeaders(includeAuth: includeAuth);
    int attempt = 0;

    while (attempt <= maxRetries) {
      try {
        debugPrint('📡 POST $endpoint (attempt ${attempt + 1}/${maxRetries + 1})');
        
        final response = await http.post(
          Uri.parse('$baseUrl$endpoint'),
          headers: headers,
          body: jsonEncode(body),
        ).timeout(
          const Duration(seconds: 15), // Reduce from 30 to 15 seconds
          onTimeout: () {
            throw TimeoutException('Request timed out after 15 seconds');
          },
        );

        // Handle 401 (token expired) by refreshing and retrying
        if (response.statusCode == 401 && includeAuth) {
          return _handle401AndRetry(response, 'POST', '$baseUrl$endpoint', headers, body);
        }

        return response;
      } on SocketException catch (e) {
        debugPrint('❌ Network error: $e');
        if (attempt < maxRetries) {
          attempt++;
          final delay = _calculateRetryDelay(attempt);
          debugPrint('🔄 Retrying in ${delay.inSeconds}s... (attempt $attempt/$maxRetries)');
          await Future.delayed(delay);
          continue;
        }
        throw Exception('Network error: Unable to connect to server. Please check your internet connection.');
      } on TimeoutException catch (e) {
        debugPrint('❌ Request timeout: $e');
        if (attempt < maxRetries) {
          attempt++;
          final delay = _calculateRetryDelay(attempt);
          debugPrint('🔄 Retrying in ${delay.inSeconds}s... (attempt $attempt/$maxRetries)');
          await Future.delayed(delay);
          continue;
        }
        throw Exception('Request timed out. The server may be slow or unavailable.');
      } on HttpException catch (e) {
        debugPrint('❌ HTTP error: $e');
        throw Exception('HTTP error: ${e.message}');
      } catch (e) {
        final errorStr = e.toString();
        // Retry on handshake errors and connection issues with exponential backoff
        if ((errorStr.contains('HandshakeException') || 
             errorStr.contains('Connection terminated') ||
             errorStr.contains('TlsException')) && 
            attempt < maxRetries) {
          attempt++;
          final delay = _calculateRetryDelay(attempt, isHandshake: true);
          debugPrint('🔄 SSL handshake failed, retrying in ${delay.inSeconds}s... (attempt $attempt/$maxRetries)');
          await Future.delayed(delay);
          continue;
        }
        throw _handleConnectionError(e, 'POST', endpoint);
      }
    }
    
    // Should never reach here, but just in case
    throw Exception('Failed after ${maxRetries + 1} attempts');
  }
  
  static Future<http.Response> put(
    String endpoint,
    Map<String, dynamic> body, {
    bool includeAuth = true,
    int maxRetries = 4,
  }) async {
    final headers = await _getHeaders(includeAuth: includeAuth);
    int attempt = 0;

    while (attempt <= maxRetries) {
      try {
        debugPrint('📡 PUT $endpoint (attempt ${attempt + 1}/${maxRetries + 1})');
        
        final response = await http.put(
          Uri.parse('$baseUrl$endpoint'),
          headers: headers,
          body: jsonEncode(body),
        ).timeout(
          const Duration(seconds: 15), // Reduce from 30 to 15 seconds
          onTimeout: () {
            throw TimeoutException('Request timed out after 15 seconds');
          },
        );

        // Handle 401 (token expired) by refreshing and retrying
        if (response.statusCode == 401 && includeAuth) {
          return _handle401AndRetry(response, 'PUT', '$baseUrl$endpoint', headers, body);
        }

        return response;
      } on SocketException catch (e) {
        debugPrint('❌ Network error: $e');
        if (attempt < maxRetries) {
          attempt++;
          final delay = _calculateRetryDelay(attempt);
          debugPrint('🔄 Retrying in ${delay.inSeconds}s... (attempt $attempt/$maxRetries)');
          await Future.delayed(delay);
          continue;
        }
        throw Exception('Network error: Unable to connect to server. Please check your internet connection.');
      } on TimeoutException catch (e) {
        debugPrint('❌ Request timeout: $e');
        if (attempt < maxRetries) {
          attempt++;
          final delay = _calculateRetryDelay(attempt);
          debugPrint('🔄 Retrying in ${delay.inSeconds}s... (attempt $attempt/$maxRetries)');
          await Future.delayed(delay);
          continue;
        }
        throw Exception('Request timed out. The server may be slow or unavailable.');
      } on HttpException catch (e) {
        debugPrint('❌ HTTP error: $e');
        throw Exception('HTTP error: ${e.message}');
      } catch (e) {
        final errorStr = e.toString();
        if ((errorStr.contains('HandshakeException') || 
             errorStr.contains('Connection terminated') ||
             errorStr.contains('TlsException')) && 
            attempt < maxRetries) {
          attempt++;
          final delay = _calculateRetryDelay(attempt, isHandshake: true);
          debugPrint('🔄 SSL handshake failed, retrying in ${delay.inSeconds}s... (attempt $attempt/$maxRetries)');
          await Future.delayed(delay);
          continue;
        }
        throw _handleConnectionError(e, 'PUT', endpoint);
      }
    }
    
    throw Exception('Failed after ${maxRetries + 1} attempts');
  }
  
  static Future<http.Response> delete(String endpoint, {bool includeAuth = true, int maxRetries = 4}) async {
    final headers = await _getHeaders(includeAuth: includeAuth);
    int attempt = 0;

    while (attempt <= maxRetries) {
      try {
        debugPrint('📡 DELETE $endpoint (attempt ${attempt + 1}/${maxRetries + 1})');
        
        final response = await http.delete(
          Uri.parse('$baseUrl$endpoint'),
          headers: headers,
        ).timeout(
          const Duration(seconds: 15), // Reduce from 30 to 15 seconds
          onTimeout: () {
            throw TimeoutException('Request timed out after 15 seconds');
          },
        );

        // Handle 401 (token expired) by refreshing and retrying
        if (response.statusCode == 401 && includeAuth) {
          return _handle401AndRetry(response, 'DELETE', '$baseUrl$endpoint', headers);
        }

        return response;
      } on SocketException catch (e) {
        debugPrint('❌ Network error: $e');
        if (attempt < maxRetries) {
          attempt++;
          final delay = _calculateRetryDelay(attempt);
          debugPrint('🔄 Retrying in ${delay.inSeconds}s... (attempt $attempt/$maxRetries)');
          await Future.delayed(delay);
          continue;
        }
        throw Exception('Network error: Unable to connect to server. Please check your internet connection.');
      } on TimeoutException catch (e) {
        debugPrint('❌ Request timeout: $e');
        if (attempt < maxRetries) {
          attempt++;
          final delay = _calculateRetryDelay(attempt);
          debugPrint('🔄 Retrying in ${delay.inSeconds}s... (attempt $attempt/$maxRetries)');
          await Future.delayed(delay);
          continue;
        }
        throw Exception('Request timed out. The server may be slow or unavailable.');
      } on HttpException catch (e) {
        debugPrint('❌ HTTP error: $e');
        throw Exception('HTTP error: ${e.message}');
      } catch (e) {
        final errorStr = e.toString();
        if ((errorStr.contains('HandshakeException') || 
             errorStr.contains('Connection terminated') ||
             errorStr.contains('TlsException')) && 
            attempt < maxRetries) {
          attempt++;
          final delay = _calculateRetryDelay(attempt, isHandshake: true);
          debugPrint('🔄 SSL handshake failed, retrying in ${delay.inSeconds}s... (attempt $attempt/$maxRetries)');
          await Future.delayed(delay);
          continue;
        }
        throw _handleConnectionError(e, 'DELETE', endpoint);
      }
    }
    
    throw Exception('Failed after ${maxRetries + 1} attempts');
  }
  
  // Check if backend is accessible
  // Returns true if reachable, false otherwise
  // This is a best-effort check - don't block on it
  static Future<bool> checkConnection() async {
    try {
      // Use ngrok URL for health check (same as baseUrl but with /health endpoint)
      final healthUrl = baseUrl.endsWith('/api') 
          ? '${baseUrl.substring(0, baseUrl.length - 4)}/health'
          : '$baseUrl/health';
      debugPrint('🔍 Checking backend connection to $healthUrl...');
      
      // Use a shorter timeout for health check
      final client = http.Client();
      try {
        final response = await client
            .get(Uri.parse(healthUrl), headers: {'ngrok-skip-browser-warning': 'true'})
            .timeout(
              const Duration(seconds: 5), // Increased timeout for ngrok
              onTimeout: () {
                debugPrint('⏱️ Health check timed out after 5 seconds');
                throw TimeoutException('Health check timed out');
              },
            );
        
        final isHealthy = response.statusCode == 200;
        debugPrint('✅ Backend health check: ${isHealthy ? "PASSED" : "FAILED"} (status: ${response.statusCode})');
        return isHealthy;
      } finally {
        client.close();
      }
    } on SocketException catch (e) {
      debugPrint('❌ Backend health check failed - SocketException: $e');
      debugPrint('   This usually means the backend is not reachable from your device.');
      debugPrint('   Possible causes:');
      debugPrint('   • iPhone and Mac are on different networks');
      debugPrint('   • Firewall blocking connection');
      debugPrint('   • Backend not listening on 0.0.0.0');
      return false;
    } on TimeoutException catch (e) {
      debugPrint('❌ Backend health check failed - Timeout: $e');
      debugPrint('   The backend may be slow or unreachable.');
      return false;
    } on HttpException catch (e) {
      debugPrint('❌ Backend health check failed - HttpException: $e');
      return false;
    } catch (e) {
      debugPrint('❌ Backend health check failed: $e');
      debugPrint('   Error type: ${e.runtimeType}');
      return false;
    }
  }
  
  // Auth endpoints
  static Future<Map<String, dynamic>> register(String email, String password) async {
    final response = await post('/auth/register', {
      'email': email,
      'password': password,
    }, includeAuth: false);
    
    if (response.statusCode == 201) {
      return jsonDecode(response.body);
    } else {
      // Parse error message from response
      try {
        final errorData = jsonDecode(response.body);
        final errorMessage = errorData['error'] ?? 'Registration failed';
        throw Exception(errorMessage);
      } catch (e) {
        // If JSON parsing fails, use the raw response
        throw Exception('Registration failed: ${response.body}');
      }
    }
  }
  
  static Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await post('/auth/login', {
      'email': email,
      'password': password,
    }, includeAuth: false);
    
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      
      // Debug: Log what we received
      debugPrint('✅ Login successful');
      debugPrint('   Access token received: ${data['accessToken'] != null}');
      debugPrint('   Refresh token received: ${data['refreshToken'] != null}');
      
      // Save tokens
      if (data['accessToken'] != null) {
        await setAccessToken(data['accessToken']);
        debugPrint('   ✅ Access token saved');
      } else {
        debugPrint('   ❌ No access token in response!');
      }
      
      if (data['refreshToken'] != null) {
        await setRefreshToken(data['refreshToken']);
        debugPrint('   ✅ Refresh token saved');
        
        // Verify it was saved
        final savedRefresh = await _storage.read(key: 'refresh_token');
        if (savedRefresh != null) {
          debugPrint('   ✅ Refresh token verified in storage');
        } else {
          debugPrint('   ❌ Refresh token NOT found in storage after save!');
        }
      } else {
        debugPrint('   ❌ No refresh token in response!');
      }
      
      // Register FCM token for push notifications after successful login
      try {
        await PushNotificationService.registerToken();
      } catch (e) {
        debugPrint('⚠️ FCM token registration failed (non-critical): $e');
      }
      
      return data;
    } else {
      // Parse error message from response
      try {
        final errorData = jsonDecode(response.body);
        final errorMessage = errorData['error'] ?? 'Login failed';
        throw Exception(errorMessage);
      } catch (e) {
        // If JSON parsing fails, use the raw response
        throw Exception('Login failed: ${response.body}');
      }
    }
  }
  
  static Future<void> logout() async {
    try {
      final refreshToken = await _storage.read(key: 'refresh_token');
      if (refreshToken != null) {
        try {
          await post('/auth/logout', {'refreshToken': refreshToken}, includeAuth: false);
        } catch (e) {
          // If logout API call fails, still clear tokens locally
          debugPrint('⚠️ Logout API call failed: $e');
        }
      }
    } catch (e) {
      debugPrint('⚠️ Logout error: $e');
    } finally {
      // Always clear tokens, even if API call fails
      await clearTokens();
    }
  }
  
  static Future<String> refreshAccessToken() async {
    final refreshToken = await _storage.read(key: 'refresh_token');
    if (refreshToken == null) {
      // Debug: Check if access token exists
      final accessToken = await _storage.read(key: 'access_token');
      debugPrint('❌ No refresh token available for refresh');
      debugPrint('   Access token exists: ${accessToken != null}');
      debugPrint('   This usually means you need to log in again');
      throw Exception('No refresh token available');
    }
    
    debugPrint('🔄 Attempting token refresh...');
    debugPrint('   Refresh token length: ${refreshToken.length}');
    
    try {
      final response = await post('/auth/refresh', {
        'refreshToken': refreshToken,
      }, includeAuth: false);
      
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        await setAccessToken(data['accessToken']);
        // Update refresh token if provided (some implementations rotate refresh tokens)
        if (data['refreshToken'] != null) {
          await setRefreshToken(data['refreshToken']);
        }
        return data['accessToken'];
      } else if (response.statusCode == 401 || response.statusCode == 403) {
        // Only clear tokens on actual auth failures (401/403), not network errors
        debugPrint('❌ Token refresh failed with auth error (${response.statusCode})');
        await clearTokens();
        throw Exception('Token refresh failed: Authentication error');
      } else {
        // Other errors (500, etc.) - don't clear tokens, might be temporary
        debugPrint('❌ Token refresh failed with server error (${response.statusCode})');
        throw Exception('Token refresh failed: Server error');
      }
    } catch (e) {
      final errorStr = e.toString();
      // Only clear tokens if it's an auth error, not a network error
      if (errorStr.contains('No refresh token available') || 
          errorStr.contains('Authentication error') ||
          errorStr.contains('Token refresh failed: Authentication')) {
        // Auth error - clear tokens
        await clearTokens();
        throw Exception('Session expired. Please log in again.');
      } else {
        // Network error - keep tokens and throw network error
        debugPrint('⚠️ Token refresh failed due to network error, keeping tokens: $e');
        throw Exception('Token refresh failed due to network error. Please try again.');
      }
    }
  }
  
  // Static flag and completer to prevent multiple simultaneous refresh attempts
  static bool _isRefreshingToken = false;
  static Completer<String>? _refreshCompleter;

  // Helper method to handle token refresh and retry
  static Future<http.Response> _handle401AndRetry(
    http.Response response,
    String method,
    String url,
    Map<String, String> headers,
    [Map<String, dynamic>? body]
  ) async {
    // Only retry once to prevent infinite loops
    if (response.statusCode != 401) {
      return response;
    }

    // If refresh is already in progress, wait for it
    if (_isRefreshingToken && _refreshCompleter != null) {
      debugPrint('🔄 Token refresh already in progress, waiting...');
      try {
        final newToken = await _refreshCompleter!.future.timeout(
          const Duration(seconds: 15), // Reduce from 30 to 15 seconds
          onTimeout: () {
            throw Exception('Token refresh timeout');
          },
        );
        // Use the refreshed token for retry
        final newHeaders = Map<String, String>.from(headers);
        newHeaders['Authorization'] = 'Bearer $newToken';
        return _retryRequest(method, url, newHeaders, body);
      } catch (e) {
        debugPrint('❌ Failed while waiting for token refresh: $e');
        return response; // Return original 401 response
      }
    }

    // Start new refresh
    _isRefreshingToken = true;
    _refreshCompleter = Completer<String>();
    debugPrint('🔄 Token expired (401), attempting refresh...');

    try {
      // Try to refresh the token
      final newToken = await refreshAccessToken();
      debugPrint('✅ Token refreshed successfully');
      
      // Complete the completer for any waiting requests
      if (!_refreshCompleter!.isCompleted) {
        _refreshCompleter!.complete(newToken);
      }

      // Retry the original request with new token
      final newHeaders = Map<String, String>.from(headers);
      newHeaders['Authorization'] = 'Bearer $newToken';
      return _retryRequest(method, url, newHeaders, body);

    } catch (refreshError) {
      debugPrint('❌ Token refresh failed: $refreshError');
      
      // Complete completer with error for waiting requests
      if (!_refreshCompleter!.isCompleted) {
        _refreshCompleter!.completeError(refreshError);
      }
      
      final errorStr = refreshError.toString();
      // Only clear tokens if it's an auth error, not a network error
      if (errorStr.contains('Session expired') || 
          errorStr.contains('Authentication error') ||
          errorStr.contains('No refresh token available')) {
        // Auth error - tokens already cleared by refreshAccessToken
        throw Exception('Session expired. Please log in again.');
      } else {
        // Network error - keep tokens, throw network error
        throw Exception('Token refresh failed due to network error. Please try again.');
      }
    } finally {
      _isRefreshingToken = false;
      _refreshCompleter = null;
    }
  }

  // Helper to retry request with new headers
  static Future<http.Response> _retryRequest(
    String method,
    String url,
    Map<String, String> headers,
    Map<String, dynamic>? body,
  ) async {
    http.Response retryResponse;
    if (method == 'GET') {
      retryResponse = await http.get(Uri.parse(url), headers: headers)
          .timeout(const Duration(seconds: 15)); // Reduce from 30 to 15 seconds
    } else if (method == 'POST') {
      retryResponse = await http.post(Uri.parse(url), headers: headers, body: jsonEncode(body))
          .timeout(const Duration(seconds: 15)); // Reduce from 30 to 15 seconds
    } else if (method == 'PUT') {
      retryResponse = await http.put(Uri.parse(url), headers: headers, body: jsonEncode(body))
          .timeout(const Duration(seconds: 15)); // Reduce from 30 to 15 seconds
    } else if (method == 'DELETE') {
      retryResponse = await http.delete(Uri.parse(url), headers: headers)
          .timeout(const Duration(seconds: 15)); // Reduce from 30 to 15 seconds
    } else {
      throw Exception('Unsupported method: $method');
    }

    debugPrint('🔄 Retried $method request: ${retryResponse.statusCode}');
    return retryResponse;
  }

  static Future<Map<String, dynamic>> getCurrentUser() async {
    final response = await get('/user/me');

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      
      // Check if backend returned placeholder message (indicates endpoint not implemented)
      if (data is Map && data.containsKey('message') && 
          data['message'].toString().contains('to be implemented')) {
        debugPrint('❌ Backend /user/me endpoint returned placeholder message');
        debugPrint('   Response: $data');
        debugPrint('   This indicates the backend endpoint is not properly deployed');
        throw Exception('User endpoint not implemented on backend. Please check backend deployment.');
      }
      
      // Try to extract user ID from various possible keys
      if (data is Map) {
        final userId = data['id'] ?? data['user_id'] ?? data['userId'];
        if (userId != null) {
          debugPrint('✅ User ID extracted: $userId');
          return Map<String, dynamic>.from(data);
        } else {
          debugPrint('⚠️ User data received but no ID field found');
          debugPrint('   Available keys: ${data.keys.toList()}');
          debugPrint('   Response: $data');
        }
      }
      
      return Map<String, dynamic>.from(data as Map);
    } else {
      debugPrint('❌ Failed to get current user: ${response.statusCode}');
      debugPrint('   Response body: ${response.body}');
      throw Exception('Failed to get current user: ${response.body}');
    }
  }

  /// POST multipart/form-data request (for file uploads)
  static Future<http.Response> postMultipart(
    String endpoint,
    Map<String, dynamic> fields,
    {int maxRetries = 2} // Add retry support
  ) async {
    int attempt = 0;
    
    while (attempt <= maxRetries) {
      try {
        final token = await getAccessToken();
        final uri = Uri.parse('$baseUrl$endpoint');
        
        var request = http.MultipartRequest('POST', uri);
        
        // Add authorization header
        if (token != null) {
          request.headers['Authorization'] = 'Bearer $token';
        }
        
        // Add ngrok headers if configured
        if (AppConfig.includeNgrokHeaders) {
          request.headers['ngrok-skip-browser-warning'] = 'true';
        }
        
        // Add fields
        fields.forEach((key, value) {
          if (value is File) {
            // Determine content type based on file extension
            String? contentType;
            final extension = value.path.split('.').last.toLowerCase();
            if (extension == 'jpg' || extension == 'jpeg') {
              contentType = 'image/jpeg';
            } else if (extension == 'png') {
              contentType = 'image/png';
            } else if (extension == 'gif') {
              contentType = 'image/gif';
            } else if (extension == 'mp4' || extension == 'mov') {
              contentType = 'video/mp4';
            } else if (extension == 'm4a' || extension == 'mp3' || extension == 'aac') {
              contentType = 'audio/m4a';
            }
            
            request.files.add(
              http.MultipartFile(
                key,
                value.readAsBytes().asStream(),
                value.lengthSync(),
                filename: value.path.split('/').last,
                contentType: contentType != null 
                  ? http.MediaType.parse(contentType) 
                  : null,
              ),
            );
          } else if (value is String) {
            request.fields[key] = value;
          }
        });
        
        debugPrint('📡 POST multipart $endpoint (attempt ${attempt + 1}/${maxRetries + 1})');
        
        // Add timeout to multipart request
        final streamedResponse = await request.send().timeout(
          const Duration(seconds: 30), // Longer timeout for file uploads
          onTimeout: () {
            throw TimeoutException('Multipart request timed out after 30 seconds');
          },
        );
        
        final response = await http.Response.fromStream(streamedResponse).timeout(
          const Duration(seconds: 10), // Timeout for reading response
          onTimeout: () {
            throw TimeoutException('Response read timed out');
          },
        );
        
        debugPrint('📡 Response: ${response.statusCode}');
        
        // Handle 401 (token expired) - for multipart, we can't easily retry with new token
        // Just return the 401 response and let the caller handle it
        if (response.statusCode == 401) {
          debugPrint('⚠️ 401 Unauthorized on multipart request - token may have expired');
        }
        
        return response;
      } on SocketException catch (e) {
        debugPrint('❌ Network error on multipart upload: $e');
        if (attempt < maxRetries) {
          attempt++;
          final delay = _calculateRetryDelay(attempt);
          debugPrint('🔄 Retrying multipart upload in ${delay.inSeconds}s... (attempt $attempt/$maxRetries)');
          await Future.delayed(delay);
          continue;
        }
        throw Exception('Network error: Unable to upload file. Please check your internet connection.');
      } on TimeoutException catch (e) {
        debugPrint('❌ Multipart upload timeout: $e');
        if (attempt < maxRetries) {
          attempt++;
          final delay = _calculateRetryDelay(attempt);
          debugPrint('🔄 Retrying multipart upload in ${delay.inSeconds}s... (attempt $attempt/$maxRetries)');
          await Future.delayed(delay);
          continue;
        }
        throw Exception('Upload timed out. The file may be too large or the connection is slow.');
      } catch (e) {
        debugPrint('❌ Error in multipart upload: $e');
        final errorStr = e.toString();
        
        // Handle connection reset errors specifically
        if (errorStr.contains('Connection reset') || errorStr.contains('errno = 54')) {
          if (attempt < maxRetries) {
            attempt++;
            final delay = _calculateRetryDelay(attempt);
            debugPrint('🔄 Connection reset - retrying multipart upload in ${delay.inSeconds}s... (attempt $attempt/$maxRetries)');
            await Future.delayed(delay);
            continue;
          }
          throw Exception('Connection was reset by the server. This may happen with large files. Please try again or use a smaller image.');
        }
        
        if (attempt < maxRetries) {
          attempt++;
          final delay = _calculateRetryDelay(attempt);
          debugPrint('🔄 Retrying multipart upload in ${delay.inSeconds}s... (attempt $attempt/$maxRetries)');
          await Future.delayed(delay);
          continue;
        }
        rethrow;
      }
    }
    
    throw Exception('Failed to upload file after ${maxRetries + 1} attempts');
  }
}

