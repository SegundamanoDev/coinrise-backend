const mongoose = require("mongoose");

const depositSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  amount: { type: Number, required: true },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  method: { type: String },
  txHash: { type: String },
  createdAt: { type: Date, default: Date.now },
});

const Deposit =
  mongoose.models.Deposit || mongoose.model("Deposit", depositSchema);

module.exports = Deposit;
