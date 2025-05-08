const mongoose = require("mongoose");

const investmentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  amount: { type: Number, required: true },
  planName: { type: String },
  roiPercentDaily: { type: Number }, // e.g., 5
  durationDays: { type: Number },
  startDate: { type: Date, default: Date.now },
  profitEarned: { type: Number, default: 0 },

  status: {
    type: String,
    enum: ["active", "completed", "cancelled"],
    default: "active",
  },
});

const Investment = mongoose.model("Investment", investmentSchema);

module.exports = Investment;
