import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import './Contacts.css'

function Contacts() {
  const navigate = useNavigate()
  const [contacts, setContacts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newContactEmail, setNewContactEmail] = useState('')
  const [newContactName, setNewContactName] = useState('')
  const [inviteCopied, setInviteCopied] = useState(false)

  // Easiest path: share a link — whoever registers through it becomes your
  // mutual emergency contact automatically (no exact-email guessing).
  const shareInviteLink = async () => {
    try {
      const { data } = await api.get('/contacts/invite-link')
      const url: string = data.inviteUrl
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Be my emergency contact on Guardian Connect',
            text: 'Register through this link and we automatically become each other\'s emergency contacts:',
            url,
          })
          return
        } catch { /* user cancelled share — fall through to clipboard */ }
      }
      await navigator.clipboard.writeText(url)
      setInviteCopied(true)
      setTimeout(() => setInviteCopied(false), 3000)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Could not create invite link')
    }
  }

  useEffect(() => {
    loadContacts()
  }, [])

  const loadContacts = async () => {
    try {
      const response = await api.get('/contacts')
      setContacts(response.data)
    } catch (err) {
      console.error('Failed to load contacts:', err)
    } finally {
      setLoading(false)
    }
  }

  const addContact = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/contacts/add', {
        email: newContactEmail,
        name: newContactName,
      })
      setNewContactEmail('')
      setNewContactName('')
      setShowAddForm(false)
      loadContacts()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add contact')
    }
  }

  const removeContact = async (contactId: string) => {
    if (!confirm('Remove this contact?')) return

    try {
      await api.delete(`/contacts/${contactId}`)
      loadContacts()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to remove contact')
    }
  }

  if (loading) {
    return <div className="loading">Loading contacts...</div>
  }

  return (
    <div className="contacts-page">
      <header className="contacts-header">
        <h1>Emergency Contacts</h1>
        <div>
          <button onClick={() => navigate('/')}>Home</button>
          <button onClick={() => setShowAddForm(true)}>Add Contact</button>
        </div>
      </header>

      <button
        onClick={shareInviteLink}
        style={{ width: '100%', padding: '12px', marginBottom: '12px', borderRadius: 10, border: 'none', background: '#2563eb', color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
      >
        {inviteCopied ? '✓ Invite link copied — send it to them!' : '🔗 Share invite link (fastest way)'}
      </button>

      {showAddForm && (
        <div className="add-contact-form">
          <h2>Add Emergency Contact</h2>
          <form onSubmit={addContact}>
            <input
              type="text"
              placeholder="Contact Name"
              value={newContactName}
              onChange={(e) => setNewContactName(e.target.value)}
              required
            />
            <input
              type="email"
              placeholder="Email"
              value={newContactEmail}
              onChange={(e) => setNewContactEmail(e.target.value)}
              required
            />
            <div className="form-actions">
              <button type="submit">Add</button>
              <button type="button" onClick={() => setShowAddForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="contacts-list">
        {contacts.length === 0 ? (
          <div className="no-contacts" style={{ textAlign: 'center', lineHeight: 1.6 }}>
            <p style={{ fontSize: 17, fontWeight: 700, margin: '8px 0' }}>You're not protected yet</p>
            <p style={{ margin: '4px 0' }}>
              Guardian Connect works by alerting <strong>your people</strong>. Add at least one
              contact — the fastest way is the blue invite-link button above: send it to someone
              you trust, they register, and you're connected automatically.
            </p>
            <p style={{ margin: '4px 0', color: '#777' }}>
              Already know they have an account? Use "Add Contact" with their exact email.
            </p>
          </div>
        ) : (
          contacts.map((contact) => (
            <div key={contact.id} className="contact-card">
              <div>
                <h3>{contact.contact_name}</h3>
                <p>{contact.contact_email || contact.user_email}</p>
                <p className="status">Status: {contact.status}</p>
              </div>
              <button onClick={() => removeContact(contact.id)}>Remove</button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default Contacts






