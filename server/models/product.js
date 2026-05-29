const mongoose= require('mongoose'); // To store data in database 



const productSchema= mongoose.Schema({  //Creating schema for product (definign struc)
    name:{
        type:String,
        required:true
    },
    description:{
        type:String,
        default : ''
    },
    moreDescription:{
        type:String,
        default : ''
    },
    image:{
        type:String,
        default : ''
    },
    images :{            // this is added for having mulltiple images like in amazon
        type:[String],
        default : []
    },
    brand :{
        type:String,
        default:''
    },
    price:{
        type:Number,
        required:true,
        default:0
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',  // Category schema se link hoga
        required: true
    },
    countStock:{
        type:Number,
        required: true,
        min:0,
        max:1000
    },
    rating:{
        type:Number,
        default:0
    },
    isFeatured : {
        type: Boolean,
        default: false
    },
    dateOnCreated:{
        type:Date,
        default: Date.now
    },
    reviews: {
        type: [ 
            {
            user: { type: String },
            rating: { type: Number },
            comment: { type: String }
            }
        ],
        default: []
    },
    addedBy: {
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    region: {
    city: String,
    state: String,
    },
    retailer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
    },
    wholesaler: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    }, location: {           // ← ADD THIS
    type: String,
    required: false
  },

})

exports.Product= mongoose.model('Product', productSchema); // this is model for interacting with scheme