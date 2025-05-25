const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Transaction = require("../models/transaction");
const { verifyToken } = require("../middlewares/auth");

router.get("/", verifyToken, async (req, res) => {
  const userId = req.user._id;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Total Approved Deposits
    const totalDepositedResult = await Transaction.aggregate([
      {
        $match: {
          user: user._id,
          type: "deposit",
          status: "approved",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    // Pending Withdrawals
    const pendingWithdrawalsResult = await Transaction.aggregate([
      {
        $match: {
          user: user._id,
          type: "withdrawal",
          status: "pending",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    const totalDeposited = totalDepositedResult?.[0]?.total ?? 0;
    const pendingWithdrawals = pendingWithdrawalsResult?.[0]?.total ?? 0;

    const availableBalance = user.balance || 0;

    res.json({
      fullName: user.fullName,
      email: user.email,
      accountType: user.accountType || "User",
      referralCode: user.referralCode,
      currency: user.currency || "USD",
      availableBalance,
      totalDeposited,
      totalProfits: user.totalProfits || 0,
      referralEarnings: user.referralEarnings || 0,
      pendingWithdrawals,
    });
  } catch (err) {
    console.error("Dashboard Error:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
