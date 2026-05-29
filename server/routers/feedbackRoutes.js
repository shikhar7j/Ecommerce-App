const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');

// Create feedback
router.post('/', feedbackController.createFeedback);

// Get feedbacks by product
router.get('/product/:productId', feedbackController.getFeedbacksByProduct);

// Get feedbacks by user
router.get('/user/:userId', feedbackController.getFeedbacksByUser);

// Update feedback
router.put('/:id', feedbackController.updateFeedback);

// Delete feedback
router.delete('/:id', feedbackController.deleteFeedback);

// Mark feedback as helpful
router.post('/:id/helpful', feedbackController.markHelpful);

// NEW: Add reply to feedback
router.post('/:id/reply', feedbackController.addReply);

// NEW: Delete reply from feedback
router.delete('/:id/reply/:replyId', feedbackController.deleteReply);

module.exports = router;