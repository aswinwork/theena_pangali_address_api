const mongoose = require('mongoose');

// Mirrors the member shape the app has always used (see
// mobile/src/data/records.js). Every optional text field defaults to null
// rather than '' so the screens' "No phone on file" / "No address on file"
// fallbacks keep firing on absent data instead of rendering a blank line.
const nullableString = { type: String, trim: true, default: null };

// Relations are stored on both ends — A lists B as a spouse and B lists A.
// mobile/src/data/familyTree.js relies on that symmetry, so the client
// keeps both sides in step and persists every record it touched.
const familyTreeSchema = new mongoose.Schema(
  {
    fatherId: { type: String, default: null },
    motherId: { type: String, default: null },
    spouseIds: { type: [String], default: [] },
    childrenIds: { type: [String], default: [] },
    siblingIds: { type: [String], default: [] },
  },
  { _id: false }
);

const memberSchema = new mongoose.Schema(
  {
    // "M-001" — the app's stable key. Every familyTree reference points at
    // this, not at Mongo's _id, so it is what the API exposes as `id`.
    memberId: {
      type: String,
      required: [true, 'memberId is required'],
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    houseName: nullableString,
    generation: { type: Number, default: null },

    // Object key inside the Supabase Storage bucket. Resolved to a public
    // URL at read time in ../storage.js; never sent to the client raw.
    photo: { type: String, default: null },

    phone: nullableString,
    alternatePhone: nullableString,

    addressLine1: nullableString,
    addressLine2: nullableString,
    area: nullableString,
    city: nullableString,
    state: nullableString,
    postalCode: nullableString,
    country: { type: String, trim: true, default: 'India' },

    // Null is meaningful: it means "no tree recorded", which the Family
    // Tree screen renders differently from an empty-but-present tree.
    familyTree: { type: familyTreeSchema, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Member', memberSchema);
