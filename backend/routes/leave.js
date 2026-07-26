const router = require("express").Router();
const auth = require("../middleware/auth");
const pool = require("../db");

// GET /api/leave
router.get("/", auth, async (req, res) => {
  try {
    const rows = (await pool.query(
      "SELECT date FROM leave_dates WHERE user_id=$1 ORDER BY date",
      [req.user.userId]
    )).rows;
    res.json(rows.map(r => r.date.toISOString().split("T")[0]));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/leave/toggle
router.post("/toggle", auth, async (req, res) => {
  try {
    const { date } = req.body;
    const existing = (await pool.query(
      "SELECT id FROM leave_dates WHERE user_id=$1 AND date=$2",
      [req.user.userId, date]
    )).rows[0];

    if (existing) {
      await pool.query("DELETE FROM leave_dates WHERE user_id=$1 AND date=$2", [req.user.userId, date]);
      res.json({ action: "removed", date });
    } else {
      await pool.query("INSERT INTO leave_dates (user_id, date) VALUES ($1,$2)", [req.user.userId, date]);
      res.json({ action: "added", date });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/leave/summary — manager
router.get("/summary", auth, async (req, res) => {
  try {
    if (req.user.role !== "manager") return res.status(403).json({ message: "Forbidden" });
    const rows = (await pool.query(`
      SELECT date::text AS _id, COUNT(*) AS count
      FROM leave_dates
      GROUP BY date
      ORDER BY date
    `)).rows;
    res.json(rows.map(r => ({ _id: r._id, count: parseInt(r.count) })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
