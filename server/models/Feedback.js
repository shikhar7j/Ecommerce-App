const mongoose = require('mongoose');

const feedbackSchema = mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },

  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },

  comment: {
    type: String,
    required: true
  },

  replies: [
    {
      user: {                                 // ✅ THIS FIXES YOUR ERROR
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        // required: true
      },
      text: {
        type: String,
        required: true
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }
  ],

  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt timestamp before saving
feedbackSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Prevent duplicate feedback from same user for same product
feedbackSchema.index({ product: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('Feedback', feedbackSchema);
