const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const auth = require('../middleware/auth');

// ✅ Create order
router.post('/create-order', auth, paymentController.createOrder);

// ✅ Verify payment
router.post('/verify-payment', auth, paymentController.verifyPayment);

// ✅ Get payment history
router.get('/history', auth, paymentController.getPaymentHistory);

// ✅ Refund payment (admin only)
router.post('/refund/:paymentId', auth, paymentController.refundPayment);

module.exports = router;

// ============================================
// 3. MAIN APP FILE - Make sure routes are mounted!
// ============================================
// In your main server.js or app.js file:


// ============================================
// 4. models/Payment.js (Example schema)
// ============================================
