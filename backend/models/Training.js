const mongoose = require('mongoose');

const trainingSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  modules: { type: Number, min: 1, default: 1 },
  learners: { type: Number, min: 0, default: 0 },
  progress: { type: Number, min: 0, max: 100, default: 0 },
  status: { type: String, enum: ['In progress', 'Upcoming', 'Completed'], default: 'Upcoming' }
}, { timestamps: true });

module.exports = mongoose.model('Training', trainingSchema);

