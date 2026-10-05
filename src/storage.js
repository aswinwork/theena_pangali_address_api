const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Photos live in a public Supabase Storage bucket rather than on the
// local filesystem: Render wipes a free instance's disk on every deploy
// and every restart, so anything written to ./uploads is gone within a
// day. Supabase keeps the object and serves it straight from its CDN.
const BUCKET = process.env.SUPABASE_BUCKET || 'theena_pangali_address';

const url = process.env.SUPABASE_URL;
// The secret key bypasses RLS, which is what lets this server write to
// the bucket without a signed-in user. It must stay server-side only.
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !secretKey) {
  console.error(
    'Missing SUPABASE_URL or SUPABASE_SECRET_KEY. Copy backend/.env.example to backend/.env and fill them in.'
  );
  process.exit(1);
}

const supabase = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Uploads a multer in-memory file and returns the object's key inside the
// bucket (e.g. "1693-4213.jpg"). That key is what we persist on the user
// document; the browsable URL is derived from it at read time.
async function uploadImage(file) {
  const ext = path.extname(file.originalname) || '.jpg';
  const key = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(key, file.buffer, {
    contentType: file.mimetype,
    upsert: false,
  });

  if (error) {
    throw new Error(`Image upload failed: ${error.message}`);
  }

  return key;
}

// Legacy rows still hold "/uploads/<file>" from the disk-based version.
// Those files did not survive the move, so they resolve to null instead
// of a URL that would 404 on the phone.
function publicImageUrl(imagePath) {
  if (!imagePath || imagePath.startsWith('/uploads/')) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(imagePath).data.publicUrl;
}

async function deleteImage(imagePath) {
  if (!imagePath || imagePath.startsWith('/uploads/')) return;

  const { error } = await supabase.storage.from(BUCKET).remove([imagePath]);
  if (error) {
    // A failed cleanup should not fail the user's request; the row is
    // already gone and the orphan is just wasted bucket space.
    console.error('Failed to delete image object:', imagePath, error.message);
  }
}

module.exports = { uploadImage, deleteImage, publicImageUrl, BUCKET };
