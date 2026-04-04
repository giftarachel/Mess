// Run: node migrate_menu.js
// Adds weekId to existing menu documents that don't have one
require("dotenv").config();
const mongoose = require("mongoose");
const Menu = require("./models/Menu");
const { getCurrentWeekId } = require("./utils/week");

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected");

  const weekId = getCurrentWeekId();
  console.log("Current weekId:", weekId);

  // Find menus without weekId
  const menus = await Menu.find({ weekId: { $exists: false } });
  console.log(`Found ${menus.length} menus without weekId`);

  for (const m of menus) {
    await Menu.findByIdAndUpdate(m._id, { $set: { weekId } });
    console.log(`Updated ${m.day} → weekId: ${weekId}`);
  }

  console.log("Migration complete!");
  process.exit(0);
}

migrate().catch(e => { console.error(e); process.exit(1); });
