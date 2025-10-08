const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const User = require('../models/User');
const Notification = require('../models/Notification');
const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Helper function to check if string is a valid ObjectId
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// Search users by username or display name
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    console.log('Search query:', query); // Debug log
    const searchRegex = new RegExp(query, 'i'); // Case-insensitive search
    
    const users = await User.find({
      $or: [
        { username: searchRegex },
        { displayName: searchRegex }
      ]
    }).select('username displayName avatar bio followers following').limit(20);
    
    console.log('Found users:', users.length); // Debug log
    res.json(users);
  } catch (err) {
    console.error('Search error:', err); // Debug log
    res.status(400).json({ error: err.message });
  }
});

// Follow a user
router.post('/:id/follow', async (req, res) => {
  try {
    const { followerId } = req.body;
    const userId = req.params.id;
    
    if (!followerId) {
      return res.status(400).json({ error: 'Follower ID is required' });
    }
    
    // Add to user's following list
    await User.findByIdAndUpdate(followerId, {
      $addToSet: { following: userId }
    });
    
    // Add to target user's followers list
    await User.findByIdAndUpdate(userId, {
      $addToSet: { followers: followerId }
    });
    
    // Create notification for the user being followed
    await Notification.create({
      user: userId,
      from: followerId,
      type: 'follow'
    });
    
    res.json({ message: 'Successfully followed user' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Unfollow a user
router.post('/:id/unfollow', async (req, res) => {
  try {
    const { followerId } = req.body;
    const userId = req.params.id;
    
    if (!followerId) {
      return res.status(400).json({ error: 'Follower ID is required' });
    }
    
    // Remove from user's following list
    await User.findByIdAndUpdate(followerId, {
      $pull: { following: userId }
    });
    
    // Remove from target user's followers list
    await User.findByIdAndUpdate(userId, {
      $pull: { followers: followerId }
    });
    
    res.json({ message: 'Successfully unfollowed user' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    let user;
    if (isValidObjectId(req.params.id)) {
      // If it's a valid ObjectId, search by _id
      user = await User.findById(req.params.id);
    } else {
      // If it's not a valid ObjectId, search by username
      user = await User.findOne({ username: req.params.id });
    }
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { displayName, username, email, bio, website, phone, gender } = req.body;
    const updateData = {};
    
    if (displayName !== undefined) updateData.displayName = displayName;
    if (username !== undefined) updateData.username = username;
    if (email !== undefined) updateData.email = email;
    if (bio !== undefined) updateData.bio = bio;
    if (website !== undefined) updateData.website = website;
    if (phone !== undefined) updateData.phone = phone;
    if (gender !== undefined) updateData.gender = gender;
    
    let user;
    if (isValidObjectId(req.params.id)) {
      // If it's a valid ObjectId, update by _id
      user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true });
    } else {
      // If it's not a valid ObjectId, update by username
      user = await User.findOneAndUpdate({ username: req.params.id }, updateData, { new: true });
    }
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update user avatar
router.put('/:id/avatar', upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No avatar file provided' });
    }
    
    let user;
    if (isValidObjectId(req.params.id)) {
      user = await User.findByIdAndUpdate(
        req.params.id, 
        { avatar: req.file.path }, 
        { new: true }
      );
    } else {
      user = await User.findOneAndUpdate(
        { username: req.params.id }, 
        { avatar: req.file.path }, 
        { new: true }
      );
    }
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
