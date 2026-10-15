const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// Increase timeout for AI generation routes (HuggingFace cold starts can take 30s+)
app.use('/api/design', (req, res, next) => {
  req.setTimeout(180000); // 3 minutes
  res.setTimeout(180000);
  next();
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Database Connected Successfully'))
  .catch((err) => console.log('❌ Database Connection Failed:', err));

// Import Routes
const authRoutes = require('./routes/auth');
const designRoutes = require('./routes/design'); // <-- NEW

app.use('/api/auth', authRoutes);
app.use('/api/design', designRoutes); // <-- NEW

// A simple test route
app.get('/', (req, res) => {
  res.send('AI Apparel API is running!');
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});