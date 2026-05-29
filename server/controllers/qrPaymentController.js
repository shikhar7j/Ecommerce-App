// controllers/qrPaymentController.js
const QRPayment = require('../models/qrPayment');
const { Orders } = require('../models/orders');
const Payment = require('../models/payment');

const generateQRPaymentId = () => {
  return `QR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const validateTransactionId = (txnId) => {
  const upiPattern = /^[0-9]{12,16}$/;
  const cleanTxnId = txnId.replace(/\s/g, '');
  return upiPattern.test(cleanTxnId);
};

const validateAmount = (submittedAmount, expectedAmount) => {
  const difference = Math.abs(submittedAmount - expectedAmount);
  return difference <= 2;
};

const validateTimestamp = (submittedAt) => {
  const now = new Date();
  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
  return new Date(submittedAt) >= thirtyMinutesAgo;
};

const validateScreenshot = (screenshot) => {
  if (!screenshot) return false;
  
  const base64Pattern = /^data:image\/(png|jpeg|jpg);base64,/;
  if (!base64Pattern.test(screenshot)) return false;
  
  const sizeInBytes = (screenshot.length * 3) / 4;
  return sizeInBytes >= 50000 && sizeInBytes <= 5000000;
};

// 1. Submit QR Payment
exports.submitQRPayment = async (req, res) => {
  try {
    const { 
      orderId, 
      transactionId, 
      upiTransactionId,
      screenshot, 
      amount,
      submittedAt 
    } = req.body;

    if (!orderId || !transactionId || !screenshot || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    const order = await Orders.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const existingPayment = await QRPayment.findOne({ orderId });
    if (existingPayment && existingPayment.status !== 'FAILED') {
      return res.status(400).json({
        success: false,
        message: 'Payment already submitted for this order'
      });
    }

    const paymentId = generateQRPaymentId();
    const qrPayment = new QRPayment({
      paymentId,
      orderId: order._id,
      customer: order.customer,
      amount: amount,
      expectedAmount: order.totalAmount,
      transactionId: transactionId.trim(),
      upiTransactionId: upiTransactionId?.trim(),
      screenshot,
      screenshotMetadata: {
        uploadedAt: new Date(),
        fileSize: screenshot.length,
        fileType: screenshot.match(/^data:image\/(\w+);/)?.[1] || 'unknown'
      },
      submittedAt: submittedAt || new Date()
    });

    const checks = {
      transactionIdFormat: validateTransactionId(transactionId),
      amountMatch: validateAmount(amount, order.totalAmount),
      timestampValid: validateTimestamp(submittedAt || new Date()),
      screenshotValid: validateScreenshot(screenshot)
    };

    qrPayment.autoVerificationChecks = checks;
    const autoApproved = qrPayment.autoApprove();
    await qrPayment.save();

    if (autoApproved) {
      order.payment.mode = 'online';
      order.payment.status = 'paid';
      order.payment.transactionId = transactionId;
      order.orderStatus = 'confirmed';
      await order.save();

      const payment = new Payment({
        paymentId: qrPayment.paymentId,
        orderId: order._id,
        customer: order.customer,
        amount: order.totalAmount,
        paymentMethod: 'UPI',
        status: 'SUCCESS',
        transactionId: transactionId,
        paymentDetails: {
          upiId: 'QR Payment',
          verificationMethod: 'AUTO'
        }
      });
      await payment.save();

      return res.json({
        success: true,
        message: 'Payment verified automatically! Order confirmed.',
        paymentId: qrPayment.paymentId,
        status: 'AUTO_APPROVED',
        verificationStatus: 'VERIFIED',
        autoApproved: true
      });
    } else {
      order.payment.mode = 'online';
      order.payment.status = 'pending';
      order.payment.transactionId = transactionId;
      order.orderStatus = 'placed';
      await order.save();

      return res.json({
        success: true,
        message: 'Payment submitted for verification. We will confirm shortly.',
        paymentId: qrPayment.paymentId,
        status: qrPayment.verificationStatus,
        verificationScore: qrPayment.autoVerificationChecks.overallScore,
        autoApproved: false,
        estimatedVerificationTime: '5-10 minutes'
      });
    }

  } catch (error) {
    console.error('Submit QR payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit payment',
      error: error.message
    });
  }
};

// 2. Check Payment Status
exports.checkQRPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    const qrPayment = await QRPayment.findOne({ orderId })
      .populate('orderId')
      .sort({ createdAt: -1 });

    if (!qrPayment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.json({
      success: true,
      payment: {
        paymentId: qrPayment.paymentId,
        status: qrPayment.status,
        verificationStatus: qrPayment.verificationStatus,
        verificationMethod: qrPayment.verificationMethod,
        verificationScore: qrPayment.autoVerificationChecks.overallScore,
        transactionId: qrPayment.transactionId,
        amount: qrPayment.amount,
        submittedAt: qrPayment.submittedAt,
        verifiedAt: qrPayment.verifiedAt
      }
    });

  } catch (error) {
    console.error('Check payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check payment status',
      error: error.message
    });
  }
};

// 3. Get Pending Verifications
exports.getPendingVerifications = async (req, res) => {
  try {
    const pendingPayments = await QRPayment.find({
      verificationStatus: { $in: ['PENDING', 'MANUAL_REVIEW'] },
      status: 'PENDING'
    })
      .populate('orderId')
      .populate('customer', 'name email phone')
      .sort({ submittedAt: -1 });

    res.json({
      success: true,
      payments: pendingPayments,
      count: pendingPayments.length
    });

  } catch (error) {
    console.error('Get pending verifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending verifications',
      error: error.message
    });
  }
};

// 4. Manual Verification
exports.manualVerification = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { approved, notes, adminId } = req.body;

    const qrPayment = await QRPayment.findOne({ paymentId });
    if (!qrPayment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    if (qrPayment.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Payment already processed'
      });
    }

    qrPayment.verificationStatus = approved ? 'APPROVED' : 'REJECTED';
    qrPayment.status = approved ? 'VERIFIED' : 'FAILED';
    qrPayment.verifiedBy = adminId;
    qrPayment.verifiedAt = new Date();
    qrPayment.verificationNotes = notes;
    
    if (!approved) {
      qrPayment.rejectionReason = notes;
    }

    await qrPayment.save();

    const order = await Orders.findById(qrPayment.orderId);
    if (order) {
      if (approved) {
        order.payment.status = 'paid';
        order.orderStatus = 'confirmed';

        const payment = new Payment({
          paymentId: qrPayment.paymentId,
          orderId: order._id,
          customer: order.customer,
          amount: order.totalAmount,
          paymentMethod: 'UPI',
          status: 'SUCCESS',
          transactionId: qrPayment.transactionId,
          paymentDetails: {
            upiId: 'QR Payment',
            verificationMethod: 'MANUAL',
            verifiedBy: adminId
          }
        });
        await payment.save();
      } else {
        order.payment.status = 'failed';
        order.orderStatus = 'cancelled';
      }
      await order.save();
    }

    res.json({
      success: true,
      message: approved ? 'Payment approved successfully' : 'Payment rejected',
      payment: qrPayment
    });

  } catch (error) {
    console.error('Manual verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify payment',
      error: error.message
    });
  }
};

// 5. Get All QR Payments
exports.getAllQRPayments = async (req, res) => {
  try {
    const { status, verificationStatus, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status) query.status = status;
    if (verificationStatus) query.verificationStatus = verificationStatus;

    const payments = await QRPayment.find(query)
      .populate('orderId')
      .populate('customer', 'name email phone')
      .populate('verifiedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await QRPayment.countDocuments(query);

    res.json({
      success: true,
      payments,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count
    });

  } catch (error) {
    console.error('Get all QR payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payments',
      error: error.message
    });
  }
};

// 6. Get Payment Details
exports.getQRPaymentDetails = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const qrPayment = await QRPayment.findOne({ paymentId })
      .populate('orderId')
      .populate('customer', 'name email phone')
      .populate('verifiedBy', 'name email');

    if (!qrPayment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.json({
      success: true,
      payment: qrPayment
    });

  } catch (error) {
    console.error('Get payment details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment details',
      error: error.message
    });
  }
};

// 7. Retry Payment
exports.retryPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { transactionId, screenshot } = req.body;

    const qrPayment = await QRPayment.findOne({ paymentId });
    if (!qrPayment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    if (qrPayment.status !== 'FAILED') {
      return res.status(400).json({
        success: false,
        message: 'Can only retry failed payments'
      });
    }

    qrPayment.transactionId = transactionId;
    qrPayment.screenshot = screenshot;
    qrPayment.status = 'PENDING';
    qrPayment.verificationStatus = 'PENDING';
    qrPayment.submittedAt = new Date();

    const checks = {
      transactionIdFormat: validateTransactionId(transactionId),
      amountMatch: validateAmount(qrPayment.amount, qrPayment.expectedAmount),
      timestampValid: true,
      screenshotValid: validateScreenshot(screenshot)
    };

    qrPayment.autoVerificationChecks = checks;
    qrPayment.autoApprove();
    await qrPayment.save();

    res.json({
      success: true,
      message: 'Payment resubmitted',
      payment: qrPayment
    });

  } catch (error) {
    console.error('Retry payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retry payment',
      error: error.message
    });
  }
};

module.exports = exports;