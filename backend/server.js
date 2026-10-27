require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const Employee = require('./models/Employee');
const LeaveRequest = require('./models/LeaveRequest');
const Attendance = require('./models/Attendance');
const Announcement = require('./models/Announcement');
const Training = require('./models/Training');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// A single place for friendly API errors.
function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// Employees
app.get('/api/employees', asyncRoute(async (req, res) => {
  const filter = {};
  if (req.query.department) filter.department = req.query.department;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) filter.$or = [
    { name: { $regex: req.query.search, $options: 'i' } },
    { email: { $regex: req.query.search, $options: 'i' } },
    { department: { $regex: req.query.search, $options: 'i' } }
  ];
  res.json(await Employee.find(filter).sort({ name: 1 }));
}));
app.post('/api/employees', asyncRoute(async (req, res) => {
  const employee = await Employee.create(req.body);
  res.status(201).json(employee);
}));
app.get('/api/employees/:id', asyncRoute(async (req, res) => {
  const employee = await Employee.findById(req.params.id);
  if (!employee) return res.status(404).json({ message: 'Employee not found.' });
  res.json(employee);
}));
app.patch('/api/employees/:id', asyncRoute(async (req, res) => {
  const employee = await Employee.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!employee) return res.status(404).json({ message: 'Employee not found.' });
  res.json(employee);
}));
app.delete('/api/employees/:id', asyncRoute(async (req, res) => {
  const employee = await Employee.findByIdAndDelete(req.params.id);
  if (!employee) return res.status(404).json({ message: 'Employee not found.' });
  await LeaveRequest.deleteMany({ employee: employee._id });
  await Attendance.deleteMany({ employee: employee._id });
  res.json({ message: 'Employee and related records deleted.' });
}));

// Leave requests
app.get('/api/leaves', asyncRoute(async (req, res) => {
  const filter = req.query.status ? { status: req.query.status } : {};
  res.json(await LeaveRequest.find(filter).populate('employee', 'name email department').sort({ createdAt: -1 }));
}));
app.post('/api/leaves', asyncRoute(async (req, res) => {
  if (new Date(req.body.endDate) < new Date(req.body.startDate)) {
    return res.status(400).json({ message: 'The end date must be on or after the start date.' });
  }
  const leave = await LeaveRequest.create(req.body);
  await leave.populate('employee', 'name email department');
  res.status(201).json(leave);
}));
app.patch('/api/leaves/:id', asyncRoute(async (req, res) => {
  const { status, reviewedBy = '' } = req.body;
  if (!['Pending', 'Approved', 'Declined'].includes(status)) return res.status(400).json({ message: 'Choose Pending, Approved, or Declined.' });
  const leave = await LeaveRequest.findByIdAndUpdate(req.params.id, { status, reviewedBy, reviewedAt: new Date() }, { new: true, runValidators: true }).populate('employee', 'name email department');
  if (!leave) return res.status(404).json({ message: 'Leave request not found.' });
  res.json(leave);
}));
app.delete('/api/leaves/:id', asyncRoute(async (req, res) => {
  const leave = await LeaveRequest.findByIdAndDelete(req.params.id);
  if (!leave) return res.status(404).json({ message: 'Leave request not found.' });
  res.json({ message: 'Leave request deleted.' });
}));

// Attendance records. An employee can check in once per day; the unique index prevents duplicates.
app.get('/api/attendance', asyncRoute(async (req, res) => {
  const filter = {};
  if (req.query.date) {
    const start = new Date(`${req.query.date}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    filter.date = { $gte: start, $lt: end };
  }
  if (req.query.employee) filter.employee = req.query.employee;
  res.json(await Attendance.find(filter).populate('employee', 'name department').sort({ date: -1 }));
}));
app.get('/api/attendance/trend', asyncRoute(async (req, res) => {
  const days = Math.max(7, Math.min(31, Number.parseInt(req.query.days, 10) || 7));
  const start = new Date(); start.setUTCHours(0, 0, 0, 0); start.setUTCDate(start.getUTCDate() - (days - 1));
  const trend = await Attendance.aggregate([
    { $match: { date: { $gte: start } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: 1 }, present: { $sum: { $cond: [{ $in: ['$status', ['Present', 'Remote']] }, 1, 0] } }, remote: { $sum: { $cond: [{ $eq: ['$status', 'Remote'] }, 1, 0] } } } },
    { $sort: { _id: 1 } }
  ]);
  res.json(trend);
}));

app.post('/api/attendance/check-in', asyncRoute(async (req, res) => {
  const { employeeId, location = 'Office', status = 'Present' } = req.body;
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  const record = await Attendance.create({ employee: employeeId, date: start, checkIn: new Date(), location, status });
  await record.populate('employee', 'name department');
  res.status(201).json(record);
}));
app.patch('/api/attendance/:id/check-out', asyncRoute(async (req, res) => {
  const record = await Attendance.findByIdAndUpdate(req.params.id, { checkOut: new Date() }, { new: true }).populate('employee', 'name department');
  if (!record) return res.status(404).json({ message: 'Attendance record not found.' });
  res.json(record);
}));

// Company news
app.get('/api/announcements', asyncRoute(async (req, res) => {
  res.json(await Announcement.find().sort({ publishedAt: -1 }));
}));
app.post('/api/announcements', asyncRoute(async (req, res) => {
  res.status(201).json(await Announcement.create(req.body));
}));
app.delete('/api/announcements/:id', asyncRoute(async (req, res) => {
  const item = await Announcement.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ message: 'Announcement not found.' });
  res.json({ message: 'Announcement deleted.' });
}));

// Training and development
app.get('/api/training', asyncRoute(async (req, res) => {
  res.json(await Training.find().sort({ createdAt: -1 }));
}));
app.post('/api/training', asyncRoute(async (req, res) => {
  res.status(201).json(await Training.create(req.body));
}));
app.patch('/api/training/:id', asyncRoute(async (req, res) => {
  const course = await Training.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!course) return res.status(404).json({ message: 'Training course not found.' });
  res.json(course);
}));
app.delete('/api/training/:id', asyncRoute(async (req, res) => {
  const course = await Training.findByIdAndDelete(req.params.id);
  if (!course) return res.status(404).json({ message: 'Training course not found.' });
  res.json({ message: 'Training course deleted.' });
}));

app.use('/api', (req, res) => res.status(404).json({ message: 'API route not found.' }));
app.use((err, req, res, next) => {
  console.error(err);
  if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
  if (err.code === 11000) return res.status(409).json({ message: err.keyPattern?.employee ? 'This employee already has an attendance record today.' : 'That email is already in use.' });
  if (err.name === 'CastError') return res.status(400).json({ message: 'The provided ID or value is invalid.' });
  res.status(500).json({ message: 'Something went wrong on the server.' });
});

const port = process.env.PORT || 5000;
if (!process.env.MONGODB_URI) {
  console.error('Missing MONGODB_URI. Copy .env.example to .env and add your MongoDB Atlas connection string.');
  process.exit(1);
}
mongoose.connect(process.env.MONGODB_URI)
  .then(() => app.listen(port, '0.0.0.0', () => console.log(`StaffSync is running on port ${port}`)))
  .catch((error) => { console.error('Could not connect to MongoDB:', error.message); process.exit(1); });

