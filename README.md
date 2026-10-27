# StaffSync

A web-based HR demo for employee records, leave requests, attendance, announcements, and training.

- **Live demo:** https://staffsync-icdg.onrender.com
- **GitHub:** https://github.com/nayanpatidar901/StaffSyncProject

## Features

- Browse and manage employees
- Submit and review leave requests
- Record attendance and export reports
- Manage training paths and announcements
- View live dashboard metrics from MongoDB

## Tech

Node.js, Express, MongoDB Atlas, HTML, CSS, and JavaScript.

## Run locally

You need Node.js and a MongoDB Atlas database.

```powershell
git clone https://github.com/nayanpatidar901/StaffSyncProject.git
cd StaffSyncProject
npm install
Copy-Item .env.example .env
```

Add your private Atlas connection string to `.env`, then run:

```powershell
npm run seed
npm run dev
```

Open http://localhost:5000. Seeding only adds sample data to empty collections.

## Demo safety

This public demo has no sign-in or role-based access controls. Its API is open, so use synthetic data only—never real employee or payroll information.
