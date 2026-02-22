import { useState } from 'react'
import api from '../services/api'
import './Messaging.css'

function Messaging() {
  const [messageType, setMessageType] = useState<'individual' | 'group' | 'broadcast'>('individual')
  const [userId, setUserId] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  const handleSend = async () => {
    if (!message.trim()) {
      alert('Please enter a message')
      return
    }

    setLoading(true)
    setSuccess('')

    try {
      if (messageType === 'broadcast') {
        await api.post('/admin/messages/broadcast', { message })
        setSuccess('Broadcast message sent to all users')
      } else if (messageType === 'individual') {
        if (!userId) {
          alert('Please enter a user ID')
          return
        }
        await api.post(`/admin/users/${userId}/message`, { message })
        setSuccess('Message sent to user')
      } else {
        // Group message
        if (selectedUsers.length === 0) {
          alert('Please select at least one user')
          return
        }
        await api.post('/admin/messages/group', { userIds: selectedUsers, message })
        setSuccess(`Message sent to ${selectedUsers.length} users`)
      }
      setMessage('')
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to send message')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="messaging-page">
      <h1>Send Messages</h1>
      
      <div className="message-type-selector">
        <button
          className={messageType === 'individual' ? 'active' : ''}
          onClick={() => setMessageType('individual')}
        >
          Individual
        </button>
        <button
          className={messageType === 'group' ? 'active' : ''}
          onClick={() => setMessageType('group')}
        >
          Group
        </button>
        <button
          className={messageType === 'broadcast' ? 'active' : ''}
          onClick={() => setMessageType('broadcast')}
        >
          Broadcast All
        </button>
      </div>

      {messageType === 'individual' && (
        <div className="form-group">
          <label>User ID:</label>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Enter user ID"
          />
        </div>
      )}

      {messageType === 'group' && (
        <div className="form-group">
          <label>User IDs (comma-separated):</label>
          <input
            type="text"
            value={selectedUsers.join(',')}
            onChange={(e) => setSelectedUsers(e.target.value.split(',').map(s => s.trim()))}
            placeholder="user1, user2, user3"
          />
        </div>
      )}

      <div className="form-group">
        <label>Message:</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          placeholder="Enter your message..."
        />
      </div>

      {success && <div className="success">{success}</div>}

      <button onClick={handleSend} disabled={loading}>
        {loading ? 'Sending...' : 'Send Message'}
      </button>
    </div>
  )
}

export default Messaging






