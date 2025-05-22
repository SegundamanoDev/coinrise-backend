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

    const transaction = await Transaction.create({
      user: userId,
      type,
      amount,
      coin: type === "deposit" ? coin : undefined,
      method: type === "withdrawal" ? method : undefined,
      details: details || {},
    });

    // Optional: immediately deduct withdrawal amount
    if (type === "withdrawal") {
      await User.findByIdAndUpdate(userId, { $inc: { balance: -amount } });
    }
    console.log(transaction);
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
      "fullName email balance"
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

    // Validate request
    if (!id || !["approve", "decline"].includes(action)) {
      return res.status(400).json({ message: "Invalid request." });
    }

    // Find the transaction
    const transaction = await Transaction.findById(id);
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found." });
    }

    // Check if already processed
    if (transaction.status !== "pending") {
      return res
        .status(400)
        .json({ message: "Transaction already processed." });
    }

    // Find the user
    const user = await User.findById(transaction.user);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Determine new status
    const newStatus = action === "approve" ? "approved" : "declined";

    // Handle balance updates
    if (action === "approve") {
      if (transaction.type === "deposit") {
        user.balance += transaction.amount;
      }
      // No need to update balance on approved withdrawal; it was deducted on creation
    }

    if (action === "decline") {
      if (transaction.type === "withdrawal") {
        user.balance += transaction.amount; // refund
      }
    }

    // Update transaction status and save
    transaction.status = newStatus;
    await transaction.save({ validateBeforeSave: false });

    await user.save();

    return res.status(200).json({
      message: `Transaction ${newStatus} successfully.`,
      transaction,
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
    console.log(transactions);
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

module.exports = router;
