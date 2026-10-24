# SchoolSphere ERP

A full-stack school management system built with React + Vite, Node.js, Express, MongoDB, Socket.IO and JWT.

## Included modules
- Role-based access: Admin, Teacher, Student, Parent
- Registration without mandatory email OTP
- Email verification from profile and OTP-based password reset (SMTP configured through `.env`)
- Student/teacher management, attendance, marks, notes, timetable
- Admission enquiries, fee records, announcements, notifications
- Live Socket.IO chat and instant dashboard events
- Audit/activity logs
- Responsive UI with motion effects and dashboard navigation

## Requirements
- Node.js 20+
- MongoDB local instance or MongoDB Atlas
- Optional SMTP credentials for email verification and password reset

## Setup
### 1. Backend
```bash
cd server
copy .env.example .env
npm install
npm run dev
```
Edit `server/.env` and set `MONGO_URI`, `JWT_SECRET`, and SMTP values if email features are needed.

### 2. Frontend
Open another terminal:
```bash
cd client
npm install
npm run dev
```
Open the Vite URL shown in the terminal. The frontend proxies `/api` and `/socket.io` to `http://localhost:5000`.

## First admin
Register a user, then promote that account to admin directly in MongoDB for initial setup:
```js
db.users.updateOne({ email: "you@example.com" }, { $set: { role: "admin" } })
```
Never expose an unrestricted public admin-registration route.

## Email behaviour
Registration works without OTP. Email verification is available in Profile and password reset sends an OTP when SMTP is configured. Without SMTP settings, the server logs a development OTP in the terminal; do not use that mode in production.

## Important production checklist
- Set a long random JWT secret and secure SMTP credentials.
- Use HTTPS, restrict CORS, configure rate limiting and backups.
- Configure production frontend/backend URLs.
- Use a real payment gateway before accepting online payments. Fee entries here are administrative records, not a payment processor.
- This is a runnable project scaffold; validate workflows against your institution's rules before production use.
