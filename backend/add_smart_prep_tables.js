require("dotenv").config();
const pool = require("./db");

async function run() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── collection_history: every vending machine transaction ──────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS collection_history (
        id               SERIAL PRIMARY KEY,
        student_id       VARCHAR(255) NOT NULL,
        food_item        VARCHAR(255) NOT NULL,
        diet             VARCHAR(10)  NOT NULL DEFAULT 'veg',
        day_of_week      VARCHAR(10)  NOT NULL,
        collection_date  DATE         NOT NULL,
        collection_time  TIMETZ       NOT NULL DEFAULT NOW(),
        quantity_collected INT        NOT NULL DEFAULT 1 CHECK (quantity_collected BETWEEN 1 AND 3),
        week_id          VARCHAR(20)  NOT NULL,
        machine_id       VARCHAR(50)  DEFAULT 'VM-01',
        created_at       TIMESTAMPTZ  DEFAULT NOW()
      );
    `);

    // Index for fast historical lookups per item + day
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ch_food_day
      ON collection_history (food_item, day_of_week);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ch_date
      ON collection_history (collection_date);
    `);

    // ── food_prediction_history: AI recommendation log ─────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS food_prediction_history (
        id                   SERIAL PRIMARY KEY,
        food_item            VARCHAR(255) NOT NULL,
        diet                 VARCHAR(10)  NOT NULL DEFAULT 'veg',
        day_of_week          VARCHAR(10)  NOT NULL,
        week_id              VARCHAR(20)  NOT NULL,
        prediction_date      DATE         NOT NULL DEFAULT CURRENT_DATE,
        students_selected    INT          NOT NULL DEFAULT 0,
        historical_avg_qty   NUMERIC(5,3) DEFAULT 1.8,
        suggested_quantity   INT          NOT NULL,
        manager_final_qty    INT          DEFAULT NULL,
        actual_quantity      INT          DEFAULT NULL,
        confidence_score     NUMERIC(5,2) DEFAULT 0,
        data_points          INT          DEFAULT 0,
        prediction_model     VARCHAR(50)  DEFAULT 'rule_based',
        created_at           TIMESTAMPTZ  DEFAULT NOW(),
        updated_at           TIMESTAMPTZ  DEFAULT NOW(),
        UNIQUE(food_item, day_of_week, week_id)
      );
    `);

    await client.query("COMMIT");
    console.log("✅ collection_history and food_prediction_history tables created.");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("❌ Error:", e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
