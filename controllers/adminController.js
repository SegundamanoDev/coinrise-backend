const User = require("../models/user");
const Deposit = require("../models/deposit");
const Withdrawal = require("../models/withdrawal");
const Investment = require("../models/investment");

exports.getAdminDashboard = async (req, res) => {
  try {
    // Stats
    const totalUsers = await User.countDocuments();
    const totalDeposited = await Deposit.aggregate([
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalActiveInvestments = await Investment.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalWithdrawn = await Withdrawal.aggregate([
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const referralBonuses = await User.aggregate([
      { $group: { _id: null, total: { $sum: "$referralBonus" } } },
    ]);

    // Snapshot
    const lastUser = await User.findOne().sort({ createdAt: -1 });
    const lastDeposit = await Deposit.findOne().sort({ createdAt: -1 });
    const lastWithdrawal = await Withdrawal.findOne().sort({ createdAt: -1 });

    // Chart data (example: last 7 days)
    const last7Days = [...Array(7)]
      .map((_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return date.toISOString().split("T")[0];
      })
      .reverse();

    const chartData = await Promise.all(
      last7Days.map(async (day) => {
        const deposits = await Deposit.aggregate([
          { $match: { date: { $regex: day } } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]);
        const withdrawals = await Withdrawal.aggregate([
          { $match: { date: { $regex: day } } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]);
        return {
          label: day,
          deposits: deposits[0]?.total || 0,
          withdrawals: withdrawals[0]?.total || 0,
        };
      })
    );

    res.json({
      stats: {
        totalUsers,
        totalDeposited: totalDeposited[0]?.total || 0,
        totalActiveInvestments: totalActiveInvestments[0]?.total || 0,
        totalWithdrawn: totalWithdrawn[0]?.total || 0,
        referralBonuses: referralBonuses[0]?.total || 0,
      },
      snapshot: {
        lastUser,
        lastDeposit,
        lastWithdrawal,
      },
      charts: {
        data: chartData,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error loading dashboard data." });
  }
};
