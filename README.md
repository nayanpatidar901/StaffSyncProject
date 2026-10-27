# StaffSync

StaffSync is a web-based HR dashboard starter for a small organization. It brings employee records, leave requests, attendance, company announcements, and training into one place.

The project uses the **MERN stack**:

- **MongoDB** stores employees, leave requests, attendance, announcements, and training.
- **Express.js** provides the API used by the website.
- **React** is the UI library in the MERN stack; the current dashboard is plain HTML, CSS, and JavaScript while the project is being built out.
- **Node.js** runs the Express server.

## Current project status

The Express API and MongoDB models are ready. The dashboard's leave request list loads from the API and approve/decline actions update MongoDB. The other dashboard sections still show example interface data; they are not yet connected to the API. Login, employee/manager/HR permissions, and production hosting have not been added.

Use sample data while learning. Do not put real employee information on a public deployment until authentication and permissions are implemented.

## Project files

```text
StaffSyncproject/
├── backend/
│   ├── models/          # MongoDB document shapes (Mongoose)
│   ├── seed.js          # Adds example data to empty collections
│   └── server.js        # Express API and web server
├── public/
│   └── index.html       # StaffSync dashboard
├── .env.example         # Safe example of required settings
├── .gitignore           # Excludes .env and node_modules from Git
├── package.json         # Dependencies and run commands
└── README.md
```

## Run StaffSync locally

### 1. Install Node.js

Install the current LTS version of Node.js from [nodejs.org](https://nodejs.org/). This also installs npm. Open a new PowerShell window after the installation.

### 2. Create a free MongoDB Atlas database

StaffSync connects to MongoDB Atlas using the Mongoose library. You do not need a MongoDB app plugin to run the website.

1. Create a MongoDB Atlas account and a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas/database).
2. In Atlas, open **Database Access** and create a database user. This user is separate from your Atlas website login. Save its password privately.
3. Open **Network Access** and add your current IP address so your computer can connect.
4. In the cluster, choose **Connect → Drivers → Node.js** and copy the connection string.
5. Replace `<password>` in the connection string with your database user's password. If the password includes special characters such as `@` or `/`, URL-encode them. Add `/staffsync` before the `?` so the database is named `staffsync`.

The final connection string will look similar to this, with your own values:

```text
mongodb+srv://myUser:myEncodedPassword@cluster-name.mongodb.net/staffsync?retryWrites=true&w=majority
```

### 3. Create your local environment file

In PowerShell, go to the folder containing this README and run:

```powershell
Copy-Item .env.example .env
```

Open `.env` in your code editor. Replace the example `MONGODB_URI` with your Atlas connection string and save it. Keep this file private. `.gitignore` prevents `.env` from being uploaded to GitHub; never paste the real connection string into the README or a public chat.

### 4. Install, add sample data, and start the app

Run these commands from the project folder:

```powershell
npm install
npm run seed
npm run dev
```

Now open <http://localhost:5000> in your browser. Leave the PowerShell window running while you use the site. Stop the server with **Ctrl+C**.

`npm run seed` adds example employees, leave requests, announcements, and training only when each collection is empty. It does not erase or replace existing records. You can skip this step if you prefer to start with an empty database.

To start without the auto-restart development helper, use `npm start` instead of `npm run dev`.

## Check the database connection

Open <http://localhost:5000/api/health>. A successful connection returns:

```json
{"ok":true,"database":"connected"}
```

If the server says `Missing MONGODB_URI`, create the `.env` file and check its connection string. If Atlas reports a network error, check that your current IP address is allowed in Atlas **Network Access**.

## Use the API

The API sends and receives JSON. You can visit `GET` links in a browser. For requests that create or edit data (`POST`, `PATCH`, or `DELETE`), use PowerShell, Postman, or the Thunder Client extension in VS Code.

| What | Method and URL |
| --- | --- |
| Check server/database | `GET /api/health` |
| List employees | `GET /api/employees` |
| Search employees | `GET /api/employees?search=Priya` |
| Filter employees | `GET /api/employees?department=Design` |
| Add employee | `POST /api/employees` |
| Get/edit/delete one employee | `GET`, `PATCH`, or `DELETE /api/employees/EMPLOYEE_ID` |
| List leave requests | `GET /api/leaves` |
| List pending leave requests | `GET /api/leaves?status=Pending` |
| Create a leave request | `POST /api/leaves` |
| Approve or decline a leave request | `PATCH /api/leaves/LEAVE_ID` |
| List attendance | `GET /api/attendance` |
| Check in | `POST /api/attendance/check-in` |
| Check out | `PATCH /api/attendance/ATTENDANCE_ID/check-out` |
| List/create/delete announcements | `GET`, `POST /api/announcements`, `DELETE /api/announcements/ANNOUNCEMENT_ID` |
| List/create/edit/delete training | `GET`, `POST /api/training`, `PATCH /api/training/TRAINING_ID`, `DELETE /api/training/TRAINING_ID` |

Replace `EMPLOYEE_ID`, `LEAVE_ID`, and similar values with the `_id` returned by MongoDB. For example, first list employees at <http://localhost:5000/api/employees> and copy the `_id` of the employee you want.

### Example: add an employee in PowerShell

```powershell
$employee = @{
  name = "Taylor Reed"
  email = "taylor@example.com"
  department = "Design"
  role = "Product Designer"
  location = "Bengaluru"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri http://localhost:5000/api/employees `
  -ContentType "application/json" `
  -Body $employee
```

### Example: create a leave request

Use an employee `_id` from `GET /api/employees`:

```powershell
$leave = @{
  employee = "PASTE_EMPLOYEE_ID_HERE"
  type = "Annual leave"
  startDate = "2026-12-10"
  endDate = "2026-12-12"
  reason = "Family trip"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri http://localhost:5000/api/leaves `
  -ContentType "application/json" `
  -Body $leave
```

The employee ID must exist in the database. A leave end date cannot be earlier than its start date. To approve it, send a `PATCH` request to `/api/leaves/LEAVE_ID` with JSON like `{"status":"Approved","reviewedBy":"Jordan Davis"}`. Use `"Declined"` to decline it.

## MongoDB collections

Mongoose creates these collections when records are first saved:

- `employees` — name, email, department, role, location, and status.
- `leaverequests` — employee reference, leave type, dates, reason, and approval status.
- `attendances` — employee reference, date, check-in/out times, location, and status.
- `announcements` — title, message, audience, author, and publish date.
- `trainings` — course title, category, module count, learner count, and progress.

## Put the project on GitHub

GitHub stores the code. MongoDB Atlas stores the app's data. The GitHub plugin is not required for local development. This project is connected to the GitHub repository `nayanpatidar901/StaffSyncProject`. If you are setting up a separate copy of the project folder, configure its Git remote to point to your repository before pushing.

For a fresh copy with no remote, run the following in PowerShell and replace the URL with your repository's HTTPS URL:

```powershell
git add .
git commit -m "Add StaffSync MongoDB backend"
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin master
```

If your local branch is named `main`, use `main` in the final command instead of `master`. GitHub should receive `.env.example`, but must not receive `.env`.

## Next steps

For a production HR system, add user registration and login, secure passwords, and enforce HR/manager/employee permissions on the server before connecting these API records to the rest of the dashboard. Then deploy the server and frontend and set the `MONGODB_URI` as a private environment variable in the hosting provider.

