const router = require("express").Router();
const auth = require("../middleware/auth");
const Feedback = require("../models/Feedback");

// POST /api/feedback — student submits feedback
router.post("/", auth, async (req, res) => {
  try {
    if (req.user.role !== "student") return res.status(403).json({ message: "Only students can submit feedback" });
    const { meal, rating, comment } = req.body;
    if (!meal || !rating) return res.status(400).json({ message: "Meal and rating are required" });
    const fb = await Feedback.create({
      userId: req.user.userId,
      name: req.user.name,
      meal, rating,
      comment: comment || "",
    });
    res.status(201).json({ success: true, id: fb._id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/feedback — manager gets all feedback
router.get("/", auth, async (req, res) => {
  try {
    if (req.user.role !== "manager") return res.status(403).json({ message: "Forbidden" });
    const feedbacks = await Feedback.find().sort({ createdAt: -1 }).limit(100);
    res.json(feedbacks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/feedback/summary — average ratings per meal
router.get("/summary", auth, async (req, res) => {
  try {
    if (req.user.role !== "manager") return res.status(403).json({ message: "Forbidden" });
    const summary = await Feedback.aggregate([
      { $group: { _id: "$meal", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
