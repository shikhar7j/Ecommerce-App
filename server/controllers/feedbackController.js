const Feedback = require('../models/Feedback');
const Product = require('../models/product');

// Create new feedback
exports.createFeedback = async (req, res) => {
  try {
    const { product, user, rating, comment, images } = req.body;

    // Validate required fields
    if (!product || !user || !rating || !comment) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Validate rating range
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Check if user already gave feedback for this product
    const existingFeedback = await Feedback.findOne({ product, user });
    if (existingFeedback) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted feedback for this product. You can edit your existing feedback.'
      });
    }

    // Create feedback
    const feedback = await Feedback.create({
      product,
      user,
      rating,
      comment,
      images: images || []
    });

    // Populate user details
    await feedback.populate('user', 'name email');

    // Update product average rating
    await updateProductRating(product);

    res.status(201).json({
      success: true,
      feedback
    });
  } catch (error) {
    console.error('Create feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create feedback',
      error: error.message
    });
  }
};

// Get all feedbacks for a product
exports.getFeedbacksByProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    const feedbacks = await Feedback.find({ product: productId })
  .populate("user", "name email")
  .populate({
      path: "replies.user",
      select: "name email",
      options: { strictPopulate: false }
  })
  .sort({ createdAt: -1 });

    res.status(200).json(feedbacks);
  } catch (error) {
    console.error('Get feedbacks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feedbacks',
      error: error.message
    });
  }
};

// Get all feedbacks by a user
exports.getFeedbacksByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const feedbacks = await Feedback.find({ user: userId })
      .populate('product', 'name image price')
      .populate('replies.user', 'name email role')
      .sort({ createdAt: -1 });

    res.status(200).json(feedbacks);
  } catch (error) {
    console.error('Get user feedbacks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user feedbacks',
      error: error.message
    });
  }
};

// Update feedback
exports.updateFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment, images } = req.body;

    const feedback = await Feedback.findById(id);
    
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }

    // Update fields
    if (rating) {
      if (rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          message: 'Rating must be between 1 and 5'
        });
      }
      feedback.rating = rating;
    }
    
    if (comment) {
      feedback.comment = comment;
    }

    if (images) {
      feedback.images = images;
    }

    feedback.updatedAt = Date.now();
    await feedback.save();

    // Update product average rating
    await updateProductRating(feedback.product);

    await feedback.populate('user', 'name email');
    await feedback.populate('replies.user', 'name email role');

    res.status(200).json({
      success: true,
      feedback
    });
  } catch (error) {
    console.error('Update feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update feedback',
      error: error.message
    });
  }
};

// Delete feedback
exports.deleteFeedback = async (req, res) => {
  try {
    const { id } = req.params;

    const feedback = await Feedback.findById(id);
    
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }

    const productId = feedback.product;
    await Feedback.findByIdAndDelete(id);

    // Update product average rating
    await updateProductRating(productId);

    res.status(200).json({
      success: true,
      message: 'Feedback deleted successfully'
    });
  } catch (error) {
    console.error('Delete feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete feedback',
      error: error.message
    });
  }
};

// Mark feedback as helpful
exports.markHelpful = async (req, res) => {
  try {
    const { id } = req.params;

    const feedback = await Feedback.findById(id);
    
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }

    feedback.helpful = (feedback.helpful || 0) + 1;
    await feedback.save();

    res.status(200).json({
      success: true,
      feedback
    });
  } catch (error) {
    console.error('Mark helpful error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark feedback as helpful',
      error: error.message
    });
  }
};

// NEW: Add seller reply to feedback
exports.addReply = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, text } = req.body;

    if (!userId || !text) {
      return res.status(400).json({
        success: false,
        message: 'User ID and reply text are required'
      });
    }

    const feedback = await Feedback.findById(id);
    
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }

    // Add reply
    feedback.replies.push({
      user: userId,
      text: text,
      createdAt: new Date()
    });

    await feedback.save();

    // Populate the feedback with user details
    await feedback.populate('user', 'name email');
    await feedback.populate('replies.user', 'name email role');

    res.status(200).json({
      success: true,
      feedback
    });
  } catch (error) {
    console.error('Add reply error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add reply',
      error: error.message
    });
  }
};

// NEW: Delete a reply
exports.deleteReply = async (req, res) => {
  try {
    const { id, replyId } = req.params;

    const feedback = await Feedback.findById(id);
    
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }

    // Remove the reply
    feedback.replies = feedback.replies.filter(
      reply => reply._id.toString() !== replyId
    );

    await feedback.save();

    await feedback.populate('user', 'name email');
    await feedback.populate('replies.user', 'name email role');

    res.status(200).json({
      success: true,
      feedback
    });
  } catch (error) {
    console.error('Delete reply error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete reply',
      error: error.message
    });
  }
};

// Helper function to update product rating
async function updateProductRating(productId) {
  try {
    const feedbacks = await Feedback.find({ product: productId });
    
    if (feedbacks.length === 0) {
      await Product.findByIdAndUpdate(productId, { rating: 0 });
      return;
    }

    const totalRating = feedbacks.reduce((sum, fb) => sum + fb.rating, 0);
    const averageRating = totalRating / feedbacks.length;

    await Product.findByIdAndUpdate(productId, { 
      rating: Math.round(averageRating * 10) / 10 // Round to 1 decimal place
    });
  } catch (error) {
    console.error('Update product rating error:', error);
  }
}
