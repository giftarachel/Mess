require("dotenv").config();
const pool = require("./db");

async function run() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Menu: remove lunch/dinner columns, add slot numbers and stock counts
    await client.query(`
      ALTER TABLE menu
        DROP COLUMN IF EXISTS lunch_veg,
        DROP COLUMN IF EXISTS lunch_nonveg,
        DROP COLUMN IF EXISTS dinner_veg,
        DROP COLUMN IF EXISTS dinner_nonveg,
        DROP COLUMN IF EXISTS default_lunch_veg,
        DROP COLUMN IF EXISTS default_lunch_nonveg,
        DROP COLUMN IF EXISTS default_dinner_veg,
        DROP COLUMN IF EXISTS default_dinner_nonveg,
        ADD COLUMN IF NOT EXISTS slot_veg INT DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS slot_nonveg INT DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS stock_veg INT DEFAULT 0,
        ADD COLUMN IF NOT EXISTS stock_nonveg INT DEFAULT 0
    `);

    // Preferences: drop old meal-level unique constraint
    await client.query(`ALTER TABLE preferences DROP CONSTRAINT IF EXISTS preferences_user_id_week_id_day_meal_key`);
    await client.query(`ALTER TABLE preferences DROP CONSTRAINT IF EXISTS preferences_user_week_day`);

    // Preferences: remove meal column, add collection tracking
    await client.query(`ALTER TABLE preferences DROP COLUMN IF EXISTS meal`);
    await client.query(`ALTER TABLE preferences ADD COLUMN IF NOT EXISTS collected BOOLEAN DEFAULT FALSE`);
    await client.query(`ALTER TABLE preferences ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ DEFAULT NULL`);

    // Preferences: one preference per student per week per day (breakfast only)
    await client.query(`
      ALTER TABLE preferences
        ADD CONSTRAINT preferences_user_week_day UNIQUE(user_id, week_id, day)
    `);

    await client.query("COMMIT");
    console.log("✅ Schema updated successfully — breakfast-only mode");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("❌ Error:", e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
