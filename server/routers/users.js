const express  = require('express');
const router = express.Router();
const {User}= require('../models/users');
const bcrypt = require("bcryptjs");
const mongoose = require('mongoose');

router.get('/', async(req,res)=>{
    const userList = await User.find().select('-password');
    if(!userList){
        res.status(500).json({success: false});
    }
    res.send(userList);

})

router.get('/:userId', async (req, res) => {
  
  if (!mongoose.isValidObjectId(req.params.userId)) {
    return res.status(400).json({ message: 'Invalid user id' });
  }
  const user = await User.findById(req.params.userId).select('-password'); 
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  return res.status(200).send(user);
});



router.delete('/:userId', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.userId)) {
    return res.status(400).json({ message: 'Invalid user id' });
  }
  try {
    const user = await User.findByIdAndDelete(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.status(200).json({ success: true, message: 'User deleted', deletedUser: user });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});


router.post('/register', async (req, res) => { 
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    let user = new User({
      name: req.body.name,
      email: req.body.email,
      password: hashedPassword, 
      role: req.body.role,
      location: req.body.location,
      phone: req.body.phone
    });

    user = await user.save();
    res.status(201).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


router.post('/login', async (req, res) => {       
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');
  if (!user) return res.status(400).json({ message: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(400).json({ message: 'Invalid credentials' });

  res.json({ success: true, user: { _id: user._id, name: user.name, email: user.email, role: user.role } });
});

module.exports= router;