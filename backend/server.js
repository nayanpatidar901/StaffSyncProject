require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const User = require('./models/User');
const Employee = require('./models/Employee');
const LeaveRequest = require('./models/LeaveRequest');
const Attendance = require('./models/Attendance');
const Announcement = require('./models/Announcement');
const Training = require('./models/Training');

const app = express();
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

const APP_TIME_ZONE = process.env.APP_TIME_ZONE || 'Asia/Kolkata';
function appDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
function utcStartOfDay(dateKey) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

// A single place for friendly API errors.
function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

const SESSION_COOKIE = 'staffsync_session';
const SESSION_AGE = 7 * 24 * 60 * 60 * 1000;
function createSession(user, res) {
  const token = jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
    maxAge: SESSION_AGE, path: '/'
  });
}
function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role, employeeId: user.employee?._id || user.employee };
}
function authRequired(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return res.status(401).json({ message: 'Sign in to continue.' });
  try {
    req.authUserId = jwt.verify(token, process.env.JWT_SECRET).sub;
    next();
  } catch {
    res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
    return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  }
}
app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const role = String(req.body.role || 'employee').toLowerCase();
  const registrationCode = String(req.body.registrationCode || '');
  if (name.length < 2 || name.length > 100) return res.status(400).json({ message: 'Enter a name between 2 and 100 characters.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
  if (password.length < 10 || password.length > 128) return res.status(400).json({ message: 'Use a password between 10 and 128 characters.' });
  if (!['employee', 'manager', 'hr'].includes(role)) return res.status(400).json({ message: 'Choose a valid account type.' });
  if (role !== 'employee') {
    const expectedCode = role === 'hr' ? process.env.HR_REGISTRATION_CODE : process.env.MANAGER_REGISTRATION_CODE;
    if (!expectedCode || registrationCode !== expectedCode) return res.status(403).json({ message: 'That account type requires a valid invitation code from your administrator.' });
  }
  if (await User.exists({ email })) return res.status(409).json({ message: 'An account with this email already exists.' });

  if (await Employee.exists({ email })) return res.status(409).json({ message: 'This email already has an employee record. Ask HR to help activate the account.' });
  const employee = await Employee.create({ name, email, department: 'General', role: role === 'hr' ? 'HR' : role === 'manager' ? 'Manager' : 'Employee' });
  try {
    const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12), role, employee: employee._id });
    createSession(user, res);
    res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    await Employee.findByIdAndDelete(employee._id);
    throw error;
  }
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = await User.findOne({ email }).select('+passwordHash').populate('employee', 'name department role status');
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: 'Email or password is incorrect.' });
  createSession(user, res);
  res.json({ user: publicUser(user) });
}));

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
  res.json({ message: 'Signed out.' });
});

app.get('/api/auth/me', authRequired, asyncRoute(async (req, res) => {
  const user = await User.findById(req.authUserId).populate('employee', 'name department role status');
  if (!user) return res.status(401).json({ message: 'Account no longer exists.' });
  res.json({ user: publicUser(user) });
}));

app.use('/api', authRequired);
app.use('/api', asyncRoute(async (req, res, next) => {
  req.user = await User.findById(req.authUserId).populate('employee', 'name department role status');
  if (!req.user) return res.status(401).json({ message: 'Account no longer exists.' });
  next();
}));

// Employees
app.get('/api/employees', asyncRoute(async (req, res) => {
  if (req.user.role === 'employee') {
    const employee = await Employee.findById(req.user.employee?._id);
    return res.json(employee ? [employee] : []);
  }
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
  if (req.user.role !== 'hr') return res.status(403).json({ message: 'Only HR can add employees.' });
  const employee = await Employee.create(req.body);
  res.status(201).json(employee);
}));
app.get('/api/employees/:id', asyncRoute(async (req, res) => {
  if (req.user.role === 'employee' && String(req.user.employee._id) !== req.params.id) return res.status(403).json({ message: 'You can only view your own employee record.' });
  const employee = await Employee.findById(req.params.id);
  if (!employee) return res.status(404).json({ message: 'Employee not found.' });
  res.json(employee);
}));
app.patch('/api/employees/:id', asyncRoute(async (req, res) => {
  if (req.user.role !== 'hr') return res.status(403).json({ message: 'Only HR can edit employee records.' });
  const employee = await Employee.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!employee) return res.status(404).json({ message: 'Employee not found.' });
  res.json(employee);
}));
app.delete('/api/employees/:id', asyncRoute(async (req, res) => {
  if (req.user.role !== 'hr') return res.status(403).json({ message: 'Only HR can remove employees.' });
  const employee = await Employee.findByIdAndDelete(req.params.id);
  if (!employee) return res.status(404).json({ message: 'Employee not found.' });
  await User.deleteMany({ employee: employee._id });
  await LeaveRequest.deleteMany({ employee: employee._id });
  await Attendance.deleteMany({ employee: employee._id });
  res.json({ message: 'Employee and related records deleted.' });
}));

// Leave requests
app.get('/api/leaves', asyncRoute(async (req, res) => {
  const filter = req.user.role === 'employee' ? { employee: req.user.employee._id } : (req.query.status ? { status: req.query.status } : {});
  res.json(await LeaveRequest.find(filter).populate('employee', 'name email department').sort({ createdAt: -1 }));
}));
app.post('/api/leaves', asyncRoute(async (req, res) => {
  if (req.user.role === 'employee') req.body.employee = req.user.employee._id;
  if (new Date(req.body.endDate) < new Date(req.body.startDate)) {
    return res.status(400).json({ message: 'The end date must be on or after the start date.' });
  }
  const leave = await LeaveRequest.create(req.body);
  await leave.populate('employee', 'name email department');
  res.status(201).json(leave);
}));
app.patch('/api/leaves/:id', asyncRoute(async (req, res) => {
  if (!['hr', 'manager'].includes(req.user.role)) return res.status(403).json({ message: 'Only HR or managers can review leave requests.' });
  const { status, reviewedBy = '' } = req.body;
  if (!['Pending', 'Approved', 'Declined'].includes(status)) return res.status(400).json({ message: 'Choose Pending, Approved, or Declined.' });
  const leave = await LeaveRequest.findByIdAndUpdate(req.params.id, { status, reviewedBy, reviewedAt: new Date() }, { new: true, runValidators: true }).populate('employee', 'name email department');
  if (!leave) return res.status(404).json({ message: 'Leave request not found.' });
  res.json(leave);
}));
app.delete('/api/leaves/:id', asyncRoute(async (req, res) => {
  if (req.user.role !== 'hr') return res.status(403).json({ message: 'Only HR can remove leave requests.' });
  const leave = await LeaveRequest.findByIdAndDelete(req.params.id);
  if (!leave) return res.status(404).json({ message: 'Leave request not found.' });
  res.json({ message: 'Leave request deleted.' });
}));

// Attendance records. An employee can check in once per day; the unique index prevents duplicates.
app.get('/api/attendance', asyncRoute(async (req, res) => {
  const filter = req.user.role === 'employee' ? { employee: req.user.employee._id } : {};
  if (req.query.date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(req.query.date)) return res.status(400).json({ message: 'Date must use YYYY-MM-DD format.' });
    const start = utcStartOfDay(req.query.date);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    filter.date = { $gte: start, $lt: end };
  }
  if (req.query.employee && req.user.role !== 'employee') filter.employee = req.query.employee;
  res.json(await Attendance.find(filter).populate('employee', 'name department').sort({ date: -1 }));
}));
app.get('/api/attendance/trend', asyncRoute(async (req, res) => {
  if (req.user.role === 'employee') return res.json(await Attendance.aggregate([
    { $match: { employee: req.user.employee._id, date: { $gte: (() => { const d = utcStartOfDay(appDateKey()); d.setUTCDate(d.getUTCDate() - 30); return d; })() } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: 1 }, present: { $sum: { $cond: [{ $in: ['$status', ['Present', 'Remote']] }, 1, 0] } }, remote: { $sum: { $cond: [{ $eq: ['$status', 'Remote'] }, 1, 0] } } } },
    { $sort: { _id: 1 } }
  ]));
  const days = Math.max(7, Math.min(31, Number.parseInt(req.query.days, 10) || 7));
  const start = utcStartOfDay(appDateKey()); start.setUTCDate(start.getUTCDate() - (days - 1));
  const trend = await Attendance.aggregate([
    { $match: { date: { $gte: start } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: 1 }, present: { $sum: { $cond: [{ $in: ['$status', ['Present', 'Remote']] }, 1, 0] } }, remote: { $sum: { $cond: [{ $eq: ['$status', 'Remote'] }, 1, 0] } } } },
    { $sort: { _id: 1 } }
  ]);
  res.json(trend);
}));

app.post('/api/attendance/check-in', asyncRoute(async (req, res) => {
  const { location = 'Office', status = 'Present' } = req.body;
  const employeeId = req.user.role === 'employee' ? req.user.employee._id : req.body.employeeId;
  if (!employeeId) return res.status(400).json({ message: 'Select an employee to check in.' });
  const start = utcStartOfDay(appDateKey());
  const record = await Attendance.create({ employee: employeeId, date: start, checkIn: new Date(), location, status });
  await record.populate('employee', 'name department');
  res.status(201).json(record);
}));
app.patch('/api/attendance/:id/check-out', asyncRoute(async (req, res) => {
  if (req.user.role === 'employee') {
    const existing = await Attendance.findById(req.params.id);
    if (!existing || String(existing.employee) !== String(req.user.employee._id)) return res.status(403).json({ message: 'You can only check out your own attendance.' });
  }
  const record = await Attendance.findByIdAndUpdate(req.params.id, { checkOut: new Date() }, { new: true }).populate('employee', 'name department');
  if (!record) return res.status(404).json({ message: 'Attendance record not found.' });
  res.json(record);
}));

// Company news
app.get('/api/announcements', asyncRoute(async (req, res) => {
  res.json(await Announcement.find().sort({ publishedAt: -1 }));
}));
app.post('/api/announcements', asyncRoute(async (req, res) => {
  if (req.user.role !== 'hr') return res.status(403).json({ message: 'Only HR can publish announcements.' });
  res.status(201).json(await Announcement.create(req.body));
}));
app.delete('/api/announcements/:id', asyncRoute(async (req, res) => {
  if (req.user.role !== 'hr') return res.status(403).json({ message: 'Only HR can remove announcements.' });
  const item = await Announcement.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ message: 'Announcement not found.' });
  res.json({ message: 'Announcement deleted.' });
}));

// Training and development
app.get('/api/training', asyncRoute(async (req, res) => {
  res.json(await Training.find().sort({ createdAt: -1 }));
}));
app.post('/api/training', asyncRoute(async (req, res) => {
  if (!['hr', 'manager'].includes(req.user.role)) return res.status(403).json({ message: 'Only HR or managers can create training programs.' });
  res.status(201).json(await Training.create(req.body));
}));
app.patch('/api/training/:id', asyncRoute(async (req, res) => {
  if (!['hr', 'manager'].includes(req.user.role)) return res.status(403).json({ message: 'Only HR or managers can update training programs.' });
  const course = await Training.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!course) return res.status(404).json({ message: 'Training course not found.' });
  res.json(course);
}));
app.delete('/api/training/:id', asyncRoute(async (req, res) => {
  if (!['hr', 'manager'].includes(req.user.role)) return res.status(403).json({ message: 'Only HR or managers can remove training programs.' });
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
if (!process.env.MONGODB_URI || !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('Set MONGODB_URI and a JWT_SECRET with at least 32 characters as private environment variables before starting StaffSync.');
  process.exit(1);
}
mongoose.connect(process.env.MONGODB_URI)
  .then(() => app.listen(port, '0.0.0.0', () => console.log(`StaffSync is running on port ${port}`)))
  .catch((error) => { console.error('Could not connect to MongoDB:', error.message); process.exit(1); });
