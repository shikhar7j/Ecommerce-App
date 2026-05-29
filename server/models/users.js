
const mongoose= require('mongoose');

const userSchema = mongoose.Schema({
    name:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    password:{
        type:String,
        select:false
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true 
    },
    photo: {
        type: String
    },
    role:{
        type:String,
        default:null,
        enum:['customer','wholesaler','retailer']
    },
    location:{
    address: String,
    city: String,
    state: String,
    pincode: String,
    coordinates: 
        {
            lat: Number,
            lng: Number,
        },
    },
    phone: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

module.exports = mongoose.model('User', userSchema);