const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Type: deposit or withdrawal
    type: {
      type: String,
      enum: ["deposit", "withdrawal", "investment"],
      required: true,
    },

    // Amount of the transaction
    amount: {
      type: Number,
      required: true,
    },

    // For deposits: coin type (BTC, ETH, LTC, USDT)
    coin: {
      type: String,
      enum: ["BTC", "ETH", "LTC", "USDT"],
      required: function () {
        return this.type === "deposit";
      },
    },

    // For withdrawals: payment method
    method: {
      type: String,
      enum: ["BTC", "Bank Transfer", "CashApp", "PayPal"],
      required: function () {
        return this.type === "withdrawal";
      },
    },

    // Optional nested details depending on method or coin
    details: {
      type: mongoose.Schema.Types.Mixed, // Accepts any nested object
    },

    // Transaction status
    status: {
      type: String,
      enum: ["pending", "approved", "declined"],
      default: "pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Transaction", transactionSchema);
