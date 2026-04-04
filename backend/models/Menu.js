const mongoose = require("mongoose");

const menuSchema = new mongoose.Schema({
  weekId: { type: String, required: true }, // e.g. "2026-W15"
  day:    { type: String, required: true },  // "Mon"..."Sun"
  Breakfast: { veg: [String], nonVeg: [String] },
  Lunch:     { veg: [String], nonVeg: [String] },
  Dinner:    { veg: [String], nonVeg: [String] },
  defaultBreakfastVeg:    { type: Number, default: null },
  defaultBreakfastNonVeg: { type: Number, default: null },
  defaultLunchVeg:        { type: Number, default: null },
  defaultLunchNonVeg:     { type: Number, default: null },
  defaultDinnerVeg:       { type: Number, default: null },
  defaultDinnerNonVeg:    { type: Number, default: null },
}, { timestamps: true });

menuSchema.index({ weekId: 1, day: 1 }, { unique: true });

module.exports = mongoose.model("Menu", menuSchema);
