import { useState, useEffect } from 'react'
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import './Donations.css'

// Only initialize Stripe if key is provided (prevents errors when Stripe is not configured)
const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
const stripePromise = stripeKey ? loadStripe(stripeKey) : null

interface DonationFormProps {
  clientSecret: string
  onSuccess: () => void
  onError: (error: string) => void
}

const DonationForm = ({ clientSecret, onSuccess, onError }: DonationFormProps) => {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setIsProcessing(true)
    setMessage(null)

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/donations/success`,
        },
        redirect: 'if_required',
      })

      if (error) {
        setMessage(error.message || 'Payment failed')
        onError(error.message || 'Payment failed')
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        setMessage('Payment successful!')
        onSuccess()
      }
    } catch (err: any) {
      setMessage(err.message || 'An error occurred')
      onError(err.message || 'An error occurred')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="donation-form">
      <PaymentElement />
      <button 
        type="submit" 
        disabled={!stripe || isProcessing}
        className="donate-button"
      >
        {isProcessing ? 'Processing...' : 'Donate Now'}
      </button>
      {message && (
        <div className={`donation-message ${message.includes('success') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}
    </form>
  )
}

function Donations() {
  const navigate = useNavigate()
  const [amount, setAmount] = useState<number>(1000) // $10.00 in cents
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Safety check: Stripe must be configured
  if (!stripePromise) {
    return (
      <div className="donations-container">
        <h1>Donations</h1>
        <p>Stripe payment processing is not currently configured. Please contact support.</p>
        <button onClick={() => navigate('/')}>Return Home</button>
      </div>
    )
  }

  const handleCreateIntent = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await api.post('/donations/create-intent', {
        amount,
        currency: 'usd',
        name: name || undefined,
        message: message || undefined,
      })

      setClientSecret(response.data.clientSecret)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create payment intent')
    } finally {
      setLoading(false)
    }
  }

  const handleSuccess = () => {
    setTimeout(() => {
      navigate('/')
    }, 2000)
  }

  const options: StripeElementsOptions = {
    clientSecret: clientSecret || undefined,
    appearance: {
      theme: 'stripe',
    },
  }

  return (
    <div className="donations-page">
      <header className="donations-header">
        <button onClick={() => navigate('/')} className="back-button">
          ← Back
        </button>
        <h1>Support Guardian Connect</h1>
      </header>

      <main className="donations-main">
        {!clientSecret ? (
          <div className="donation-setup">
            <h2>Make a Donation</h2>
            <p>Your support helps us keep Guardian Connect running and improving.</p>

            <div className="donation-amount-selector">
              <label>Donation Amount</label>
              <div className="amount-buttons">
                {[500, 1000, 2500, 5000, 10000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    className={`amount-button ${amount === amt ? 'active' : ''}`}
                    onClick={() => setAmount(amt)}
                  >
                    ${(amt / 100).toFixed(2)}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="50"
                step="50"
                value={amount / 100}
                onChange={(e) => setAmount(Math.max(50, Math.round(parseFloat(e.target.value) * 100)))}
                className="custom-amount-input"
                placeholder="Or enter custom amount"
              />
            </div>

            <div className="donation-options">
              <input
                type="text"
                placeholder="Your name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="donation-input"
              />
              <textarea
                placeholder="Message (optional)"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={500}
                className="donation-textarea"
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <button
              onClick={handleCreateIntent}
              disabled={loading || amount < 50}
              className="create-intent-button"
            >
              {loading ? 'Processing...' : 'Continue to Payment'}
            </button>
          </div>
        ) : (
          <div className="donation-payment">
            <h2>Complete Your Donation</h2>
            <Elements stripe={stripePromise} options={options}>
              <DonationForm clientSecret={clientSecret} onSuccess={handleSuccess} onError={setError} />
            </Elements>
          </div>
        )}
      </main>
    </div>
  )
}

export default Donations

