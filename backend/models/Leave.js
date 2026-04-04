const mongoose = require("mongoose");

const leaveSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  date: { type: String, required: true }, // "YYYY-MM-DD"
}, { timestamps: true });

leaveSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Leave", leaveSchema);
