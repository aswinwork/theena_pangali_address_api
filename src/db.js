const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error(
      'Missing MONGODB_URI. Copy backend/.env.example to backend/.env and set your MongoDB Atlas connection string.'
    );
    process.exit(1);
  }

  try {
    // Without an explicit dbName, a URI with no "/<db>" path silently lands
    // in Atlas's default "test" database.
    const dbName = process.env.MONGODB_DB || 'theena_address';
    await mongoose.connect(uri, { dbName });
    console.log(`Connected to MongoDB (${dbName})`);
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
