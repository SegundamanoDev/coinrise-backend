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
      required: true, // Keep as required, ensure it's provided or has a default
    },
    type: {
      type: String,
      required: true,
      // ADDED 'investment' to the enum
      enum: [
        "deposit",
        "withdrawal",
        "upgrade_deposit",
        "referral_bonus",
        "investment",
      ],
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
      default: "pending",
      // ADDED 'approved', 'processed' and 'completed' to the enum
      enum: ["pending", "approved", "rejected", "processed", "completed"],
    },
    // --- New fields for upgrade transactions (keep as is) ---
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
