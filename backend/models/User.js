const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['employee', 'manager', 'hr'], default: 'employee', required: true },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
