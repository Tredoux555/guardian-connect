import 'package:flutter/foundation.dart';
import '../models/emergency.dart';

class EmergencyProvider with ChangeNotifier {
  Emergency? _activeEmergency;
  List<EmergencyParticipant> _participants = [];
  Map<String, EmergencyLocation> _locations = {};
  bool _isLoading = false;
  
  Emergency? get activeEmergency => _activeEmergency;
  List<EmergencyParticipant> get participants => List.unmodifiable(_participants);
  Map<String, EmergencyLocation> get locations => Map.unmodifiable(_locations);
  bool get isLoading => _isLoading;
  
  List<EmergencyParticipant> get acceptedParticipants {
    return _participants.where((p) => p.status == 'accepted').toList();
  }
  
  List<EmergencyParticipant> get pendingParticipants {
    return _participants.where((p) => p.status == 'pending').toList();
  }
  
  /// Set active emergency with validation
  void setActiveEmergency(Emergency? emergency) {
    // Validate emergency data
    if (emergency != null) {
      if (emergency.id.isEmpty) {
        debugPrint('⚠️ Warning: Attempted to set emergency with empty ID');
        return;
      }
      if (emergency.status != 'active' && emergency.status != 'ended' && emergency.status != 'cancelled') {
        debugPrint('⚠️ Warning: Invalid emergency status: ${emergency.status}');
        return;
      }
    }
    
    _activeEmergency = emergency;
    debugPrint('✅ Emergency provider updated: ${emergency?.id ?? 'null'}');
    notifyListeners();
  }
  
  /// Set participants with validation
  void setParticipants(List<EmergencyParticipant> participants) {
    // Validate participants
    final validParticipants = participants.where((p) {
      if (p.userId.isEmpty) {
        debugPrint('⚠️ Warning: Participant with empty userId ignored');
        return false;
      }
      if (p.emergencyId.isEmpty) {
        debugPrint('⚠️ Warning: Participant with empty emergencyId ignored');
        return false;
      }
      return true;
    }).toList();
    
    _participants = validParticipants;
    debugPrint('✅ Participants updated: ${_participants.length} participants');
    notifyListeners();
  }
  
  /// Update participant status with validation
  void updateParticipantStatus(String userId, String status) {
    if (userId.isEmpty) {
      debugPrint('⚠️ Warning: Cannot update participant status with empty userId');
      return;
    }
    
    // Validate status
    if (status != 'pending' && status != 'accepted' && status != 'rejected') {
      debugPrint('⚠️ Warning: Invalid participant status: $status');
      return;
    }
    
    final index = _participants.indexWhere((p) => p.userId == userId);
    if (index == -1) {
      debugPrint('⚠️ Warning: Participant not found: $userId');
      return;
    }
    
    _participants[index] = EmergencyParticipant(
      id: _participants[index].id,
      emergencyId: _participants[index].emergencyId,
      userId: _participants[index].userId,
      status: status,
      joinedAt: status == 'accepted' ? DateTime.now() : _participants[index].joinedAt,
      userName: _participants[index].userName,
      userEmail: _participants[index].userEmail,
    );
    debugPrint('✅ Participant status updated: $userId -> $status');
    notifyListeners();
  }
  
  /// Update location with validation
  void updateLocation(String userId, EmergencyLocation location) {
    if (userId.isEmpty) {
      debugPrint('⚠️ Warning: Cannot update location with empty userId');
      return;
    }
    
    // Validate location coordinates
    if (location.latitude < -90 || location.latitude > 90) {
      debugPrint('⚠️ Warning: Invalid latitude: ${location.latitude}');
      return;
    }
    if (location.longitude < -180 || location.longitude > 180) {
      debugPrint('⚠️ Warning: Invalid longitude: ${location.longitude}');
      return;
    }
    
    _locations[userId] = location;
    debugPrint('✅ Location updated for user: $userId');
    notifyListeners();
  }
  
  /// Clear emergency state
  void clearEmergency() {
    _activeEmergency = null;
    _participants = [];
    _locations = {};
    debugPrint('✅ Emergency state cleared');
    notifyListeners();
  }
  
  /// Set loading state
  void setLoading(bool loading) {
    if (_isLoading != loading) {
      _isLoading = loading;
      notifyListeners();
    }
  }
  
  /// Check if emergency is active
  bool get hasActiveEmergency => _activeEmergency != null && _activeEmergency!.status == 'active';
}






