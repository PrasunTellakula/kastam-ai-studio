const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

// Request Logger (Observability for incoming API calls)
app.use((req, res, next) => {
  console.log(`📡 [${req.method}] ${req.originalUrl}`);
  next();
});

// Timeout extension for AI generation routes
app.use('/api/design', (req, res, next) => {
  req.setTimeout(180000); // 3 minutes
  res.setTimeout(180000);
  next();
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Database Connected Successfully'))
  .catch((err) => console.log('❌ Database Connection Failed:', err));

// Import Feature Routers
const authRoutes = require('./routes/auth');
const designRoutes = require('./routes/design'); 

app.use('/api/auth', authRoutes);
app.use('/api/design', designRoutes); 

// Health check route
app.get('/', (req, res) => {
  res.send('AI Apparel API is running!');
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});