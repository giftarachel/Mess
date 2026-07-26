require("dotenv").config();
const pool = require("./db");

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50) NOT NULL,           -- 'window_open','window_close','menu_update','collection','broadcast'
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        target_role VARCHAR(20) DEFAULT 'all', -- 'all','student','manager'
        target_user VARCHAR(255) DEFAULT NULL, -- specific user or NULL for all
        read_by TEXT[] DEFAULT '{}',           -- array of user_ids who read it
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log("✅ notifications table created");
  } catch(e) {
    console.error("❌", e.message);
  } finally {
    client.release();
    await pool.end();
  }
}
run();
