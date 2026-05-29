// index.js - CORRECTED VERSION
require('dotenv').config();
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const morgan = require('morgan');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require("./auth/google");
const path = require('path');
const fs = require('fs');

const api = process.env.API_URL; // This is /api/v1

const otpRoutes = require('./routers/otpAuth');
const authMiddleware = require('./middleware/auth');

// ============ MIDDLEWARE SETUP (Order matters!) ============

// 1. CORS first
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

// 2. Body parsing
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan('tiny'));

// 3. STATIC FILES
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 4. Session setup
app.set("trust proxy", 1);
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      secure: false,
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
      path: '/'
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// ============ GOOGLE AUTH ROUTES ============

app.get("/auth/google", (req, res, next) => {
  const role = req.query.role;
  console.log("🎯 Selected role from frontend:", role);
  const state = encodeURIComponent(role || "customer");
  passport.authenticate("google", {
    scope: ["profile", "email"],
    state,
  })(req, res, next);
});

app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: process.env.FRONTEND_URL + "/login",
    session: true,
  }),
  async (req, res) => {
    try {
      console.log("🟢 After Google login - req.session:", req.session);
      console.log("🟢 After Google login - req.user (before save):", req.user);

      const role =
        (req.query.state && decodeURIComponent(req.query.state)) ||
        req.session.userRole ||
        "customer";

      console.log("🧩 Role restored from OAuth state:", role);

      const UserModel = require("./models/users");
      const dbUser = await UserModel.findById(req.user._id);
      if (dbUser) {
        dbUser.role = role;
        await dbUser.save();
        console.log(`✅ Role '${role}' set for ${dbUser.name}`);

        req.login(dbUser, (err) => {
          if (err) {
            console.error("⚠️ Session refresh error:", err);
            return res.redirect(process.env.FRONTEND_URL + "/login");
          }
          req.session.save(() => {
            console.log("🚀 Redirecting to frontend dashboard...");
            return res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
          });
        });
      } else {
        console.warn("⚠️ User not found in DB for role update");
        return res.redirect(process.env.FRONTEND_URL + "/login");
      }
    } catch (err) {
      console.error("❌ Error during OAuth callback:", err);
      res.redirect(process.env.FRONTEND_URL + "/login");
    }
  }
);

// ============ OTP AUTH ROUTES ============
app.use('/auth', otpRoutes);

// ============ COMBINED AUTH USER ENDPOINT ============
app.get("/auth/user", authMiddleware, (req, res) => {
  console.log("🟢 /auth/user -> req.user:", req.user);
  res.json({
    _id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    phone: req.user.phone,
    role: req.user.role,
    photo: req.user.photo
  });
});

// ============ LOGOUT ENDPOINT ============
app.get("/auth/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.clearCookie('authToken');
      res.redirect(process.env.FRONTEND_URL + "/login");
    });
  });
});

// ============ TEST ENDPOINT ============
app.get("/test-session", (req, res) => {
  console.log("Session data:", req.session);
  console.log("User:", req.user);
  res.json({ session: req.session, user: req.user });
});

// ============ DASHBOARD ENDPOINT ============
app.get('/api/dashboard', authMiddleware, (req, res) => {
  res.json({
    message: `Welcome ${req.user.name}!`,
    user: req.user
  });
});

// ============ IMPORT ALL ROUTES ============
const updateLocationsRoute = require('./routers/updateLocation');
const productRouter = require('./routers/product');
const categoriesRouter = require('./routers/category');
const orderRouter = require('./routers/orders');
const userRouter = require('./routers/users');
const cartRouter = require('./routers/cart');
const feedbackRoutes = require('./routers/feedbackRoutes');
const paymentRoutes = require('./routers/Payment'); // ✅ PAYMENT ROUTES
const qrPaymentRoutes = require('./routers/qrPayment');
const orderTracking = require("./routers/orderTracking");
const notificationRoutes = require("./routers/notifications");
const recommendationRouter = require("./routers/recommendations");
// ============ MOUNT ALL ROUTES ============
// ✅ IMPORTANT: These MUST be mounted with ${api} prefix
app.use(`${api}/product`, productRouter);
app.use(`${api}/category`, categoriesRouter);
app.use(`${api}/orders`, orderRouter);
app.use(`${api}/users`, userRouter);
app.use(`${api}/cart`, cartRouter);
app.use(`${api}/feedback`, feedbackRoutes);
app.use(`${api}/payment`, paymentRoutes); // ✅ FIX: Use ${api}/payment NOT /api/payment
app.use(`${api}/qr-payment`, qrPaymentRoutes);
app.use(`${api}/notifications`, notificationRoutes);
app.use('/api', updateLocationsRoute); // This one uses /api directly
app.use(`${api}/recommendations`, recommendationRouter);

// ============ WELCOME ROUTE ============
app.get(`${api}`, (req, res) => {
  res.json({
    message: 'Welcome to the OOPS API!',
    availableRoutes: [
      `${api}/product`,
      `${api}/category`,
      `${api}/orders`,
      `${api}/users`,
      `${api}/cart`,
      `${api}/feedback`,
      `${api}/payment`, // ✅ Updated
      `${api}/qr-payment`,
      `${api}/notifications`,
      '/auth/google',
      '/auth/otp/send',
      '/auth/otp-register-login',
      '/auth/user',
      '/auth/logout'
    ]
  });
});

// ============ LOG ALL REGISTERED ROUTES ============
console.log("\n---- 📋 Registered Routes ----");
if (app._router && app._router.stack) {
  app._router.stack
    .filter(r => r.route && r.route.path)
    .forEach(r => {
      const methods = Object.keys(r.route.methods)
        .map(m => m.toUpperCase())
        .join(",");
      console.log(`${methods.padEnd(8)} ${r.route.path}`);
    });

  // Also log router middleware
  app._router.stack
    .filter(r => r.name === 'router')
    .forEach(r => {
      if (r.regexp) {
        const path = r.regexp.source
          .replace(/\\\//g, '/')
          .replace(/\$/, '');
        console.log(`ROUTER   ${path}`);
      }
    });
}
console.log("---- end routes ----\n");

// ============ DATABASE CONNECTION ============
mongoose.connect(process.env.CONNECTION_STRING, {
  dbName: 'OOPS-Database'
})
.then(() => {
  console.log('✅ Database connection is ready');
})
.catch((err) => {
  console.log("❌ Error:", err.message);
});

// ============ START SERVER ============
app.listen(3000, () => {
  console.log(`✅ Server is running on port http://localhost:3000${api}`);
  console.log(`📍 API endpoint is ${api}`);
  console.log(`📍 Uploads served at http://localhost:3000/uploads`);
  console.log(`📍 Payment routes available at ${api}/payment`);
  console.log(`📍 Auth routes available at /auth/*`);
  console.log(`\n💳 Payment endpoints:`);
  console.log(`   POST   ${api}/payment/create-order`);
  console.log(`   POST   ${api}/payment/verify-payment`);
  console.log(`   GET    ${api}/payment/history`);
  console.log(`   POST   ${api}/payment/refund/:paymentId\n`);
});