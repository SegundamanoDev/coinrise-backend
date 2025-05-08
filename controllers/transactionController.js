const Transaction = require("../models/transaction");

// @desc Get all transactions (admin only)
exports.getAllTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find().populate(
      "user",
      "fullname email"
    );
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: "Server error fetching transactions." });
  }
};

// @desc Get user's transactions
exports.getUserTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user._id });
    res.json(transactions);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Server error fetching user transactions." });
  }
};

// @desc Create a new transaction (used internally by deposit, withdrawal, etc.)
exports.createTransaction = async (userId, type, amount, description = "") => {
  try {
    const newTransaction = new Transaction({
      user: userId,
      type,
      amount,
      description,
    });
    await newTransaction.save();
    return newTransaction;
  } catch (err) {
    console.error("Error creating transaction:", err.message);
    throw err;
  }
};
