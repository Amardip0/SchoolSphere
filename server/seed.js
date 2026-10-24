import { MongoClient, ObjectId } from "mongodb";

const URI = "mongodb://127.0.0.1:27017";
const client = new MongoClient(URI);

async function seed() {
  await client.connect();
  const db = client.db("school");
  const now = new Date();

  const classes = ["6", "7", "8", "9", "10"];
  const sections = ["A", "B"];
  const subjects = [
    "Mathematics",
    "English",
    "Science",
    "Social Studies",
    "Computer Science",
    "Gujarati",
  ];
  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  const users = [];
  const teachers = [];
  const students = [];
  const parents = [];

  // Demo password only; replace with a real bcrypt hash
  // before testing login.
  const password = "REPLACE_WITH_BCRYPT_HASH";

  users.push({
    _id: new ObjectId(),
    name: "Demo Admin",
    email: "admin@schoolsphere.demo",
    password,
    role: "admin",
    phone: "9000000001",
    emailVerified: true,
  });

  for (let i = 0; i < 9; i++) {
    const u = {
      _id: new ObjectId(),
      name: `Teacher ${i + 1}`,
      email: `teacher${i + 1}@schoolsphere.demo`,
      password,
      role: "teacher",
      phone: `910000${String(i + 1).padStart(4, "0")}`,
      className: classes[i % 5],
      section: sections[i % 2],
      emailVerified: true,
    };
    teachers.push(u);
    users.push(u);
  }

  for (let i = 0; i < 50; i++) {
    const u = {
      _id: new ObjectId(),
      name: `Student ${i + 1}`,
      email: `student${i + 1}@schoolsphere.demo`,
      password,
      role: "student",
      phone: `920000${String(i + 1).padStart(4, "0")}`,
      className: classes[i % 5],
      section: sections[i % 2],
      admissionNo: `SS-2026-${String(i + 1).padStart(4, "0")}`,
      emailVerified: true,
    };
    students.push(u);
    users.push(u);
  }

  for (let i = 0; i < 50; i++) {
    const u = {
      _id: new ObjectId(),
      name: `Parent ${i + 1}`,
      email: `parent${i + 1}@schoolsphere.demo`,
      password,
      role: "parent",
      phone: `930000${String(i + 1).padStart(4, "0")}`,
      parentOf: [students[i]._id],
      emailVerified: true,
    };
    parents.push(u);
    users.push(u);
  }

  const admin = users[0];
  const attendance = students.map((s, i) => ({
    student: s._id,
    date: new Date(Date.now() - (i % 30) * 86400000).toISOString().slice(0, 10),
    status: ["present", "absent", "late", "leave"][i % 4],
    className: s.className,
    markedBy: teachers[i % teachers.length]._id,
    note: "",
  }));

  const marks = Array.from({ length: 50 }, (_, i) => ({
    student: students[i]._id,
    subject: subjects[i % subjects.length],
    exam: ["Unit Test 1", "Mid Term", "Final Exam"][i % 3],
    score: 50 + (i % 51),
    maxScore: 100,
    published: true,
    enteredBy: teachers[i % teachers.length]._id,
  }));

  const notes = Array.from({ length: 50 }, (_, i) => ({
    title: `${subjects[i % 6]} Chapter ${(i % 10) + 1}`,
    body: `Demo study notes for ${subjects[i % 6]}.`,
    className: classes[i % 5],
    subject: subjects[i % 6],
    fileUrl: "",
    createdBy: teachers[i % teachers.length]._id,
  }));

  const timetable = Array.from({ length: 50 }, (_, i) => ({
    className: classes[i % 5],
    day: days[i % 6],
    startTime: ["09:00", "10:00", "11:00", "12:00", "14:00"][i % 5],
    endTime: ["09:50", "10:50", "11:50", "12:50", "14:50"][i % 5],
    subject: subjects[i % 6],
    room: `Room ${101 + (i % 10)}`,
    teacher: teachers[i % teachers.length]._id,
  }));

  const admissions = Array.from({ length: 50 }, (_, i) => ({
    studentName: `Applicant ${i + 1}`,
    parentName: `Applicant Parent ${i + 1}`,
    email: `applicant${i + 1}@example.com`,
    phone: `940000${String(i + 1).padStart(4, "0")}`,
    applyingClass: classes[i % 5],
    status: ["new", "contacted", "documents", "accepted", "rejected"][i % 5],
    notes: "Demo admission record",
  }));

  const fees = students.map((s, i) => ({
    student: s._id,
    title: ["Tuition Fee", "Transport Fee", "Exam Fee"][i % 3],
    amount: 3000 + (i % 8) * 500,
    dueDate: new Date(Date.now() + (i + 1) * 86400000)
      .toISOString()
      .slice(0, 10),
    status: ["due", "paid", "partial"][i % 3],
    receiptNo: i % 3 === 0 ? `SS-RCP-${i + 1}` : "",
    recordedBy: admin._id,
  }));

  const announcements = Array.from({ length: 50 }, (_, i) => ({
    title: `School Announcement ${i + 1}`,
    message: `Demo announcement ${i + 1}.`,
    audience: ["all", "students", "teachers", "parents"][i % 4],
    createdBy: admin._id,
  }));

  const chatmessages = Array.from({ length: 50 }, (_, i) => {
    const sender = users[i % users.length];
    return {
      room: i % 2 === 0 ? "general" : `class-${classes[i % 5]}`,
      sender: sender._id,
      senderName: sender.name,
      message: `Demo message ${i + 1}`,
    };
  });

  const activities = Array.from({ length: 50 }, (_, i) => {
    const actor = users[i % users.length];
    return {
      actor: actor._id,
      actorName: actor.name,
      action: ["created", "updated", "viewed", "published", "marked"][i % 5],
      entity: ["Attendance", "Mark", "Note", "Fee", "Announcement"][i % 5],
      details: `Demo activity ${i + 1}`,
      ip: "127.0.0.1",
    };
  });

  const notifications = Array.from({ length: 50 }, (_, i) => ({
    user: users[i % users.length]._id,
    title: ["Welcome", "Attendance Updated", "New Notes", "Fee Reminder"][
      i % 4
    ],
    message: `Demo notification ${i + 1}`,
    read: i % 2 === 0,
  }));

  const collections = {
    users,
    attendance,
    marks,
    notes,
    timetable,
    admissions,
    fees,
    announcements,
    chatmessages,
    activities,
    notifications,
  };

  // Refuse to overwrite collections containing existing data.
  for (const name of Object.keys(collections)) {
    const count = await db.collection(name).countDocuments();
    if (count > 0) {
      throw new Error(
        `Collection "${name}" already has ${count} documents. ` +
          "Seed stopped to avoid overwriting existing data.",
      );
    }
  }

  for (const [name, records] of Object.entries(collections)) {
    await db.collection(name).insertMany(
      records.map((doc) => ({
        ...doc,
        createdAt: now,
        updatedAt: now,
      })),
    );
    console.log(`${name}: ${records.length} records inserted`);
  }

  console.log("Seed completed.");
  console.log(
    "Total records:",
    Object.values(collections).reduce((sum, arr) => sum + arr.length, 0),
  );

  await client.close();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exitCode = 1;
});
