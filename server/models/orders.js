const mongoose = require('mongoose');

const orderSchema = mongoose.Schema({
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    retailer: {
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',
        default: null
    },
    wholesaler: {
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',
        default: null
    },
    items: [
        {
            product: { 
                type: mongoose.Schema.Types.ObjectId,
                ref: "Product",
                required: true
            },
            quantity: { 
                type: Number, 
                required: true,
                min: 1
            },
            price: { 
                type: Number, 
                required: true,
                min: 0
            },
        },
    ],
    totalAmount: {
        type: Number,
        required: true,
        min: 0
    },
    payment: {
        mode: { 
            type: String, 
            enum: ["online", "offline"], 
            default: "offline"
        },
        status: {
            type: String,
            enum: ["pending", "paid", "failed"],
            default: "pending",
        },
        transactionId: String,
    },
    orderStatus: {
        type: String,
        enum: [
            "placed",
            "confirmed",
            "packed",
            "shipped",
            "delivered",
            "cancelled",
        ],
        default: "placed",
    },
    deliveryDetails: {
        address: String,
        contactNumber: String,
        expectedDate: Date,
        deliveredAt: Date,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    tracking: {
  warehouseLocation: {
    lat: Number,
    lng: Number
  },
  currentLocation: {
    lat: Number,
    lng: Number
  },
  deliveryLocation: {
    lat: Number,
    lng: Number
  },
  driverName: String,
  driverPhone: String,
  trackingNumber: { type: String, unique: true },
  estimatedTime: {
    minutes: Number,
    distance: String
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}
});

exports.Orders = mongoose.model('Orders', orderSchema);