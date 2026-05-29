const express = require("express");
const router = express.Router();
const { Orders } = require("../models/orders"); // ✅ correct import

// SAVE ROUTE BY RETAILER
router.post("/:orderId/route", async (req, res) => {
  try {
    const { orderId } = req.params;

    const {
      warehouseLocation,
      currentLocation,
      deliveryLocation,
      driverName,
      driverPhone,
      trackingNumber,
      estimatedTime,
    } = req.body;

    const order = await Orders.findByIdAndUpdate(
      orderId,
      {
        tracking: {
          warehouseLocation: {
            lat: warehouseLocation[0],
            lng: warehouseLocation[1],
          },
          currentLocation: {
            lat: currentLocation[0],
            lng: currentLocation[1],
          },
          deliveryLocation: {
            lat: deliveryLocation[0],
            lng: deliveryLocation[1],
          },
          driverName,
          driverPhone,
          trackingNumber,
          estimatedTime,
          updatedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    return res.json({
      success: true,
      message: "Route saved successfully",
      route: order.tracking,
    });
  } catch (err) {
    console.error("❌ Route save error:", err);
    return res
      .status(500)
      .json({ success: false, error: err.message || "Server error" });
  }
});

// UPDATE DRIVER LOCATION LIVE
router.put("/:orderId/tracking", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { currentLocation, status } = req.body;

    const order = await Orders.findByIdAndUpdate(
      orderId,
      {
        "tracking.currentLocation": {
          lat: currentLocation[0],
          lng: currentLocation[1],
        },
        "tracking.updatedAt": new Date(),
        orderStatus: status || "in_transit",
      },
      { new: true }
    );

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    return res.json({
      success: true,
      updatedLocation: order.tracking.currentLocation,
    });
  } catch (error) {
    console.error("❌ Tracking update error:", error);
    return res
      .status(500)
      .json({ success: false, error: error.message || "Server error" });
  }
});

module.exports = router;
