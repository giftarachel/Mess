const router = require("express").Router();
const auth = require("../middleware/auth");
const pool = require("../db");
const { getCurrentWeekId } = require("../utils/week");

// GET /api/stats/notifications
router.get("/notifications", auth, async (req, res) => {
  try {
    const weekId = getCurrentWeekId();
    const students = (await pool.query("SELECT user_id FROM users WHERE role='student'")).rows;
    const studentIds = students.map(s => s.user_id);

    if (req.user.role === "manager") {
      // Count distinct students who responded THIS week only
      const responded = parseInt((await pool.query(
        "SELECT COUNT(DISTINCT user_id) AS cnt FROM preferences WHERE week_id=$1 AND user_id=ANY($2)",
        [weekId, studentIds]
      )).rows[0].cnt);
      res.json({ count: Math.max(0, studentIds.length - responded) });
    } else {
      // Count how many days this student has selected this week (max 7)
      const cnt = parseInt((await pool.query(
        "SELECT COUNT(*) AS cnt FROM preferences WHERE user_id=$1 AND week_id=$2",
        [req.user.userId, weekId]
      )).rows[0].cnt);
      res.json({ count: Math.max(0, 7 - cnt) });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/stats
router.get("/", auth, async (req, res) => {
  try {
    const weekId = getCurrentWeekId();
    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    const todayIST = new Date(Date.now() + IST_OFFSET);
    const today = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][todayIST.getUTCDay()];

    const students = (await pool.query("SELECT user_id FROM users WHERE role='student'")).rows;
    const studentIds = students.map(s => s.user_id);
    const totalStudents = studentIds.length;

    // Current week only — no stale fallback
    const responded = parseInt((await pool.query(
      "SELECT COUNT(DISTINCT user_id) AS cnt FROM preferences WHERE week_id=$1 AND user_id=ANY($2)",
      [weekId, studentIds]
    )).rows[0].cnt);

    // Today's collection stats — current week only
    const collectedToday = parseInt((await pool.query(
      "SELECT COUNT(*) AS cnt FROM preferences WHERE week_id=$1 AND day=$2 AND collected=TRUE AND user_id=ANY($3)",
      [weekId, today, studentIds]
    )).rows[0].cnt);

    const selectedToday = parseInt((await pool.query(
      "SELECT COUNT(*) AS cnt FROM preferences WHERE week_id=$1 AND day=$2 AND user_id=ANY($3)",
      [weekId, today, studentIds]
    )).rows[0].cnt);

    const onLeaveToday = parseInt((await pool.query(
      "SELECT COUNT(*) AS cnt FROM leave_dates WHERE date=$1 AND user_id=ANY($2)",
      [todayIST.toISOString().split("T")[0], studentIds]
    )).rows[0].cnt);

    res.json({
      totalStudents,
      onLeaveToday,
      responded,
      pending: Math.max(0, totalStudents - responded),
      collectedToday,
      selectedToday,
      pendingCollection: Math.max(0, selectedToday - collectedToday),
      weekId,
      today,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
