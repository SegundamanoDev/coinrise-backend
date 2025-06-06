// models/Transaction.js

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

    paymentProof: {
      secure_url: { type: String, default: null },
      public_id: { type: String, default: null },
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
      // This will now explicitly store the cryptocurrency symbol (e.g., "BTC", "USDT") for crypto transactions.
      // For withdrawals, it could still be "Bank Transfer", "Crypto Wallet", etc.
      type: String,
      required: false,
      default: "USDT",
    },
    // --- NEW FIELD: details to store additional transaction info like wallet addresses ---
    details: {
      type: mongoose.Schema.Types.Mixed, // Allows flexible schema-less data
      default: {}, // Default to an empty object
    },
    // --- END NEW FIELD ---
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.Transaction ||
  mongoose.model("Transaction", transactionSchema);
