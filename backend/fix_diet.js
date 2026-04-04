// Run: node fix_diet.js
// Clears ALL preferences so students re-select with correct diet assignment
require("dotenv").config();
const mongoose = require("mongoose");
const Preference = require("./models/Preference");

async function fix() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected");

  const count = await Preference.countDocuments();
  console.log(`Found ${count} preference records`);

  await Preference.deleteMany({});
  console.log("All preferences cleared. Students must re-select their meals.");

  process.exit(0);
}

fix().catch(e => { console.error(e); process.exit(1); });
