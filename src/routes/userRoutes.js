const express = require('express');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const { upload, uploadsDir } = require('../middleware/upload');

const router = express.Router();

// Build a full, absolute image URL from the stored relative path.
function toPublicUser(userDoc, req) {
  const user = userDoc.toObject();
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    address: user.address,
    imageUrl: user.imagePath ? `${baseUrl}${user.imagePath}` : null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function deleteFileIfExists(imagePath) {
  if (!imagePath) return;
  const filename = path.basename(imagePath);
  const fullPath = path.join(uploadsDir, filename);
  fs.unlink(fullPath, (err) => {
    if (err && err.code !== 'ENOENT') {
      console.error('Failed to delete image file:', fullPath, err.message);
    }
  });
}

// GET /api/users - list all users, newest first
router.get('/', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users.map((u) => toPublicUser(u, req)));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users', details: err.message });
  }
});

// GET /api/users/:id - fetch a single user
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(toPublicUser(user, req));
  } catch (err) {
    res.status(400).json({ error: 'Invalid user id', details: err.message });
  }
});

// POST /api/users - create a user, optionally with an image (multipart field "image")
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { name, email, phone, address } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'name and email are required' });
    }

    const user = new User({
      name,
      email,
      phone,
      address,
      imagePath: req.file ? `/uploads/${req.file.filename}` : null,
    });

    await user.save();
    res.status(201).json(toPublicUser(user, req));
  } catch (err) {
    res.status(400).json({ error: 'Failed to create user', details: err.message });
  }
});

// PUT /api/users/:id - update a user, optionally replacing the image
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { name, email, phone, address } = req.body;
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;

    if (req.file) {
      deleteFileIfExists(user.imagePath);
      user.imagePath = `/uploads/${req.file.filename}`;
    }

    await user.save();
    res.json(toPublicUser(user, req));
  } catch (err) {
    res.status(400).json({ error: 'Failed to update user', details: err.message });
  }
});

// DELETE /api/users/:id - delete a user and its image file
router.delete('/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    deleteFileIfExists(user.imagePath);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete user', details: err.message });
  }
});

module.exports = router;
