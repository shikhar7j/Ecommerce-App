const express = require('express');
const router = express.Router();
const { Cart } = require('../models/cart');
const { Product } = require('../models/product');
const mongoose = require('mongoose');

router.get('/:userId', async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.userId)) {
            return res.status(400).json({ message: 'Invalid user ID' });
        }

        let cart = await Cart.findOne({ user: req.params.userId })
            .populate({
                path: 'items.product',
                populate: { path: 'category' }
            });

        if (!cart) {
            cart = new Cart({
                user: req.params.userId,
                items: [],
                totalPrice: 0
            });
            await cart.save();
        }

        const validItems = cart.items.filter(item => item.product != null);
        
        const totalPrice = validItems.reduce((sum, item) => 
            sum + (item.price * item.quantity), 0
        );

        cart.items = validItems;
        cart.totalPrice = totalPrice;

        if (validItems.length !== cart.items.length) {
            await cart.save();
        }

        res.status(200).json(cart);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/:userId/add', async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.userId)) {
            return res.status(400).json({ message: 'Invalid user ID' });
        }

        const { productId, quantity } = req.body;

        if (!productId || !quantity) {
            return res.status(400).json({ message: 'Product ID and quantity are required' });
        }

        if (!mongoose.isValidObjectId(productId)) {
            return res.status(400).json({ message: 'Invalid product ID' });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        if (product.countStock < quantity) {
            return res.status(400).json({ 
                message: `Only ${product.countStock} items available in stock` 
            });
        }

        let cart = await Cart.findOne({ user: req.params.userId });

        if (!cart) {
            cart = new Cart({
                user: req.params.userId,
                items: [],
                totalPrice: 0
            });
        }

        const existingItemIndex = cart.items.findIndex(
            item => item.product && item.product.toString() === productId
        );

        if (existingItemIndex > -1) {
            const newQuantity = cart.items[existingItemIndex].quantity + quantity;
            
            if (newQuantity > product.countStock) {
                return res.status(400).json({ 
                    message: `Cannot add more. Only ${product.countStock} items available` 
                });
            }

            cart.items[existingItemIndex].quantity = newQuantity;
        } else {
            cart.items.push({
                product: productId,
                quantity: quantity,
                price: product.price
            });
        }

        cart.totalPrice = cart.items.reduce((sum, item) => 
            sum + (item.price * item.quantity), 0
        );

        await cart.save();

        const populatedCart = await Cart.findById(cart._id)
            .populate({
                path: 'items.product',
                populate: { path: 'category' }
            });

        res.status(200).json(populatedCart);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put('/:userId/update/:itemId', async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.userId)) {
            return res.status(400).json({ message: 'Invalid user ID' });
        }

        const { quantity } = req.body;

        if (!quantity || quantity < 1) {
            return res.status(400).json({ message: 'Quantity must be at least 1' });
        }

        const cart = await Cart.findOne({ user: req.params.userId })
            .populate('items.product');

        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        const itemIndex = cart.items.findIndex(
            item => item._id.toString() === req.params.itemId
        );

        if (itemIndex === -1) {
            return res.status(404).json({ message: 'Item not found in cart' });
        }

        const product = cart.items[itemIndex].product;
        
        if (product && quantity > product.countStock) {
            return res.status(400).json({ 
                message: `Only ${product.countStock} items available` 
            });
        }

        cart.items[itemIndex].quantity = quantity;

        cart.totalPrice = cart.items.reduce((sum, item) => 
            sum + (item.price * item.quantity), 0
        );

        await cart.save();

        const populatedCart = await Cart.findById(cart._id)
            .populate({
                path: 'items.product',
                populate: { path: 'category' }
            });

        res.status(200).json(populatedCart);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.delete('/:userId/remove/:itemId', async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.userId)) {
            return res.status(400).json({ message: 'Invalid user ID' });
        }

        const cart = await Cart.findOne({ user: req.params.userId });

        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        cart.items = cart.items.filter(
            item => item._id.toString() !== req.params.itemId
        );

        cart.totalPrice = cart.items.reduce((sum, item) => 
            sum + (item.price * item.quantity), 0
        );

        await cart.save();

        const populatedCart = await Cart.findById(cart._id)
            .populate({
                path: 'items.product',
                populate: { path: 'category' }
            });

        res.status(200).json(populatedCart);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.delete('/:userId/clear', async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.userId)) {
            return res.status(400).json({ message: 'Invalid user ID' });
        }

        const cart = await Cart.findOne({ user: req.params.userId });

        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        cart.items = [];
        cart.totalPrice = 0;
        await cart.save();

        res.status(200).json(cart);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;