const router = require("express").Router();
const auth = require("../middleware/auth");
const User = require("../models/User");
const Leave = require("../models/Leave");
const Preference = require("../models/Preference");

const { getCurrentWeekId } = require("../utils/week");

// GET /api/stats/notifications
router.get("/notifications", auth, async (req, res) => {
  try {
    const weekId = getCurrentWeekId();
    if (req.user.role === "manager") {
      const students = await User.find({ role: "student" }).select("userId");
      const studentIds = students.map(s => s.userId);
      const responded = await Preference.distinct("userId", { weekId, userId: { $in: studentIds } });
      res.json({ count: Math.max(0, studentIds.length - responded.length) });
    } else {
      const prefs = await Preference.find({ userId: req.user.userId, weekId });
      res.json({ count: Math.max(0, 21 - prefs.length) });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/stats
router.get("/", auth, async (req, res) => {
  try {
    const weekId = getCurrentWeekId();
    const today = new Date().toISOString().split("T")[0];
    const students = await User.find({ role: "student" }).select("userId");
    const studentIds = students.map(s => s.userId);
    const totalStudents = studentIds.length;
    const [onLeaveToday, responded] = await Promise.all([
      Leave.countDocuments({ date: today }),
      Preference.distinct("userId", { weekId, userId: { $in: studentIds } }),
    ]);
    const respondedCount = responded.length;
    res.json({ totalStudents, onLeaveToday, responded: respondedCount, pending: Math.max(0, totalStudents - respondedCount), weekId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
