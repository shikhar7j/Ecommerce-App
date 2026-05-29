const mongoose = require('mongoose');

const cartSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1,
            default: 1
        },
        price: {
            type: Number,
            required: true
        }
    }],
    totalPrice: {
        type: Number,
        required: true,
        default: 0
    },
    dateCreated: {
        type: Date,
        default: Date.now
    }
});

cartSchema.virtual('id').get(function () {
    return this._id.toHexString();
});

cartSchema.set('toJSON', {
    virtuals: true,
});

exports.Cart = mongoose.model('Cart', cartSchema);