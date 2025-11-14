class User {
  final String id;
  final String email;
  final bool verified;
  
  User({
    required this.id,
    required this.email,
    required this.verified,
  });
  
  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'],
      email: json['email'],
      verified: json['verified'] ?? false,
    );
  }
  
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'verified': verified,
    };
  }
}


