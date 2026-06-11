import rateLimit from 'express-rate-limit';

/**
 * Rate limiting is ON BY DEFAULT in every environment.
 *
 * Previous behaviour ("only enable when NODE_ENV === 'production'") meant a
 * missing/typoed env var on the host silently disabled all rate limiting.
 * For a safety app that fails the wrong way: now the limiter is always
 * active unless explicitly opted out for local development with
 * DISABLE_RATE_LIMIT=true.
 */
export const rateLimitingDisabled = process.env.DISABLE_RATE_LIMIT === 'true';

if (rateLimitingDisabled) {
  console.warn('⚠️  RATE LIMITING IS DISABLED (DISABLE_RATE_LIMIT=true). Never run production like this.');
}

const skip = () => rateLimitingDisabled;

// Login / register: brute-force protection
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { error: 'Too many authentication attempts, please try again later.' },
});

// Password reset: stricter (abuse vector for email spam)
export const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { error: 'Too many password reset attempts, please try again later.' },
});

// Admin login: strictest
export const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { error: 'Too many admin login attempts, please try again later.' },
});

// Emergency creation: generous on purpose — must NEVER block a real emergency,
// only mass-abuse (a person can't plausibly trigger 30 emergencies in 15 min).
export const emergencyCreateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { error: 'Too many emergency requests. If this is a real emergency, call your local emergency number.' },
});

// Chat messages: anti-spam
export const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { error: 'Too many messages sent. Please wait a moment.' },
});
