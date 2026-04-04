// Run once: node cleanup.js
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");
const Preference = require("./models/Preference");

async function cleanup() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected");

  // Get all valid student userIds
  const students = await User.find({ role: "student" }).select("userId");
  const validIds = students.map(s => s.userId);
  console.log("Valid student IDs:", validIds);

  // Remove preferences from non-student users
  const result = await Preference.deleteMany({ userId: { $nin: validIds } });
  console.log(`Removed ${result.deletedCount} invalid preference records`);

  // Show remaining counts per user
  const counts = await Preference.aggregate([
    { $group: { _id: "$userId", count: { $sum: 1 } } }
  ]);
  console.log("Remaining preferences per user:", counts);

  process.exit(0);
}

cleanup().catch(err => { console.error(err); process.exit(1); });
