import { useEffect, useState } from 'react'
import api from '../services/api'
import './Users.css'

interface User {
  id: string
  email: string
  display_name?: string
  verified: boolean
  created_at: string
  contacts?: Contact[]
}

interface Contact {
  id: string
  contact_email: string
  contact_name: string
  contact_user_email?: string
  status: string
  created_at: string
}

function Users() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showContacts, setShowContacts] = useState(false)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const response = await api.get('/admin/users')
      setUsers(response.data)
    } catch (err: any) {
      console.error('Failed to load users:', err)
      if (err.response?.status === 401) {
        // Token expired or invalid - redirect to login
        localStorage.removeItem('admin_token')
        window.location.href = '/login'
      }
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleVerifyUser = async (userId: string) => {
    try {
      await api.post(`/admin/users/${userId}/verify`)
      loadUsers() // Reload the list
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to verify user')
    }
  }

  const handleViewContacts = async (userId: string) => {
    try {
      const response = await api.get(`/admin/users/${userId}`)
      setSelectedUser(response.data)
      setShowContacts(true)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to load user contacts')
    }
  }

  const handleDeleteContact = async (userId: string, contactId: string) => {
    if (!confirm('Are you sure you want to remove this contact? This will remove it from both users.')) {
      return
    }
    
    try {
      await api.delete(`/admin/users/${userId}/contacts/${contactId}`)
      
      // Update the selected user's contacts list immediately
      if (selectedUser) {
        const updatedContacts = selectedUser.contacts?.filter(contact => contact.id !== contactId) || []
        setSelectedUser({
          ...selectedUser,
          contacts: updatedContacts
        })
      }
      
      alert('Contact removed successfully')
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete contact')
    }
  }

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to delete user "${userEmail}"?\n\nThis will permanently delete:\n- User account\n- All their contacts\n- All emergency history\n\nThis action cannot be undone!`)) {
      return
    }
    
    try {
      await api.delete(`/admin/users/${userId}`)
      
      // Remove user from list immediately
      setUsers(users.filter(user => user.id !== userId))
      
      // Close modal if this user was selected
      if (selectedUser?.id === userId) {
        setShowContacts(false)
        setSelectedUser(null)
      }
      
      alert('User deleted successfully')
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete user')
    }
  }

  if (loading) {
    return <div className="loading">Loading users...</div>
  }

  return (
    <div className="users-page">
      <h1>User Management</h1>
      <input
        type="text"
        placeholder="Search by email..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="search-input"
      />
      <table className="users-table">
        <thead>
          <tr>
            <th>Display Name</th>
            <th>Email</th>
            <th>Verified</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredUsers.map((user) => (
            <tr key={user.id}>
              <td>{user.display_name || user.email}</td>
              <td style={{ fontSize: '0.9em', color: '#666' }}>{user.email}</td>
              <td>{user.verified ? 'Yes' : 'No'}</td>
              <td>{new Date(user.created_at).toLocaleDateString()}</td>
              <td>
                <button 
                  onClick={() => handleVerifyUser(user.id)}
                  disabled={user.verified}
                  style={{ 
                    marginRight: '0.5rem',
                    backgroundColor: user.verified ? '#28a745' : '#E53935',
                    color: 'white',
                    border: 'none',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '4px',
                    cursor: user.verified ? 'default' : 'pointer'
                  }}
                >
                  {user.verified ? 'Verified' : 'Verify'}
                </button>
                <button 
                  onClick={() => handleViewContacts(user.id)}
                  style={{ 
                    marginRight: '0.5rem',
                    backgroundColor: '#4285F4',
                    color: 'white',
                    border: 'none',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Contacts
                </button>
                <button 
                  onClick={() => handleDeleteUser(user.id, user.email)}
                  style={{ 
                    marginRight: '0.5rem',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Delete
                </button>
                <button onClick={() => {/* TODO: Message user */}}>
                  Message
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* User Details Modal */}
      {showContacts && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowContacts(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>User Details: {selectedUser.email}</h2>
              <button className="close-button" onClick={() => setShowContacts(false)}>×</button>
            </div>
            
            <div className="user-credentials">
              <h3>Login Credentials</h3>
              <div className="credential-item">
                <strong>Email (Login):</strong> {selectedUser.email}
              </div>
              <div className="credential-item">
                <strong>Password:</strong> <span style={{color: '#666'}}>•••••••• (Hashed - cannot be displayed)</span>
              </div>
              <div className="credential-note">
                <small>Note: Passwords are securely hashed and cannot be retrieved. Use password reset if needed.</small>
              </div>
            </div>

            <div className="user-contacts">
              <h3>Emergency Contacts ({selectedUser.contacts?.length || 0})</h3>
              {selectedUser.contacts && selectedUser.contacts.length > 0 ? (
                <table className="contacts-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedUser.contacts.map((contact) => (
                      <tr key={contact.id}>
                        <td>{contact.contact_name}</td>
                        <td>{contact.contact_user_email || contact.contact_email || 'N/A'}</td>
                        <td>{contact.status}</td>
                        <td>
                          <button
                            onClick={() => handleDeleteContact(selectedUser.id, contact.id)}
                            style={{
                              backgroundColor: '#dc3545',
                              color: 'white',
                              border: 'none',
                              padding: '0.25rem 0.75rem',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>No contacts found</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Users

