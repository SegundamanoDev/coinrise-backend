const mongoose = require("mongoose");

const investmentPlanSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    amount: { type: Number, required: true },
    roiPercent: { type: Number, required: true }, // e.g. 20 means 20%
    durationHours: { type: Number, required: true },
    support: { type: Boolean, default: false },
    dailyReport: { type: Boolean, default: false },
    commissionPercent: { type: Number, required: true }, // for referrals
    capitalInsurancePercent: { type: Number, required: true },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("InvestmentPlan", investmentPlanSchema);
