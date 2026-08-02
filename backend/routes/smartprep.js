const router = require("express").Router();
const auth   = require("../middleware/auth");
const pool   = require("../db");
const { getCurrentWeekId } = require("../utils/week");

const DEFAULT_AVG = 1.8; // used when no historical data exists
const MIN_DATA_POINTS_FOR_ML = 5; // switch from rule-based after this many records

// ─── AI ENGINE ───────────────────────────────────────────────────────────────

/**
 * Fetch historical average quantity for a food item on a given day.
 * Returns { avg, dataPoints, trend, weeklyTotals }
 */
async function getHistoricalStats(foodItem, dayOfWeek) {
  // Per-collection average quantity
  const avgResult = await pool.query(`
    SELECT
      COUNT(*)                          AS data_points,
      AVG(quantity_collected)           AS avg_qty,
      SUM(quantity_collected)           AS total_qty,
      MIN(quantity_collected)           AS min_qty,
      MAX(quantity_collected)           AS max_qty
    FROM collection_history
    WHERE food_item = $1 AND day_of_week = $2
  `, [foodItem, dayOfWeek]);

  const row = avgResult.rows[0];
  const dataPoints = parseInt(row.data_points) || 0;
  const avgQty     = parseFloat(row.avg_qty)   || DEFAULT_AVG;
  const minQty     = parseInt(row.min_qty)     || 1;
  const maxQty     = parseInt(row.max_qty)     || 3;

  // Weekly consumption totals for trend chart (last 8 weeks)
  const trendResult = await pool.query(`
    SELECT
      week_id,
      SUM(quantity_collected) AS total,
      COUNT(DISTINCT student_id) AS student_count,
      ROUND(AVG(quantity_collected)::numeric, 3) AS avg_qty
    FROM collection_history
    WHERE food_item = $1 AND day_of_week = $2
    GROUP BY week_id
    ORDER BY week_id DESC
    LIMIT 8
  `, [foodItem, dayOfWeek]);

  const weeklyTotals = trendResult.rows.reverse(); // oldest first for charts

  // Simple linear trend: positive = consumption growing, negative = shrinking
  let trend = 0;
  if (weeklyTotals.length >= 2) {
    const first = parseFloat(weeklyTotals[0].avg_qty) || DEFAULT_AVG;
    const last  = parseFloat(weeklyTotals[weeklyTotals.length - 1].avg_qty) || DEFAULT_AVG;
    trend = parseFloat(((last - first) / first * 100).toFixed(1));
  }

  return { avgQty, dataPoints, minQty, maxQty, trend, weeklyTotals };
}

/**
 * Calculate confidence score based on data quality.
 * More data points + lower variance = higher confidence.
 */
function calcConfidence(dataPoints, trend) {
  if (dataPoints === 0) return 30; // no data, rule-based baseline
  if (dataPoints < 3)  return 45;
  if (dataPoints < 5)  return 60;
  if (dataPoints < 10) return 75;
  if (dataPoints < 20) return 85;
  // High data volume — reduce confidence slightly if trend is volatile
  const volatilityPenalty = Math.min(Math.abs(trend) * 0.1, 10);
  return Math.round(Math.min(97, 90 - volatilityPenalty));
}

/**
 * Generate AI preparation recommendation for a food item.
 */
async function generateRecommendation(foodItem, diet, dayOfWeek, studentsSelected, currentStock) {
  const hist = await getHistoricalStats(foodItem, dayOfWeek);
  const { avgQty, dataPoints, minQty, maxQty, trend, weeklyTotals } = hist;

  // ── Model selection ──────────────────────────────────────────────────────
  let model = "rule_based";
  let suggestedQty;
  let reasoning;

  if (dataPoints >= MIN_DATA_POINTS_FOR_ML) {
    // Statistical model: weighted average (recent data weighted more)
    // Simple linear regression simulation using trend adjustment
    const trendFactor = 1 + (trend / 100) * 0.3; // dampen trend impact
    const adjustedAvg = Math.min(3, Math.max(1, avgQty * trendFactor));
    suggestedQty = Math.ceil(studentsSelected * adjustedAvg);
    model = "statistical";
    reasoning = `Based on ${dataPoints} historical transactions. Average consumption: ${avgQty.toFixed(2)} units/student. Trend: ${trend > 0 ? "+" : ""}${trend}% vs baseline.`;
  } else {
    // Rule-based: use DEFAULT_AVG or partial historical average
    const effectiveAvg = dataPoints > 0 ? avgQty : DEFAULT_AVG;
    suggestedQty = Math.ceil(studentsSelected * effectiveAvg);
    model = "rule_based";
    reasoning = dataPoints > 0
      ? `Based on ${dataPoints} transaction(s). Using historical average of ${effectiveAvg.toFixed(2)} units/student.`
      : `No historical data yet. Using default average of ${DEFAULT_AVG} units/student.`;
  }

  const confidence    = calcConfidence(dataPoints, trend);
  const minRequired   = studentsSelected;        // at least 1 per student
  const maxPossible   = studentsSelected * 3;    // max 3 per student
  const prevWeekTotal = weeklyTotals.length > 0
    ? parseInt(weeklyTotals[weeklyTotals.length - 1].total) || 0
    : 0;

  return {
    foodItem,
    diet,
    dayOfWeek,
    studentsSelected,
    minRequired,
    maxPossible,
    historicalAvg:    parseFloat(avgQty.toFixed(3)),
    suggestedQuantity: suggestedQty,
    currentInventory: currentStock || 0,
    prevWeekConsumption: prevWeekTotal,
    confidenceScore:  confidence,
    dataPoints,
    model,
    reasoning,
    trend,
    weeklyTrend: weeklyTotals.map(w => ({
      weekId:       w.week_id,
      total:        parseInt(w.total),
      students:     parseInt(w.student_count),
      avgQty:       parseFloat(w.avg_qty),
    })),
  };
}

// ─── ROUTES ──────────────────────────────────────────────────────────────────

// GET /api/smartprep/recommendations?day=Mon
// Returns AI recommendations for all food items scheduled for a given day
router.get("/recommendations", auth, async (req, res) => {
  try {
    if (req.user.role !== "manager") return res.status(403).json({ message: "Forbidden" });

    const weekId = getCurrentWeekId();
    const { day } = req.query;
    const targetDays = day ? [day] : ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

    const FALLBACK_MENU = {
      Mon: { veg: ["Idli Sambar","Poha","Upma"],           nonVeg: ["Egg Bhurji","Omelette Wrap"] },
      Tue: { veg: ["Dosa Chutney","Paratha","Cornflakes"],  nonVeg: ["Egg Paratha","Boiled Eggs"] },
      Wed: { veg: ["Bread Butter Jam","Poha","Upma"],       nonVeg: ["Egg Toast","Omelette"] },
      Thu: { veg: ["Idli Vada","Sprouts Bowl","Pongal"],    nonVeg: ["Egg Dosa","Boiled Eggs"] },
      Fri: { veg: ["Poha","Dosa Sambar","Upma"],            nonVeg: ["Egg Bhurji","Omelette"] },
      Sat: { veg: ["Chole Bhature","Paratha Pickle"],       nonVeg: ["Egg Paratha","Chicken Sandwich"] },
      Sun: { veg: ["Puri Sabzi","Halwa Poori"],             nonVeg: ["Egg Puri","Omelette"] },
    };

    const results = {};

    for (const d of targetDays) {
      // Get menu for this day
      const menuRow = (await pool.query(
        "SELECT * FROM menu WHERE week_id=$1 AND day=$2 LIMIT 1",
        [weekId, d]
      )).rows[0];

      const vegItems    = menuRow?.breakfast_veg    || FALLBACK_MENU[d]?.veg    || [];
      const nonVegItems = menuRow?.breakfast_nonveg || FALLBACK_MENU[d]?.nonVeg || [];
      const stockVeg    = menuRow?.stock_veg    ?? 0;
      const stockNonVeg = menuRow?.stock_nonveg ?? 0;

      // Count students who selected each item for this day/week
      const prefRows = (await pool.query(`
        SELECT p.choice_index, p.diet, COUNT(*) AS cnt
        FROM preferences p
        JOIN users u ON u.user_id = p.user_id
        WHERE p.week_id=$1 AND p.day=$2 AND u.role='student'
        GROUP BY p.choice_index, p.diet
      `, [weekId, d])).rows;

      // Build selection map: { "veg_0": 3, "nonVeg_1": 2 }
      const selMap = {};
      prefRows.forEach(r => {
        selMap[`${r.diet}_${r.choice_index}`] = parseInt(r.cnt);
      });

      const dayRecs = [];

      // Veg items
      for (let i = 0; i < vegItems.length; i++) {
        const selected = selMap[`veg_${i}`] || 0;
        if (selected === 0 && vegItems[i] === "New Item") continue;
        const rec = await generateRecommendation(vegItems[i], "veg", d, selected, stockVeg);
        dayRecs.push(rec);
      }

      // Non-veg items
      for (let i = 0; i < nonVegItems.length; i++) {
        const selected = selMap[`nonVeg_${i}`] || 0;
        if (selected === 0 && nonVegItems[i] === "New Item") continue;
        const rec = await generateRecommendation(nonVegItems[i], "nonVeg", d, selected, stockNonVeg);
        dayRecs.push(rec);
      }

      if (dayRecs.length > 0) results[d] = dayRecs;
    }

    res.json({ weekId, recommendations: results });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/smartprep/confirm
// Manager confirms/overrides the preparation plan
router.post("/confirm", auth, async (req, res) => {
  try {
    if (req.user.role !== "manager") return res.status(403).json({ message: "Forbidden" });

    const weekId = getCurrentWeekId();
    const { day, foodItem, diet, managerFinalQty, suggestedQty, studentsSelected, historicalAvg, confidenceScore, model } = req.body;

    await pool.query(`
      INSERT INTO food_prediction_history
        (food_item, diet, day_of_week, week_id, prediction_date, students_selected,
         historical_avg_qty, suggested_quantity, manager_final_qty,
         confidence_score, prediction_model, updated_at)
      VALUES ($1,$2,$3,$4,CURRENT_DATE,$5,$6,$7,$8,$9,$10,NOW())
      ON CONFLICT (food_item, day_of_week, week_id) DO UPDATE SET
        manager_final_qty   = EXCLUDED.manager_final_qty,
        suggested_quantity  = EXCLUDED.suggested_quantity,
        students_selected   = EXCLUDED.students_selected,
        confidence_score    = EXCLUDED.confidence_score,
        prediction_model    = EXCLUDED.prediction_model,
        updated_at          = NOW()
    `, [
      foodItem, diet, day, weekId,
      studentsSelected, historicalAvg, suggestedQty,
      managerFinalQty, confidenceScore, model
    ]);

    res.json({ success: true, message: `Preparation plan saved: ${managerFinalQty} units of ${foodItem} for ${day}` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/smartprep/history
// Historical analytics: consumption trends, popular items, wastage estimate
router.get("/history", auth, async (req, res) => {
  try {
    if (req.user.role !== "manager") return res.status(403).json({ message: "Forbidden" });

    // Most popular items (all time)
    const popular = (await pool.query(`
      SELECT food_item, diet,
        SUM(quantity_collected)           AS total_qty,
        COUNT(*)                          AS transactions,
        COUNT(DISTINCT student_id)        AS unique_students,
        ROUND(AVG(quantity_collected)::numeric, 2) AS avg_qty,
        MAX(collection_date)              AS last_seen
      FROM collection_history
      GROUP BY food_item, diet
      ORDER BY total_qty DESC
      LIMIT 10
    `)).rows;

    // Daily consumption (last 30 days)
    const daily = (await pool.query(`
      SELECT
        collection_date::text    AS date,
        SUM(quantity_collected)  AS total,
        COUNT(DISTINCT student_id) AS students,
        ROUND(AVG(quantity_collected)::numeric, 2) AS avg_qty
      FROM collection_history
      WHERE collection_date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY collection_date
      ORDER BY collection_date
    `)).rows;

    // Weekly totals (last 12 weeks)
    const weekly = (await pool.query(`
      SELECT
        week_id,
        SUM(quantity_collected)    AS total,
        COUNT(DISTINCT student_id) AS students,
        COUNT(DISTINCT food_item)  AS items_served,
        ROUND(AVG(quantity_collected)::numeric, 2) AS avg_qty
      FROM collection_history
      GROUP BY week_id
      ORDER BY week_id DESC
      LIMIT 12
    `)).rows.reverse();

    // Day of week patterns
    const byDay = (await pool.query(`
      SELECT
        day_of_week,
        SUM(quantity_collected)    AS total,
        COUNT(DISTINCT student_id) AS students,
        ROUND(AVG(quantity_collected)::numeric, 2) AS avg_qty
      FROM collection_history
      GROUP BY day_of_week
      ORDER BY (ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])::text[]
               = day_of_week::text[] DESC
    `)).rows;

    // Prediction accuracy (where we have actual vs predicted)
    const accuracy = (await pool.query(`
      SELECT
        food_item,
        day_of_week,
        ROUND(AVG(
          CASE WHEN manager_final_qty > 0 AND actual_quantity > 0
            THEN 100 - ABS(manager_final_qty - actual_quantity)::float
                       / manager_final_qty * 100
          END
        )::numeric, 1) AS accuracy_pct,
        COUNT(*) AS predictions
      FROM food_prediction_history
      WHERE manager_final_qty IS NOT NULL
      GROUP BY food_item, day_of_week
      ORDER BY accuracy_pct DESC NULLS LAST
      LIMIT 10
    `)).rows;

    // Wastage estimate: manager_final_qty - actual_quantity when positive
    const wastage = (await pool.query(`
      SELECT
        food_item,
        SUM(GREATEST(manager_final_qty - COALESCE(actual_quantity,0), 0)) AS wasted,
        SUM(manager_final_qty) AS prepared,
        SUM(COALESCE(actual_quantity,0)) AS consumed
      FROM food_prediction_history
      WHERE manager_final_qty IS NOT NULL
      GROUP BY food_item
      ORDER BY wasted DESC
      LIMIT 10
    `)).rows;

    res.json({ popular, daily, weekly, byDay, accuracy, wastage });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/smartprep/record-collection
// Called by vending machine after dispensing (updates collection_history + actual_quantity)
router.post("/record-collection", async (req, res) => {
  try {
    const { studentId, foodItem, diet, dayOfWeek, quantityCollected, weekId, machineId } = req.body;
    if (!studentId || !foodItem || !quantityCollected)
      return res.status(400).json({ message: "studentId, foodItem, quantityCollected required" });

    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    const now = new Date(Date.now() + IST_OFFSET);
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toISOString().split("T")[1].split(".")[0];

    await pool.query(`
      INSERT INTO collection_history
        (student_id, food_item, diet, day_of_week, collection_date, collection_time,
         quantity_collected, week_id, machine_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    `, [
      studentId, foodItem, diet || "veg", dayOfWeek,
      dateStr, timeStr, quantityCollected,
      weekId || require("../utils/week").getCurrentWeekId(),
      machineId || "VM-01"
    ]);

    // Update actual_quantity in prediction history
    await pool.query(`
      UPDATE food_prediction_history
      SET actual_quantity = COALESCE(actual_quantity, 0) + $1,
          updated_at = NOW()
      WHERE food_item=$2 AND day_of_week=$3 AND week_id=$4
    `, [quantityCollected, foodItem, dayOfWeek, weekId || require("../utils/week").getCurrentWeekId()]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/smartprep/summary
// Quick summary stats for the manager overview dashboard
router.get("/summary", auth, async (req, res) => {
  try {
    if (req.user.role !== "manager") return res.status(403).json({ message: "Forbidden" });

    const weekId = getCurrentWeekId();

    const totalCollections = parseInt((await pool.query(
      "SELECT COUNT(*) AS cnt FROM collection_history"
    )).rows[0].cnt);

    const thisWeek = parseInt((await pool.query(
      "SELECT COALESCE(SUM(quantity_collected),0) AS total FROM collection_history WHERE week_id=$1",
      [weekId]
    )).rows[0].total);

    const avgQtyPerStudent = parseFloat((await pool.query(
      "SELECT COALESCE(ROUND(AVG(quantity_collected)::numeric,2),1.8) AS avg FROM collection_history"
    )).rows[0].avg);

    const confirmedPlans = parseInt((await pool.query(
      "SELECT COUNT(*) AS cnt FROM food_prediction_history WHERE week_id=$1 AND manager_final_qty IS NOT NULL",
      [weekId]
    )).rows[0].cnt);

    res.json({ totalCollections, thisWeekQty: thisWeek, avgQtyPerStudent, confirmedPlans, weekId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
