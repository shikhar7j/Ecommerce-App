// routers/recommendations.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { Orders } = require("../models/orders");
const { Product } = require("../models/product");

// helper to bump feature weights
function addWeight(map, key, amount) {
  map.set(key, (map.get(key) || 0) + amount);
}

// GET /api/v1/recommendations/user/:userId
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }

    // 1) Get user's past orders with products + categories
    const orders = await Orders.find({ customer: userId })
      .populate({
        path: "items.product",
        populate: [{ path: "category" }],
      });

    if (!orders.length) {
      // No history → fallback to latest / popular products
      const fallbackProducts = await Product.find({ countStock: { $gt: 0 } })
        .populate("category")
        .sort({ createdAt: -1 })
        .limit(10);

      return res.json({
        success: true,
        strategy: "cold_start",
        products: fallbackProducts,
      });
    }

    // 2) Build user preference profile from order history
    const featureWeights = new Map();      // key -> weight
    const boughtProductIds = new Set();    // to exclude already bought

    orders.forEach((order) => {
      order.items.forEach((item) => {
        const prod = item.product;
        if (!prod) return;

        const qty = item.quantity || 1;

        const prodId = prod._id.toString();
        boughtProductIds.add(prodId);

        // category feature
        const catId = (prod.category && prod.category._id)
          ? prod.category._id.toString()
          : prod.category?.toString();
        if (catId) {
          addWeight(featureWeights, `cat:${catId}`, 2 * qty);
        }

        // brand feature
        if (prod.brand) {
          addWeight(featureWeights, `brand:${prod.brand}`, 1 * qty);
        }

        // price bucket feature (e.g. 0–499, 500–999, etc.)
        const bucket = Math.floor((prod.price || 0) / 500);
        addWeight(featureWeights, `priceBucket:${bucket}`, 0.5 * qty);

        // exact product preference (for very similar ones)
        addWeight(featureWeights, `prod:${prodId}`, 1 * qty);
      });
    });

    // 3) Fetch candidate products (not already bought, in stock)
    const candidates = await Product.find({
      _id: { $nin: [...boughtProductIds] },
      countStock: { $gt: 0 },
    })
      .populate("category");

    // 4) Score each candidate based on feature overlap
    function scoreProduct(prod) {
      let score = 0;

      const prodId = prod._id.toString();
      const catId = (prod.category && prod.category._id)
        ? prod.category._id.toString()
        : prod.category?.toString();

      if (catId) {
        score += featureWeights.get(`cat:${catId}`) || 0;
      }

      if (prod.brand) {
        score += featureWeights.get(`brand:${prod.brand}`) || 0;
      }

      const bucket = Math.floor((prod.price || 0) / 500);
      score += featureWeights.get(`priceBucket:${bucket}`) || 0;

      score += featureWeights.get(`prod:${prodId}`) || 0;

      return score;
    }

    const scored = candidates
      .map((p) => ({ product: p, score: scoreProduct(p) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((x) => x.product);

    // If nothing scored > 0, use fallback
    if (!scored.length) {
      const fallbackProducts = await Product.find({ countStock: { $gt: 0 } })
        .populate("category")
        .sort({ createdAt: -1 })
        .limit(10);

      return res.json({
        success: true,
        strategy: "fallback",
        products: fallbackProducts,
      });
    }

    res.json({
      success: true,
      strategy: "content_based",
      products: scored,
    });
  } catch (err) {
    console.error("Recommendation error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
