const mongoose = require("mongoose");

const preferenceSchema = new mongoose.Schema({
  userId:      { type: String, required: true },
  weekId:      { type: String, required: true }, // e.g. "2026-W15"
  day:         { type: String, required: true },
  meal:        { type: String, required: true },
  choiceIndex: { type: Number, required: true },
  diet:        { type: String, enum: ["veg", "nonVeg"], default: "veg" },
}, { timestamps: true });

// One vote per student per week per day per meal
preferenceSchema.index({ userId: 1, weekId: 1, day: 1, meal: 1 }, { unique: true });

module.exports = mongoose.model("Preference", preferenceSchema);
