const User = require("../models/user");
const Deposit = require("../models/deposit");
const Withdrawal = require("../models/withdrawal");
const Investment = require("../models/investment");

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

// Get single user by ID
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

// Update user
exports.updateUser = async (req, res) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true }
    );
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: "Update failed" });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ error: "Delete failed" });
  }
};

exports.getUserDashboard = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).select("profit bonus");

    const [deposits, withdrawals, investments, pendingWithdrawals] =
      await Promise.all([
        Deposit.aggregate([
          { $match: { userId, status: "confirmed" } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
        Withdrawal.aggregate([
          { $match: { userId, status: "confirmed" } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
        Investment.aggregate([
          { $match: { userId, status: "active" } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
        Withdrawal.aggregate([
          { $match: { userId, status: "pending" } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
      ]);

    const totalDeposited = deposits[0]?.total || 0;
    const totalWithdrawn = withdrawals[0]?.total || 0;
    const totalProfits = user?.profit || 0;
    const totalReferrals = user?.bonus || 0;
    const totalActiveInvestments = investments[0]?.total || 0;
    const totalPendingWithdrawals = pendingWithdrawals[0]?.total || 0;

    const availableBalance =
      totalDeposited + totalProfits + totalReferrals - totalWithdrawn;

    res.json({
      availableBalance,
      totalDeposited,
      totalProfits,
      totalReferrals,
      totalActiveInvestments,
      totalPendingWithdrawals,
    });
  } catch (error) {
    console.error("Dashboard Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
