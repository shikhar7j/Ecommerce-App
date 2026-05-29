
const express = require('express');
const router = express.Router();
const Product = require('../models/product');

// router.post('/fix-locations', async (req, res) => {
//   try {
//     const result = await Product.updateMany(
//       { location: { $exists: false } },
//       { $set: { location: "Delhi" } }
//     );
//     res.json({ 
//       message: 'Updated products with default location',
//       modifiedCount: result.modifiedCount 
//     });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

module.exports = router; 