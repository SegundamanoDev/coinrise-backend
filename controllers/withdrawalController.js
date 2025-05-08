const Withdrawal = require("../models/withdrawal");
const User = require("../models/user");

// @desc    Create a new withdrawal request
// @route   POST /api/withdrawals
// @access  Private
exports.createWithdrawal = async (req, res) => {
  try {
    const { amount, method, walletAddress } = req.body;

    const newWithdrawal = await Withdrawal.create({
      user: req.user._id,
      amount,
      method,
      walletAddress,
      status: "pending",
    });

    res.status(201).json({
      message: "Withdrawal request submitted",
      withdrawal: newWithdrawal,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Withdrawal request failed", error: err.message });
  }
};

// @desc    Get all withdrawals (admin)
// @route   GET /api/withdrawals
// @access  Admin
exports.getAllWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find().populate(
      "user",
      "fullname email"
    );
    res.json(withdrawals);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to retrieve withdrawals", error: err.message });
  }
};

// @desc    Get user’s withdrawals
// @route   GET /api/withdrawals/user
// @access  Private
exports.getUserWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ user: req.user._id });
    res.json(withdrawals);
  } catch (err) {
    res.status(500).json({
      message: "Failed to retrieve user withdrawals",
      error: err.message,
    });
  }
};

// @desc    Update withdrawal status (admin)
// @route   PUT /api/withdrawals/:id
// @access  Admin
exports.updateWithdrawalStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const withdrawal = await Withdrawal.findById(req.params.id);
    if (!withdrawal)
      return res.status(404).json({ message: "Withdrawal not found" });

    withdrawal.status = status;
    await withdrawal.save();

    res.json({ message: "Withdrawal status updated", withdrawal });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to update withdrawal", error: err.message });
  }
};

// @desc    Delete withdrawal (admin)
// @route   DELETE /api/withdrawals/:id
// @access  Admin
exports.deleteWithdrawal = async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findByIdAndDelete(req.params.id);
    if (!withdrawal)
      return res.status(404).json({ message: "Withdrawal not found" });

    res.json({ message: "Withdrawal deleted" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to delete withdrawal", error: err.message });
  }
};
