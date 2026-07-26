require("dotenv").config();
const pool = require("./db");
const bcrypt = require("bcryptjs");

async function run() {
  const client = await pool.connect();
  try {
    // Add register_number column for IoT barcode scanning
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS register_number VARCHAR(50) UNIQUE
    `);

    // Seed users with register_number
    const users = [
      { userId: "ashwin@karunya.edu.in",     name: "Ashwin",     password: "URK25CS1195", registerNumber: "URK25CS1195", role: "student" },
      { userId: "gifta@karunya.edu.in",      name: "Gifta",      password: "URK25CS1079", registerNumber: "URK25CS1079", role: "student" },
      { userId: "eamil@karunya.edu.in",      name: "Eamil",      password: "URK25CS9065", registerNumber: "URK25CS9065", role: "student" },
      { userId: "prethiksha@karunya.edu.in", name: "Prethiksha", password: "URK25CS9030", registerNumber: "URK25CS9030", role: "student" },
      { userId: "manager@karunya.edu.in",    name: "Manager",    password: "MESS_MGR01",  registerNumber: null,          role: "manager" },
    ];

    for (const u of users) {
      const hashed = await bcrypt.hash(u.password, 10);
      const avatar = u.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
      await client.query(`
        INSERT INTO users (user_id, name, password, role, avatar, register_number)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (user_id) DO UPDATE SET
          name=EXCLUDED.name, password=EXCLUDED.password,
          avatar=EXCLUDED.avatar, register_number=EXCLUDED.register_number
      `, [u.userId, u.name, hashed, u.role, avatar, u.registerNumber]);
      console.log(`✅ Upserted: ${u.userId}`);
    }

    console.log("✅ register_number column added and users seeded");
  } catch (e) {
    console.error("❌ Error:", e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
