const router = require("express").Router();
const auth = require("../middleware/auth");
const pool = require("../db");
const { getCurrentWeekId, isSelectionOpen } = require("../utils/week");
const { pushSystemNotification } = require("./notifications");

// GET /api/preferences — student's breakfast choices for current week
router.get("/", auth, async (req, res) => {
  try {
    const weekId = getCurrentWeekId();
    const rows = (await pool.query(
      "SELECT day, choice_index, diet, collected, collected_at FROM preferences WHERE user_id=$1 AND week_id=$2",
      [req.user.userId, weekId]
    )).rows;

    const result = {};
    rows.forEach(({ day, choice_index, diet, collected, collected_at }) => {
      result[day] = {
        choiceIndex: choice_index,
        diet: diet || "veg",
        collected: collected || false,
        collectedAt: collected_at || null,
      };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/preferences — student selects breakfast for a day
router.put("/", auth, async (req, res) => {
  try {
    if (req.user.role !== "student")
      return res.status(403).json({ message: "Only students can set preferences" });
    if (!isSelectionOpen())
      return res.status(403).json({ message: "Selection window is closed. Open Sat 7PM – Sun 11:59PM." });

    const { day, choiceIndex, diet } = req.body;
    const weekId = getCurrentWeekId();

    await pool.query(`
      INSERT INTO preferences (user_id, week_id, day, choice_index, diet, updated_at)
      VALUES ($1,$2,$3,$4,$5,NOW())
      ON CONFLICT (user_id, week_id, day) DO UPDATE SET
        choice_index = EXCLUDED.choice_index,
        diet         = EXCLUDED.diet,
        updated_at   = NOW()
    `, [req.user.userId, weekId, day, choiceIndex, diet || "veg"]);

    res.json({ success: true, weekId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/preferences/window
router.get("/window", auth, async (req, res) => {
  const weekId = getCurrentWeekId();
  res.json({ open: isSelectionOpen(), weekId });
});

// GET /api/preferences/deadline — returns precise countdown info for the timer
router.get("/deadline", auth, async (req, res) => {
  const { getDeadlineInfo } = require("../utils/week");
  res.json(getDeadlineInfo());
});

// GET /api/preferences/analytics — manager only
router.get("/analytics", auth, async (req, res) => {
  try {
    if (req.user.role !== "manager") return res.status(403).json({ message: "Forbidden" });

    const weekId = getCurrentWeekId();

    // Hardcoded fallback menu (mirrors frontend MENU_DATA) — used when manager hasn't saved menu yet
    const FALLBACK_MENU = {
      Mon: { veg: ["Idli Sambar","Poha","Upma"],           nonVeg: ["Egg Bhurji","Omelette Wrap"] },
      Tue: { veg: ["Dosa Chutney","Paratha","Cornflakes"],  nonVeg: ["Egg Paratha","Boiled Eggs"] },
      Wed: { veg: ["Bread Butter Jam","Poha","Upma"],       nonVeg: ["Egg Toast","Omelette"] },
      Thu: { veg: ["Idli Vada","Sprouts Bowl","Pongal"],    nonVeg: ["Egg Dosa","Boiled Eggs"] },
      Fri: { veg: ["Poha","Dosa Sambar","Upma"],            nonVeg: ["Egg Bhurji","Omelette"] },
      Sat: { veg: ["Chole Bhature","Paratha Pickle"],       nonVeg: ["Egg Paratha","Chicken Sandwich"] },
      Sun: { veg: ["Puri Sabzi","Halwa Poori"],             nonVeg: ["Egg Puri","Omelette"] },
    };

    // Try current week menu first, fallback to latest per day, then hardcoded defaults
    let menuRows = (await pool.query("SELECT * FROM menu WHERE week_id=$1", [weekId])).rows;
    if (menuRows.length === 0) {
      // Try latest saved menu per day
      const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
      const fb = await Promise.all(
        days.map(d =>
          pool.query("SELECT * FROM menu WHERE day=$1 ORDER BY created_at DESC LIMIT 1", [d])
            .then(r => r.rows[0])
        )
      );
      menuRows = fb.filter(Boolean);
    }

    const menuMap = {};
    menuRows.forEach(m => {
      menuMap[m.day] = {
        veg:         m.breakfast_veg      || [],
        nonVeg:      m.breakfast_nonveg   || [],
        slotVeg:     m.slot_veg     ?? null,
        slotNonVeg:  m.slot_nonveg  ?? null,
        stockVeg:    m.stock_veg    ?? 0,
        stockNonVeg: m.stock_nonveg ?? 0,
      };
    });

    const students = (await pool.query("SELECT user_id FROM users WHERE role='student'")).rows;
    const studentIds = new Set(students.map(s => s.user_id));

    const prefRows = (await pool.query(
      "SELECT * FROM preferences WHERE week_id=$1 AND user_id=ANY($2)",
      [weekId, [...studentIds]]
    )).rows;

    const analytics = {};
    prefRows.forEach(({ user_id, day, choice_index, diet, collected }) => {
      if (!studentIds.has(user_id)) return;

      const dietKey = diet || "veg";

      // Resolve item name: DB menu → fallback hardcoded menu
      const dbOptions = menuMap[day]?.[dietKey];
      const fallbackOptions = FALLBACK_MENU[day]?.[dietKey] || [];
      const options = (dbOptions && dbOptions.length > 0) ? dbOptions : fallbackOptions;
      const itemName = options[choice_index];

      const dayMenu = menuMap[day];
      if (!analytics[day]) {
        analytics[day] = {
          veg: {}, nonVeg: {},
          collected: 0, total: 0,
          slotVeg:     dayMenu?.slotVeg    ?? null,
          slotNonVeg:  dayMenu?.slotNonVeg ?? null,
          stockVeg:    dayMenu?.stockVeg   ?? 0,
          stockNonVeg: dayMenu?.stockNonVeg ?? 0,
        };
      }

      analytics[day].total++;
      if (collected) analytics[day].collected++;

      if (itemName) {
        if (!analytics[day][dietKey]) analytics[day][dietKey] = {};
        analytics[day][dietKey][itemName] = (analytics[day][dietKey][itemName] || 0) + 1;
      }
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
    const weekId = getCurrentWeekId();

    const students = (await pool.query("SELECT user_id FROM users WHERE role='student'")).rows;
    const studentIds = students.map(s => s.user_id);

    // Count DISTINCT students per diet — one student = one diet (use their most recent choice)
    // Each student has one diet value per preference row; we take any row per student
    // since diet is consistent across all days for a student in a week
    const rows = (await pool.query(
      `SELECT DISTINCT ON (user_id) user_id, diet
       FROM preferences
       WHERE week_id=$1 AND user_id=ANY($2)
       ORDER BY user_id, updated_at DESC`,
      [weekId, studentIds]
    )).rows;

    let veg = 0, nonVeg = 0;
    rows.forEach(r => {
      if (r.diet === "nonVeg") nonVeg++;
      else veg++;
    });

    const responded = rows.length;

    res.json({
      veg,
      nonVeg,
      noChoice: studentIds.length - responded,
      total: studentIds.length,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── VENDING MACHINE / IoT ENDPOINT ────────────────────────────────────────

// POST /api/preferences/collect — ESP32 scans student barcode, triggers dispensing
// Body: { registerId: "URK25CS1195" }  (the raw register number from barcode scanner)
router.post("/collect", async (req, res) => {
  try {
    const { registerId } = req.body;
    if (!registerId) return res.status(400).json({ message: "Register ID required" });

    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    const todayIST   = new Date(Date.now() + IST_OFFSET);
    const dayNames   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const today      = dayNames[todayIST.getUTCDay()];
    const weekId     = require("../utils/week").getCurrentWeekId();

    // Find user by register number (stored as user_id password, but we look up name in users)
    // The register number is part of the user_id email or we store it separately.
    // We match by looking for the preference whose user has this register number.
    // user_id is the email; register number == password (register number). 
    // For IoT lookup we need a separate field. We'll look up by user where user_id ILIKE pattern
    // OR we store register_number as a separate column. For now: match user whose avatar or name 
    // maps — actually we need to add register_id to users. Let's use a join approach:
    // The seed stores register number as the password hash — we can't reverse it.
    // Solution: add register_number column to users for barcode lookup.

    // Check if register_number column exists; if not, fall back to matching user_id suffix
    const userResult = await pool.query(
      "SELECT user_id, name, avatar FROM users WHERE register_number = $1 AND role='student'",
      [registerId.toUpperCase()]
    );

    if (!userResult.rows.length) {
      return res.status(404).json({ message: "Student not found", registerId });
    }

    const userId = userResult.rows[0].user_id;
    const name   = userResult.rows[0].name;

    // Get their preference for today
    const prefResult = await pool.query(
      "SELECT * FROM preferences WHERE user_id=$1 AND week_id=$2 AND day=$3",
      [userId, weekId, today]
    );

    if (!prefResult.rows.length) {
      return res.status(404).json({ message: "No breakfast selected for today", name });
    }

    const pref = prefResult.rows[0];

    if (pref.collected) {
      return res.status(409).json({
        message: "Breakfast already collected today",
        name,
        collectedAt: pref.collected_at,
      });
    }

    // Get menu for today to find slot number
    const menuResult = await pool.query(
      "SELECT * FROM menu WHERE week_id=$1 AND day=$2",
      [weekId, today]
    );

    const menu = menuResult.rows[0];
    const slotNumber = pref.diet === "nonVeg" ? menu?.slot_nonveg : menu?.slot_veg;
    const itemList   = pref.diet === "nonVeg" ? menu?.breakfast_nonveg : menu?.breakfast_veg;
    const itemName   = itemList?.[pref.choice_index] || "Unknown item";

    // Mark as collected & decrement stock
    await pool.query(
      "UPDATE preferences SET collected=TRUE, collected_at=NOW() WHERE user_id=$1 AND week_id=$2 AND day=$3",
      [userId, weekId, today]
    );

    // Decrement stock
    if (menu) {
      const stockCol = pref.diet === "nonVeg" ? "stock_nonveg" : "stock_veg";
      await pool.query(
        `UPDATE menu SET ${stockCol} = GREATEST(${stockCol} - 1, 0), updated_at=NOW() WHERE week_id=$1 AND day=$2`,
        [weekId, today]
      );
    }

    // Notify student their breakfast was collected
    pushSystemNotification({
      type: "collection",
      title: "✅ Breakfast Collected!",
      message: `Your breakfast "${itemName}" has been dispensed from Slot ${slotNumber}. Enjoy your meal!`,
      targetRole: "student",
      targetUser: userId,
    }).catch(() => {});

    res.json({
      success: true,
      name,
      item: itemName,
      diet: pref.diet,
      slot: slotNumber,
      message: `Dispense slot ${slotNumber} for ${name}`,
    });
  } catch (err) {
    // If register_number column doesn't exist yet, return helpful error
    if (err.message.includes("register_number")) {
      return res.status(500).json({ message: "Run /api/seed-users first to create register_number column" });
    }
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
