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
          <p className="no-contacts">No emergency contacts. Add one to get started.</p>
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


