const router = require("express").Router();
const auth = require("../middleware/auth");
const pool = require("../db");

// POST /api/feedback
router.post("/", auth, async (req, res) => {
  try {
    if (req.user.role !== "student")
      return res.status(403).json({ message: "Only students can submit feedback" });
    const { meal, rating, comment } = req.body;
    if (!meal || !rating) return res.status(400).json({ message: "Meal and rating are required" });

    const result = await pool.query(
      "INSERT INTO feedback (user_id, name, meal, rating, comment) VALUES ($1,$2,$3,$4,$5) RETURNING id",
      [req.user.userId, req.user.name, meal, rating, comment || ""]
    );
    res.status(201).json({ success: true, id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/feedback — manager
router.get("/", auth, async (req, res) => {
  try {
    if (req.user.role !== "manager") return res.status(403).json({ message: "Forbidden" });
    const rows = (await pool.query(
      "SELECT * FROM feedback ORDER BY created_at DESC LIMIT 100"
    )).rows;
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/feedback/summary
router.get("/summary", auth, async (req, res) => {
  try {
    if (req.user.role !== "manager") return res.status(403).json({ message: "Forbidden" });
    const rows = (await pool.query(`
      SELECT meal AS _id, ROUND(AVG(rating)::numeric, 2) AS avg, COUNT(*) AS count
      FROM feedback
      GROUP BY meal
      ORDER BY meal
    `)).rows;
    res.json(rows.map(r => ({ _id: r._id, avg: parseFloat(r.avg), count: parseInt(r.count) })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
