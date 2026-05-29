const express = require('express');
const router = express.Router();
const User = require('../models/users');
const jwt = require('jsonwebtoken');

// Store OTP temporarily (use Redis in production)
const otpStore = new Map();
const OTP_EXPIRY = 5 * 60 * 1000; // 5 minutes

console.log('🚀 OTP Routes Initializing...');

/**
 * STEP 1: Send OTP
 * POST /auth/otp/send
 */
router.post('/otp/send', async (req, res) => {
  try {
    const { email, phone, method } = req.body;

    console.log('📬 OTP Send Request:', { email, phone, method });

    if (!email && method !== 'phone') {
      return res.status(400).json({ message: 'Email required for email OTP' });
    }

    if (!phone && method === 'phone') {
      return res.status(400).json({ message: 'Phone required for phone OTP' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const contact = email || phone;

    // Store OTP with expiry
    otpStore.set(contact, {
      otp,
      timestamp: Date.now(),
      expiry: Date.now() + OTP_EXPIRY,
      attempts: 0
    });

    console.log(`📬 OTP for ${contact}: ${otp}`);

    res.json({
      success: true,
      message: `OTP sent to ${method === 'email' ? 'email' : 'phone'}`,
      contact,
      demo_otp: otp
    });
  } catch (error) {
    console.error('❌ OTP Send Error:', error);
    res.status(500).json({ message: 'Failed to send OTP' });
  }
});

/**
 * STEP 2: Register & Login with OTP
 * POST /auth/otp-register-login
 */
router.post('/otp-register-login', async (req, res) => {
  try {
    const { name, email, phone, otp, role } = req.body;

    console.log('🔐 OTP Register/Login Request:', { name, email, phone, role, otp: '****' });

    // Validate required fields
    if (!name || !otp || !role) {
      return res.status(400).json({ message: 'Missing required fields: name, otp, role' });
    }

    if (!email && !phone) {
      return res.status(400).json({ message: 'Email or phone required' });
    }

    // Verify OTP
    const contact = email || phone;
    const storedOtpData = otpStore.get(contact);

    if (!storedOtpData) {
      return res.status(400).json({ message: 'OTP expired or not sent. Please send OTP again.' });
    }

    if (Date.now() > storedOtpData.expiry) {
      otpStore.delete(contact);
      return res.status(400).json({ message: 'OTP expired. Please request a new one.' });
    }

    if (storedOtpData.otp !== otp) {
      storedOtpData.attempts += 1;
      if (storedOtpData.attempts >= 3) {
        otpStore.delete(contact);
        return res.status(400).json({ message: 'Too many attempts. Please request a new OTP.' });
      }
      return res.status(400).json({ message: `Invalid OTP. ${3 - storedOtpData.attempts} attempts remaining.` });
    }

    // OTP verified - remove from store
    otpStore.delete(contact);

    // Check if user exists
    let user = await User.findOne({
      $or: [
        email ? { email: email.toLowerCase() } : null,
        phone ? { phone } : null
      ].filter(Boolean)
    });

    if (!user) {
      // Create new user
      user = await User.create({
        name,
        email: email ? email.toLowerCase() : null,
        phone: phone || null,
        role,
        password: 'otp-login', // dummy password for OTP users
        otpVerified: true,
        loginMethod: 'otp',
        lastLogin: new Date()
      });
      console.log('✅ New user created via OTP:', user.name);
    } else {
      // Update existing user if role not set
      if (!user.role) {
        user.role = role;
      }
      user.otpVerified = true;
      user.loginMethod = 'otp';
      user.lastLogin = new Date();
      await user.save();
      console.log('🔄 Existing user logged in:', user.name);
    }

    // Create JWT Token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // Set secure cookie
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    console.log('🍪 Auth cookie set for:', user.email || user.phone);

    // Also set session for Passport compatibility
    req.login(user, (err) => {
      if (err) {
        console.error('❌ Session login error:', err);
      } else {
        console.log('✅ Session established for:', user.name);
      }
    });

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        photo: user.photo
      },
      token
    });

  } catch (error) {
    console.error('❌ OTP Login Error:', error);
    res.status(500).json({ message: 'Login failed. Please try again.' });
  }
});

/**
 * STEP 3: Verify OTP (for checking OTP validity before registration)
 * POST /auth/otp/verify
 */
router.post('/otp/verify', (req, res) => {
  try {
    const { contact, otp } = req.body;

    if (!contact || !otp) {
      return res.status(400).json({ message: 'Contact and OTP required' });
    }

    const storedOtpData = otpStore.get(contact);

    if (!storedOtpData) {
      return res.status(400).json({ message: 'OTP expired' });
    }

    if (storedOtpData.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    res.json({ success: true, message: 'OTP verified' });

  } catch (error) {
    console.error('❌ OTP Verify Error:', error);
    res.status(500).json({ message: 'Verification failed' });
  }
});

// Log all routes in this router
console.log('✅ OTP Routes registered:', [
  'POST /auth/otp/send',
  'POST /auth/otp-register-login',
  'POST /auth/otp/verify'
]);

module.exports = router;