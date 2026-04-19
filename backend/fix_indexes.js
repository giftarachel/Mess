// Run once: node fix_indexes.js
require("dotenv").config();
const mongoose = require("mongoose");

async function fixIndexes() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected");

  const collection = mongoose.connection.collection("preferences");

  // List current indexes
  const indexes = await collection.indexes();
  console.log("Current indexes:", indexes.map(i => i.name));

  // Drop the stale index (missing weekId)
  try {
    await collection.dropIndex("userId_1_day_1_meal_1");
    console.log("Dropped stale index: userId_1_day_1_meal_1");
  } catch (e) {
    console.log("Stale index not found or already dropped:", e.message);
  }

  // Also drop the correct index so Mongoose can recreate it cleanly
  try {
    await collection.dropIndex("userId_1_weekId_1_day_1_meal_1");
    console.log("Dropped existing correct index to recreate cleanly");
  } catch (e) {
    console.log("Correct index not found:", e.message);
  }

  // Recreate the correct unique index
  await collection.createIndex(
    { userId: 1, weekId: 1, day: 1, meal: 1 },
    { unique: true }
  );
  console.log("Created correct index: userId_1_weekId_1_day_1_meal_1");

  process.exit(0);
}

fixIndexes().catch(err => { console.error(err); process.exit(1); });
