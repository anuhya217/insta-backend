const express = require('express');
const Notification = require('../models/Notification');
const router = express.Router();

// Fallback mock notifications
const mockNotifications = [
  {
    _id: '1',
    type: 'like',
    read: false,
    createdAt: new Date(),
    from: { username: 'ajad', displayName: 'Ajad Ahmed', avatar: '/images/anu1.jpg' },
    post: { photo: '/images/anu1.jpg', caption: 'Happie bday Anuhya 🎂 #beach #sunset' },
  },
  {
    _id: '2',
    type: 'comment',
    read: false,
    createdAt: new Date(),
    from: { username: 'suha', displayName: 'Suharika', avatar: '/images/anu2.jpg' },
    post: { photo: '/images/anu2.jpg', caption: 'Trio 😎 #friends' },
  },
  {
    _id: '3',
    type: 'follow',
    read: true,
    createdAt: new Date(),
    from: { username: 'anu', displayName: 'Anuhya', avatar: '/images/anu3.jpg' },
  },
  {
    _id: '4',
    type: 'message',
    read: false,
    createdAt: new Date(),
    from: { username: 'gt', displayName: 'Tharun GT', avatar: '/images/anu4.jpg' },
  },
  {
    _id: '5',
    type: 'like',
    read: true,
    createdAt: new Date(),
    from: { username: 'divya', displayName: 'Divya', avatar: '/images/anu9.jpg' },
    post: { photo: '/images/anu9.jpg', caption: 'Having fun! 🎉 #batch' },
  },
];

// ==============================
// Get all notifications for a user
// ==============================
router.get('/:userId', async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.params.userId })
      .populate('from', 'username displayName avatar')
      .populate('post', 'photo caption')
      .sort({ createdAt: -1 });

    // If no notifications exist in DB, return mock data
    if (!notifications.length) {
      return res.json(mockNotifications);
    }

    res.json(notifications);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==============================
// Create a notification
// ==============================
router.post('/', async (req, res) => {
  try {
    const { user, from, type, post, comment } = req.body;

    if (user === from) {
      return res.json({ message: 'No self-notification created' });
    }

    const notification = new Notification({ user, from, type, post, comment });
    await notification.save();

    res.json(notification);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
