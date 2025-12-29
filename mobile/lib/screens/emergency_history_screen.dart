import 'package:flutter/material.dart';
import '../services/offline_storage_service.dart';
import '../services/api_service.dart';
import 'dart:convert';
import 'package:intl/intl.dart';

/// Screen showing emergency history
class EmergencyHistoryScreen extends StatefulWidget {
  const EmergencyHistoryScreen({super.key});

  @override
  State<EmergencyHistoryScreen> createState() => _EmergencyHistoryScreenState();
}

class _EmergencyHistoryScreenState extends State<EmergencyHistoryScreen> {
  List<Map<String, dynamic>> _history = [];
  bool _loading = true;
  bool _loadingMore = false;
  int _page = 0;
  static const int _pageSize = 20;

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  Future<void> _loadHistory({bool loadMore = false}) async {
    if (loadMore) {
      setState(() => _loadingMore = true);
    } else {
      setState(() {
        _loading = true;
        _page = 0;
      });
    }

    try {
      // Try to load from API first
      try {
        final response = await ApiService.get('/emergencies/history?page=$_page&limit=$_pageSize');
        if (response.statusCode == 200) {
          final data = jsonDecode(response.body);
          final emergencies = (data is List ? data : (data['emergencies'] as List? ?? []))
              .map((e) => e as Map<String, dynamic>)
              .toList();
          
          if (loadMore) {
            setState(() {
              _history.addAll(emergencies);
              _page++;
            });
          } else {
            setState(() {
              _history = emergencies;
              _page = 1;
            });
          }
          
          // Save to offline storage
          for (final emergency in emergencies) {
            await OfflineStorageService.saveToHistory(
              emergency,
              emergency['responder_count'] ?? 0,
            );
          }
        }
      } catch (e) {
        debugPrint('⚠️ Failed to load from API, using offline storage: $e');
        // Fallback to offline storage
        final offlineHistory = await OfflineStorageService.getEmergencyHistory(
          limit: (_page + 1) * _pageSize,
        );
        
        if (loadMore) {
          setState(() {
            _history.addAll(offlineHistory.skip(_page * _pageSize).take(_pageSize));
            _page++;
          });
        } else {
          setState(() {
            _history = offlineHistory.take(_pageSize).toList();
            _page = 1;
          });
        }
      }
    } catch (e) {
      debugPrint('❌ Error loading history: $e');
    } finally {
      setState(() {
        _loading = false;
        _loadingMore = false;
      });
    }
  }

  String _formatDate(String? dateString) {
    if (dateString == null) return 'Unknown';
    try {
      final date = DateTime.parse(dateString);
      return DateFormat('MMM dd, yyyy • hh:mm a').format(date);
    } catch (e) {
      return dateString;
    }
  }

  String _getStatusColor(String? status) {
    switch (status) {
      case 'active':
        return '🟢';
      case 'ended':
        return '⚫';
      case 'cancelled':
        return '🔴';
      default:
        return '⚪';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Emergency History'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _history.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.history, size: 64, color: Colors.grey),
                      const SizedBox(height: 16),
                      const Text(
                        'No emergency history',
                        style: TextStyle(fontSize: 18, color: Colors.grey),
                      ),
                      const SizedBox(height: 8),
                      TextButton(
                        onPressed: () => _loadHistory(),
                        child: const Text('Refresh'),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () => _loadHistory(),
                  child: ListView.builder(
                    itemCount: _history.length + (_loadingMore ? 1 : 0),
                    itemBuilder: (context, index) {
                      if (index == _history.length) {
                        return const Center(
                          child: Padding(
                            padding: EdgeInsets.all(16.0),
                            child: CircularProgressIndicator(),
                          ),
                        );
                      }

                      final emergency = _history[index];
                      final status = emergency['status'] as String? ?? 'unknown';
                      final createdAt = emergency['created_at'] as String?;
                      final endedAt = emergency['ended_at'] as String?;
                      final responderCount = emergency['responder_count'] ?? 0;
                      final senderName = emergency['user_display_name'] ?? 
                                       emergency['user_email'] ?? 
                                       'Unknown';

                      return Card(
                        margin: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 8,
                        ),
                        child: ListTile(
                          leading: CircleAvatar(
                            backgroundColor: status == 'ended' 
                                ? Colors.grey 
                                : Colors.red,
                            child: Text(
                              _getStatusColor(status),
                              style: const TextStyle(fontSize: 20),
                            ),
                          ),
                          title: Text(
                            status == 'ended' 
                                ? 'Emergency Ended'
                                : 'Emergency Active',
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const SizedBox(height: 4),
                              Text('From: $senderName'),
                              Text('Created: ${_formatDate(createdAt)}'),
                              if (endedAt != null)
                                Text('Ended: ${_formatDate(endedAt)}'),
                              Text('Responders: $responderCount'),
                            ],
                          ),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () {
                            // TODO: Show emergency details
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('Emergency ID: ${emergency['id']}'),
                              ),
                            );
                          },
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}
