const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema({
  userId:  { type: String, required: true },
  name:    { type: String, required: true },
  meal:    { type: String, enum: ["Breakfast","Lunch","Dinner","General"], required: true },
  rating:  { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, maxlength: 500, default: "" },
}, { timestamps: true });

module.exports = mongoose.model("Feedback", feedbackSchema);
