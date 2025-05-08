const mongoose = require("mongoose");
const settingSchema = new mongoose.Schema(
  {
    roiPercent: Number,
    referralBonus: Number,
    minDeposit: Number,
    maxDeposit: Number,
    walletAddress: String,
    maintenanceMode: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Setting = mongoose.model("Setting", settingSchema);

module.exports = Setting;
