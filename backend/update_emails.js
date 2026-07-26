require("dotenv").config();
const pool = require("./db");
const bcrypt = require("bcryptjs");

async function run() {
  const client = await pool.connect();
  try {
    // Map old email → new email
    const updates = [
      { old: "ashwin@college.edu",     new: "ashwin@karunya.edu.in",     name: "Ashwin",     password: "URK25CS1195", role: "student", reg: "URK25CS1195" },
      { old: "gifta@college.edu",      new: "gifta@karunya.edu.in",      name: "Gifta",      password: "URK25CS1079", role: "student", reg: "URK25CS1079" },
      { old: "eamil@college.edu",      new: "eamil@karunya.edu.in",      name: "Eamil",      password: "URK25CS9065", role: "student", reg: "URK25CS9065" },
      { old: "prethiksha@college.edu", new: "prethiksha@karunya.edu.in", name: "Prethiksha", password: "URK25CS9030", role: "student", reg: "URK25CS9030" },
      { old: "manager@lumiluna.edu",   new: "manager@karunya.edu.in",    name: "Manager",    password: "MESS_MGR01",  role: "manager", reg: null },
    ];

    for (const u of updates) {
      const hashed = await bcrypt.hash(u.password, 10);
      const avatar = u.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

      // Delete old row first (cascade not needed — no FK constraints)
      await client.query("DELETE FROM users WHERE user_id = $1", [u.old]);

      // Also update preferences / leave_dates that reference old user_id
      await client.query("UPDATE preferences  SET user_id=$1 WHERE user_id=$2", [u.new, u.old]);
      await client.query("UPDATE leave_dates  SET user_id=$1 WHERE user_id=$2", [u.new, u.old]);
      await client.query("UPDATE feedback     SET user_id=$1 WHERE user_id=$2", [u.new, u.old]);

      // Upsert new row
      await client.query(`
        INSERT INTO users (user_id, name, password, role, avatar, register_number)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (user_id) DO UPDATE SET
          name=EXCLUDED.name, password=EXCLUDED.password,
          role=EXCLUDED.role, avatar=EXCLUDED.avatar, register_number=EXCLUDED.register_number
      `, [u.new, u.name, hashed, u.role, avatar, u.reg]);

      console.log(`✅ ${u.old} → ${u.new}`);
    }

    console.log("\n✅ All emails updated to @karunya.edu.in");
  } catch (e) {
    console.error("❌ Error:", e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
