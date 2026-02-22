import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import 'dart:convert';
import 'package:flutter/foundation.dart';

/// Local storage service for offline support and emergency history
class LocalStorageService {
  static Database? _database;
  static const String _dbName = 'guardian_connect.db';
  static const int _dbVersion = 1;

  /// Get database instance
  static Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDatabase();
    return _database!;
  }

  /// Initialize database
  static Future<Database> _initDatabase() async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, _dbName);

    return await openDatabase(
      path,
      version: _dbVersion,
      onCreate: _onCreate,
      onUpgrade: _onUpgrade,
    );
  }

  /// Create database tables
  static Future<void> _onCreate(Database db, int version) async {
    // Emergency history table
    await db.execute('''
      CREATE TABLE emergency_history (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        sender_name TEXT,
        sender_email TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        ended_at TEXT,
        location_lat REAL,
        location_lng REAL,
        data TEXT,
        UNIQUE(id)
      )
    ''');

    // Emergency messages cache
    await db.execute('''
      CREATE TABLE emergency_messages_cache (
        id TEXT PRIMARY KEY,
        emergency_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        message TEXT,
        image_url TEXT,
        video_url TEXT,
        audio_url TEXT,
        created_at TEXT NOT NULL,
        data TEXT,
        UNIQUE(id)
      )
    ''');

    // Emergency data cache (for offline viewing)
    await db.execute('''
      CREATE TABLE emergency_data_cache (
        emergency_id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        expires_at TEXT
      )
    ''');

    // Create indexes for faster queries
    await db.execute('CREATE INDEX idx_emergency_history_user_id ON emergency_history(user_id)');
    await db.execute('CREATE INDEX idx_emergency_history_status ON emergency_history(status)');
    await db.execute('CREATE INDEX idx_messages_emergency_id ON emergency_messages_cache(emergency_id)');
  }

  /// Upgrade database schema
  static Future<void> _onUpgrade(Database db, int oldVersion, int newVersion) async {
    // Handle future schema upgrades here
  }

  /// Save emergency to history
  static Future<void> saveEmergencyToHistory(Map<String, dynamic> emergency) async {
    try {
      final db = await database;
      await db.insert(
        'emergency_history',
        {
          'id': emergency['id'],
          'user_id': emergency['user_id'] ?? emergency['userId'],
          'sender_name': emergency['user_display_name'] ?? emergency['senderName'],
          'sender_email': emergency['user_email'] ?? emergency['senderEmail'],
          'status': emergency['status'] ?? 'active',
          'created_at': emergency['created_at'] ?? emergency['createdAt'] ?? DateTime.now().toIso8601String(),
          'ended_at': emergency['ended_at'] ?? emergency['endedAt'],
          'location_lat': emergency['location']?['latitude'] ?? emergency['latitude'],
          'location_lng': emergency['location']?['longitude'] ?? emergency['longitude'],
          'data': jsonEncode(emergency),
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
      debugPrint('✅ Emergency saved to history: ${emergency['id']}');
    } catch (e) {
      debugPrint('❌ Error saving emergency to history: $e');
    }
  }

  /// Get emergency history
  static Future<List<Map<String, dynamic>>> getEmergencyHistory({int? limit}) async {
    try {
      final db = await database;
      final results = await db.query(
        'emergency_history',
        orderBy: 'created_at DESC',
        limit: limit,
      );

      return results.map((row) {
        final data = jsonDecode(row['data'] as String? ?? '{}') as Map<String, dynamic>;
        return <String, dynamic>{
          ...data,
          'id': row['id'],
          'user_id': row['user_id'],
          'sender_name': row['sender_name'],
          'sender_email': row['sender_email'],
          'status': row['status'],
          'created_at': row['created_at'],
          'ended_at': row['ended_at'],
          'location_lat': row['location_lat'],
          'location_lng': row['location_lng'],
        };
      }).toList().cast<Map<String, dynamic>>();
    } catch (e) {
      debugPrint('❌ Error getting emergency history: $e');
      return [];
    }
  }

  /// Cache emergency data for offline viewing
  static Future<void> cacheEmergencyData(String emergencyId, Map<String, dynamic> data) async {
    try {
      final db = await database;
      await db.insert(
        'emergency_data_cache',
        {
          'emergency_id': emergencyId,
          'data': jsonEncode(data),
          'updated_at': DateTime.now().toIso8601String(),
          'expires_at': DateTime.now().add(const Duration(hours: 24)).toIso8601String(),
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
      debugPrint('✅ Emergency data cached: $emergencyId');
    } catch (e) {
      debugPrint('❌ Error caching emergency data: $e');
    }
  }

  /// Get cached emergency data
  static Future<Map<String, dynamic>?> getCachedEmergencyData(String emergencyId) async {
    try {
      final db = await database;
      final results = await db.query(
        'emergency_data_cache',
        where: 'emergency_id = ? AND expires_at > ?',
        whereArgs: [emergencyId, DateTime.now().toIso8601String()],
      );

      if (results.isEmpty) return null;

      return jsonDecode(results.first['data'] as String);
    } catch (e) {
      debugPrint('❌ Error getting cached emergency data: $e');
      return null;
    }
  }

  /// Cache emergency messages
  static Future<void> cacheMessages(String emergencyId, List<Map<String, dynamic>> messages) async {
    try {
      final db = await database;
      final batch = db.batch();

      for (final message in messages) {
        batch.insert(
          'emergency_messages_cache',
          {
            'id': message['id'],
            'emergency_id': emergencyId,
            'user_id': message['user_id'] ?? message['userId'],
            'message': message['message'],
            'image_url': message['image_url'] ?? message['imageUrl'],
            'video_url': message['video_url'] ?? message['videoUrl'],
            'audio_url': message['audio_url'] ?? message['audioUrl'],
            'created_at': message['created_at'] ?? message['createdAt'],
            'data': jsonEncode(message),
          },
          conflictAlgorithm: ConflictAlgorithm.replace,
        );
      }

      await batch.commit(noResult: true);
      debugPrint('✅ Cached ${messages.length} messages for emergency: $emergencyId');
    } catch (e) {
      debugPrint('❌ Error caching messages: $e');
    }
  }

  /// Get cached messages for emergency
  static Future<List<Map<String, dynamic>>> getCachedMessages(String emergencyId) async {
    try {
      final db = await database;
      final results = await db.query(
        'emergency_messages_cache',
        where: 'emergency_id = ?',
        whereArgs: [emergencyId],
        orderBy: 'created_at ASC',
      );

      return results.map((row) => jsonDecode(row['data'] as String? ?? '{}') as Map<String, dynamic>).toList().cast<Map<String, dynamic>>();
    } catch (e) {
      debugPrint('❌ Error getting cached messages: $e');
      return [];
    }
  }

  /// Clear expired cache
  static Future<void> clearExpiredCache() async {
    try {
      final db = await database;
      await db.delete(
        'emergency_data_cache',
        where: 'expires_at < ?',
        whereArgs: [DateTime.now().toIso8601String()],
      );
      debugPrint('✅ Cleared expired cache');
    } catch (e) {
      debugPrint('❌ Error clearing expired cache: $e');
    }
  }

  /// Delete emergency from history
  static Future<void> deleteEmergencyFromHistory(String emergencyId) async {
    try {
      final db = await database;
      await db.delete('emergency_history', where: 'id = ?', whereArgs: [emergencyId]);
      debugPrint('✅ Deleted emergency from history: $emergencyId');
    } catch (e) {
      debugPrint('❌ Error deleting emergency from history: $e');
    }
  }
}

