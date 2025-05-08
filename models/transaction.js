const mongoose = require("mongoose");
const transactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    type: {
      type: String,
      enum: ["deposit", "withdrawal", "investment", "referral", "profit"],
    },
    amount: Number,
    description: String,
    status: { type: String, default: "success" },
  },
  { timestamps: true }
);

const Transaction = mongoose.model("Transaction", transactionSchema);

module.exports = Transaction;
