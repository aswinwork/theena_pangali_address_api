const express = require('express');
const User = require('../models/User');
const { upload } = require('../middleware/upload');
const { uploadImage, deleteImage, publicImageUrl } = require('../storage');

const router = express.Router();

// Resolve the stored Supabase object key into a URL the app can load.
function toPublicUser(userDoc) {
  const user = userDoc.toObject();
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    address: user.address,
    imageUrl: publicImageUrl(user.imagePath),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// GET /api/users - list all users, newest first
router.get('/', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users.map((u) => toPublicUser(u)));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users', details: err.message });
  }
});

// GET /api/users/:id - fetch a single user
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(toPublicUser(user));
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
      imagePath: req.file ? await uploadImage(req.file) : null,
    });

    await user.save();
    res.status(201).json(toPublicUser(user));
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
      const previousPath = user.imagePath;
      user.imagePath = await uploadImage(req.file);
      await deleteImage(previousPath);
    }

    await user.save();
    res.json(toPublicUser(user));
  } catch (err) {
    res.status(400).json({ error: 'Failed to update user', details: err.message });
  }
});

// DELETE /api/users/:id - delete a user and its stored image object
router.delete('/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await deleteImage(user.imagePath);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete user', details: err.message });
  }
});

module.exports = router;
