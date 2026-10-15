const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  publishCredits: { type: Number, default: 0 } // Tracks their discount money
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);