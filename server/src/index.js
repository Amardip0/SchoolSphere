import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { createServer } from "http";
import rateLimit from "express-rate-limit";
import { User, Attendance, Mark, Note, Timetable, Admission, Fee, Announcement, ChatMessage, Activity, Notification } from "./models.js";
import { auth, allow, audit } from "./middleware.js";
import { makeOtp, otpHash, sendOtp } from "./mailer.js";

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: process.env.CLIENT_URL || "http://localhost:5173", methods: ["GET", "POST", "PATCH", "DELETE"] } });
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 60 }));
app.get("/api/health", (_, res) => res.json({ status: "ok", service: "SchoolSphere API" }));

const safeUser = u => ({ id: u._id, name: u.name, email: u.email, role: u.role, emailVerified: u.emailVerified, className: u.className, section: u.section, phone: u.phone });
const tokenFor = u => jwt.sign({ id: u._id, role: u.role }, process.env.JWT_SECRET, { expiresIn: "7d" });

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name?.trim() || !email || !password) return res.status(400).json({ message: "Name, email and password are required." });
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters." });
    if (role && role !== "student") return res.status(403).json({ message: "Public registration creates student accounts only. Ask an administrator for staff/parent access." });
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ message: "An account with this email already exists." });
    const user = await User.create({ name: name.trim(), email: email.toLowerCase(), password: await bcrypt.hash(password, 12), role: "student" });
    res.status(201).json({ token: tokenFor(user), user: safeUser(user), message: "Account created. You can verify your email later from Profile." });
  } catch (e) { res.status(500).json({ message: "Registration failed.", error: e.code === 11000 ? "Email already exists." : undefined }); }
});

app.post("/api/auth/login", async (req, res) => {
  const user = await User.findOne({ email: String(req.body.email || "").toLowerCase() });
  if (!user || !(await bcrypt.compare(req.body.password || "", user.password))) return res.status(401).json({ message: "Incorrect email or password." });
  res.json({ token: tokenFor(user), user: safeUser(user) });
});
app.get("/api/auth/me", auth, (req, res) => res.json({ user: safeUser(req.user) }));

app.post("/api/auth/email-otp", auth, async (req, res) => {
  const otp = makeOtp();
  req.user.emailOtpHash = otpHash(otp); req.user.emailOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
  await req.user.save(); await sendOtp(req.user.email, otp, "Email verification");
  res.json({ message: "If email delivery is configured, a verification code has been sent." });
});
app.post("/api/auth/verify-email", auth, async (req, res) => {
  const u = await User.findById(req.user._id);
  if (!u.emailOtpHash || u.emailOtpExpires < new Date() || u.emailOtpHash !== otpHash(String(req.body.otp || ""))) return res.status(400).json({ message: "Invalid or expired code." });
  u.emailVerified = true; u.emailOtpHash = undefined; u.emailOtpExpires = undefined; await u.save();
  res.json({ message: "Email verified successfully.", user: safeUser(u) });
});
app.post("/api/auth/forgot-password", async (req, res) => {
  const email = String(req.body.email || "").toLowerCase();
  const u = await User.findOne({ email });
  if (u) { const otp = makeOtp(); u.resetOtpHash = otpHash(otp); u.resetOtpExpires = new Date(Date.now() + 10 * 60 * 1000); await u.save(); await sendOtp(email, otp, "Password reset"); }
  res.json({ message: "If an account exists, a reset code has been sent." });
});
app.post("/api/auth/reset-password", async (req, res) => {
  const u = await User.findOne({ email: String(req.body.email || "").toLowerCase() });
  if (!u || !u.resetOtpHash || u.resetOtpExpires < new Date() || u.resetOtpHash !== otpHash(String(req.body.otp || ""))) return res.status(400).json({ message: "Invalid or expired code." });
  if (!req.body.password || req.body.password.length < 8) return res.status(400).json({ message: "New password must be at least 8 characters." });
  u.password = await bcrypt.hash(req.body.password, 12); u.resetOtpHash = undefined; u.resetOtpExpires = undefined; await u.save();
  res.json({ message: "Password reset successfully. You can sign in now." });
});

app.get("/api/users", auth, allow("admin"), async (req, res) => {
  const filter = req.query.role ? { role: req.query.role } : {};
  res.json((await User.find(filter).select("-password -emailOtpHash -resetOtpHash").sort({ createdAt: -1 }).limit(500)).map(safeUser));
});
app.post("/api/users", auth, allow("admin"), async (req, res) => {
  const { name, email, password, role, className, section, phone } = req.body;
  if (!name || !email || !password || !["admin","teacher","student","parent"].includes(role)) return res.status(400).json({ message: "Name, email, password and valid role are required." });
  const user = await User.create({ name, email: email.toLowerCase(), password: await bcrypt.hash(password, 12), role, className, section, phone });
  await audit(req, "created", "user", `${role}: ${email}`); io.emit("data:changed", { type: "user" });
  res.status(201).json({ user: safeUser(user) });
});
app.patch("/api/users/:id", auth, allow("admin"), async (req, res) => {
  const allowed = ["name","role","phone","className","section","admissionNo"];
  const update = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  const user = await User.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).select("-password");
  if (!user) return res.status(404).json({ message: "User not found." });
  await audit(req, "updated", "user", user.email); io.emit("data:changed", { type: "user" }); res.json({ user: safeUser(user) });
});
app.delete("/api/users/:id", auth, allow("admin"), async (req, res) => {
  if (String(req.user._id) === req.params.id) return res.status(400).json({ message: "You cannot delete your own account." });
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found." });
  await audit(req, "deleted", "user", user.email); io.emit("data:changed", { type: "user" }); res.json({ message: "User deleted." });
});

app.get("/api/dashboard", auth, async (req, res) => {
  const role = req.user.role;
  const [students, teachers, admissions, notes, timetable, announcements, fees, attendanceToday] = await Promise.all([
    User.countDocuments({ role: "student" }), User.countDocuments({ role: "teacher" }),
    Admission.countDocuments({ status: "new" }), Note.countDocuments(),
    Timetable.countDocuments(), Announcement.find().sort({ createdAt: -1 }).limit(5),
    Fee.countDocuments({ status: "due" }), Attendance.countDocuments({ date: new Date().toISOString().slice(0,10), status: "present" })
  ]);
  res.json({ stats: { students, teachers, newAdmissions: admissions, notes, timetableEntries: timetable, feesDue: fees, presentToday: attendanceToday }, announcements, role });
});

app.get("/api/attendance", auth, async (req, res) => {
  const filter = {};
  if (req.user.role === "student") filter.student = req.user._id;
  if (req.query.date) filter.date = req.query.date;
  if (req.query.student) filter.student = req.query.student;
  res.json(await Attendance.find(filter).populate("student", "name email className").sort({ date: -1 }).limit(500));
});
app.post("/api/attendance", auth, allow("admin","teacher"), async (req, res) => {
  const { student, date, status, note } = req.body;
  if (!student || !date || !["present","absent","late","leave"].includes(status)) return res.status(400).json({ message: "Student, date and valid status are required." });
  const record = await Attendance.findOneAndUpdate({ student, date }, { student, date, status, note, markedBy: req.user._id }, { upsert: true, new: true, runValidators: true });
  await audit(req, "marked", "attendance", `${student} · ${date} · ${status}`);
  io.emit("data:changed", { type: "attendance", student, date }); res.json(record);
});

app.get("/api/marks", auth, async (req, res) => {
  const filter = {};
  if (req.user.role === "student") { filter.student = req.user._id; filter.published = true; }
  if (req.query.student && req.user.role !== "student") filter.student = req.query.student;
  res.json(await Mark.find(filter).populate("student", "name className").sort({ createdAt: -1 }).limit(500));
});
app.post("/api/marks", auth, allow("admin","teacher"), async (req, res) => {
  const { student, subject, exam, score, maxScore, published } = req.body;
  if (!student || !subject || !exam || !Number.isFinite(Number(score)) || !Number.isFinite(Number(maxScore)) || Number(maxScore) <= 0 || Number(score) < 0 || Number(score) > Number(maxScore)) return res.status(400).json({ message: "Enter valid student, subject, exam and marks." });
  const mark = await Mark.create({ student, subject, exam, score: Number(score), maxScore: Number(maxScore), published: !!published, enteredBy: req.user._id });
  await audit(req, "created", "mark", `${subject} · ${score}/${maxScore}`); io.emit("data:changed", { type: "marks", student }); res.status(201).json(mark);
});

app.get("/api/notes", auth, async (req, res) => {
  const filter = req.user.role === "student" ? { $or: [{ className: req.user.className }, { className: "" }, { className: { $exists: false } }] } : {};
  res.json(await Note.find(filter).sort({ createdAt: -1 }).limit(300));
});
app.post("/api/notes", auth, allow("admin","teacher"), async (req, res) => {
  if (!req.body.title || !req.body.body) return res.status(400).json({ message: "Title and note content are required." });
  const note = await Note.create({ ...req.body, createdBy: req.user._id }); await audit(req, "created", "note", note.title);
  io.emit("data:changed", { type: "notes" }); res.status(201).json(note);
});
app.get("/api/timetable", auth, async (req, res) => {
  const filter = req.user.role === "student" ? { className: req.user.className } : {};
  if (req.query.className) filter.className = req.query.className;
  res.json(await Timetable.find(filter).populate("teacher", "name").sort({ day: 1, startTime: 1 }).limit(500));
});
app.post("/api/timetable", auth, allow("admin"), async (req, res) => {
  const { className, day, startTime, endTime, subject } = req.body;
  if (!className || !day || !startTime || !endTime || !subject) return res.status(400).json({ message: "Class, day, times and subject are required." });
  const item = await Timetable.create(req.body); await audit(req, "created", "timetable", `${className} ${day} ${subject}`);
  io.emit("data:changed", { type: "timetable" }); res.status(201).json(item);
});

app.get("/api/admissions", auth, allow("admin"), async (_, res) => res.json(await Admission.find().sort({ createdAt: -1 }).limit(500)));
app.post("/api/admissions", async (req, res) => {
  const { studentName, parentName, email, phone, applyingClass } = req.body;
  if (!studentName || !phone) return res.status(400).json({ message: "Student name and contact phone are required." });
  const item = await Admission.create({ studentName, parentName, email, phone, applyingClass });
  io.emit("data:changed", { type: "admission" }); res.status(201).json({ message: "Admission enquiry submitted.", admission: item });
});
app.patch("/api/admissions/:id", auth, allow("admin"), async (req, res) => {
  const item = await Admission.findByIdAndUpdate(req.params.id, { status: req.body.status, notes: req.body.notes }, { new: true, runValidators: true });
  if (!item) return res.status(404).json({ message: "Admission not found." });
  await audit(req, "updated", "admission", `${item.studentName}: ${item.status}`); io.emit("data:changed", { type: "admission" }); res.json(item);
});

app.get("/api/fees", auth, async (req, res) => {
  const filter = req.user.role === "student" ? { student: req.user._id } : {};
  if (req.query.student && req.user.role === "admin") filter.student = req.query.student;
  res.json(await Fee.find(filter).populate("student", "name className").sort({ createdAt: -1 }).limit(500));
});
app.post("/api/fees", auth, allow("admin"), async (req, res) => {
  if (!req.body.student || !req.body.title || !Number.isFinite(Number(req.body.amount)) || Number(req.body.amount) < 0) return res.status(400).json({ message: "Student, fee title and valid amount are required." });
  const fee = await Fee.create({ ...req.body, amount: Number(req.body.amount), recordedBy: req.user._id });
  await audit(req, "created", "fee", `${fee.title} · ₹${fee.amount}`); io.emit("data:changed", { type: "fees" }); res.status(201).json(fee);
});
app.patch("/api/fees/:id", auth, allow("admin"), async (req, res) => {
  if (!["due","paid","partial"].includes(req.body.status)) return res.status(400).json({ message: "Invalid fee status." });
  const fee = await Fee.findByIdAndUpdate(req.params.id, { status: req.body.status, receiptNo: req.body.receiptNo }, { new: true });
  if (!fee) return res.status(404).json({ message: "Fee record not found." });
  await audit(req, "updated", "fee", `${fee.title}: ${fee.status}`); io.emit("data:changed", { type: "fees" }); res.json(fee);
});

app.get("/api/announcements", auth, async (req, res) => res.json(await Announcement.find({ $or: [{ audience: "all" }, { audience: req.user.role }] }).sort({ createdAt: -1 }).limit(100)));
app.post("/api/announcements", auth, allow("admin","teacher"), async (req, res) => {
  if (!req.body.title || !req.body.message) return res.status(400).json({ message: "Title and message are required." });
  const a = await Announcement.create({ title: req.body.title, message: req.body.message, audience: req.body.audience || "all", createdBy: req.user._id });
  await audit(req, "published", "announcement", a.title); io.emit("announcement:new", a); io.emit("data:changed", { type: "announcements" }); res.status(201).json(a);
});
app.get("/api/activity", auth, allow("admin"), async (_, res) => res.json(await Activity.find().sort({ createdAt: -1 }).limit(200)));

app.get("/api/notifications", auth, async (req, res) => res.json(await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100)));
app.patch("/api/notifications/:id/read", auth, async (req, res) => {
  const n = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { read: true }, { new: true });
  if (!n) return res.status(404).json({ message: "Notification not found." }); res.json(n);
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    const p = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(p.id).select("name role");
    if (!user) return next(new Error("Unauthorized"));
    socket.user = { id: String(user._id), name: user.name, role: user.role }; next();
  } catch { next(new Error("Unauthorized")); }
});
io.on("connection", socket => {
  socket.on("chat:join", async room => {
    if (typeof room !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(room)) return;
    socket.join(room);
    const history = await ChatMessage.find({ room }).sort({ createdAt: -1 }).limit(50).lean();
    socket.emit("chat:history", history.reverse());
  });
  socket.on("chat:send", async payload => {
    const room = typeof payload?.room === "string" ? payload.room : "";
    const message = String(payload?.message || "").trim();
    if (!room || !/^[a-zA-Z0-9_-]{1,80}$/.test(room) || !message || message.length > 2000 || !socket.rooms.has(room)) return;
    const saved = await ChatMessage.create({ room, sender: socket.user.id, senderName: socket.user.name, message });
    io.to(room).emit("chat:message", { id: saved._id, room, sender: socket.user.id, senderName: socket.user.name, message, createdAt: saved.createdAt });
  });
});
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ message: "Unexpected server error." }); });

const port = process.env.PORT || 5000;
await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/schoolsphere");
server.listen(port, () => console.log(`SchoolSphere API listening on ${port}`));
