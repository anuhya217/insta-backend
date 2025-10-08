const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const User = require('../models/User');
const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

router.post('/signup', upload.single('avatar'), async (req, res) => {
  try {
    const { username, email, password, bio } = req.body;
    const avatar = req.file ? req.file.path : '';
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword, avatar, bio });
    await user.save();
    res.status(201).json({ user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/signin', async (req, res) => {
  try {
    console.log('Login request body:', req.body); // Debug log
    const { email, password } = req.body;
    // Try to find user by email or username
    const user = await User.findOne({
      $or: [
        { email },
        { username: email }
      ]
    });
    if (!user) return res.status(400).json({ error: 'User not found' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'fallback_secret_key', { expiresIn: '1d' });
    res.json({ token, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
