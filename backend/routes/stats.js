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
      let responded = await Preference.distinct("userId", { weekId, userId: { $in: studentIds } });
      if (responded.length === 0) {
        responded = await Preference.distinct("userId", { userId: { $in: studentIds } });
      }
      res.json({ count: Math.max(0, studentIds.length - responded.length) });
    } else {
      let prefs = await Preference.find({ userId: req.user.userId, weekId });
      if (prefs.length === 0) {
        prefs = await Preference.find({ userId: req.user.userId });
      }
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
    // Use IST date for today
    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(Date.now() + IST_OFFSET);
    const today = istNow.toISOString().split("T")[0];

    const students = await User.find({ role: "student" }).select("userId");
    const studentIds = students.map(s => s.userId);
    const totalStudents = studentIds.length;

    // Try current weekId first, fallback to any recent preferences
    let responded = await Preference.distinct("userId", { weekId, userId: { $in: studentIds } });
    if (responded.length === 0) {
      // Fallback: count students who have any preferences at all
      responded = await Preference.distinct("userId", { userId: { $in: studentIds } });
    }

    const onLeaveToday = await Leave.countDocuments({ date: today, userId: { $in: studentIds } });
    const respondedCount = responded.length;
    res.json({ totalStudents, onLeaveToday, responded: respondedCount, pending: Math.max(0, totalStudents - respondedCount), weekId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
