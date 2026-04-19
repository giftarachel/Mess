const router = require("express").Router();
const auth = require("../middleware/auth");
const Preference = require("../models/Preference");
const { getCurrentWeekId, isSelectionOpen } = require("../utils/week");

// GET /api/preferences — student's preferences for current week
router.get("/", auth, async (req, res) => {
  try {
    const weekId = getCurrentWeekId();
    const prefs = await Preference.find({ userId: req.user.userId, weekId });
    const result = {};
    prefs.forEach(({ day, meal, choiceIndex, diet }) => {
      if (!result[day]) result[day] = {};
      result[day][meal] = { choiceIndex, diet: diet || "veg" };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/preferences — upsert (one per student per week per day per meal)
router.put("/", auth, async (req, res) => {
  try {
    if (req.user.role !== "student") return res.status(403).json({ message: "Only students can set preferences" });
    if (!isSelectionOpen()) return res.status(403).json({ message: "Selection window is closed. Open Sat 7PM – Sun 11:59PM." });

    const { day, meal, choiceIndex, diet } = req.body;
    const weekId = getCurrentWeekId();

    await Preference.findOneAndUpdate(
      { userId: req.user.userId, weekId, day, meal },
      { $set: { choiceIndex, diet: diet || "veg" } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, weekId });
  } catch (err) {
    // Handle duplicate key race condition gracefully
    if (err.code === 11000) {
      await Preference.updateOne(
        { userId: req.user.userId, weekId, day, meal },
        { $set: { choiceIndex, diet: diet || "veg" } }
      );
      return res.json({ success: true, weekId });
    }
    res.status(500).json({ message: err.message });
  }
});

// GET /api/preferences/window — is selection open?
router.get("/window", auth, async (req, res) => {
  const weekId = getCurrentWeekId();
  res.json({ open: isSelectionOpen(), weekId });
});

// GET /api/preferences/analytics — manager only
router.get("/analytics", auth, async (req, res) => {
  try {
    if (req.user.role !== "manager") return res.status(403).json({ message: "Forbidden" });

    const Menu = require("../models/Menu");
    const User = require("../models/User");
    const weekId = getCurrentWeekId();

    const menus = await Menu.find({ weekId });
    const menuMap = {};
    menus.forEach(m => {
      menuMap[m.day] = { Breakfast: m.Breakfast, Lunch: m.Lunch, Dinner: m.Dinner };
    });

    const students = await User.find({ role: "student" }).select("userId");
    const studentIds = new Set(students.map(s => s.userId));

    const prefs = await Preference.find({ weekId });
    const userVotes = {};
    const analytics = {};

    prefs.forEach(({ userId, day, meal, choiceIndex, diet }) => {
      if (!studentIds.has(userId)) return;
      const key = `${userId}|${day}|${meal}`;
      if (userVotes[key]) return;
      userVotes[key] = true;

      const mealMenu = menuMap[day]?.[meal];
      if (!mealMenu) return;

      const dietKey = diet || "veg";
      const itemName = Array.isArray(mealMenu)
        ? mealMenu[choiceIndex]
        : mealMenu[dietKey]?.[choiceIndex];

      if (!itemName) return;

      if (!analytics[day]) analytics[day] = {};
      if (!analytics[day][meal]) analytics[day][meal] = {};
      if (!analytics[day][meal][dietKey]) analytics[day][meal][dietKey] = {};
      analytics[day][meal][dietKey][itemName] = (analytics[day][meal][dietKey][itemName] || 0) + 1;
    });

    res.json(analytics);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/preferences/diet-summary
router.get("/diet-summary", auth, async (req, res) => {
  try {
    if (req.user.role !== "manager") return res.status(403).json({ message: "Forbidden" });
    const User = require("../models/User");
    const weekId = getCurrentWeekId();

    const students = await User.find({ role: "student" }).select("userId");
    const studentIds = new Set(students.map(s => s.userId));

    const prefs = await Preference.find({ weekId, userId: { $in: [...studentIds] } });
    const studentDiet = {};
    prefs.forEach(({ userId, diet }) => {
      if (!studentDiet[userId]) studentDiet[userId] = diet || "veg";
    });

    const vegCount = Object.values(studentDiet).filter(d => d === "veg").length;
    const nonVegCount = Object.values(studentDiet).filter(d => d === "nonVeg").length;

    res.json({ veg: vegCount, nonVeg: nonVegCount, noChoice: students.length - Object.keys(studentDiet).length, total: students.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
