const mongoose = require("mongoose");
const userSchema = new mongoose.Schema(
  {
    fullname: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    number: { type: String },
    password: { type: String, required: true },
    referralCode: { type: String },
    referredBy: { type: String },
    country: { type: String },
    currency: { type: String },
    balance: { type: Number, default: 0 },
    profit: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    isAdmin: { type: Boolean, default: false },
    isSuspended: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

module.exports = User;
