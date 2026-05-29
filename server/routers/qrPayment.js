// routers/qrPayment.js
const express = require('express');
const router = express.Router();
const qrPaymentController = require("../controllers/qrPaymentController.js");


// Customer Routes
router.post('/submit', qrPaymentController.submitQRPayment);
router.get('/status/:orderId', qrPaymentController.checkQRPaymentStatus);
router.post('/retry/:paymentId', qrPaymentController.retryPayment);

// Admin Routes
router.get('/pending', qrPaymentController.getPendingVerifications);
router.get('/all', qrPaymentController.getAllQRPayments);
router.get('/details/:paymentId', qrPaymentController.getQRPaymentDetails);
router.post('/verify/:paymentId', qrPaymentController.manualVerification);

module.exports = router;