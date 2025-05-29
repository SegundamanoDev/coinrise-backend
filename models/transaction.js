// models/transaction.js (Update the type enum and paymentProof field)

const mongoose = require("mongoose");

const transactionSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User", // Link to the User model
    },
    type: {
      type: String,
      required: true,
      enum: [
        "deposit",
        "withdrawal",
        "investment",
        "referral_bonus",
        "investment_return",
        "account_upgrade", // NEW: for account upgrade payments
      ],
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      required: true,
      enum: ["pending", "approved", "declined", "completed", "failed"], // 'approved' and 'declined' are typically final states
      default: "pending",
    },
    coin: {
      type: String, // e.g., "BTC", "ETH", "USDT"
      required: function () {
        // Coin is required for crypto-based transactions
        return (
          this.type === "deposit" ||
          this.type === "withdrawal" ||
          this.type === "account_upgrade"
        );
      },
    },
    method: {
      type: String, // e.g., "Crypto", "Bank Transfer", "Staking Plan"
      required: function () {
        return (
          this.type === "deposit" ||
          this.type === "withdrawal" ||
          this.type === "investment" ||
          this.type === "account_upgrade"
        );
      },
      default: "Crypto", // Default for crypto payments
    },
    paymentProof: {
      type: String, // URL or path to the uploaded proof of payment image
      required: function () {
        // Required for deposit and account upgrade
        return this.type === "deposit" || this.type === "account_upgrade";
      },
    },
    details: {
      type: Object, // Flexible field for additional transaction details (e.g., wallet address, txId, plan name for investment)
      default: {},
    },
    // If you plan to store the target upgrade level within the transaction
    // targetAccountLevel: {
    //   type: String,
    //   enum: ["Silver", "Gold", "Diamond"], // Levels user can upgrade to
    //   required: function() { return this.type === 'account_upgrade'; }
    // },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Transaction", transactionSchema);
