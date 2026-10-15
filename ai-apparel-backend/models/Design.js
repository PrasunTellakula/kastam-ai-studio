const mongoose = require('mongoose');

const designSchema = new mongoose.Schema({
  creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  aiPrompt: { type: String, required: true },
  rawAiImageUrl: { type: String, required: true },
  finalPrintUrl: { type: String }, // Filled after we add the watermark
  isPublished: { type: Boolean, default: false },
  basePrice: { type: Number, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Design', designSchema);