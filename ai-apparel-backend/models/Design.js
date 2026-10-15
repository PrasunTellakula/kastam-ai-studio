const mongoose = require('mongoose');

const designSchema = new mongoose.Schema({
  prompt: { 
    type: String, 
    required: true 
  },
  shirtColor: { 
    type: String, 
    required: true 
  },
  frontImageUrl: { 
    type: String, 
    default: null 
  },
  backImageUrl: { 
    type: String, 
    default: null 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('Design', designSchema);