const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  body: { type: String, required: true, trim: true },
  audience: { type: String, default: 'Everyone', trim: true },
  author: { type: String, default: 'People & Culture', trim: true },
  publishedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Announcement', announcementSchema);

