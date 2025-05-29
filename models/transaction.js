// models/Transaction.js (Example - assuming Mongoose)

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
      required: true,
    },
    type: {
      type: String, // 'deposit', 'withdrawal', 'upgrade_deposit', 'referral_bonus', etc.
      required: true,
      enum: ["deposit", "withdrawal", "upgrade_deposit", "referral_bonus"], // Add 'upgrade_deposit'
    },
    proofOfPayment: {
      type: String, // Path to the uploaded image
      required: function () {
        // Only required for deposit/upgrade_deposit
        return this.type === "deposit" || this.type === "upgrade_deposit";
      },
    },
    status: {
      type: String,
      required: true,
      default: "pending", // 'pending', 'approved', 'rejected'
      enum: ["pending", "approved", "rejected"],
    },
    // --- New fields for upgrade transactions ---
    planId: {
      type: String, // Store the ID of the plan (e.g., 'basic', 'standard', 'premium')
      required: function () {
        return this.type === "upgrade_deposit";
      },
    },
    planName: {
      type: String, // Store the human-readable name of the plan (e.g., 'Basic Tier')
      required: function () {
        return this.type === "upgrade_deposit";
      },
    },
    // --- End new fields ---
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.Transaction ||
  mongoose.model("Transaction", transactionSchema);
