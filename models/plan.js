const mongoose = require("mongoose");
const planSchema = new mongoose.Schema(
  {
    name: String,
    amount: Number,
    roi: Number,
    duration: Number,
  },
  { timestamps: true }
);

const Plan = mongoose.model("Plan", planSchema);

module.exports = Plan;
