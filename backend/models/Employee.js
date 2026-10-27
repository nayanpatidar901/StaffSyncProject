const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  department: { type: String, required: true, trim: true },
  role: { type: String, required: true, trim: true },
  location: { type: String, default: '', trim: true },
  status: { type: String, enum: ['Active', 'On leave', 'Inactive'], default: 'Active' },
  avatarColor: { type: String, default: '#dbece1' }
}, { timestamps: true });

module.exports = mongoose.model('Employee', employeeSchema);

