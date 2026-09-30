const crypto = require('crypto');

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'ritiksuthar989@gmail.com').toLowerCase().trim();
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const COOLDOWN_MS = 30 * 1000; // 30 seconds between resends
const MAX_ATTEMPTS = 5;

// In-memory store for pending OTP verification requests
// Key: email (lowercase), Value: { otp, expiresAt, attempts, lastSentAt }
const otpStore = new Map();

/**
 * Generate a cryptographically secure 6-digit OTP
 */
function generateSecureCode() {
  const num = crypto.randomInt(100000, 1000000);
  return num.toString();
}

/**
 * Request creation of an OTP for the admin email
 */
function createOtp(email) {
  const normalizedEmail = (email || '').toLowerCase().trim();

  // Security check: Only portfolio owner is authorized
  if (normalizedEmail !== ADMIN_EMAIL) {
    return {
      success: false,
      message: `Unauthorized email address. Only ${ADMIN_EMAIL} can request login credentials.`
    };
  }

  const existing = otpStore.get(normalizedEmail);
  const now = Date.now();

  // Check resend cooldown
  if (existing && existing.lastSentAt && (now - existing.lastSentAt < COOLDOWN_MS)) {
    const remainingSeconds = Math.ceil((COOLDOWN_MS - (now - existing.lastSentAt)) / 1000);
    return {
      success: false,
      message: `Please wait ${remainingSeconds}s before requesting a new code.`,
      retryAfter: remainingSeconds
    };
  }

  const otp = generateSecureCode();
  const expiresAt = now + OTP_EXPIRY_MS;

  otpStore.set(normalizedEmail, {
    otp,
    expiresAt,
    attempts: 0,
    lastSentAt: now
  });

  return {
    success: true,
    otp,
    expiresInMinutes: 10,
    expiresAt
  };
}

/**
 * Verify submitted OTP for the admin email
 */
function verifyOtp(email, enteredOtp) {
  const normalizedEmail = (email || '').toLowerCase().trim();

  if (normalizedEmail !== ADMIN_EMAIL) {
    return {
      success: false,
      message: `Unauthorized email address. Access denied.`
    };
  }

  const record = otpStore.get(normalizedEmail);

  if (!record) {
    return {
      success: false,
      message: 'No OTP request found. Please request a new code.'
    };
  }

  const now = Date.now();
  if (now > record.expiresAt) {
    otpStore.delete(normalizedEmail);
    return {
      success: false,
      message: 'Passcode has expired. Please request a new code.'
    };
  }

  // Increment attempt counter
  record.attempts += 1;

  if (record.attempts > MAX_ATTEMPTS) {
    otpStore.delete(normalizedEmail);
    return {
      success: false,
      message: 'Too many incorrect attempts. For security, please request a new code.'
    };
  }

  // Normalize string comparisons
  const cleanEntered = (enteredOtp || '').toString().trim();
  const cleanActual = (record.otp || '').toString().trim();

  if (cleanEntered !== cleanActual) {
    const remainingAttempts = MAX_ATTEMPTS - record.attempts;
    return {
      success: false,
      message: `Invalid passcode. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`
    };
  }

  // Valid! Remove used OTP to prevent replay attacks
  otpStore.delete(normalizedEmail);

  return {
    success: true,
    email: normalizedEmail
  };
}

/**
 * Check if cooldown is currently active
 */
function getCooldownRemaining(email) {
  const normalizedEmail = (email || '').toLowerCase().trim();
  const record = otpStore.get(normalizedEmail);
  if (!record || !record.lastSentAt) return 0;
  const elapsed = Date.now() - record.lastSentAt;
  if (elapsed >= COOLDOWN_MS) return 0;
  return Math.ceil((COOLDOWN_MS - elapsed) / 1000);
}

module.exports = {
  ADMIN_EMAIL,
  createOtp,
  verifyOtp,
  getCooldownRemaining
};
