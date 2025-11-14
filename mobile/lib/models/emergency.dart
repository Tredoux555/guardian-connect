class Emergency {
  final String id;
  final String userId;
  final String status; // 'active', 'ended', 'cancelled'
  final DateTime createdAt;
  final DateTime? endedAt;
  
  Emergency({
    required this.id,
    required this.userId,
    required this.status,
    required this.createdAt,
    this.endedAt,
  });
  
  factory Emergency.fromJson(Map<String, dynamic> json) {
    return Emergency(
      id: json['id'],
      userId: json['user_id'],
      status: json['status'],
      createdAt: DateTime.parse(json['created_at']),
      endedAt: json['ended_at'] != null ? DateTime.parse(json['ended_at']) : null,
    );
  }
}

class EmergencyParticipant {
  final String id;
  final String emergencyId;
  final String userId;
  final String status; // 'pending', 'accepted', 'rejected'
  final DateTime? joinedAt;
  final String? userName;
  final String? userEmail;
  
  EmergencyParticipant({
    required this.id,
    required this.emergencyId,
    required this.userId,
    required this.status,
    this.joinedAt,
    this.userName,
    this.userEmail,
  });
  
  factory EmergencyParticipant.fromJson(Map<String, dynamic> json) {
    return EmergencyParticipant(
      id: json['id'],
      emergencyId: json['emergency_id'],
      userId: json['user_id'],
      status: json['status'],
      joinedAt: json['joined_at'] != null ? DateTime.parse(json['joined_at']) : null,
      userName: json['user_name'],
      userEmail: json['user_email'],
    );
  }
}

class EmergencyLocation {
  final String id;
  final String emergencyId;
  final String userId;
  final double latitude;
  final double longitude;
  final DateTime timestamp;
  
  EmergencyLocation({
    required this.id,
    required this.emergencyId,
    required this.userId,
    required this.latitude,
    required this.longitude,
    required this.timestamp,
  });
  
  factory EmergencyLocation.fromJson(Map<String, dynamic> json) {
    return EmergencyLocation(
      id: json['id'],
      emergencyId: json['emergency_id'],
      userId: json['user_id'],
      latitude: double.parse(json['latitude'].toString()),
      longitude: double.parse(json['longitude'].toString()),
      timestamp: DateTime.parse(json['timestamp']),
    );
  }
}


