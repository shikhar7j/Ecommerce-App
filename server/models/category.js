
const mongoose= require('mongoose');

const categorySchema = mongoose.Schema({
    name:{
        type:String,
        required:true,

    },
    icon:{
        type:String,   // we added string becausse we can directly add google icon link
        default : ''
    },
    color:{
        type:String,   // we can just write color code #fffff   
        default : ''  // basically in this we can store html code
        
    }
})

exports.Category = mongoose.model('Category', categorySchema);