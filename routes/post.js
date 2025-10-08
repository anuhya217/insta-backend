const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const Post = require('../models/Post');
const User = require('../models/User');
const Notification = require('../models/Notification');


const router = express.Router();

// ==========================
// MULTER STORAGE SETUP
// ==========================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image and video files are allowed!'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

// ==========================
// CREATE POST
// ==========================
router.post('/', upload.single('photo'), async (req, res) => {
  try {
    let { user, caption, location, postType = 'photo' } = req.body;

    if (!user) throw new Error('User ID is required');
    if (!mongoose.Types.ObjectId.isValid(user)) throw new Error('Invalid User ID');

    user = new mongoose.Types.ObjectId(user);
    const filePath = req.file ? req.file.path : '';

    const postData = { user, caption, location, postType };
    if (req.file) {
      if (req.file.mimetype.startsWith('video/')) {
        postData.video = filePath;
        postData.postType = 'reel';
      } else {
        postData.photo = filePath;
        postData.postType = 'photo';
      }
    }

    const post = new Post(postData);
    await post.save();

    console.log(`✅ Post created by user ${user}`);
    res.status(201).json(post);
  } catch (err) {
    console.error('❌ Create post error:', err);
    res.status(400).json({ error: err.message });
  }
});

// ==========================
// GET ALL POSTS
// ==========================
router.get('/', async (req, res) => {
  try {
    const posts = await Post.find()
      .populate('user')
      .populate('comments.user', 'username')
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    console.error('Error fetching posts:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================
// GET USER POSTS
// ==========================
router.get('/user/:userId', async (req, res) => {
  try {
    const posts = await Post.find({ user: req.params.userId })
      .populate('user')
      .populate('comments.user', 'username')
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================
// GET SAVED POSTS
// ==========================
router.get('/saved/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).populate('savedPosts');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const savedPosts = await Post.find({ _id: { $in: user.savedPosts } })
      .populate('user')
      .populate('comments.user', 'username')
      .sort({ createdAt: -1 });

    res.json(savedPosts);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================
// DELETE POST
// ==========================
router.delete('/:id', async (req, res) => {
  try {
    const post = await Post.findByIdAndDelete(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json({ message: 'Post deleted successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================
// SAVE / UNSAVE POST
// ==========================
router.post('/:id/save', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    const postId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(postId))
      return res.status(400).json({ error: 'Invalid post ID' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.savedPosts.includes(postId)) {
      user.savedPosts.push(postId);
      await user.save();
    }

    res.json({ message: 'Post saved successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id/save', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    const postId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(postId))
      return res.status(400).json({ error: 'Invalid post ID' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.savedPosts = user.savedPosts.filter((id) => id.toString() !== postId);
    await user.save();

    res.json({ message: 'Post unsaved successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================
// COMMENT ON POST
// ==========================
router.post('/:id/comment', async (req, res) => {
  try {
    const { userId, text } = req.body;
    if (!userId || !text)
      return res.status(400).json({ error: 'User ID and comment text are required' });

    const postId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(postId))
      return res.status(400).json({ error: 'Invalid post ID' });

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const comment = { user: new mongoose.Types.ObjectId(userId), text: text.trim() };
    post.comments.push(comment);
    await post.save();

    // ✅ Create comment notification
    if (post.user.toString() !== userId) {
      await Notification.create({
        user: post.user,
        from: userId,
        type: 'comment',
        post: postId,
      });
      console.log(`🔔 Notification: User ${userId} commented on post ${postId}`);
    }

    await post.populate('comments.user', 'username');
    const newComment = post.comments[post.comments.length - 1];

    res.json({ message: 'Comment added successfully', comment: newComment });
  } catch (err) {
    console.error('Comment error:', err);
    res.status(400).json({ error: err.message });
  }
});

// ==========================
// LIKE / UNLIKE POST
// ==========================
router.post('/:id/like', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    const postId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(postId))
      return res.status(400).json({ error: 'Invalid post ID' });

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    if (!post.likes.includes(userId)) {
      post.likes.push(new mongoose.Types.ObjectId(userId));
      await post.save();

      // ✅ Create like notification
      if (post.user.toString() !== userId) {
        await Notification.create({
          user: post.user,
          from: userId,
          type: 'like',
          post: postId,
        });
        console.log(`🔔 Notification: User ${userId} liked post ${postId}`);
      }
    }

    res.json({ message: 'Post liked successfully', likesCount: post.likes.length });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id/like', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    const postId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(postId))
      return res.status(400).json({ error: 'Invalid post ID' });

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    post.likes = post.likes.filter((id) => id.toString() !== userId);
    await post.save();

    res.json({ message: 'Post unliked successfully', likesCount: post.likes.length });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
