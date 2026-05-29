const jwt = require('jsonwebtoken');
const User = require('../models/users');

const authMiddleware = async (req, res, next) => {
  try {
    // ✅ Check 1: JWT token in HTTP-only cookie (OTP login)
    const token = req.cookies?.authToken;

    if (token) {
      try {
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || 'your-secret-key'
        );
        const user = await User.findById(decoded.userId);
        if (user) {
          req.user = user;
          console.log('✅ User authenticated via JWT token:', user.name);
          return next();
        }
      } catch (jwtError) {
        console.error('⚠️ JWT verification failed:', jwtError.message);
        // Continue to check session
      }
    }

    // ✅ Check 2: Passport session (Google OAuth login)
    if (req.user) {
      console.log('✅ User authenticated via Passport session:', req.user.name);
      return next();
    }

    // ✅ Check 3: Re-verify user in DB (backup)
    if (req.session?.passport?.user) {
      const user = await User.findById(req.session.passport.user);
      if (user) {
        req.user = user;
        console.log('✅ User authenticated via session backup:', user.name);
        return next();
      }
    }

    // ❌ No authentication found
    console.warn('❌ No authentication found');
    return res.status(401).json({ message: 'Not authenticated' });

  } catch (error) {
    console.error('❌ Auth Middleware Error:', error);
    res.status(401).json({ message: 'Authentication failed' });
  }
};

module.exports = authMiddleware;