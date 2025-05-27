const express = require("express");
const { verifyToken } = require("../middlewares/auth.js");
const Transaction = require("../models/transaction.js");
const User = require("../models/User.js");
const router = express.Router();

router.post("/request", verifyToken, async (req, res) => {
  try {
    const { type, amount, coin, method, details } = req.body;
    const userId = req.user._id;

    if (!type || !amount) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    // Get the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Balance check for withdrawals
    if (type === "withdrawal") {
      if (amount > user.balance) {
        return res
          .status(400)
          .json({ message: "Insufficient balance for this withdrawal." });
      }
    }

    // Create the transaction
    const transaction = await Transaction.create({
      user: userId,
      type,
      amount,
      coin: type === "deposit" ? coin : undefined,
      method: type === "withdrawal" ? method : undefined,
      details: details || {},
    });

    // Deduct balance if it's a withdrawal
    if (type === "withdrawal") {
      user.balance -= amount;
      await user.save();
    }

    res.status(201).json(transaction);
  } catch (error) {
    res.status(500).json({ message: "Failed to create transaction", error });
  }
});

router.get("/admin", verifyToken, async (req, res) => {
  try {
    const { type, status } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;

    const transactions = await Transaction.find(filter).populate(
      "user",
      "fullName email balance, currency"
    );
    console.log(transactions);
    res.status(200).json(transactions);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch transactions", error });
  }
});

router.patch("/transactions-update", verifyToken, async (req, res) => {
  try {
    const { id, action } = req.body;

    if (!id || !["approve", "decline"].includes(action)) {
      return res.status(400).json({ message: "Invalid request." });
    }

    const transaction = await Transaction.findById(id);
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found." });
    }

    if (transaction.status !== "pending") {
      return res
        .status(400)
        .json({ message: "Transaction already processed." });
    }

    const user = await User.findById(transaction.user);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const newStatus = action === "approve" ? "approved" : "declined";

    // ======================
    // ✅ HANDLE TRANSACTION
    // ======================

    if (action === "approve") {
      switch (transaction.type) {
        case "deposit":
          user.balance += transaction.amount;
          break;

        case "withdrawal":
          // Do nothing — user already had this amount deducted on request
          break;

        case "investment":
          // Deduction already done when investment was placed
          // Optionally: mark investment as active in user's profile
          break;

        case "referral":
          user.balance += transaction.amount;
          break;

        default:
          return res
            .status(400)
            .json({ message: "Unsupported transaction type." });
      }
    }

    if (action === "decline") {
      switch (transaction.type) {
        case "deposit":
          // No refund needed
          break;

        case "withdrawal":
          user.balance += transaction.amount; // refund withdrawal
          break;

        case "investment":
          user.balance += transaction.amount; // refund investment
          break;

        case "referral":
          // Optional: ignore or reverse bonus
          break;

        default:
          return res
            .status(400)
            .json({ message: "Unsupported transaction type." });
      }
    }

    // ======================
    // ✅ SAVE & RESPOND
    // ======================
    transaction.status = newStatus;
    await transaction.save({ validateBeforeSave: false });
    await user.save();

    return res.status(200).json({
      message: `Transaction ${newStatus}`,
      transaction,
      balance: user.balance,
    });
  } catch (error) {
    console.error("Transaction update error:", error);
    return res
      .status(500)
      .json({ message: "Failed to update transaction", error });
  }
});

router.get("/my", verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const transactions = await Transaction.find({ user: userId }).sort({
      createdAt: -1,
    });

    res.status(200).json(transactions);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch your transactions", error });
  }
});

router.get("/deposits-history", verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;

    const deposits = await Transaction.find({
      user: userId,
      type: "deposit",
    }).sort({ createdAt: -1 });

    res.json(deposits);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch deposit history", error: err.message });
  }
});

router.get("/:id", verifyToken, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    res.json(transaction);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch transaction", error: err.message });
  }
});

module.exports = router;
