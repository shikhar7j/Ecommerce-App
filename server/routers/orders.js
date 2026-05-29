const express = require('express');
const router = express.Router();
const { Orders } = require('../models/orders');
const mongoose = require('mongoose');
const { Product } = require('../models/product');
const Notification = require("../models/notification");
const axios = require("axios");

// GET all orders
router.get('/', async (req, res) => {
    const orderList = await Orders.find()
        .populate('customer', 'name email')
        .populate("retailer", "name email")
        .populate("wholesaler", "name email")
        .populate({
            path: "items.product",
            populate: [
                { path: "category" },
                { path: "retailer", select: "name email" },
                { path: "wholesaler", select: "name email" }
            ]
        })
        .sort({ createdAt: -1 });

    if (!orderList) {
        return res.status(500).json({ success: false });
    }
    res.send(orderList);
});

// GET orders by customer
router.get('/by/customer/:customerId', async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.customerId)) {
        return res.status(400).json({ message: 'Invalid customer id' });
    }
    const orders = await Orders.find({ customer: req.params.customerId })
        .sort({ createdAt: -1 })
        .populate({
            path: "items.product",
            populate: [
                { path: "category" },
                { path: "retailer", select: "name email" },
                { path: "wholesaler", select: "name email" }
            ]
        });
    res.status(200).send(orders);
});

// GET orders by retailer - FIXED VERSION
router.get("/by/retailer/:id", async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: 'Invalid retailer id' });
        }

        console.log("🔍 Looking for retailer orders, ID:", req.params.id);

        const allOrders = await Orders.find()
            .populate("customer", "name email")
            .populate("retailer", "name email")
            .populate("wholesaler", "name email")
            .populate({
                path: "items.product",
                populate: [
                    { path: "category" },
                    { path: "retailer", select: "name email" },
                    { path: "wholesaler", select: "name email" }
                ]
            })
            .sort({ createdAt: -1 });

        console.log("📦 Total orders:", allOrders.length);

        const retailerOrders = allOrders.filter(order =>
            order.items.some(item => {
                if (!item.product) return false;
                const productRetailerId = item.product.retailer?._id 
                    ? item.product.retailer._id.toString() 
                    : item.product.retailer?.toString();
                return productRetailerId === req.params.id;
            })
        );

        console.log("✅ Retailer orders found:", retailerOrders.length);

        res.json(retailerOrders);
    } catch (err) {
        console.error("❌ Error:", err);
        res.status(500).json({ message: err.message });
    }
});

// GET orders by wholesaler - FIXED VERSION
router.get("/by/wholesaler/:id", async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: 'Invalid wholesaler id' });
        }

        console.log("🔍 Looking for wholesaler orders, ID:", req.params.id);

        // CRITICAL: Must populate items.product to access wholesaler field
        const allOrders = await Orders.find()
            .populate("customer", "name email")
            .populate("retailer", "name email")
            .populate("wholesaler", "name email")
            .populate({
                path: "items.product",
                populate: [
                    { path: "category" },
                    { path: "retailer", select: "name email" },
                    { path: "wholesaler", select: "name email" } // THIS IS CRITICAL
                ]
            })
            .sort({ createdAt: -1 });

        console.log("📦 Total orders in database:", allOrders.length);

        // Debug: Check first order structure
        if (allOrders.length > 0 && allOrders[0].items.length > 0) {
            console.log("🔍 First order's first item:", {
                productName: allOrders[0].items[0].product?.name,
                hasWholesaler: !!allOrders[0].items[0].product?.wholesaler,
                wholesaler: allOrders[0].items[0].product?.wholesaler
            });
        }

        // Filter orders containing products from this wholesaler
        const wholesalerOrders = allOrders.filter(order => {
            if (!order.items || order.items.length === 0) {
                return false;
            }
            
            const hasWholesalerProduct = order.items.some(item => {
                if (!item.product) {
                    console.log("⚠️ Item has no product");
                    return false;
                }
                
                // Get wholesaler ID from product
                let productWholesalerId = null;
                
                if (item.product.wholesaler) {
                    if (item.product.wholesaler._id) {
                        // Wholesaler is populated
                        productWholesalerId = item.product.wholesaler._id.toString();
                    } else {
                        // Wholesaler is just an ID string
                        productWholesalerId = item.product.wholesaler.toString();
                    }
                }
                
                const matches = productWholesalerId === req.params.id;
                
                if (matches) {
                    console.log("✅ MATCH! Product:", item.product.name, "Wholesaler ID:", productWholesalerId);
                }
                
                return matches;
            });
            
            return hasWholesalerProduct;
        });

        console.log("✅ Filtered wholesaler orders:", wholesalerOrders.length);

        if (wholesalerOrders.length === 0) {
            console.log("⚠️ No orders found for this wholesaler");
            console.log("💡 Debug info:");
            console.log("   - Wholesaler ID we're looking for:", req.params.id);
            console.log("   - Total orders checked:", allOrders.length);
        }

        res.json(wholesalerOrders);
    } catch (err) {
        console.error("❌ Error fetching wholesaler orders:", err);
        res.status(500).json({ message: err.message });
    }
});

// POST - Create new order
router.post('/', async (req, res) => {
    try {
        let customer = req.body.customer ?? null;
        let retailer = req.body.retailer ?? null;
        let wholesaler = req.body.wholesaler ?? null;

        if (retailer) customer = null;
        if (wholesaler) customer = null;

        const items = req.body.items;
        if (!items || !items.length) {
            return res.status(400).json({ message: "Items are required" });
        }

        const pricedItems = [];
        let computedTotal = 0;

        let detectedRetailerId = null;
        let detectedWholesalerId = null;

        for (const it of items) {
            const productId = it.product;
            const qty = Number(it.quantity) || 1;

            const prod = await Product.findById(productId);
            if (!prod) return res.status(400).json({ message: "Product not found" });

            if (prod.countStock < qty)
                return res.status(400).json({ message: `Insufficient stock for ${prod.name}` });

            detectedRetailerId = prod.retailer;
            detectedWholesalerId = prod.wholesaler;

            const price = prod.price * qty;
            pricedItems.push({ product: prod._id, quantity: qty, price });
            computedTotal += price;
        }

        const orderData = {
            customer: customer,
            retailer: retailer || detectedRetailerId,
            wholesaler: wholesaler || detectedWholesalerId,
            items: pricedItems,
            totalAmount: computedTotal,
            payment: req.body.payment || { mode: "offline", status: "pending" },
            orderStatus: "placed",
            deliveryDetails: req.body.deliveryDetails
        };

        let order = await Orders.create(orderData);

        for (const it of pricedItems) {
            await Product.findByIdAndUpdate(it.product, {
                $inc: { countStock: -it.quantity }
            });
        }

        const populatedOrder = await Orders.findById(order._id)
            .populate("customer", "name email")
            .populate("retailer", "name email")
            .populate("wholesaler", "name email")
            .populate({
                path: "items.product",
                populate: [
                    { path: "category" },
                    { path: "retailer", select: "name email" },
                    { path: "wholesaler", select: "name email" }
                ]
            });

        res.status(201).json({ success: true, order: populatedOrder });

    } catch (e) {
        res.status(400).json({ success: false, message: "Order cannot be created", error: e.message });
    }
});

// GET single order by ID
router.get('/:orderId', async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.orderId)) {
        return res.status(400).json({ message: 'Invalid order id' });
    }

    const order = await Orders.findById(req.params.orderId)
        .populate("customer", "name email")
        .populate("retailer", "name email")
        .populate("wholesaler", "name email")
        .populate({
            path: "items.product",
            populate: [
                { path: "category" },
                { path: "retailer", select: "name email" },
                { path: "wholesaler", select: "name email" }
            ]
        });

    if (!order) return res.status(404).json({ message: "Order not found" });

    res.status(200).send(order);
});

// PUT - Update order
router.put('/:orderId', async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.orderId)) {
        return res.status(400).json({ message: 'Invalid order id' });
    }

    const updateData = {};

    if (req.body.orderStatus) updateData.orderStatus = req.body.orderStatus;
    if (req.body.payment) updateData.payment = req.body.payment;
    if (req.body.deliveryDetails) updateData.deliveryDetails = req.body.deliveryDetails;

    const order = await Orders.findByIdAndUpdate(req.params.orderId, updateData, { new: true });

    if (!order) {
        return res.status(404).json({ message: 'Order not found' });
    }

    res.send(order);
});

// DELETE order
router.delete('/:orderId', async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.orderId)) {
        return res.status(400).json({ message: 'Invalid order id' });
    }

    const order = await Orders.findByIdAndDelete(req.params.orderId);

    if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.status(200).json({
        success: true,
        message: 'Order deleted',
        deletedOrder: order
    });
});


router.post("/:id/route", async (req, res) => {
  try {
    const orderId = req.params.id;
    const {
      currentLocation,
      warehouseLocation,
      deliveryLocation,
      driverName,
      driverPhone,
      trackingNumber,
      estimatedTime,
      sendNotification
    } = req.body;

    const order = await Orders.findById(orderId).populate("customer");
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Save route data into order
    order.route = {
      currentLocation,
      warehouseLocation,
      deliveryLocation,
      driverName,
      driverPhone,
      trackingNumber,
      estimatedTime
    };

    await order.save();

    /* ========= SEND NOTIFICATION ========= */
    if (sendNotification?.email && order.customer?.email) {
            await axios.post("http://localhost:3000/api/v1/notifications/send", {
        customerId: order.customer._id,
        customerEmail: order.customer.email,
        trackingNumber,
        estimatedTime,
        message: `Your order has been shipped! Tracking No: ${trackingNumber}`
        });

    }

    res.json({
      success: true,
      message: "Route saved successfully",
      route: order.route
    });

  } catch (error) {
    console.error("Route Save Error:", error);
    res.status(500).json({ message: "Failed to save route" });
  }
});

module.exports = router;
