// controllers/paymentController.js - FIXED VERSION
const crypto = require('crypto');
const Razorpay = require('razorpay');
const Payment = require('../models/payment');

// ✅ FIX: Import the Order model correctly
const { Orders } = require('../models/orders'); // Destructure because it's exported as named export
const Order = Orders; // Alias for cleaner code

console.log('✅ Order model imported successfully');
console.log('✅ Payment model imported successfully');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

console.log('✅ Payment Controller Loaded');
console.log('Razorpay Key ID:', process.env.RAZORPAY_KEY_ID ? '✅ Set' : '❌ Missing');
console.log('Razorpay Secret:', process.env.RAZORPAY_KEY_SECRET ? '✅ Set' : '❌ Missing');

// ✅ CREATE ORDER
exports.createOrder = async (req, res) => {
  try {
    console.log('\n=== CREATE ORDER REQUEST ===');
    console.log('req.user:', req.user);
    console.log('req.body:', JSON.stringify(req.body, null, 2));

    const { items, customer, deliveryDetails } = req.body;
    
    // ✅ Debug: Check if user is authenticated
    if (!req.user) {
      console.error('❌ No authenticated user in req.user');
      return res.status(401).json({ 
        success: false, 
        message: 'User not authenticated' 
      });
    }

    const userId = req.user._id;
    console.log('userId:', userId);
    console.log('customer from body:', customer);

    // Validate user
    if (userId.toString() !== customer) {
      console.error('❌ User ID mismatch');
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized - User ID mismatch' 
      });
    }

    // ✅ Validate items
    if (!items || items.length === 0) {
      console.error('❌ No items in order');
      return res.status(400).json({ 
        success: false, 
        message: 'Cart is empty' 
      });
    }

    console.log('items:', items);

    // Calculate total amount
    let totalAmount = 0;
    const orderItems = items.map(item => {
      const itemPrice = item.price || 100;
      totalAmount += itemPrice * item.quantity;
      console.log(`Item: ${item.product}, Price: ${itemPrice}, Qty: ${item.quantity}`);
      return {
        product: item.product,
        quantity: item.quantity,
        price: itemPrice
      };
    });

    console.log('Total Amount:', totalAmount);

    if (totalAmount <= 0) {
      console.error('❌ Invalid total amount');
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid cart total' 
      });
    }

    // ✅ Create order in DB
    console.log('Creating order in database...');
    console.log('Order constructor type:', typeof Order);
    
    const order = new Order({
      customer: userId,
      items: orderItems,
      deliveryDetails: {
        address: deliveryDetails.address,
        contactNumber: deliveryDetails.phone // ✅ Match schema field name
      },
      payment: {
        mode: 'online', // ✅ Changed from 'razorpay' to 'online' (valid enum value)
        status: 'pending',
        transactionId: null
      },
      totalAmount: totalAmount, // ✅ Changed from totalPrice to totalAmount (matches schema)
      orderStatus: 'placed' // ✅ Add this - schema expects it
    });

    await order.save();
    console.log('✅ Order saved:', order._id);

    // ✅ Create payment record
    console.log('Creating payment record...');
    const payment = new Payment({
      order: order._id,
      customer: userId,
      amount: totalAmount,
      status: 'initiated',
      paymentMethod: 'razorpay'
    });

    await payment.save();
    console.log('✅ Payment saved:', payment._id);

    // ✅ Create Razorpay order
    console.log('Creating Razorpay order...');
    const razorpayOrder = await razorpay.orders.create({
      amount: totalAmount * 100,
      currency: 'INR',
      receipt: `order_${order._id}`,
      notes: {
        orderId: order._id.toString(),
        customerId: userId.toString()
      }
    });
    console.log('✅ Razorpay order created:', razorpayOrder.id);

    const response = {
      success: true,
      orderId: order._id,
      paymentId: payment._id,
      razorpayOrderId: razorpayOrder.id,
      amount: totalAmount,
      message: 'Order created successfully'
    };

    console.log('✅ Response:', response);
    res.json(response);

  } catch (err) {
    console.error('❌ CREATE ORDER ERROR:', err.message);
    console.error('Error Stack:', err.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Error creating order: ' + err.message,
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ✅ VERIFY PAYMENT
exports.verifyPayment = async (req, res) => {
  try {
    console.log('\n=== VERIFY PAYMENT REQUEST ===');
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, paymentId } = req.body;

    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not authenticated' 
      });
    }

    const userId = req.user._id;

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    console.log('Expected Signature:', expectedSignature);
    console.log('Received Signature:', razorpay_signature);

    if (expectedSignature !== razorpay_signature) {
      console.error('❌ Signature mismatch');
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid payment signature' 
      });
    }

    console.log('✅ Signature verified');

    // Update payment record
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      console.error('❌ Payment not found:', paymentId);
      return res.status(404).json({ 
        success: false, 
        message: 'Payment not found' 
      });
    }

    payment.status = 'completed';
    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpayOrderId = razorpay_order_id;
    await payment.save();
    console.log('✅ Payment updated');

    // Update order
    const order = await Order.findById(payment.order);
    if (!order) {
      console.error('❌ Order not found');
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }

    order.payment.status = 'paid'; // ✅ Use 'paid' instead of 'completed' (matches enum)
    order.orderStatus = 'confirmed'; // ✅ Use 'orderStatus' not 'status' (matches schema)
    await order.save();
    console.log('✅ Order updated');

    res.json({
      success: true,
      message: 'Payment verified successfully',
      orderId: order._id
    });

  } catch (err) {
    console.error('❌ VERIFY PAYMENT ERROR:', err.message);
    console.error('Error Stack:', err.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Error verifying payment: ' + err.message 
    });
  }
};

// ✅ GET PAYMENT HISTORY
exports.getPaymentHistory = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not authenticated' 
      });
    }

    const userId = req.user._id;

    const payments = await Payment.find({ customer: userId })
      .populate('order')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      payments
    });

  } catch (err) {
    console.error('Get Payment History Error:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

// ✅ REFUND PAYMENT
exports.refundPayment = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not authenticated' 
      });
    }

    const { paymentId } = req.params;

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ 
        success: false, 
        message: 'Payment not found' 
      });
    }

    if (payment.status !== 'completed') {
      return res.status(400).json({ 
        success: false, 
        message: 'Can only refund completed payments' 
      });
    }

    const refund = await razorpay.payments.refund(payment.razorpayPaymentId, {
      amount: payment.amount * 100
    });

    payment.status = 'refunded';
    payment.refundId = refund.id;
    await payment.save();

    res.json({
      success: true,
      message: 'Refund processed successfully',
      refundId: refund.id
    });

  } catch (err) {
    console.error('Refund Error:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};