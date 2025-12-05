import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

enum LogSource {
  mobile,
  backend,
  socket,
  location,
  emergency,
  chat,
  api,
  system,
}

enum LogLevel {
  debug,
  info,
  warning,
  error,
}

class LogEntry {
  final DateTime timestamp;
  final LogSource source;
  final LogLevel level;
  final String message;
  final String? category;
  final Map<String, dynamic>? metadata;

  LogEntry({
    required this.timestamp,
    required this.source,
    required this.level,
    required this.message,
    this.category,
    this.metadata,
  });

  Map<String, dynamic> toJson() => {
    'timestamp': timestamp.toIso8601String(),
    'source': source.name,
    'level': level.name,
    'message': message,
    'category': category,
    'metadata': metadata,
  };

  String toFormattedString() {
    final levelIcon = {
      LogLevel.debug: '🔍',
      LogLevel.info: 'ℹ️',
      LogLevel.warning: '⚠️',
      LogLevel.error: '❌',
    }[level] ?? '📝';
    
    final time = timestamp.toLocal().toString().substring(11, 19);
    final sourceName = source.name.toUpperCase();
    final categoryStr = category != null ? '[$category]' : '';
    
    return '[$time] $levelIcon [$sourceName] $categoryStr $message';
  }
}

class LogCollector {
  static final List<LogEntry> _logs = [];
  static final StreamController<LogEntry> _logStreamController = StreamController<LogEntry>.broadcast();
  static bool _isCapturing = false;
  static final Map<String, int> _categoryCounts = {};

  static Stream<LogEntry> get logStream => _logStreamController.stream;
  static List<LogEntry> get allLogs => List.unmodifiable(_logs);
  static int get totalLogs => _logs.length;

  // Start capturing logs
  static void startCapture() {
    if (_isCapturing) return;
    _isCapturing = true;
    _logs.clear();
    _categoryCounts.clear();
    _addLog(LogEntry(
      timestamp: DateTime.now(),
      source: LogSource.system,
      level: LogLevel.info,
      message: 'Log collection started',
      category: 'LogCollector',
    ));
  }

  // Stop capturing logs
  static void stopCapture() {
    _isCapturing = false;
    _addLog(LogEntry(
      timestamp: DateTime.now(),
      source: LogSource.system,
      level: LogLevel.info,
      message: 'Log collection stopped',
      category: 'LogCollector',
    ));
  }

  // Add a log entry
  static void _addLog(LogEntry entry) {
    if (!_isCapturing && entry.level != LogLevel.error) return;
    
    _logs.add(entry);
    _logStreamController.add(entry);
    
    // Track category counts
    if (entry.category != null) {
      _categoryCounts[entry.category!] = (_categoryCounts[entry.category!] ?? 0) + 1;
    }
    
    // Keep only last 10000 logs to prevent memory issues
    if (_logs.length > 10000) {
      _logs.removeRange(0, _logs.length - 10000);
    }
  }

  // Log from different sources
  static void logMobile(String message, {LogLevel level = LogLevel.debug, String? category, Map<String, dynamic>? metadata}) {
    _addLog(LogEntry(
      timestamp: DateTime.now(),
      source: LogSource.mobile,
      level: level,
      message: message,
      category: category,
      metadata: metadata,
    ));
    debugPrint(message);
  }

  static void logLocation(String message, {LogLevel level = LogLevel.info, Map<String, dynamic>? metadata}) {
    _addLog(LogEntry(
      timestamp: DateTime.now(),
      source: LogSource.location,
      level: level,
      message: message,
      category: 'Location',
      metadata: metadata,
    ));
    debugPrint('📍 $message');
  }

  static void logEmergency(String message, {LogLevel level = LogLevel.info, Map<String, dynamic>? metadata}) {
    _addLog(LogEntry(
      timestamp: DateTime.now(),
      source: LogSource.emergency,
      level: level,
      message: message,
      category: 'Emergency',
      metadata: metadata,
    ));
    debugPrint('🚨 $message');
  }

  static void logSocket(String message, {LogLevel level = LogLevel.info, Map<String, dynamic>? metadata}) {
    _addLog(LogEntry(
      timestamp: DateTime.now(),
      source: LogSource.socket,
      level: level,
      message: message,
      category: 'Socket',
      metadata: metadata,
    ));
    debugPrint('🔌 $message');
  }

  static void logApi(String message, {LogLevel level = LogLevel.info, Map<String, dynamic>? metadata}) {
    _addLog(LogEntry(
      timestamp: DateTime.now(),
      source: LogSource.api,
      level: level,
      message: message,
      category: 'API',
      metadata: metadata,
    ));
    debugPrint('📡 $message');
  }

  static void logChat(String message, {LogLevel level = LogLevel.info, Map<String, dynamic>? metadata}) {
    _addLog(LogEntry(
      timestamp: DateTime.now(),
      source: LogSource.chat,
      level: level,
      message: message,
      category: 'Chat',
      metadata: metadata,
    ));
    debugPrint('💬 $message');
  }

  static void logError(String message, {LogSource source = LogSource.mobile, String? category, Map<String, dynamic>? metadata, Object? error, StackTrace? stackTrace}) {
    final fullMessage = error != null 
        ? '$message\nError: $error${stackTrace != null ? "\nStack: $stackTrace" : ""}'
        : message;
    
    _addLog(LogEntry(
      timestamp: DateTime.now(),
      source: source,
      level: LogLevel.error,
      message: fullMessage,
      category: category,
      metadata: {
        ...?metadata,
        if (error != null) 'error': error.toString(),
        if (stackTrace != null) 'stackTrace': stackTrace.toString(),
      },
    ));
    debugPrint('❌ $fullMessage');
  }

  // Get logs filtered by criteria
  static List<LogEntry> getLogs({
    LogSource? source,
    LogLevel? level,
    String? category,
    DateTime? since,
    String? searchTerm,
  }) {
    return _logs.where((log) {
      if (source != null && log.source != source) return false;
      if (level != null && log.level != level) return false;
      if (category != null && log.category != category) return false;
      if (since != null && log.timestamp.isBefore(since)) return false;
      if (searchTerm != null && !log.message.toLowerCase().contains(searchTerm.toLowerCase())) return false;
      return true;
    }).toList();
  }

  // Get location-related logs
  static List<LogEntry> getLocationLogs({DateTime? since}) {
    return getLogs(
      source: LogSource.location,
      since: since,
    )..addAll(getLogs(
      category: 'Location',
      since: since,
    ));
  }

  // Get emergency-related logs
  static List<LogEntry> getEmergencyLogs({DateTime? since}) {
    return getLogs(
      source: LogSource.emergency,
      since: since,
    )..addAll(getLogs(
      category: 'Emergency',
      since: since,
    ));
  }

  // Get socket-related logs
  static List<LogEntry> getSocketLogs({DateTime? since}) {
    return getLogs(
      source: LogSource.socket,
      since: since,
    )..addAll(getLogs(
      category: 'Socket',
      since: since,
    ));
  }

  // Get API-related logs
  static List<LogEntry> getApiLogs({DateTime? since}) {
    return getLogs(
      source: LogSource.api,
      since: since,
    )..addAll(getLogs(
      category: 'API',
      since: since,
    ));
  }

  // Get chat-related logs
  static List<LogEntry> getChatLogs({DateTime? since}) {
    return getLogs(
      source: LogSource.chat,
      since: since,
    )..addAll(getLogs(
      category: 'Chat',
      since: since,
    ));
  }

  // Get error logs
  static List<LogEntry> getErrorLogs({DateTime? since}) {
    return getLogs(
      level: LogLevel.error,
      since: since,
    );
  }

  // Get logs by search term
  static List<LogEntry> searchLogs(String term, {DateTime? since}) {
    return getLogs(
      searchTerm: term,
      since: since,
    );
  }

  // Get statistics
  static Map<String, dynamic> getStatistics() {
    final sourceCounts = <String, int>{};
    final levelCounts = <String, int>{};
    
    for (final log in _logs) {
      sourceCounts[log.source.name] = (sourceCounts[log.source.name] ?? 0) + 1;
      levelCounts[log.level.name] = (levelCounts[log.level.name] ?? 0) + 1;
    }

    return {
      'totalLogs': _logs.length,
      'sourceCounts': sourceCounts,
      'levelCounts': levelCounts,
      'categoryCounts': _categoryCounts,
      'oldestLog': _logs.isNotEmpty ? _logs.first.timestamp.toIso8601String() : null,
      'newestLog': _logs.isNotEmpty ? _logs.last.timestamp.toIso8601String() : null,
      'errorCount': getErrorLogs().length,
    };
  }

  // Export logs as JSON
  static String exportLogs({DateTime? since, LogSource? source, LogLevel? level, String? category}) {
    final filteredLogs = getLogs(since: since, source: source, level: level, category: category);
    return jsonEncode({
      'exportedAt': DateTime.now().toIso8601String(),
      'filter': {
        if (since != null) 'since': since.toIso8601String(),
        if (source != null) 'source': source.name,
        if (level != null) 'level': level.name,
        if (category != null) 'category': category,
      },
      'totalLogs': filteredLogs.length,
      'statistics': getStatistics(),
      'logs': filteredLogs.map((log) => log.toJson()).toList(),
    });
  }

  // Export location logs specifically
  static String exportLocationLogs({DateTime? since}) {
    final locationLogs = getLocationLogs(since: since);
    return jsonEncode({
      'exportedAt': DateTime.now().toIso8601String(),
      'type': 'location_logs',
      'totalLogs': locationLogs.length,
      'logs': locationLogs.map((log) => log.toJson()).toList(),
    });
  }

  // Clear logs
  static void clearLogs() {
    _logs.clear();
    _categoryCounts.clear();
  }

  // Get recent logs (last N)
  static List<LogEntry> getRecentLogs(int count) {
    if (_logs.length <= count) return _logs;
    return _logs.sublist(_logs.length - count);
  }
}





