const mongoose = require("mongoose");
const referralSchema = new mongoose.Schema(
  {
    referrerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    referredId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    bonus: Number,
  },
  { timestamps: true }
);

const Referral = mongoose.model("Referral", referralSchema);

module.exports = Referral;
