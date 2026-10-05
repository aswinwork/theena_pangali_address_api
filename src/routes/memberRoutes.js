const express = require('express');
const Member = require('../models/Member');
const { upload } = require('../middleware/upload');
const { uploadImage, deleteImage, publicImageUrl } = require('../storage');

const router = express.Router();

// The app keys everything off the "M-001" style id, so that is what goes
// out as `id`; Mongo's _id never leaves the server. `photo` goes out as a
// ready-to-load URL rather than the bucket key it is stored as.
function toPublicMember(doc) {
  const m = doc.toObject();
  return {
    id: m.memberId,
    memberId: m.memberId,
    name: m.name,
    houseName: m.houseName,
    generation: m.generation,
    photo: publicImageUrl(m.photo),
    phone: m.phone,
    alternatePhone: m.alternatePhone,
    addressLine1: m.addressLine1,
    addressLine2: m.addressLine2,
    area: m.area,
    city: m.city,
    state: m.state,
    postalCode: m.postalCode,
    country: m.country,
    familyTree: m.familyTree,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

// Multipart sends everything as strings, so "" / "null" have to come back
// as real nulls and the numeric and object fields need parsing.
function clean(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === '' || trimmed === 'null' ? null : trimmed;
}

function parseGeneration(value) {
  const cleaned = clean(value);
  if (cleaned == null) return null;
  const n = parseInt(cleaned, 10);
  return Number.isFinite(n) ? n : null;
}

// Multipart delivers the tree as a JSON string, a JSON body delivers it
// already parsed — the object case has to be caught before clean(), which
// would otherwise stringify it to "[object Object]".
function parseFamilyTree(value) {
  let ft = value;
  if (ft !== null && typeof ft === 'object') {
    // already parsed
  } else {
    const cleaned = clean(ft);
    if (cleaned == null) return null;
    ft = JSON.parse(cleaned);
  }
  return {
    fatherId: ft.fatherId || null,
    motherId: ft.motherId || null,
    spouseIds: Array.isArray(ft.spouseIds) ? ft.spouseIds : [],
    childrenIds: Array.isArray(ft.childrenIds) ? ft.childrenIds : [],
    siblingIds: Array.isArray(ft.siblingIds) ? ft.siblingIds : [],
  };
}

const TEXT_FIELDS = [
  'name', 'houseName', 'phone', 'alternatePhone',
  'addressLine1', 'addressLine2', 'area', 'city', 'state', 'postalCode', 'country',
];

// Only copies fields the request actually sent, so a PUT that touches one
// field cannot blank out the rest.
function applyFields(member, body) {
  TEXT_FIELDS.forEach((field) => {
    if (body[field] !== undefined) member[field] = clean(body[field]);
  });
  if (body.generation !== undefined) member.generation = parseGeneration(body.generation);
  if (body.familyTree !== undefined) member.familyTree = parseFamilyTree(body.familyTree);
}

// The photo is deliberately never set from a client-supplied string: the
// client either uploads a new file, asks for removal, or says nothing and
// the stored object is left alone. That keeps the bucket key server-owned
// and avoids any URL-to-key round-tripping.
async function applyPhoto(member, req) {
  if (req.file) {
    const previous = member.photo;
    member.photo = await uploadImage(req.file);
    await deleteImage(previous);
    return;
  }
  if (String(req.body.removePhoto) === 'true' && member.photo) {
    await deleteImage(member.photo);
    member.photo = null;
  }
}

// GET /api/members - the whole directory, oldest member id first so the
// list order is stable across reloads.
router.get('/', async (req, res) => {
  try {
    const members = await Member.find().sort({ memberId: 1 });
    res.json(members.map(toPublicMember));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch members', details: err.message });
  }
});

// GET /api/members/:memberId
router.get('/:memberId', async (req, res) => {
  try {
    const member = await Member.findOne({ memberId: req.params.memberId });
    if (!member) return res.status(404).json({ error: 'Member not found' });
    res.json(toPublicMember(member));
  } catch (err) {
    res.status(400).json({ error: 'Failed to fetch member', details: err.message });
  }
});

// POST /api/members - create one; photo is optional, multipart field "photo"
router.post('/', upload.single('photo'), async (req, res) => {
  try {
    const memberId = clean(req.body.memberId);
    if (!memberId) return res.status(400).json({ error: 'memberId is required' });
    if (!clean(req.body.name)) return res.status(400).json({ error: 'name is required' });

    const existing = await Member.findOne({ memberId });
    if (existing) return res.status(409).json({ error: `Member ${memberId} already exists` });

    const member = new Member({ memberId, name: clean(req.body.name) });
    applyFields(member, req.body);
    await applyPhoto(member, req);

    await member.save();
    res.status(201).json(toPublicMember(member));
  } catch (err) {
    res.status(400).json({ error: 'Failed to create member', details: err.message });
  }
});

// PUT /api/members/:memberId - update in place, optionally replacing the photo
router.put('/:memberId', upload.single('photo'), async (req, res) => {
  try {
    const member = await Member.findOne({ memberId: req.params.memberId });
    if (!member) return res.status(404).json({ error: 'Member not found' });

    applyFields(member, req.body);
    await applyPhoto(member, req);

    await member.save();
    res.json(toPublicMember(member));
  } catch (err) {
    res.status(400).json({ error: 'Failed to update member', details: err.message });
  }
});

// DELETE /api/members/:memberId - drop the member, its photo, and every
// inbound relation, so the tree can never render a dangling reference.
router.delete('/:memberId', async (req, res) => {
  try {
    const id = req.params.memberId;
    const member = await Member.findOneAndDelete({ memberId: id });
    if (!member) return res.status(404).json({ error: 'Member not found' });

    await deleteImage(member.photo);

    await Member.updateMany(
      { 'familyTree.fatherId': id },
      { $set: { 'familyTree.fatherId': null } }
    );
    await Member.updateMany(
      { 'familyTree.motherId': id },
      { $set: { 'familyTree.motherId': null } }
    );
    // Scoped to members that actually have a tree: several records store
    // familyTree as null, and $pull cannot traverse into null.
    await Member.updateMany({ familyTree: { $ne: null } }, {
      $pull: {
        'familyTree.spouseIds': id,
        'familyTree.childrenIds': id,
        'familyTree.siblingIds': id,
      },
    });

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete member', details: err.message });
  }
});

module.exports = router;
