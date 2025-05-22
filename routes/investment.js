// routes/invest.js
const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth.js");
const Investment = require("../models/Investment.js");
const InvestmentPlan = require("../models/InvestmentPlan.js");
const User = require("../models/User.js");
const Transaction = require("../models/transaction.js");

// POST /invest
router.post("/create", verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const { planId, amount } = req.body;

    if (!planId || !amount) {
      return res
        .status(400)
        .json({ message: "Plan ID and amount are required." });
    }

    const plan = await InvestmentPlan.findById(planId._id);

    if (!plan) {
      return res.status(404).json({ message: "Investment plan not found." });
    }

    // Validate amount within plan range
    if (amount < plan.minAmount || amount > plan.maxAmount) {
      return res.status(400).json({
        message: `Investment amount must be between ${plan.minAmount} and ${plan.maxAmount}.`,
      });
    }

    const user = await User.findById(userId);
    if (!user || user.balance < amount) {
      return res.status(400).json({ message: "Insufficient balance." });
    }

    // Calculate ROI
    const roiAmount = (amount * plan.roiPercent) / 100;
    const durationInMs = plan.durationHours * 60 * 60 * 1000;
    const now = new Date();
    const endDate = new Date(now.getTime() + durationInMs);

    // Create investment
    const investment = await Investment.create({
      userId,
      amount,
      plan: plan.name,
      duration: plan.durationHours,
      roi: plan.roiPercent,
      status: "active",
      startDate: now,
      endDate,
    });

    // Deduct balance
    user.balance -= amount;
    user.activeInvestments += 1;
    await user.save();

    // Create a transaction record for the investment
    await Transaction.create({
      user: userId,
      type: "investment",
      amount,
      details: {
        plan: plan.name,
        roiPercent: plan.roiPercent,
        endDate,
      },
    });

    res.status(201).json({ message: "Investment successful.", investment });
  } catch (error) {
    console.error("Invest error:", error);
    res.status(500).json({ message: "Investment failed.", error });
  }
});

// GET /invest/my
router.get("/my", verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const investments = await Investment.find({ userId }).sort({
      startDate: -1,
    });
    res.status(200).json(investments);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch investments", error });
  }
});

module.exports = router;
