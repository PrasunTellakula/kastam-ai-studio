const mongoose = require('mongoose');

const designSchema = new mongoose.Schema({
  prompt: { type: String, default: null }, // Legacy field for older designs
  frontPrompt: { type: String, default: null },
  backPrompt: { type: String, default: null },
  shirtColor: { type: String, required: true },
  frontImageUrl: { type: String, default: null },
  backImageUrl: { type: String, default: null },
  creatorId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    default: null 
  },
  creatorName: { 
    type: String, 
    default: 'Anonymous' 
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Design', designSchema);