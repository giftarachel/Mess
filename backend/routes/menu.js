const router = require("express").Router();
const auth = require("../middleware/auth");
const Menu = require("../models/Menu");
const { getCurrentWeekId } = require("../utils/week");

// GET /api/menu — current week's menu (falls back to latest per day if none for this week)
router.get("/", auth, async (req, res) => {
  try {
    const weekId = getCurrentWeekId();
    let menus = await Menu.find({ weekId }).select("-__v -createdAt -updatedAt");

    // Fallback: if no menu for this week, get the most recent record for each day
    if (menus.length === 0) {
      const allDays = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
      const fallbacks = await Promise.all(
        allDays.map(d => Menu.findOne({ day: d }).sort({ createdAt: -1 }).select("-__v"))
      );
      menus = fallbacks.filter(Boolean);
    }

    const result = {};
    menus.forEach(m => {
      result[m.day] = {
        Breakfast: m.Breakfast || { veg: [], nonVeg: [] },
        Lunch:     m.Lunch     || { veg: [], nonVeg: [] },
        Dinner:    m.Dinner    || { veg: [], nonVeg: [] },
        defaults: {
          Breakfast: { veg: m.defaultBreakfastVeg ?? null, nonVeg: m.defaultBreakfastNonVeg ?? null },
          Lunch:     { veg: m.defaultLunchVeg     ?? null, nonVeg: m.defaultLunchNonVeg     ?? null },
          Dinner:    { veg: m.defaultDinnerVeg    ?? null, nonVeg: m.defaultDinnerNonVeg    ?? null },
        }
      };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/menu/:day — manager sets/updates menu items for current week
router.put("/:day", auth, async (req, res) => {
  try {
    if (req.user.role !== "manager") return res.status(403).json({ message: "Forbidden" });
    const weekId = getCurrentWeekId();
    const { Breakfast, Lunch, Dinner } = req.body;
    const updated = await Menu.findOneAndUpdate(
      { weekId, day: req.params.day },
      { $set: { Breakfast, Lunch, Dinner } },
      { upsert: true, new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/menu/:day/default — set default item for a meal+diet
router.put("/:day/default", auth, async (req, res) => {
  try {
    if (req.user.role !== "manager") return res.status(403).json({ message: "Forbidden" });
    const weekId = getCurrentWeekId();
    const { meal, diet, index } = req.body;
    const dietSuffix = diet === "nonVeg" ? "NonVeg" : "Veg";
    const field = `default${meal}${dietSuffix}`;

    // Use $set so we only update the default field, not wipe other data
    const updated = await Menu.findOneAndUpdate(
      { weekId, day: req.params.day },
      { $set: { [field]: index } },
      { upsert: true, new: true }
    );
    res.json({ success: true, field, value: updated[field] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
