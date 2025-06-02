const mongoose = require("mongoose");

const transactionSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    amount: {
      type: Number,
      required: true,
    },
    coin: {
      type: String,
      required: false, // Make this false for "topup_profit" if coin isn't always relevant
      default: "USDT", // Set a default if it's not always provided
    },
    type: {
      type: String,
      required: true,
      enum: [
        "deposit",
        "withdrawal",
        "upgrade_deposit",
        "referral_bonus",
        "investment",
        "investment_payout",
        "profit", // NEW: Added for admin top-ups
      ],
    },
    proofOfPayment: {
      type: String, // Path to the uploaded image
      required: function () {
        return this.type === "deposit" || this.type === "upgrade_deposit";
      },
    },
    status: {
      type: String,
      required: true,
      default: "pending",
      enum: ["pending", "approved", "rejected", "processed", "completed"],
    },
    planId: {
      type: String,
      required: function () {
        return this.type === "upgrade_deposit";
      },
    },
    planName: {
      type: String,
      required: function () {
        return this.type === "upgrade_deposit";
      },
    },
    notes: {
      type: String,
    },
    method: {
      type: String,
      required: false,
      default: "USDT",
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.Transaction ||
  mongoose.model("Transaction", transactionSchema);
