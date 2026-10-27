require('dotenv').config();
const mongoose = require('mongoose');
const Employee = require('./models/Employee');
const LeaveRequest = require('./models/LeaveRequest');
const Announcement = require('./models/Announcement');
const Training = require('./models/Training');

async function seed() {
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in your .env file first.');
  await mongoose.connect(process.env.MONGODB_URI);

  // This command only adds starter records to empty collections. It never clears your data.
  let employees = await Employee.find().sort({ createdAt: 1 });
  if (employees.length === 0) {
    employees = await Employee.insertMany([
      { name: 'Priya Sharma', email: 'priya@northstar.co', department: 'Product', role: 'Product Designer', location: 'Bengaluru' },
      { name: 'Alex Morgan', email: 'alex@northstar.co', department: 'Engineering', role: 'Software Engineer', location: 'London' },
      { name: 'Sarah Kim', email: 'sarah@northstar.co', department: 'Design', role: 'Design Lead', location: 'New York' },
      { name: 'Rohan Mehta', email: 'rohan@northstar.co', department: 'People & Culture', role: 'HR Manager', location: 'Mumbai' },
      { name: 'Jamie Lee', email: 'jamie@northstar.co', department: 'Marketing', role: 'Content Strategist', location: 'Singapore' }
    ]);
    console.log('Added 5 example employees.');
  } else console.log(`Employees already exist (${employees.length}); skipped.`);

  if (await LeaveRequest.countDocuments() === 0) {
    const dates = (start, end) => ({ startDate: new Date(start), endDate: new Date(end) });
    await LeaveRequest.insertMany([
      { employee: employees[2]._id, type: 'Annual leave', ...dates('2026-10-30', '2026-11-03'), reason: 'Family vacation' },
      { employee: employees[1]._id, type: 'Sick leave', ...dates('2026-10-29', '2026-10-29'), reason: 'Medical appointment' },
      { employee: employees[0]._id, type: 'Annual leave', ...dates('2026-11-02', '2026-11-06'), reason: 'Personal time' },
      { employee: employees[4]._id, type: 'Personal leave', ...dates('2026-11-04', '2026-11-04'), reason: 'Personal matters' }
    ]);
    console.log('Added 4 example leave requests.');
  } else console.log('Leave requests already exist; skipped.');

  if (await Announcement.countDocuments() === 0) {
    await Announcement.insertMany([
      { title: 'Diwali celebration at the studio', body: 'Join us this Friday for an afternoon of lights, food, and good company. Festive attire encouraged!', author: 'People & Culture' },
      { title: 'October all-hands: recording available', body: 'Catch up on the product roadmap, Q4 priorities, and team Q&A.', author: 'Leadership' }
    ]);
    console.log('Added 2 example announcements.');
  } else console.log('Announcements already exist; skipped.');

  if (await Training.countDocuments() === 0) {
    await Training.insertMany([
      { title: 'Design systems: from foundation to scale', category: 'Design', modules: 6, learners: 32, progress: 68, status: 'In progress' },
      { title: 'Leadership essentials for new managers', category: 'Leadership', modules: 8, learners: 24, progress: 42, status: 'In progress' },
      { title: 'Modern JavaScript & React patterns', category: 'Engineering', modules: 10, learners: 48, progress: 79, status: 'In progress' }
    ]);
    console.log('Added 3 example training courses.');
  } else console.log('Training courses already exist; skipped.');

  await mongoose.disconnect();
  console.log('Done. Restart the app and refresh the dashboard.');
}

seed().catch(async (error) => {
  console.error('Seed failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

