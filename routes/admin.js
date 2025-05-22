const express = require("express");
const { verifyToken, isAdmin } = require("../middlewares/auth.js");
const Transaction = require("../models/transaction.js");
const Investment = require("../models/Investment.js");
const User = require("../models/User.js");

const router = express.Router();

router.get("/dashboard", verifyToken, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();

    const totalDeposited = await Transaction.aggregate([
      { $match: { type: "deposit", status: "approved" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const totalWithdrawn = await Transaction.aggregate([
      { $match: { type: "withdrawal", status: "approved" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const totalActiveInvestments = await Investment.aggregate([
      { $match: { status: "active" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const totalCompletedInvestments = await Investment.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const averageROI = await Investment.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, avgRoi: { $avg: "$roi" } } },
    ]);

    const referralBonuses = 3200; // Replace with logic if tracked

    const chartData = await Transaction.aggregate([
      {
        $match: {
          status: "approved",
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          deposits: {
            $sum: {
              $cond: [{ $eq: ["$type", "deposit"] }, "$amount", 0],
            },
          },
          withdrawals: {
            $sum: {
              $cond: [{ $eq: ["$type", "withdrawal"] }, "$amount", 0],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const recentLogs = await Transaction.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select("type amount createdAt _id")
      .lean();

    const snapshot = {
      lastUser: await User.findOne().sort({ createdAt: -1 }).lean(),
      lastDeposit: await Transaction.findOne({ type: "deposit" })
        .sort({ createdAt: -1 })
        .lean(),
      lastWithdrawal: await Transaction.findOne({ type: "withdrawal" })
        .sort({ createdAt: -1 })
        .lean(),
    };

    res.json({
      stats: {
        totalUsers,
        totalDeposited: totalDeposited[0]?.total || 0,
        totalWithdrawn: totalWithdrawn[0]?.total || 0,
        totalActiveInvestments: totalActiveInvestments[0]?.total || 0,
        totalCompletedInvestments: totalCompletedInvestments[0]?.total || 0,
        averageROI: averageROI[0]?.avgRoi?.toFixed(2) || 0,
        referralBonuses,
      },
      snapshot,
      charts: {
        data: chartData.map((item) => ({
          label: item._id,
          deposits: item.deposits,
          withdrawals: item.withdrawals,
        })),
      },
      recentLogs: recentLogs.map((log) => ({
        id: log._id,
        action: `${log.type} - $${log.amount}`,
        time: new Date(log.createdAt).toLocaleString(),
      })),
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ message: "Failed to fetch dashboard data" });
  }
});

// GET /admin/investments - Get all investments (with optional filters)
router.get("/investments", verifyToken, isAdmin, async (req, res) => {
  console.log(req.user);
  try {
    const { status, plan, search, startDate, endDate } = req.query;
    const query = {};

    if (status) query.status = status;
    if (plan) query.plan = plan;

    if (startDate && endDate) {
      query.startDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    if (search) {
      const users = await User.find({
        $or: [
          { username: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ],
      });
      const userIds = users.map((u) => u._id);
      query.userId = { $in: userIds };
    }

    const investments = await Investment.find(query)
      .sort({ createdAt: -1 })
      .populate("userId", "fullName email");
    // Calculate summary stats
    const totalInvested = investments.reduce((acc, inv) => acc + inv.amount, 0);
    const totalROI = investments.reduce(
      (acc, inv) => acc + (inv.amount * inv.roi) / 100,
      0
    );
    const activeCount = investments.filter(
      (inv) => inv.status === "active"
    ).length;
    const completedCount = investments.filter(
      (inv) => inv.status === "completed"
    ).length;

    res.status(200).json({
      summary: {
        totalInvested,
        totalROI,
        total: investments.length,
        activeCount,
        completedCount,
      },
      investments,
    });
  } catch (error) {
    console.error("Admin fetch investments error:", error);
    res.status(500).json({ message: "Failed to fetch investments." });
  }
});

// PATCH /admin/investments/:id/complete - Mark investment as completed
router.patch("/investments/:id/complete", isAdmin, async (req, res) => {
  try {
    const investment = await Investment.findById(req.params.id);
    if (!investment)
      return res.status(404).json({ message: "Investment not found." });

    if (investment.status === "completed") {
      return res.status(400).json({ message: "Investment already completed." });
    }

    const user = await User.findById(investment.userId);
    const roiAmount = (investment.amount * investment.roi) / 100;
    user.balance += investment.amount + roiAmount;
    investment.status = "completed";

    await investment.save();
    await user.save();

    res
      .status(200)
      .json({ message: "Investment marked as completed.", investment });
  } catch (error) {
    console.error("Mark investment complete error:", error);
    res.status(500).json({ message: "Failed to complete investment." });
  }
});

// DELETE /admin/investments/:id - Cancel/delete investment
router.delete("/investments/:id", isAdmin, async (req, res) => {
  try {
    const investment = await Investment.findById(req.params.id);
    if (!investment)
      return res.status(404).json({ message: "Investment not found." });

    if (investment.status === "active") {
      const user = await User.findById(investment.userId);
      user.balance += investment.amount;
      await user.save();
    }

    await Investment.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Investment cancelled and deleted." });
  } catch (error) {
    console.error("Delete investment error:", error);
    res.status(500).json({ message: "Failed to delete investment." });
  }
});

module.exports = router;
