import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/diagnostic_service.dart';
import '../services/log_collector.dart';
import 'dart:convert';

class DiagnosticScreen extends StatefulWidget {
  const DiagnosticScreen({super.key});

  @override
  State<DiagnosticScreen> createState() => _DiagnosticScreenState();
}

class _DiagnosticScreenState extends State<DiagnosticScreen> with SingleTickerProviderStateMixin {
  bool _isRunning = false;
  List<DiagnosticResult> _results = [];
  String _exportData = '';
  late TabController _tabController;
  String _logFilter = 'all'; // all, location, emergency, socket, api, chat, errors
  String _logSearch = '';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    // Start log collection when screen opens
    LogCollector.startCapture();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _runTests() async {
    setState(() {
      _isRunning = true;
      _results = [];
    });

    try {
      final results = await DiagnosticService.runAllTests();
      setState(() {
        _results = results;
        _exportData = DiagnosticService.exportResults();
      });
    } finally {
      setState(() {
        _isRunning = false;
      });
    }
  }

  void _copyToClipboard() {
    Clipboard.setData(ClipboardData(text: _exportData));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Diagnostic data copied to clipboard')),
    );
  }

  void _copyLocationLogs() {
    final locationLogs = LogCollector.exportLocationLogs();
    Clipboard.setData(ClipboardData(text: locationLogs));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Location logs copied to clipboard')),
    );
  }

  void _clearResults() {
    DiagnosticService.clearResults();
    LogCollector.clearLogs();
    setState(() {
      _results = [];
      _exportData = '';
    });
  }

  List<LogEntry> _getFilteredLogs() {
    List<LogEntry> logs;
    
    switch (_logFilter) {
      case 'location':
        logs = LogCollector.getLocationLogs();
        break;
      case 'emergency':
        logs = LogCollector.getEmergencyLogs();
        break;
      case 'socket':
        logs = LogCollector.getSocketLogs();
        break;
      case 'api':
        logs = LogCollector.getApiLogs();
        break;
      case 'chat':
        logs = LogCollector.getChatLogs();
        break;
      case 'errors':
        logs = LogCollector.getErrorLogs();
        break;
      default:
        logs = LogCollector.allLogs;
    }
    
    if (_logSearch.isNotEmpty) {
      logs = logs.where((log) => 
        log.message.toLowerCase().contains(_logSearch.toLowerCase()) ||
        (log.category?.toLowerCase().contains(_logSearch.toLowerCase()) ?? false)
      ).toList();
    }
    
    return logs.reversed.toList(); // Most recent first
  }

  @override
  Widget build(BuildContext context) {
    final passedCount = _results.where((r) => r.passed).length;
    final totalCount = _results.length;
    final allPassed = totalCount > 0 && passedCount == totalCount;
    final stats = LogCollector.getStatistics();
    final filteredLogs = _getFilteredLogs();

    return Scaffold(
      appBar: AppBar(
        title: const Text('System Diagnostics'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(icon: Icon(Icons.bug_report), text: 'Tests'),
            Tab(icon: Icon(Icons.list_alt), text: 'Logs'),
          ],
        ),
        actions: [
          if (_exportData.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.copy),
              onPressed: _copyToClipboard,
              tooltip: 'Copy diagnostic data',
            ),
          if (_tabController.index == 1)
            IconButton(
              icon: const Icon(Icons.location_on),
              onPressed: _copyLocationLogs,
              tooltip: 'Copy location logs',
            ),
          if (_results.isNotEmpty || LogCollector.totalLogs > 0)
            IconButton(
              icon: const Icon(Icons.clear),
              onPressed: _clearResults,
              tooltip: 'Clear results',
            ),
        ],
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // Tests Tab
          _buildTestsTab(allPassed, passedCount, totalCount),
          // Logs Tab
          _buildLogsTab(stats, filteredLogs),
        ],
      ),
    );
  }

  Widget _buildTestsTab(bool allPassed, int passedCount, int totalCount) {
    return Column(
      children: [
        // Summary card
        if (_results.isNotEmpty)
          Container(
            width: double.infinity,
            margin: const EdgeInsets.all(16),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: allPassed ? Colors.green.shade50 : Colors.orange.shade50,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: allPassed ? Colors.green : Colors.orange,
                width: 2,
              ),
            ),
            child: Column(
              children: [
                Text(
                  allPassed ? '✅ All Tests Passed' : '⚠️ Some Tests Failed',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: allPassed ? Colors.green.shade900 : Colors.orange.shade900,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  '$passedCount / $totalCount tests passed',
                  style: TextStyle(
                    fontSize: 16,
                    color: allPassed ? Colors.green.shade700 : Colors.orange.shade700,
                  ),
                ),
              ],
            ),
          ),

        // Run tests button
        Padding(
          padding: const EdgeInsets.all(16),
          child: SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _isRunning ? null : _runTests,
              icon: _isRunning
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.play_arrow),
              label: Text(_isRunning ? 'Running Tests...' : 'Run All Tests'),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
                backgroundColor: Colors.blue,
                foregroundColor: Colors.white,
              ),
            ),
          ),
        ),

        // Results list
        Expanded(
          child: _results.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.bug_report,
                        size: 64,
                        color: Colors.grey.shade400,
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'No tests run yet',
                        style: TextStyle(
                          fontSize: 18,
                          color: Colors.grey.shade600,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Tap "Run All Tests" to start',
                        style: TextStyle(
                          color: Colors.grey.shade500,
                        ),
                      ),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _results.length,
                  itemBuilder: (context, index) {
                    final result = _results[index];
                    return Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      child: ExpansionTile(
                        leading: Icon(
                          result.passed ? Icons.check_circle : Icons.error,
                          color: result.passed ? Colors.green : Colors.red,
                        ),
                        title: Text(
                          result.testName,
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: result.passed ? Colors.green.shade700 : Colors.red.shade700,
                          ),
                        ),
                        subtitle: Text(result.message),
                        children: [
                          if (result.data != null)
                            Padding(
                              padding: const EdgeInsets.all(16),
                              child: Container(
                                width: double.infinity,
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: Colors.grey.shade100,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  const JsonEncoder.withIndent('  ').convert(result.data),
                                  style: const TextStyle(
                                    fontFamily: 'monospace',
                                    fontSize: 12,
                                  ),
                                ),
                              ),
                            ),
                          Padding(
                            padding: const EdgeInsets.all(8),
                            child: Text(
                              'Time: ${result.timestamp.toLocal().toString()}',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.grey.shade600,
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  Widget _buildLogsTab(Map<String, dynamic> stats, List<LogEntry> filteredLogs) {
    return Column(
      children: [
        // Statistics and filters
        Container(
          padding: const EdgeInsets.all(16),
          color: Colors.grey.shade100,
          child: Column(
            children: [
              // Statistics
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _buildStatCard('Total', '${stats['totalLogs'] ?? 0}', Colors.blue),
                  _buildStatCard('Errors', '${stats['errorCount'] ?? 0}', Colors.red),
                  _buildStatCard('Location', '${LogCollector.getLocationLogs().length}', Colors.green),
                ],
              ),
              const SizedBox(height: 16),
              // Filter chips
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    FilterChip(
                      label: const Text('All'),
                      selected: _logFilter == 'all',
                      onSelected: (selected) {
                        if (selected) setState(() => _logFilter = 'all');
                      },
                    ),
                    const SizedBox(width: 8),
                    FilterChip(
                      label: const Text('Location'),
                      selected: _logFilter == 'location',
                      onSelected: (selected) {
                        if (selected) setState(() => _logFilter = 'location');
                      },
                    ),
                    const SizedBox(width: 8),
                    FilterChip(
                      label: const Text('Emergency'),
                      selected: _logFilter == 'emergency',
                      onSelected: (selected) {
                        if (selected) setState(() => _logFilter = 'emergency');
                      },
                    ),
                    const SizedBox(width: 8),
                    FilterChip(
                      label: const Text('Socket'),
                      selected: _logFilter == 'socket',
                      onSelected: (selected) {
                        if (selected) setState(() => _logFilter = 'socket');
                      },
                    ),
                    const SizedBox(width: 8),
                    FilterChip(
                      label: const Text('API'),
                      selected: _logFilter == 'api',
                      onSelected: (selected) {
                        if (selected) setState(() => _logFilter = 'api');
                      },
                    ),
                    const SizedBox(width: 8),
                    FilterChip(
                      label: const Text('Chat'),
                      selected: _logFilter == 'chat',
                      onSelected: (selected) {
                        if (selected) setState(() => _logFilter = 'chat');
                      },
                    ),
                    const SizedBox(width: 8),
                    FilterChip(
                      label: const Text('Errors'),
                      selected: _logFilter == 'errors',
                      onSelected: (selected) {
                        if (selected) setState(() => _logFilter = 'errors');
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              // Search bar
              TextField(
                decoration: InputDecoration(
                  hintText: 'Search logs...',
                  prefixIcon: const Icon(Icons.search),
                  suffixIcon: _logSearch.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear),
                          onPressed: () => setState(() => _logSearch = ''),
                        )
                      : null,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                onChanged: (value) => setState(() => _logSearch = value),
              ),
            ],
          ),
        ),

        // Logs list
        Expanded(
          child: filteredLogs.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.list_alt,
                        size: 64,
                        color: Colors.grey.shade400,
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'No logs found',
                        style: TextStyle(
                          fontSize: 18,
                          color: Colors.grey.shade600,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Logs will appear here as the app runs',
                        style: TextStyle(
                          color: Colors.grey.shade500,
                        ),
                      ),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(8),
                  itemCount: filteredLogs.length,
                  itemBuilder: (context, index) {
                    final log = filteredLogs[index];
                    final levelColor = {
                      LogLevel.debug: Colors.grey,
                      LogLevel.info: Colors.blue,
                      LogLevel.warning: Colors.orange,
                      LogLevel.error: Colors.red,
                    }[log.level] ?? Colors.grey;

                    return Card(
                      margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      child: ExpansionTile(
                        leading: Container(
                          width: 4,
                          height: double.infinity,
                          color: levelColor,
                        ),
                        title: Text(
                          log.message.length > 80 
                              ? '${log.message.substring(0, 80)}...' 
                              : log.message,
                          style: const TextStyle(fontSize: 12),
                        ),
                        subtitle: Text(
                          '${log.source.name} • ${log.level.name} • ${log.timestamp.toLocal().toString().substring(11, 19)}',
                          style: TextStyle(
                            fontSize: 10,
                            color: Colors.grey.shade600,
                          ),
                        ),
                        children: [
                          Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Full Message:',
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    color: Colors.grey.shade700,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                SelectableText(
                                  log.message,
                                  style: const TextStyle(fontSize: 12),
                                ),
                                if (log.metadata != null) ...[
                                  const SizedBox(height: 12),
                                  Text(
                                    'Metadata:',
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      color: Colors.grey.shade700,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Container(
                                    width: double.infinity,
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(
                                      color: Colors.grey.shade100,
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      const JsonEncoder.withIndent('  ').convert(log.metadata),
                                      style: const TextStyle(
                                        fontFamily: 'monospace',
                                        fontSize: 11,
                                      ),
                                    ),
                                  ),
                                ],
                                const SizedBox(height: 8),
                                Text(
                                  'Time: ${log.timestamp.toLocal().toString()}',
                                  style: TextStyle(
                                    fontSize: 10,
                                    color: Colors.grey.shade600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  Widget _buildStatCard(String label, String value, Color color) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color: Colors.grey.shade600,
          ),
        ),
      ],
    );
  }
}
