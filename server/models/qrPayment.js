// models/QRPayment.js
const mongoose = require('mongoose');

const qrPaymentSchema = new mongoose.Schema({
  paymentId: {
    type: String,
    required: true,
    unique: true
  },
  orderId: {
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
  expectedAmount: {
    type: Number,
    required: true
  },
  // Transaction Details
  transactionId: {
    type: String,
    required: true,
    trim: true
  },
  upiTransactionId: {
    type: String, // UTR number
    trim: true
  },
  // Payment Proof
  screenshot: {
    type: String, // Base64 or URL
    required: true
  },
  screenshotMetadata: {
    uploadedAt: Date,
    fileSize: Number,
    fileType: String
  },
  // Verification Details
  verificationStatus: {
    type: String,
    enum: ['PENDING', 'AUTO_APPROVED', 'MANUAL_REVIEW', 'APPROVED', 'REJECTED'],
    default: 'PENDING'
  },
  verificationMethod: {
    type: String,
    enum: ['AUTO', 'MANUAL', 'HYBRID'],
    default: 'AUTO'
  },
  autoVerificationChecks: {
    transactionIdFormat: { type: Boolean, default: false },
    amountMatch: { type: Boolean, default: false },
    timestampValid: { type: Boolean, default: false },
    screenshotValid: { type: Boolean, default: false },
    overallScore: { type: Number, default: 0 } // 0-100
  },
  // Manual Verification
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: Date,
  verificationNotes: String,
  rejectionReason: String,
  // Status
  status: {
    type: String,
    enum: ['PENDING', 'VERIFIED', 'FAILED', 'EXPIRED'],
    default: 'PENDING'
  },
  // Timestamps
  submittedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  }
}, {
  timestamps: true
});

// Indexes
qrPaymentSchema.index({ orderId: 1 });
qrPaymentSchema.index({ customer: 1, createdAt: -1 });
qrPaymentSchema.index({ verificationStatus: 1 });
qrPaymentSchema.index({ status: 1 });
qrPaymentSchema.index({ transactionId: 1 });

// Methods
qrPaymentSchema.methods.calculateVerificationScore = function() {
  const checks = this.autoVerificationChecks;
  let score = 0;
  
  if (checks.transactionIdFormat) score += 30;
  if (checks.amountMatch) score += 40;
  if (checks.timestampValid) score += 20;
  if (checks.screenshotValid) score += 10;
  
  this.autoVerificationChecks.overallScore = score;
  return score;
};

qrPaymentSchema.methods.autoApprove = function() {
  const score = this.calculateVerificationScore();
  
  if (score >= 80) {
    this.verificationStatus = 'AUTO_APPROVED';
    this.verificationMethod = 'AUTO';
    this.status = 'VERIFIED';
    this.verifiedAt = new Date();
    return true;
  } else if (score >= 50) {
    this.verificationStatus = 'MANUAL_REVIEW';
    this.verificationMethod = 'HYBRID';
    return false;
  } else {
    this.verificationStatus = 'MANUAL_REVIEW';
    this.verificationMethod = 'MANUAL';
    return false;
  }
};

module.exports = mongoose.model('qrPayment', qrPaymentSchema);