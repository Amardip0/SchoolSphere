import mongoose from "mongoose";

const { Schema, model } = mongoose;
const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "teacher", "student", "parent"],
      default: "student",
    },
    phone: String,
    className: String,
    section: String,
    admissionNo: String,
    emailVerified: { type: Boolean, default: false },
    emailOtpHash: String,
    emailOtpExpires: Date,
    resetOtpHash: String,
    resetOtpExpires: Date,
    parentOf: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true },
);
userSchema.index({ email: 1 }, { unique: true });

const recordSchema = (fields) => new Schema(fields, { timestamps: true });
export const User = model("User", userSchema);

const attendanceSchema = recordSchema({
  student: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  date: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["present", "absent", "late", "leave"],
    required: true,
  },
  className: String,
  markedBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  note: String,
});

// Define the unique index on the Schema, not the Model.
attendanceSchema.index({ student: 1, date: 1 }, { unique: true });

export const Attendance = model("Attendance", attendanceSchema);
export const Mark = model(
  "Mark",
  recordSchema({
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    subject: { type: String, required: true },
    exam: { type: String, required: true },
    score: { type: Number, required: true, min: 0 },
    maxScore: { type: Number, required: true, min: 1 },
    published: { type: Boolean, default: false },
    enteredBy: { type: Schema.Types.ObjectId, ref: "User" },
  }),
);
export const Note = model(
  "Note",
  recordSchema({
    title: { type: String, required: true },
    body: { type: String, required: true },
    className: String,
    subject: String,
    fileUrl: String,
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  }),
);
export const Timetable = model(
  "Timetable",
  recordSchema({
    className: { type: String, required: true },
    day: { type: String, required: true },
    startTime: String,
    endTime: String,
    subject: String,
    room: String,
    teacher: { type: Schema.Types.ObjectId, ref: "User" },
  }),
);
export const Admission = model(
  "Admission",
  recordSchema({
    studentName: { type: String, required: true },
    parentName: String,
    email: String,
    phone: String,
    applyingClass: String,
    status: {
      type: String,
      enum: ["new", "contacted", "documents", "accepted", "rejected"],
      default: "new",
    },
    notes: String,
  }),
);
export const Fee = model(
  "Fee",
  recordSchema({
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    dueDate: String,
    status: { type: String, enum: ["due", "paid", "partial"], default: "due" },
    receiptNo: String,
    recordedBy: { type: Schema.Types.ObjectId, ref: "User" },
  }),
);
export const Announcement = model(
  "Announcement",
  recordSchema({
    title: String,
    message: String,
    audience: { type: String, default: "all" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  }),
);
export const ChatMessage = model(
  "ChatMessage",
  recordSchema({
    room: { type: String, required: true },
    sender: { type: Schema.Types.ObjectId, ref: "User" },
    senderName: String,
    message: { type: String, required: true, maxlength: 2000 },
  }),
);
export const Activity = model(
  "Activity",
  recordSchema({
    actor: { type: Schema.Types.ObjectId, ref: "User" },
    actorName: String,
    action: String,
    entity: String,
    details: String,
    ip: String,
  }),
);
export const Notification = model(
  "Notification",
  recordSchema({
    user: { type: Schema.Types.ObjectId, ref: "User" },
    title: String,
    message: String,
    read: { type: Boolean, default: false },
  }),
);
