// models/payment.js - SIMPLE VERSION
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Orders',
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['initiated', 'pending', 'completed', 'failed', 'refunded'],
    default: 'initiated'
  },
  paymentMethod: String,
  razorpayOrderId: String,
  razorpayPaymentId: String,
  refundId: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// ✅ Check if model already exists before creating
module.exports = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);