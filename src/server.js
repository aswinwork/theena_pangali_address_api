require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./db');
const userRoutes = require('./routes/userRoutes');
const memberRoutes = require('./routes/memberRoutes');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'user-directory-backend' });
});

app.use('/api/members', memberRoutes);

// Superseded by /api/members; kept so the old User Directory screens in
// mobile/src/screens/UserListScreen.js still have something to talk to.
app.use('/api/users', userRoutes);

// Multer / generic error handler (keeps error responses as JSON)
app.use((err, req, res, next) => {
  if (err) {
    console.error(err);
    return res.status(400).json({ error: err.message || 'Unexpected error' });
  }
  next();
});

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`User directory API running on http://localhost:${PORT}`);
  });
});
