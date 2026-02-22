import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import 'package:flutter/foundation.dart';
import 'dart:convert';
import 'log_collector.dart';

/// Offline storage service for caching emergency data
/// Uses SQLite to store emergency data locally so users can access it offline
class OfflineStorageService {
  static Database? _database;
  static const String _dbName = 'guardian_connect.db';
  static const int _dbVersion = 1;
  
  /// Initialize database
  static Future<void> initialize() async {
    try {
      final dbPath = await getDatabasesPath();
      final path = join(dbPath, _dbName);
      
      _database = await openDatabase(
        path,
        version: _dbVersion,
        onCreate: _onCreate,
        onUpgrade: _onUpgrade,
      );
      
      debugPrint('✅ Offline storage initialized');
      LogCollector.logMobile(
        'Offline storage initialized',
        level: LogLevel.info,
        category: 'OfflineStorage',
      );
    } catch (e) {
      debugPrint('❌ Failed to initialize offline storage: $e');
      LogCollector.logError(
        'Failed to initialize offline storage',
        source: LogSource.mobile,
        error: e,
      );
    }
  }
  
  static Future<void> _onCreate(Database db, int version) async {
    // Emergencies table
    await db.execute('''
      CREATE TABLE emergencies (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        user_email TEXT,
        user_display_name TEXT,
        status TEXT,
        created_at TEXT,
        ended_at TEXT,
        data TEXT,
        updated_at TEXT
      )
    ''');
    
    // Emergency locations table
    await db.execute('''
      CREATE TABLE emergency_locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        emergency_id TEXT,
        user_id TEXT,
        latitude REAL,
        longitude REAL,
        accuracy REAL,
        timestamp TEXT,
        FOREIGN KEY (emergency_id) REFERENCES emergencies(id)
      )
    ''');
    
    // Emergency messages table
    await db.execute('''
      CREATE TABLE emergency_messages (
        id TEXT PRIMARY KEY,
        emergency_id TEXT,
        user_id TEXT,
        user_email TEXT,
        user_display_name TEXT,
        message TEXT,
        image_url TEXT,
        video_url TEXT,
        audio_url TEXT,
        created_at TEXT,
        FOREIGN KEY (emergency_id) REFERENCES emergencies(id)
      )
    ''');
    
    // Emergency history table (for past emergencies)
    await db.execute('''
      CREATE TABLE emergency_history (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        user_email TEXT,
        user_display_name TEXT,
        status TEXT,
        created_at TEXT,
        ended_at TEXT,
        responder_count INTEGER,
        data TEXT
      )
    ''');
    
    // Create indexes for faster queries
    await db.execute('CREATE INDEX idx_emergency_status ON emergencies(status)');
    await db.execute('CREATE INDEX idx_emergency_user ON emergencies(user_id)');
    await db.execute('CREATE INDEX idx_location_emergency ON emergency_locations(emergency_id)');
    await db.execute('CREATE INDEX idx_message_emergency ON emergency_messages(emergency_id)');
    await db.execute('CREATE INDEX idx_history_user ON emergency_history(user_id)');
    
    debugPrint('✅ Database tables created');
  }
  
  static Future<void> _onUpgrade(Database db, int oldVersion, int newVersion) async {
    // Handle database migrations here
    debugPrint('🔄 Upgrading database from $oldVersion to $newVersion');
  }
  
  /// Get database instance
  static Future<Database> get database async {
    if (_database != null) return _database!;
    await initialize();
    return _database!;
  }
  
  /// Save emergency data locally
  static Future<void> saveEmergency(Map<String, dynamic> emergency) async {
    try {
      final db = await database;
      await db.insert(
        'emergencies',
        {
          'id': emergency['id'],
          'user_id': emergency['user_id'],
          'user_email': emergency['user_email'],
          'user_display_name': emergency['user_display_name'],
          'status': emergency['status'],
          'created_at': emergency['created_at'],
          'ended_at': emergency['ended_at'],
          'data': jsonEncode(emergency),
          'updated_at': DateTime.now().toIso8601String(),
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
      debugPrint('✅ Emergency saved offline: ${emergency['id']}');
    } catch (e) {
      debugPrint('❌ Error saving emergency offline: $e');
    }
  }
  
  /// Get emergency from local storage
  static Future<Map<String, dynamic>?> getEmergency(String emergencyId) async {
    try {
      final db = await database;
      final result = await db.query(
        'emergencies',
        where: 'id = ?',
        whereArgs: [emergencyId],
      );
      
      if (result.isEmpty) return null;
      
      final row = result.first;
      return jsonDecode(row['data'] as String);
    } catch (e) {
      debugPrint('❌ Error getting emergency from offline storage: $e');
      return null;
    }
  }
  
  /// Get all pending emergencies from local storage
  static Future<List<Map<String, dynamic>>> getPendingEmergencies() async {
    try {
      final db = await database;
      final result = await db.query(
        'emergencies',
        where: 'status = ?',
        whereArgs: ['pending'],
        orderBy: 'created_at DESC',
      );
      
      return result.map((row) => jsonDecode(row['data'] as String) as Map<String, dynamic>).toList().cast<Map<String, dynamic>>();
    } catch (e) {
      debugPrint('❌ Error getting pending emergencies: $e');
      return [];
    }
  }
  
  /// Save emergency to history (when ended)
  static Future<void> saveToHistory(Map<String, dynamic> emergency, int responderCount) async {
    try {
      final db = await database;
      await db.insert(
        'emergency_history',
        {
          'id': emergency['id'],
          'user_id': emergency['user_id'],
          'user_email': emergency['user_email'],
          'user_display_name': emergency['user_display_name'],
          'status': emergency['status'],
          'created_at': emergency['created_at'],
          'ended_at': emergency['ended_at'] ?? DateTime.now().toIso8601String(),
          'responder_count': responderCount,
          'data': jsonEncode(emergency),
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
      
      // Remove from active emergencies
      await db.delete('emergencies', where: 'id = ?', whereArgs: [emergency['id']]);
      
      debugPrint('✅ Emergency saved to history: ${emergency['id']}');
    } catch (e) {
      debugPrint('❌ Error saving emergency to history: $e');
    }
  }
  
  /// Get emergency history
  static Future<List<Map<String, dynamic>>> getEmergencyHistory({int limit = 50}) async {
    try {
      final db = await database;
      final result = await db.query(
        'emergency_history',
        orderBy: 'created_at DESC',
        limit: limit,
      );
      
      return result.map((row) => jsonDecode(row['data'] as String) as Map<String, dynamic>).toList().cast<Map<String, dynamic>>();
    } catch (e) {
      debugPrint('❌ Error getting emergency history: $e');
      return [];
    }
  }
  
  /// Clear all offline data (for logout)
  static Future<void> clearAll() async {
    try {
      final db = await database;
      await db.delete('emergencies');
      await db.delete('emergency_locations');
      await db.delete('emergency_messages');
      // Keep history - don't delete it
      debugPrint('✅ Offline data cleared');
    } catch (e) {
      debugPrint('❌ Error clearing offline data: $e');
    }
  }
}

