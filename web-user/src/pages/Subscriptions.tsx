import { useState, useEffect } from 'react'
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import './Subscriptions.css'

// Only initialize Stripe if key is provided (prevents errors when Stripe is not configured)
const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
const stripePromise = stripeKey ? loadStripe(stripeKey) : null

interface SubscriptionFormProps {
  clientSecret: string
  onSuccess: () => void
  onError: (error: string) => void
}

const SubscriptionForm = ({ clientSecret, onSuccess, onError }: SubscriptionFormProps) => {
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
          return_url: `${window.location.origin}/subscriptions/success`,
        },
        redirect: 'if_required',
      })

      if (error) {
        setMessage(error.message || 'Payment failed')
        onError(error.message || 'Payment failed')
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        setMessage('Subscription activated!')
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
    <form onSubmit={handleSubmit} className="subscription-form">
      <PaymentElement />
      <button 
        type="submit" 
        disabled={!stripe || isProcessing}
        className="subscribe-button"
      >
        {isProcessing ? 'Processing...' : 'Subscribe Now'}
      </button>
      {message && (
        <div className={`subscription-message ${message.includes('activated') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}
    </form>
  )
}

interface Plan {
  id: string
  name: string
  amount: number
  currency: string
  interval: string
  interval_count: number
}

function Subscriptions() {
  const navigate = useNavigate()
  const [plans, setPlans] = useState<Plan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [currentSubscription, setCurrentSubscription] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Safety check: Stripe must be configured
  if (!stripePromise) {
    return (
      <div className="subscriptions-container">
        <h1>Subscriptions</h1>
        <p>Stripe payment processing is not currently configured. Please contact support.</p>
        <button onClick={() => navigate('/')}>Return Home</button>
      </div>
    )
  }

  useEffect(() => {
    loadPlans()
    loadCurrentSubscription()
  }, [])

  const loadPlans = async () => {
    try {
      const response = await api.get('/subscriptions/plans')
      setPlans(response.data.plans || [])
    } catch (err) {
      console.error('Failed to load plans:', err)
    }
  }

  const loadCurrentSubscription = async () => {
    try {
      const response = await api.get('/subscriptions/current')
      if (response.data.subscription) {
        setCurrentSubscription(response.data.subscription)
      }
    } catch (err) {
      console.error('Failed to load subscription:', err)
    }
  }

  const handleSelectPlan = async (plan: Plan) => {
    setLoading(true)
    setError(null)

    try {
      const response = await api.post('/subscriptions/create', {
        priceId: plan.id,
      })

      setClientSecret(response.data.clientSecret)
      setSelectedPlan(plan)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create subscription')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelSubscription = async () => {
    if (!currentSubscription) return

    if (!confirm('Are you sure you want to cancel your subscription? You will retain access until the end of your billing period.')) {
      return
    }

    try {
      await api.post('/subscriptions/cancel', {
        subscriptionId: currentSubscription.stripe_subscription_id,
        cancelAtPeriodEnd: true,
      })

      alert('Subscription will be canceled at the end of your billing period.')
      loadCurrentSubscription()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to cancel subscription')
    }
  }

  const handleResumeSubscription = async () => {
    if (!currentSubscription) return

    try {
      await api.post('/subscriptions/resume', {
        subscriptionId: currentSubscription.stripe_subscription_id,
      })

      alert('Subscription resumed!')
      loadCurrentSubscription()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to resume subscription')
    }
  }

  const handleSuccess = () => {
    setTimeout(() => {
      navigate('/')
    }, 2000)
  }

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100)
  }

  const options: StripeElementsOptions = {
    clientSecret: clientSecret || undefined,
    appearance: {
      theme: 'stripe',
    },
  }

  return (
    <div className="subscriptions-page">
      <header className="subscriptions-header">
        <button onClick={() => navigate('/')} className="back-button">
          ← Back
        </button>
        <h1>Subscription Plans</h1>
      </header>

      <main className="subscriptions-main">
        {currentSubscription ? (
          <div className="current-subscription">
            <h2>Your Current Subscription</h2>
            <div className="subscription-card">
              <h3>{formatPrice(currentSubscription.amount, currentSubscription.currency)}/{currentSubscription.plan_type === 'annual' ? 'year' : 'month'}</h3>
              <p>Status: <strong>{currentSubscription.status}</strong></p>
              <p>Renews: {new Date(currentSubscription.current_period_end).toLocaleDateString()}</p>
              
              {currentSubscription.cancel_at_period_end ? (
                <div>
                  <p className="warning">⚠️ Subscription will cancel at period end</p>
                  <button onClick={handleResumeSubscription} className="resume-button">
                    Resume Subscription
                  </button>
                </div>
              ) : (
                <button onClick={handleCancelSubscription} className="cancel-button">
                  Cancel Subscription
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {!clientSecret ? (
              <div className="plans-selection">
                <h2>Choose a Plan</h2>
                <p>Select a subscription plan to get started.</p>

                <div className="plans-grid">
                  {plans.map((plan) => (
                    <div key={plan.id} className="plan-card">
                      <h3>{plan.name}</h3>
                      <div className="plan-price">
                        {formatPrice(plan.amount, plan.currency)}
                        <span className="plan-interval">/{plan.interval}</span>
                      </div>
                      <button
                        onClick={() => handleSelectPlan(plan)}
                        disabled={loading}
                        className="select-plan-button"
                      >
                        {loading ? 'Loading...' : 'Select Plan'}
                      </button>
                    </div>
                  ))}
                </div>

                {plans.length === 0 && (
                  <div className="no-plans">
                    <p>No subscription plans available at this time.</p>
                    <p>Please check back later or contact support.</p>
                  </div>
                )}

                {error && <div className="error-message">{error}</div>}
              </div>
            ) : (
              <div className="subscription-payment">
                <h2>Complete Your Subscription</h2>
                <p>You're subscribing to: <strong>{selectedPlan?.name}</strong></p>
                <Elements stripe={stripePromise} options={options}>
                  <SubscriptionForm clientSecret={clientSecret} onSuccess={handleSuccess} onError={setError} />
                </Elements>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default Subscriptions

