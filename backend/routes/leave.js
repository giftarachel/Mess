const router = require("express").Router();
const auth = require("../middleware/auth");
const Leave = require("../models/Leave");

// GET /api/leave  — get current user's leave dates
router.get("/", auth, async (req, res) => {
  try {
    const leaves = await Leave.find({ userId: req.user.userId }).select("date -_id");
    res.json(leaves.map(l => l.date));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/leave/toggle  — add or remove a leave date
router.post("/toggle", auth, async (req, res) => {
  try {
    const { date } = req.body;
    const existing = await Leave.findOne({ userId: req.user.userId, date });
    if (existing) {
      await existing.deleteOne();
      res.json({ action: "removed", date });
    } else {
      await Leave.create({ userId: req.user.userId, date });
      res.json({ action: "added", date });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/leave/summary  — manager: count of students on leave per date
router.get("/summary", auth, async (req, res) => {
  try {
    if (req.user.role !== "manager") return res.status(403).json({ message: "Forbidden" });
    const summary = await Leave.aggregate([
      { $group: { _id: "$date", count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
