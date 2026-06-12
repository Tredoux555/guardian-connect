import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';
import '../services/api_service.dart';
import 'dart:convert';

class ContactsScreen extends StatefulWidget {
  const ContactsScreen({super.key});

  @override
  State<ContactsScreen> createState() => _ContactsScreenState();
}

class _ContactsScreenState extends State<ContactsScreen> {
  List<dynamic> _contacts = [];
  bool _loading = true;
  bool _showAddForm = false;
  bool _fetchingInviteLink = false;
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void initState() {
    super.initState();
    _loadContacts();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _loadContacts() async {
    setState(() {
      _loading = true;
    });

    try {
      final response = await ApiService.get('/contacts');
      if (response.statusCode == 200) {
        setState(() {
          _contacts = jsonDecode(response.body) as List<dynamic>;
          _loading = false;
        });
      } else {
        throw Exception('Failed to load contacts');
      }
    } catch (e) {
      setState(() {
        _loading = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to load contacts: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _addContact() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    try {
      final response = await ApiService.post('/contacts/add', {
        'email': _emailController.text.trim(),
        'name': _nameController.text.trim(),
      });

      if (response.statusCode == 201) {
        _nameController.clear();
        _emailController.clear();
        setState(() {
          _showAddForm = false;
        });
        _loadContacts();
        
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Contact added successfully'),
              backgroundColor: Colors.green,
            ),
          );
        }
      } else {
        throw Exception('Failed to add contact');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to add contact: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  /// INVITE BY LINK (Jun 2026 backend revamp): GET /contacts/invite-link
  /// returns { inviteUrl, expiresInDays } — a stateless signed token.
  /// Whoever registers through the link automatically becomes a MUTUAL
  /// emergency contact (no exact-email guessing). Shared via the platform
  /// share sheet, with clipboard copy as fallback.
  Future<void> _inviteByLink() async {
    if (_fetchingInviteLink) return;
    setState(() => _fetchingInviteLink = true);

    try {
      final response = await ApiService.get('/contacts/invite-link');
      if (response.statusCode != 200) {
        throw Exception('Server returned ${response.statusCode}');
      }
      final data = jsonDecode(response.body);
      final inviteUrl = data['inviteUrl'] as String?;
      final expiresInDays = (data['expiresInDays'] as num?)?.toInt() ?? 30;
      if (inviteUrl == null || inviteUrl.isEmpty) {
        throw Exception('No invite link in response');
      }

      final message =
          'Join me on Guardian Connect so we can reach each other in an '
          'emergency. Sign up with my invite link (valid $expiresInDays days) '
          'and we\'ll automatically become each other\'s emergency contacts:\n'
          '$inviteUrl';

      try {
        await Share.share(message, subject: 'Be my emergency contact on Guardian Connect');
      } catch (shareError) {
        // Share sheet unavailable (e.g. some emulators) — copy instead
        debugPrint('⚠️ Share sheet failed, copying link instead: $shareError');
        await Clipboard.setData(ClipboardData(text: inviteUrl));
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Invite link copied to clipboard'),
              backgroundColor: Colors.green,
            ),
          );
        }
      }
    } catch (e) {
      debugPrint('❌ Failed to get invite link: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Could not create invite link: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _fetchingInviteLink = false);
    }
  }

  Future<void> _removeContact(String contactId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Remove Contact?'),
        content: const Text('Are you sure you want to remove this contact?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Remove'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      final response = await ApiService.delete('/contacts/$contactId');
      if (response.statusCode == 200) {
        _loadContacts();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Contact removed'),
              backgroundColor: Colors.green,
            ),
          );
        }
      } else {
        throw Exception('Failed to remove contact');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to remove contact: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Emergency Contacts'),
        actions: [
          IconButton(
            icon: _fetchingInviteLink
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.share),
            tooltip: 'Invite by link',
            onPressed: _fetchingInviteLink ? null : _inviteByLink,
          ),
          IconButton(
            icon: Icon(_showAddForm ? Icons.close : Icons.add),
            onPressed: () {
              setState(() {
                _showAddForm = !_showAddForm;
                if (!_showAddForm) {
                  _nameController.clear();
                  _emailController.clear();
                }
              });
            },
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                if (_showAddForm) _buildAddForm(),
                Expanded(
                  child: _contacts.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(
                                Icons.contacts,
                                size: 64,
                                color: Colors.grey,
                              ),
                              const SizedBox(height: 16),
                              const Text(
                                'No emergency contacts',
                                style: TextStyle(
                                  fontSize: 18,
                                  color: Colors.grey,
                                ),
                              ),
                              const SizedBox(height: 8),
                              const Text(
                                'Add a contact to get started',
                                style: TextStyle(
                                  fontSize: 14,
                                  color: Colors.grey,
                                ),
                              ),
                              const SizedBox(height: 24),
                              ElevatedButton.icon(
                                onPressed: _fetchingInviteLink ? null : _inviteByLink,
                                icon: const Icon(Icons.share),
                                label: const Text('Invite by link'),
                              ),
                            ],
                          ),
                        )
                      : RefreshIndicator(
                          onRefresh: _loadContacts,
                          child: ListView.builder(
                            itemCount: _contacts.length,
                            itemBuilder: (context, index) {
                              final contact = _contacts[index];
                              return Card(
                                margin: const EdgeInsets.symmetric(
                                  horizontal: 16,
                                  vertical: 8,
                                ),
                                child: ListTile(
                                  leading: CircleAvatar(
                                    backgroundColor: const Color(0xFFE53935),
                                    child: Text(
                                      (contact['contact_name'] as String? ?? 
                                       contact['user_email'] as String? ?? 
                                       '?')
                                          .substring(0, 1)
                                          .toUpperCase(),
                                      style: const TextStyle(color: Colors.white),
                                    ),
                                  ),
                                  title: Text(
                                    contact['contact_name'] as String? ?? 
                                    contact['user_email'] as String? ?? 
                                    'Unknown',
                                    style: const TextStyle(fontWeight: FontWeight.bold),
                                  ),
                                  subtitle: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        contact['contact_email'] as String? ?? 
                                        contact['user_email'] as String? ?? 
                                        'No email',
                                      ),
                                      const SizedBox(height: 4),
                                      Chip(
                                        label: Text(
                                          (contact['status'] as String? ?? 'pending')
                                              .toUpperCase(),
                                          style: const TextStyle(fontSize: 10),
                                        ),
                                        backgroundColor: (contact['status'] as String? ?? 'pending') == 'active'
                                            ? Colors.green.shade100
                                            : Colors.orange.shade100,
                                      ),
                                    ],
                                  ),
                                  trailing: IconButton(
                                    icon: const Icon(Icons.delete, color: Colors.red),
                                    onPressed: () => _removeContact(contact['id'] as String),
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                ),
              ],
            ),
    );
  }

  Widget _buildAddForm() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.grey.shade100,
        border: Border(
          bottom: BorderSide(color: Colors.grey.shade300),
        ),
      ),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Add Emergency Contact',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _nameController,
              decoration: const InputDecoration(
                labelText: 'Contact Name',
                prefixIcon: Icon(Icons.person),
                border: OutlineInputBorder(),
              ),
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'Please enter a name';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _emailController,
              decoration: const InputDecoration(
                labelText: 'Email',
                prefixIcon: Icon(Icons.email),
                border: OutlineInputBorder(),
              ),
              keyboardType: TextInputType.emailAddress,
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'Please enter an email';
                }
                if (!value.contains('@')) {
                  return 'Please enter a valid email';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _addContact,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFE53935),
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              child: const Text('Add Contact'),
            ),
          ],
        ),
      ),
    );
  }
}




