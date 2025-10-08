const express = require('express');
const mongoose = require('mongoose');
const Message = require('../models/Message');
const User = require('../models/User');
const Notification = require('../models/Notification');
const router = express.Router();

// Send a message
router.post('/', async (req, res) => {
  try {
    const { sender, receiver, text } = req.body;
    
    if (!sender || !receiver || !text) {
      return res.status(400).json({ error: 'Sender, receiver, and text are required' });
    }

    const message = new Message({ sender, receiver, text });
    await message.save();
    
    // Populate sender and receiver details
    await message.populate('sender', 'username displayName avatar');
    await message.populate('receiver', 'username displayName avatar');
    
    // Create notification for the receiver
    try {
      const notification = new Notification({
        user: receiver,
        from: sender,
        type: 'message',
        text: `New message from ${message.sender.username}`
      });
      await notification.save();
    } catch (notificationError) {
      console.error('Error creating message notification:', notificationError);
    }
    
    res.status(201).json(message);
  } catch (err) {
    console.error('Error creating message:', err);
    res.status(400).json({ error: err.message });
  }
});

// Get conversations for a user (list of users they've messaged with)
router.get('/conversations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get all unique users that the current user has messaged with
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { sender: new mongoose.Types.ObjectId(userId) },
            { receiver: new mongoose.Types.ObjectId(userId) }
          ]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sender', new mongoose.Types.ObjectId(userId)] },
              '$receiver',
              '$sender'
            ]
          },
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$receiver', new mongoose.Types.ObjectId(userId)] },
                    { $eq: ['$read', false] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          user: {
            _id: '$user._id',
            username: '$user.username',
            displayName: '$user.displayName',
            avatar: '$user.avatar'
          },
          lastMessage: {
            _id: '$lastMessage._id',
            text: '$lastMessage.text',
            createdAt: '$lastMessage.createdAt',
            read: '$lastMessage.read'
          },
          unreadCount: 1
        }
      },
      {
        $sort: { 'lastMessage.createdAt': -1 }
      }
    ]);

    res.json(conversations);
  } catch (err) {
    console.error('Error fetching conversations:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get messages between two users
router.get('/:userId/:otherUserId', async (req, res) => {
  try {
    const { userId, otherUserId } = req.params;
    
    const messages = await Message.find({
      $or: [
        { sender: userId, receiver: otherUserId },
        { sender: otherUserId, receiver: userId }
      ]
    })
    .populate('sender', 'username displayName avatar')
    .populate('receiver', 'username displayName avatar')
    .sort({ createdAt: 1 });

    // Mark messages as read where current user is the receiver
    await Message.updateMany(
      { sender: otherUserId, receiver: userId, read: false },
      { read: true }
    );

    res.json(messages);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: err.message });
  }
});

// Mark messages as read
router.put('/read/:userId/:otherUserId', async (req, res) => {
  try {
    const { userId, otherUserId } = req.params;
    
    await Message.updateMany(
      { sender: otherUserId, receiver: userId, read: false },
      { read: true }
    );

    res.json({ message: 'Messages marked as read' });
  } catch (err) {
    console.error('Error marking messages as read:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get unread message count for a user
router.get('/unread-count/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const count = await Message.countDocuments({
      receiver: userId,
      read: false
    });

    res.json({ count });
  } catch (err) {
    console.error('Error fetching unread count:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
