require("dotenv").config();
const pool = require("./db");

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // USERS table
    // userId = institutional email (e.g. student@college.edu)
    // password = register number (hashed)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) UNIQUE NOT NULL,   -- institutional email
        name VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,          -- bcrypt hashed register number
        role VARCHAR(50) DEFAULT 'student' CHECK (role IN ('student', 'manager')),
        avatar VARCHAR(10),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // MENU table
    await client.query(`
      CREATE TABLE IF NOT EXISTS menu (
        id SERIAL PRIMARY KEY,
        week_id VARCHAR(20) NOT NULL,            -- e.g. "2026-W30"
        day VARCHAR(10) NOT NULL,                -- "Mon".."Sun"
        breakfast_veg TEXT[] DEFAULT '{}',
        breakfast_nonveg TEXT[] DEFAULT '{}',
        lunch_veg TEXT[] DEFAULT '{}',
        lunch_nonveg TEXT[] DEFAULT '{}',
        dinner_veg TEXT[] DEFAULT '{}',
        dinner_nonveg TEXT[] DEFAULT '{}',
        default_breakfast_veg INT DEFAULT NULL,
        default_breakfast_nonveg INT DEFAULT NULL,
        default_lunch_veg INT DEFAULT NULL,
        default_lunch_nonveg INT DEFAULT NULL,
        default_dinner_veg INT DEFAULT NULL,
        default_dinner_nonveg INT DEFAULT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(week_id, day)
      );
    `);

    // PREFERENCES table
    await client.query(`
      CREATE TABLE IF NOT EXISTS preferences (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        week_id VARCHAR(20) NOT NULL,
        day VARCHAR(10) NOT NULL,
        meal VARCHAR(20) NOT NULL,
        choice_index INT NOT NULL,
        diet VARCHAR(10) DEFAULT 'veg' CHECK (diet IN ('veg', 'nonVeg')),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, week_id, day, meal)
      );
    `);

    // LEAVE table
    await client.query(`
      CREATE TABLE IF NOT EXISTS leave_dates (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, date)
      );
    `);

    // FEEDBACK table
    await client.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        meal VARCHAR(20) NOT NULL CHECK (meal IN ('Breakfast','Lunch','Dinner','General')),
        rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query("COMMIT");
    console.log("✅ All tables created successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Migration failed:", err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
