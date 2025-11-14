import 'package:flutter/foundation.dart';
import '../models/emergency.dart';

class EmergencyProvider with ChangeNotifier {
  Emergency? _activeEmergency;
  List<EmergencyParticipant> _participants = [];
  Map<String, EmergencyLocation> _locations = {};
  bool _isLoading = false;
  
  Emergency? get activeEmergency => _activeEmergency;
  List<EmergencyParticipant> get participants => _participants;
  Map<String, EmergencyLocation> get locations => _locations;
  bool get isLoading => _isLoading;
  
  List<EmergencyParticipant> get acceptedParticipants {
    return _participants.where((p) => p.status == 'accepted').toList();
  }
  
  List<EmergencyParticipant> get pendingParticipants {
    return _participants.where((p) => p.status == 'pending').toList();
  }
  
  void setActiveEmergency(Emergency? emergency) {
    _activeEmergency = emergency;
    notifyListeners();
  }
  
  void setParticipants(List<EmergencyParticipant> participants) {
    _participants = participants;
    notifyListeners();
  }
  
  void updateParticipantStatus(String userId, String status) {
    final index = _participants.indexWhere((p) => p.userId == userId);
    if (index != -1) {
      _participants[index] = EmergencyParticipant(
        id: _participants[index].id,
        emergencyId: _participants[index].emergencyId,
        userId: _participants[index].userId,
        status: status,
        joinedAt: status == 'accepted' ? DateTime.now() : null,
        userName: _participants[index].userName,
        userEmail: _participants[index].userEmail,
      );
      notifyListeners();
    }
  }
  
  void updateLocation(String userId, EmergencyLocation location) {
    _locations[userId] = location;
    notifyListeners();
  }
  
  void clearEmergency() {
    _activeEmergency = null;
    _participants = [];
    _locations = {};
    notifyListeners();
  }
  
  void setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }
}


