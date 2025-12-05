import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:record/record.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as path;
import 'package:url_launcher/url_launcher.dart';
import 'dart:io';
import 'dart:async';
import '../services/api_service.dart';
import '../services/socket_service.dart';
import '../config/app_config.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;

class EmergencyMessage {
  final String id;
  final String emergencyId;
  final String userId;
  final String userEmail;
  final String? userDisplayName;
  final String? message;
  final String? imageUrl;
  final String? audioUrl;
  final String? videoUrl;
  final DateTime createdAt;

  EmergencyMessage({
    required this.id,
    required this.emergencyId,
    required this.userId,
    required this.userEmail,
    this.userDisplayName,
    this.message,
    this.imageUrl,
    this.audioUrl,
    this.videoUrl,
    required this.createdAt,
  });

  factory EmergencyMessage.fromJson(Map<String, dynamic> json) {
    return EmergencyMessage(
      id: json['id'] as String,
      emergencyId: json['emergency_id'] as String,
      userId: json['user_id'] as String,
      userEmail: json['user_email'] as String? ?? '',
      userDisplayName: json['user_display_name'] as String?,
      message: json['message'] as String?,
      imageUrl: json['image_url'] as String?,
      audioUrl: json['audio_url'] as String?,
      videoUrl: json['video_url'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }
}

class EmergencyChat extends StatefulWidget {
  final String emergencyId;
  final String? currentUserId;

  const EmergencyChat({
    Key? key,
    required this.emergencyId,
    this.currentUserId,
  }) : super(key: key);

  @override
  State<EmergencyChat> createState() => _EmergencyChatState();
}

class _EmergencyChatState extends State<EmergencyChat> {
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final ImagePicker _imagePicker = ImagePicker();
  final AudioRecorder _audioRecorder = AudioRecorder();
  
  List<EmergencyMessage> _messages = [];
  bool _loading = true;
  bool _sending = false;
  String? _error;
  
  // Media state
  File? _selectedImage;
  File? _selectedVideo;
  String? _audioPath;
  bool _isRecording = false;
  int _recordingDuration = 0;
  Timer? _recordingTimer;
  
  @override
  void initState() {
    super.initState();
    _loadMessages();
    _setupSocketListener();
    _joinEmergencyRoom();
    // Real-time updates via Socket.IO - no polling needed
    
    // Listen to text changes to update send button state
    _messageController.addListener(() {
      if (mounted) {
        setState(() {
          // Trigger rebuild when text changes to update send button state
        });
      }
    });
  }
  
  Future<void> _joinEmergencyRoom() async {
    // Ensure socket is connected and join emergency room
    try {
      final socket = await SocketService.connect();
      if (socket != null && socket.connected) {
        SocketService.joinEmergency(widget.emergencyId);
        debugPrint('✅ Chat joined emergency room: ${widget.emergencyId}');
      } else {
        debugPrint('⚠️ Socket not connected, will retry joining room when connected');
        // Retry when socket connects
        SocketService.on('connect', (_) {
          SocketService.joinEmergency(widget.emergencyId);
          debugPrint('✅ Chat joined emergency room after reconnect: ${widget.emergencyId}');
        });
      }
    } catch (e) {
      debugPrint('❌ Error joining emergency room: $e');
    }
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    _audioRecorder.dispose();
    _recordingTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadMessages() async {
    try {
      // Only show loading on initial load
      if (_messages.isEmpty && mounted) {
        setState(() {
          _loading = true;
          _error = null;
        });
      }

      final response = await ApiService.get('/emergencies/${widget.emergencyId}/messages');
      
      if (!mounted) return; // Check mounted before setState
      
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final messagesList = data['messages'] as List? ?? [];
        
        final newMessages = messagesList
            .map((msg) => EmergencyMessage.fromJson(msg))
            .toList();
        
        // Merge with existing messages (avoid duplicates)
        final existingIds = _messages.map((m) => m.id).toSet();
        final uniqueNewMessages = newMessages.where((m) => !existingIds.contains(m.id)).toList();
        
        if (uniqueNewMessages.isNotEmpty || _messages.isEmpty) {
          if (mounted) { // Check mounted before setState
            setState(() {
              // If we have existing messages, merge; otherwise replace
              if (_messages.isNotEmpty) {
                _messages.addAll(uniqueNewMessages);
                // Sort by timestamp
                _messages.sort((a, b) => a.createdAt.compareTo(b.createdAt));
              } else {
                _messages = newMessages;
              }
              _loading = false;
            });
            
            // Scroll to bottom after loading new messages
            if (uniqueNewMessages.isNotEmpty) {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (mounted) {
                  _scrollToBottom();
                }
              });
            }
          }
        } else {
          if (mounted) { // Check mounted before setState
            setState(() {
              _loading = false;
            });
          }
        }
      } else {
        throw Exception('Failed to load messages: ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('❌ Error loading messages: $e');
      if (mounted) { // Check mounted before setState
        setState(() {
          _error = 'Failed to load messages: $e';
          _loading = false;
        });
      }
    }
  }
  

  void _setupSocketListener() {
    SocketService.on('new_message', (data) {
      if (data['emergencyId'] == widget.emergencyId) {
        // Skip if message is from current user (already shown via optimistic update)
        if (data['userId'] == widget.currentUserId) {
          return;
        }
        
        // Check if message already exists
        final messageId = data['messageId'] as String?;
        if (messageId != null && _messages.any((m) => m.id == messageId)) {
          return;
        }
        
        // Add new message
        setState(() {
          _messages.add(EmergencyMessage(
            id: messageId ?? DateTime.now().millisecondsSinceEpoch.toString(),
            emergencyId: data['emergencyId'] as String,
            userId: data['userId'] as String,
            userEmail: data['user_email'] as String? ?? '',
            userDisplayName: data['user_display_name'] as String?,
            message: data['message'] as String?,
            imageUrl: data['image_url'] as String?,
            audioUrl: data['audio_url'] as String?,
            videoUrl: data['video_url'] as String?,
            createdAt: DateTime.parse(data['created_at'] as String),
          ));
        });
        
        _scrollToBottom();
      }
    });
  }

  void _scrollToBottom() {
    if (_scrollController.hasClients) {
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    }
  }

  Future<void> _pickImage() async {
    try {
      // Show dialog to choose camera or gallery
      final ImageSource? source = await showDialog<ImageSource>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Select Image Source'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.camera_alt),
                title: const Text('Camera'),
                onTap: () => Navigator.pop(context, ImageSource.camera),
              ),
              ListTile(
                leading: const Icon(Icons.photo_library),
                title: const Text('Gallery'),
                onTap: () => Navigator.pop(context, ImageSource.gallery),
              ),
            ],
          ),
        ),
      );
      
      if (source == null) return;
      
      final XFile? image = await _imagePicker.pickImage(
        source: source,
        maxWidth: 1920,
        maxHeight: 1920,
        imageQuality: 85,
      );
      
      if (image != null) {
        setState(() {
          _selectedImage = File(image.path);
          _selectedVideo = null; // Clear video if image selected
        });
      }
    } catch (e) {
      debugPrint('❌ Error picking image: $e');
      _showError('Failed to pick image: $e');
    }
  }

  Future<void> _pickVideo() async {
    try {
      // Show dialog to choose camera or gallery
      final ImageSource? source = await showDialog<ImageSource>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Select Video Source'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.videocam),
                title: const Text('Camera'),
                onTap: () => Navigator.pop(context, ImageSource.camera),
              ),
              ListTile(
                leading: const Icon(Icons.video_library),
                title: const Text('Gallery'),
                onTap: () => Navigator.pop(context, ImageSource.gallery),
              ),
            ],
          ),
        ),
      );
      
      if (source == null) return;
      
      final XFile? video = await _imagePicker.pickVideo(
        source: source,
        maxDuration: const Duration(minutes: 5),
      );
      
      if (video != null) {
        final file = File(video.path);
        final sizeInMB = await file.length() / (1024 * 1024);
        
        if (sizeInMB > 50) {
          _showError('Video file is too large. Maximum size is 50MB.');
          return;
        }
        
        setState(() {
          _selectedVideo = file;
          _selectedImage = null; // Clear image if video selected
        });
      }
    } catch (e) {
      debugPrint('❌ Error picking video: $e');
      _showError('Failed to pick video: $e');
    }
  }

  Future<void> _startRecording() async {
    try {
      if (await _audioRecorder.hasPermission()) {
        final directory = await getApplicationDocumentsDirectory();
        final fileName = 'voice_${DateTime.now().millisecondsSinceEpoch}.m4a';
        final filePath = path.join(directory.path, fileName);
        
        await _audioRecorder.start(
          const RecordConfig(
            encoder: AudioEncoder.aacLc,
            bitRate: 128000,
            sampleRate: 44100,
          ),
          path: filePath,
        );
        
        setState(() {
          _isRecording = true;
          _recordingDuration = 0;
          _audioPath = filePath;
        });
        
        _recordingTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
          setState(() {
            _recordingDuration++;
          });
        });
      } else {
        _showError('Microphone permission denied');
      }
    } catch (e) {
      debugPrint('❌ Error starting recording: $e');
      _showError('Failed to start recording: $e');
    }
  }

  Future<void> _stopRecording() async {
    try {
      await _audioRecorder.stop();
      _recordingTimer?.cancel();
      
      setState(() {
        _isRecording = false;
      });
    } catch (e) {
      debugPrint('❌ Error stopping recording: $e');
      _showError('Failed to stop recording: $e');
    }
  }

  Future<void> _cancelRecording() async {
    try {
      await _audioRecorder.stop();
      _recordingTimer?.cancel();
      
      if (_audioPath != null) {
        final file = File(_audioPath!);
        if (await file.exists()) {
          await file.delete();
        }
      }
      
      setState(() {
        _isRecording = false;
        _recordingDuration = 0;
        _audioPath = null;
      });
    } catch (e) {
      debugPrint('❌ Error canceling recording: $e');
    }
  }

  Future<void> _sendMessage() async {
    debugPrint('📤 _sendMessage() called');
    debugPrint('   Text: "${_messageController.text.trim()}"');
    debugPrint('   Image: ${_selectedImage != null ? _selectedImage!.path : "null"}');
    debugPrint('   Video: ${_selectedVideo != null ? _selectedVideo!.path : "null"}');
    debugPrint('   Audio: $_audioPath');
    debugPrint('   Emergency ID: ${widget.emergencyId}');
    
    if (_messageController.text.trim().isEmpty && 
        _selectedImage == null && 
        _selectedVideo == null && 
        _audioPath == null) {
      debugPrint('⚠️ Nothing to send - all fields empty');
      return;
    }

    // Verify socket connection before sending
    if (!SocketService.isConnected) {
      debugPrint('⚠️ Socket not connected, message may be delayed');
      // Try to reconnect socket in background
      SocketService.connect();
    } else {
      debugPrint('✅ Socket connected, message will be delivered instantly');
    }

    try {
      setState(() {
        _sending = true;
        _error = null;
      });

      // Create multipart request
      final formData = <String, dynamic>{};
      
      if (_messageController.text.trim().isNotEmpty) {
        formData['message'] = _messageController.text.trim();
        debugPrint('📝 Adding text message to form data');
      }
      
      if (_selectedImage != null) {
        formData['image'] = _selectedImage!;
        debugPrint('🖼️ Adding image to form data: ${_selectedImage!.path}');
      }
      
      if (_selectedVideo != null) {
        formData['video'] = _selectedVideo!;
        debugPrint('🎬 Adding video to form data: ${_selectedVideo!.path}');
      }
      
      if (_audioPath != null) {
        formData['audio'] = File(_audioPath!);
        debugPrint('🎤 Adding audio to form data: $_audioPath');
      }

      debugPrint('📤 Sending message to /emergencies/${widget.emergencyId}/messages');
      debugPrint('   Form data keys: ${formData.keys.toList()}');
      
      final response = await ApiService.postMultipart(
        '/emergencies/${widget.emergencyId}/messages',
        formData,
      );

      debugPrint('📤 Message response: ${response.statusCode}');
      debugPrint('📤 Response body: ${response.body}');

      if (response.statusCode == 201) {
        final data = jsonDecode(response.body);
        final sentMessage = EmergencyMessage.fromJson(data['message']);
        debugPrint('✅ Message sent successfully: ${sentMessage.id}');
        debugPrint('   Image URL: ${sentMessage.imageUrl}');
        debugPrint('   Video URL: ${sentMessage.videoUrl}');
        debugPrint('   Audio URL: ${sentMessage.audioUrl}');
        if (sentMessage.imageUrl != null) {
          debugPrint('   Full image URL: ${_getMediaUrl(sentMessage.imageUrl)}');
        }
        if (sentMessage.videoUrl != null) {
          debugPrint('   Full video URL: ${_getMediaUrl(sentMessage.videoUrl)}');
        }
        
        // Add message optimistically
        setState(() {
          _messages.add(sentMessage);
        });
        
        // Clear inputs
        _messageController.clear();
        _selectedImage = null;
        _selectedVideo = null;
        _audioPath = null;
        
        _scrollToBottom();
      } else {
        debugPrint('❌ Failed to send message: ${response.statusCode}');
        debugPrint('   Response: ${response.body}');
        throw Exception('Failed to send message: ${response.statusCode} - ${response.body}');
      }
    } catch (e) {
      debugPrint('❌ Error sending message: $e');
      _showError('Failed to send message: $e');
    } finally {
      setState(() {
        _sending = false;
      });
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red,
      ),
    );
  }

  String _formatTimestamp(DateTime timestamp) {
    final now = DateTime.now();
    final difference = now.difference(timestamp);
    
    if (difference.inMinutes < 1) {
      return 'Just now';
    } else if (difference.inMinutes < 60) {
      return '${difference.inMinutes}m ago';
    } else if (difference.inHours < 24) {
      return '${difference.inHours}h ago';
    } else {
      return '${timestamp.day}/${timestamp.month} ${timestamp.hour}:${timestamp.minute.toString().padLeft(2, '0')}';
    }
  }

  String _formatRecordingTime(int seconds) {
    final mins = seconds ~/ 60;
    final secs = seconds % 60;
    return '${mins}:${secs.toString().padLeft(2, '0')}';
  }

  String _getMediaUrl(String? url) {
    if (url == null) return '';
    if (url.startsWith('http')) return url;
    // Use the base URL without the /api suffix
    // AppConfig.apiBaseUrl is the correct base (e.g., https://api.guardianconnect.icu)
    final baseUrl = AppConfig.apiBaseUrl;
    final fullUrl = '$baseUrl$url';
    debugPrint('🔗 Media URL: $fullUrl (from: $url)');
    return fullUrl;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 300,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(20),
          topRight: Radius.circular(20),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 10,
            offset: const Offset(0, -5),
          ),
        ],
      ),
      child: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.grey[100],
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(20),
                topRight: Radius.circular(20),
              ),
            ),
            child: Row(
              children: [
                const Text(
                  'Emergency Chat',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const Spacer(),
                if (_loading)
                  const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
              ],
            ),
          ),
          
          // Messages list
          Expanded(
            child: _loading && _messages.isEmpty
                ? const Center(child: CircularProgressIndicator())
                : _messages.isEmpty
                    ? const Center(
                        child: Text(
                          'No messages yet. Start the conversation!',
                          style: TextStyle(color: Colors.grey),
                        ),
                      )
                    : ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.all(16),
                        itemCount: _messages.length,
                        itemBuilder: (context, index) {
                          final message = _messages[index];
                          final isOwnMessage = message.userId == widget.currentUserId;
                          
                          return Align(
                            alignment: isOwnMessage 
                                ? Alignment.centerRight 
                                : Alignment.centerLeft,
                            child: Container(
                              margin: const EdgeInsets.only(bottom: 12),
                              padding: const EdgeInsets.all(12),
                              constraints: BoxConstraints(
                                maxWidth: MediaQuery.of(context).size.width * 0.75,
                              ),
                              decoration: BoxDecoration(
                                color: isOwnMessage 
                                    ? Colors.blue[100] 
                                    : Colors.grey[200],
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  if (!isOwnMessage)
                                    Text(
                                      message.userDisplayName ?? message.userEmail,
                                      style: const TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.bold,
                                        color: Colors.grey,
                                      ),
                                    ),
                                  if (message.message != null)
                                    Padding(
                                      padding: const EdgeInsets.only(bottom: 8),
                                      child: Text(message.message!),
                                    ),
                                  if (message.imageUrl != null)
                                    Padding(
                                      padding: const EdgeInsets.only(bottom: 8),
                                      child: ClipRRect(
                                        borderRadius: BorderRadius.circular(8),
                                        child: Image.network(
                                          _getMediaUrl(message.imageUrl),
                                          width: double.infinity,
                                          fit: BoxFit.cover,
                                          errorBuilder: (context, error, stackTrace) {
                                            final url = _getMediaUrl(message.imageUrl);
                                            debugPrint('❌ Image load failed: $url');
                                            debugPrint('   Error: $error');
                                            return Container(
                                              height: 200,
                                              color: Colors.grey[200],
                                              child: const Column(
                                                mainAxisAlignment: MainAxisAlignment.center,
                                                children: [
                                                  Icon(Icons.broken_image, size: 48, color: Colors.grey),
                                                  SizedBox(height: 8),
                                                  Text(
                                                    'Failed to load image',
                                                    style: TextStyle(fontSize: 12, color: Colors.grey),
                                                  ),
                                                ],
                                              ),
                                            );
                                          },
                                        ),
                                      ),
                                    ),
                                  if (message.audioUrl != null)
                                    Padding(
                                      padding: const EdgeInsets.only(bottom: 8),
                                      child: Row(
                                        children: [
                                          const Icon(Icons.audiotrack, size: 20),
                                          const SizedBox(width: 8),
                                          Expanded(
                                            child: AudioPlayerWidget(
                                              audioUrl: _getMediaUrl(message.audioUrl),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  if (message.videoUrl != null)
                                    Padding(
                                      padding: const EdgeInsets.only(bottom: 8),
                                      child: VideoPlayerWidget(
                                        videoUrl: _getMediaUrl(message.videoUrl),
                                      ),
                                    ),
                                  Text(
                                    _formatTimestamp(message.createdAt),
                                    style: TextStyle(
                                      fontSize: 10,
                                      color: Colors.grey[600],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
          ),
          
          // Recording indicator
          if (_isRecording)
            Container(
              padding: const EdgeInsets.all(12),
              color: Colors.red[100],
              child: Row(
                children: [
                  Container(
                    width: 12,
                    height: 12,
                    decoration: const BoxDecoration(
                      color: Colors.red,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text('Recording: ${_formatRecordingTime(_recordingDuration)}'),
                  const Spacer(),
                  TextButton(
                    onPressed: _stopRecording,
                    child: const Text('Stop'),
                  ),
                  TextButton(
                    onPressed: _cancelRecording,
                    child: const Text('Cancel'),
                  ),
                ],
              ),
            ),
          
          // Media previews
          if (_selectedImage != null)
            Container(
              padding: const EdgeInsets.all(8),
              child: Stack(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Image.file(
                      _selectedImage!,
                      height: 100,
                      fit: BoxFit.cover,
                    ),
                  ),
                  Positioned(
                    top: 4,
                    right: 4,
                    child: IconButton(
                      icon: const Icon(Icons.close, color: Colors.white),
                      onPressed: () {
                        setState(() {
                          _selectedImage = null;
                        });
                      },
                    ),
                  ),
                ],
              ),
            ),
          
          if (_selectedVideo != null)
            Container(
              padding: const EdgeInsets.all(8),
              child: Stack(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: const Icon(Icons.videocam, size: 100),
                  ),
                  Positioned(
                    top: 4,
                    right: 4,
                    child: IconButton(
                      icon: const Icon(Icons.close, color: Colors.white),
                      onPressed: () {
                        setState(() {
                          _selectedVideo = null;
                        });
                      },
                    ),
                  ),
                ],
              ),
            ),
          
          if (_audioPath != null && !_isRecording)
            Container(
              padding: const EdgeInsets.all(8),
              child: Row(
                children: [
                  const Icon(Icons.audiotrack),
                  const SizedBox(width: 8),
                  const Text('Voice message ready'),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () {
                      setState(() {
                        _audioPath = null;
                      });
                    },
                  ),
                ],
              ),
            ),
          
          // Input area
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.grey[50],
              border: Border(
                top: BorderSide(color: Colors.grey[300]!),
              ),
            ),
            child: Row(
              children: [
                // Image button
                IconButton(
                  icon: const Icon(Icons.image),
                  onPressed: _sending ? null : _pickImage,
                  tooltip: 'Add photo',
                ),
                // Video button
                IconButton(
                  icon: const Icon(Icons.videocam),
                  onPressed: _sending ? null : _pickVideo,
                  tooltip: 'Add video',
                ),
                // Voice button
                IconButton(
                  icon: Icon(_isRecording ? Icons.stop : Icons.mic),
                  color: _isRecording ? Colors.red : null,
                  onPressed: _sending 
                      ? null 
                      : (_isRecording ? _stopRecording : _startRecording),
                  tooltip: _isRecording ? 'Stop recording' : 'Record voice',
                ),
                // Text input
                Expanded(
                  child: TextField(
                    controller: _messageController,
                    decoration: const InputDecoration(
                      hintText: 'Type a message...',
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.symmetric(horizontal: 12),
                    ),
                    maxLines: null,
                    enabled: !_sending,
                  ),
                ),
                // Send button
                IconButton(
                  icon: _sending
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.send),
                  onPressed: () {
                    // Always log when button is tapped, even if disabled
                    final textEmpty = _messageController.text.trim().isEmpty;
                    final hasMedia = _selectedImage != null || _selectedVideo != null || _audioPath != null;
                    final isDisabled = _sending || (textEmpty && !hasMedia);
                    
                    debugPrint('📤 Send button tapped');
                    debugPrint('   _sending: $_sending');
                    debugPrint('   textEmpty: $textEmpty');
                    debugPrint('   text: "${_messageController.text.trim()}"');
                    debugPrint('   hasMedia: $hasMedia');
                    debugPrint('   isDisabled: $isDisabled');
                    
                    if (isDisabled) {
                      debugPrint('⚠️ Send button is disabled - not calling _sendMessage()');
                      return;
                    }
                    
                    debugPrint('✅ Send button enabled - calling _sendMessage()');
                    _sendMessage();
                  },
                  tooltip: 'Send message',
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// Simple audio player widget - opens audio in device's default player
class AudioPlayerWidget extends StatefulWidget {
  final String audioUrl;

  const AudioPlayerWidget({Key? key, required this.audioUrl}) : super(key: key);

  @override
  State<AudioPlayerWidget> createState() => _AudioPlayerWidgetState();
}

class _AudioPlayerWidgetState extends State<AudioPlayerWidget> {
  bool _isPlaying = false;

  Future<void> _openAudio() async {
    try {
      debugPrint('🎵 Opening audio: ${widget.audioUrl}');
      final uri = Uri.parse(widget.audioUrl);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
        setState(() {
          _isPlaying = true;
        });
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Could not play audio'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    } catch (e) {
      debugPrint('❌ Error playing audio: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error playing audio: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        IconButton(
          icon: Icon(_isPlaying ? Icons.pause : Icons.play_arrow),
          onPressed: _openAudio,
        ),
        const Text('Voice message'),
        const SizedBox(width: 8),
        Text(
          'Tap to play',
          style: TextStyle(fontSize: 10, color: Colors.grey[600]),
        ),
      ],
    );
  }
}

// Simple video player widget - opens video in device's default player
class VideoPlayerWidget extends StatelessWidget {
  final String videoUrl;

  const VideoPlayerWidget({Key? key, required this.videoUrl}) : super(key: key);

  Future<void> _openVideo(BuildContext context) async {
    try {
      debugPrint('🎬 Opening video: $videoUrl');
      final uri = Uri.parse(videoUrl);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not open video'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (e) {
      debugPrint('❌ Error opening video: $e');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error opening video: $e'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => _openVideo(context),
      child: Container(
        height: 200,
        decoration: BoxDecoration(
          color: Colors.black,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Stack(
          alignment: Alignment.center,
          children: [
            const Icon(Icons.play_circle_filled, size: 50, color: Colors.white),
            Positioned(
              bottom: 8,
              left: 8,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.black54,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Text(
                  'Tap to play video',
                  style: TextStyle(color: Colors.white, fontSize: 12),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

