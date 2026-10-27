const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  type: { type: String, enum: ['Annual leave', 'Sick leave', 'Personal leave', 'Parental leave'], default: 'Annual leave' },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  reason: { type: String, trim: true, default: '' },
  status: { type: String, enum: ['Pending', 'Approved', 'Declined'], default: 'Pending' },
  reviewedBy: { type: String, default: '' },
  reviewedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);

