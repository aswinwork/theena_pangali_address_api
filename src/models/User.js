const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    // Object key inside the Supabase Storage bucket, e.g.
    // "16903456-847291043.jpg". The public URL is derived at read-time
    // in ../storage.js. Rows created before the move to Supabase still
    // hold a "/uploads/..." disk path; those resolve to a null imageUrl.
    imagePath: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
