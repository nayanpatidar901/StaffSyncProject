const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  date: { type: Date, required: true },
  checkIn: { type: Date, default: null },
  checkOut: { type: Date, default: null },
  location: { type: String, default: 'Office', trim: true },
  status: { type: String, enum: ['Present', 'Remote', 'On leave', 'Absent'], default: 'Present' }
}, { timestamps: true });

attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });
module.exports = mongoose.model('Attendance', attendanceSchema);

