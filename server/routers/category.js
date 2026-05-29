const express  = require('express');
const router = express.Router();
const {Category} = require('../models/category');

router.get('/', async(req,res)=>{
    const categoryList = await Category.find();
    if(!categoryList){
        res.status(500).json({success: false});
    }
    res.status(200).send(categoryList);
})

router.get('/:categoryId', async(req,res)=>{
    const category = await Category.findById(req.params.categoryId);
    if(!category){
        return res.status(404).json({         // Since express cannot send 2 request we added return
            message:'Category not found of that id',
        })
    }
    res.status(200).send(category);       //  This is for getting category by id from database so it will be usefull foor frontend to fetch one specific category by its ID 
});                 //This is not optimal because if someone write a wrong id the app will crash



router.post('/', async(req,res)=>{
    let category = new Category({
        name:req.body.name,
        icon:req.body.icon,
        color:req.body.color
    })
    category = await category.save() // waiting until save 

    if(!category){
        return res.status(404).send('the category cannot be created');
    }

    res.send(category);
})

router.put('/:categoryId', async(req,res)=>{
    const category = await Category.findByIdAndUpdate(
        req.params.categoryId,
        {
            name: req.body.name,
            icon: req.body.icon,
            color: req.body.color
        },
        {
            new:true // this will return the updated category, if not this then the previous category is returned by default
        }
    )

    if(!category){
        return res.status(404).send('the category cannot be updated');
    }
    res.send(category);
});


//Url will change to below one 
//api/v1/id of category
router.delete('/:categoryId', async(req,res)=>{                                    // this is for deleteing the category 
   try{ 
    let category = await Category.findByIdAndDelete(req.params.categoryId);
    if(!category){
        return res.status(404).json({ success: false, message: 'Category not found' });
    }
    res.status(200).json({
        success:true,
        message: 'the category is deleted',
        deletedCategory: category     // this is done instead of res.send(category); because express only allows one response per request so we cant use res.send and res.status so instead we send response in one JSON object wihtout using different calls
    });      
}
catch(err){
    res.status(500).json({success:false, error: err.message});
}
});

module.exports= router;