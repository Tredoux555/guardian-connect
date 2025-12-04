import 'package:flutter/foundation.dart';
import '../models/user.dart';
import '../services/api_service.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthProvider with ChangeNotifier {
  User? _user;
  bool _isLoading = false;
  String? _error;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  
  User? get user => _user;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get isAuthenticated => _user != null;
  
  Future<bool> checkAuth() async {
    try {
      final token = await ApiService.getAccessToken();
      if (token != null) {
        // TODO: Verify token and get user info
        // For now, just check if token exists
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }
  
  Future<bool> login(String email, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    
    try {
      // Try to check connection, but don't block if it fails
      // The actual login attempt will provide better error info
      debugPrint('🔍 Checking backend connection...');
      final isConnected = await ApiService.checkConnection();
      if (!isConnected) {
        debugPrint('⚠️ Health check failed, but attempting login anyway...');
        // Don't block - try login anyway, it might work
        // The login will provide a more specific error if it fails
      } else {
        debugPrint('✅ Backend is reachable');
      }
      
      debugPrint('🔐 Attempting login...');
      final response = await ApiService.login(email, password);
      _user = User.fromJson(response['user']);
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      // Parse error message for user-friendly display
      String errorMessage = e.toString();
      
      if (errorMessage.contains('Connection closed') || errorMessage.contains('SocketException')) {
        errorMessage = 'Server connection failed. Please check if the backend is running on port 3001.';
      } else if (errorMessage.contains('timeout') || errorMessage.contains('TimeoutException')) {
        errorMessage = 'Request timed out. The server may be slow or unavailable.';
      } else if (errorMessage.contains('401') || errorMessage.contains('Invalid credentials')) {
        errorMessage = 'Invalid email or password.';
      } else if (errorMessage.contains('403') || errorMessage.contains('verify')) {
        errorMessage = 'Please verify your email before logging in.';
      } else if (errorMessage.contains('Network error')) {
        errorMessage = 'Network error: Unable to connect to server. Please check your internet connection.';
      } else if (errorMessage.contains('HTTP error')) {
        errorMessage = 'Server error. Please try again later.';
      } else {
        // Keep original error but make it more readable
        errorMessage = errorMessage.replaceAll('Exception: ', '');
      }
      
      _error = errorMessage;
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }
  
  Future<bool> register(String email, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    
    try {
      // Check connection first
      final isConnected = await ApiService.checkConnection();
      if (!isConnected) {
        _error = 'Cannot connect to server. Please check your network connection.';
        _isLoading = false;
        notifyListeners();
        return false;
      }
      
      await ApiService.register(email, password);
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      // Parse error message for user-friendly display
      String errorMessage = e.toString();
      
      if (errorMessage.contains('Connection closed') || errorMessage.contains('SocketException')) {
        errorMessage = 'Server connection failed. Please check if the backend is running.';
      } else if (errorMessage.contains('timeout') || errorMessage.contains('TimeoutException')) {
        errorMessage = 'Request timed out. Please try again.';
      } else if (errorMessage.contains('already registered') || errorMessage.contains('Email already')) {
        errorMessage = 'This email is already registered. Please log in instead.';
      } else if (errorMessage.contains('Network error')) {
        errorMessage = 'Network error: Unable to connect to server.';
      } else {
        errorMessage = errorMessage.replaceAll('Exception: ', '');
      }
      
      _error = errorMessage;
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }
  
  Future<void> logout() async {
    try {
      await ApiService.logout();
      _user = null;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }
  
  void clearError() {
    _error = null;
    notifyListeners();
  }
}






