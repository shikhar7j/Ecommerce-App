const express = require('express');
const router = express.Router();
const { Product } = require('../models/product');
const { Category } = require('../models/category');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, and WebP images are allowed'));
    }
  }
});

// ⭐ UPLOAD ENDPOINT - MUST BE FIRST BEFORE OTHER ROUTES
router.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const imageUrl = `http://localhost:3000/uploads/${req.file.filename}`;
    res.status(200).json({ success: true, imageUrl });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ⭐ ALL STATIC/NON-PARAMETERIZED ROUTES FIRST (BEFORE :id/:productId routes)

// GET product count
router.get('/get/count', async (req, res) => {
    try {
        const productCount = await Product.countDocuments();
        res.status(200).json({ success: true, productCount });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET featured products
router.get('/get/featured', async (req, res) => {
    try {
        const count = req.query.count ? parseInt(req.query.count) : 0;

        const featuredProducts = await Product.find({ isFeatured: true })
            .populate('category')
            .populate('retailer', 'name email')
            .populate('wholesaler', 'name email')
            .limit(count);

        res.status(200).json({ success: true, products: featuredProducts });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ⭐ FIX-LOCATIONS ENDPOINT - MUST BE BEFORE :productId ROUTE
router.post('/fix-locations', async (req, res) => {
  try {
    console.log('🔧 Starting location fix for all products...');

    const locations = [
      "Delhi",
      "Mumbai",
      "Bangalore",
      "Hyderabad",
      "Chennai",
      "Kolkata",
      "Pune",
      "Jaipur",
      "Lucknow",
      "Chandigarh",
      "Ahmedabad",
      "Surat",
      "Indore",
      "Visakhapatnam",
      "Coimbatore",
      "Greater Noida",
      "Gurgaon",
      "Noida"
    ];

    // Get all products
    const allProducts = await Product.find({});
    console.log(`📦 Found ${allProducts.length} products`);

    let updated = 0;

    // Update each product with a location
    for (let i = 0; i < allProducts.length; i++) {
      const product = allProducts[i];
      const location = locations[i % locations.length];

      const result = await Product.findByIdAndUpdate(
        product._id,
        { $set: { location: location } },
        { new: true }
      );

      console.log(`✅ Updated: ${result.name} → ${location}`);
      updated++;
    }

    // Get unique locations
    const uniqueLocations = await Product.distinct('location');
    console.log('✅ All unique locations:', uniqueLocations);

    res.json({
      success: true,
      message: 'All products updated with locations',
      productsUpdated: updated,
      uniqueLocations: uniqueLocations
    });
  } catch (err) {
    console.error('❌ ERROR:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ⭐ DYNAMIC ROUTES LAST (:/productId, :id)

// GET all products
router.get('/', async (req, res) => {
    try {
        const productList = await Product.find()
            .populate('category')
            .populate('retailer', 'name email')
            .populate('wholesaler', 'name email');

        res.status(200).json({ success: true, products: productList });
    } catch (err) {
        console.error('Error fetching products:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET single product by ID
router.get('/:productId', async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.productId)) {
            return res.status(400).json({ success: false, message: 'Invalid Product ID format' });
        }

        const product = await Product.findById(req.params.productId)
            .populate('category')
            .populate('retailer', 'name email')
            .populate('wholesaler', 'name email');

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        res.status(200).json(product);
    } catch (err) {
        console.error('Error fetching product:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// CREATE product
router.post('/', async (req, res) => {
    try {
        // Find or create category
        let category = await Category.findOne({ name: req.body.category });

        if (!category) {
            category = new Category({
                name: req.body.category,
                icon: '',
                color: '',
            });
            category = await category.save();
        }

        const productData = {
            name: req.body.name,
            description: req.body.description,
            moreDescription: req.body.moreDescription,
            image: req.body.image,
            images: req.body.images || [],
            brand: req.body.brand,
            price: req.body.price,
            category: category._id,
            countStock: req.body.countStock,
            rating: req.body.rating || 0,
            isFeatured: req.body.isFeatured || false,
            dateOnCreated: req.body.dateOnCreated || new Date(),
            reviews: req.body.reviews || [],
            retailer: req.body.retailer || null,
            wholesaler: req.body.wholesaler || null,
            addedBy: req.body.addedBy || null,
            region: req.body.region || null,
            location: req.body.location
        };

        // Create the product
        let product = new Product(productData);
        product = await product.save();

        // Populate the references manually using findById
        product = await Product.findById(product._id)
            .populate('category')
            .populate('retailer', 'name email')
            .populate('wholesaler', 'name email');

        res.status(201).json({ success: true, product });
    } catch (err) {
        console.error('Error creating product:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// UPDATE product
router.put('/:id', async (req, res) => {
  try {
    console.log('🔧 UPDATE DATA RECEIVED:', req.body);
    console.log('📍 Location value:', req.body.location);

    let categoryId = req.body.category;
    
    if (req.body.category && !mongoose.isValidObjectId(req.body.category)) {
      let category = await Category.findOne({ name: req.body.category });
      if (!category) {
        category = new Category({
          name: req.body.category,
          icon: '',
          color: '',
        });
        category = await category.save();
      }
      categoryId = category._id;
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          name: req.body.name,
          price: req.body.price,
          countStock: req.body.countStock,
          category: categoryId,
          description: req.body.description,
          moreDescription: req.body.moreDescription,
          image: req.body.image,
          brand: req.body.brand,
          rating: req.body.rating,
          isFeatured: req.body.isFeatured,
          location: req.body.location,
          dateOnCreated: req.body.dateOnCreated
        }
      },
      { new: true, runValidators: false }
    )
    .populate('category')
    .populate('retailer', 'name email')
    .populate('wholesaler', 'name email');

    console.log('✅ SAVED PRODUCT:', updatedProduct);
    console.log('✅ Location saved:', updatedProduct.location);
    
    res.json(updatedProduct);
  } catch (err) {
    console.error('❌ ERROR:', err);
    res.status(500).json({ message: 'Failed to update product', error: err.message });
  }
});

// DELETE product
router.delete('/:productId', async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.productId)) {
            return res.status(400).json({ success: false, message: 'Invalid Product ID' });
        }

        const product = await Product.findByIdAndDelete(req.params.productId);

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        res.status(200).json({
            success: true,
            message: 'Product deleted successfully',
            deletedProduct: product
        });
    } catch (err) {
        console.error('Error deleting product:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;