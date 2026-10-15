const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  designId: { type: mongoose.Schema.Types.ObjectId, ref: 'Design', required: true },
  status: { type: String, default: 'pending' }, // pending, paid, printing, shipped
  stripePaymentId: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);