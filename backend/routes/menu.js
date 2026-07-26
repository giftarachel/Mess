const router = require("express").Router();
const auth = require("../middleware/auth");
const pool = require("../db");
const { getCurrentWeekId } = require("../utils/week");
const { pushSystemNotification } = require("./notifications");

// GET /api/menu — current week's breakfast menu
router.get("/", auth, async (req, res) => {
  try {
    const weekId = getCurrentWeekId();
    let rows = (await pool.query("SELECT * FROM menu WHERE week_id = $1 ORDER BY day", [weekId])).rows;

    // Fallback: latest record per day if none for this week
    if (rows.length === 0) {
      const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
      const fallbacks = await Promise.all(
        days.map(d =>
          pool.query("SELECT * FROM menu WHERE day=$1 ORDER BY created_at DESC LIMIT 1", [d])
            .then(r => r.rows[0])
        )
      );
      rows = fallbacks.filter(Boolean);
    }

    const result = {};
    rows.forEach(m => {
      result[m.day] = {
        Breakfast: {
          veg:    m.breakfast_veg    || [],
          nonVeg: m.breakfast_nonveg || [],
        },
        defaults: {
          Breakfast: {
            veg:    m.default_breakfast_veg    ?? null,
            nonVeg: m.default_breakfast_nonveg ?? null,
          },
        },
        slots: {
          veg:    m.slot_veg    ?? null,
          nonVeg: m.slot_nonveg ?? null,
        },
        stock: {
          veg:    m.stock_veg    ?? 0,
          nonVeg: m.stock_nonveg ?? 0,
        },
      };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/menu/:day — manager sets breakfast items
router.put("/:day", auth, async (req, res) => {
  try {
    if (req.user.role !== "manager") return res.status(403).json({ message: "Forbidden" });
    const weekId = getCurrentWeekId();
    const day = req.params.day;
    const { Breakfast } = req.body;

    await pool.query(`
      INSERT INTO menu (week_id, day, breakfast_veg, breakfast_nonveg, updated_at)
      VALUES ($1,$2,$3,$4,NOW())
      ON CONFLICT (week_id, day) DO UPDATE SET
        breakfast_veg    = EXCLUDED.breakfast_veg,
        breakfast_nonveg = EXCLUDED.breakfast_nonveg,
        updated_at       = NOW()
    `, [weekId, day, Breakfast?.veg || [], Breakfast?.nonVeg || []]);

    // Push real-time notification to students
    pushSystemNotification({
      type: "menu_update",
      title: "🍳 Breakfast Menu Updated",
      message: `The breakfast menu for ${day} has been updated. Check your options!`,
      targetRole: "student",
    }).catch(() => {});

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/menu/:day/default — set default breakfast item
router.put("/:day/default", auth, async (req, res) => {
  try {
    if (req.user.role !== "manager") return res.status(403).json({ message: "Forbidden" });
    const weekId = getCurrentWeekId();
    const day = req.params.day;
    const { diet, index } = req.body;

    const col = diet === "nonVeg" ? "default_breakfast_nonveg" : "default_breakfast_veg";

    await pool.query(`
      INSERT INTO menu (week_id, day, updated_at)
      VALUES ($1,$2,NOW())
      ON CONFLICT (week_id, day) DO UPDATE SET
        ${col} = $3,
        updated_at = NOW()
    `, [weekId, day, index]);

    res.json({ success: true, field: col, value: index });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/menu/:day/slot — manager assigns vending machine slot numbers
router.put("/:day/slot", auth, async (req, res) => {
  try {
    if (req.user.role !== "manager") return res.status(403).json({ message: "Forbidden" });
    const weekId = getCurrentWeekId();
    const day = req.params.day;
    const { slotVeg, slotNonVeg } = req.body;

    await pool.query(`
      INSERT INTO menu (week_id, day, slot_veg, slot_nonveg, updated_at)
      VALUES ($1,$2,$3,$4,NOW())
      ON CONFLICT (week_id, day) DO UPDATE SET
        slot_veg    = EXCLUDED.slot_veg,
        slot_nonveg = EXCLUDED.slot_nonveg,
        updated_at  = NOW()
    `, [weekId, day, slotVeg ?? null, slotNonVeg ?? null]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/menu/:day/stock — manager updates inventory stock
router.put("/:day/stock", auth, async (req, res) => {
  try {
    if (req.user.role !== "manager") return res.status(403).json({ message: "Forbidden" });
    const weekId = getCurrentWeekId();
    const day = req.params.day;
    const { stockVeg, stockNonVeg } = req.body;

    await pool.query(`
      INSERT INTO menu (week_id, day, stock_veg, stock_nonveg, updated_at)
      VALUES ($1,$2,$3,$4,NOW())
      ON CONFLICT (week_id, day) DO UPDATE SET
        stock_veg    = EXCLUDED.stock_veg,
        stock_nonveg = EXCLUDED.stock_nonveg,
        updated_at   = NOW()
    `, [weekId, day, stockVeg ?? 0, stockNonVeg ?? 0]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
