const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth.js");
const Investment = require("../models/Investment.js");
const InvestmentPlan = require("../models/InvestmentPlan.js"); // Your InvestmentPlan model
const User = require("../models/User.js");
const Transaction = require("../models/Transaction.js");

// POST /invest/create
// Creates a new investment for a user based on a selected plan
router.post("/create", verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const { planId, amount } = req.body; // 'amount' is the single value now

    // 1. Basic input validation
    if (!planId || !amount) {
      return res
        .status(400)
        .json({ message: "Plan ID and investment amount are required." });
    }

    // Ensure amount is a positive number
    if (typeof amount !== "number" || amount <= 0) {
      return res
        .status(400)
        .json({ message: "Investment amount must be a positive number." });
    }

    // 2. Find the Investment Plan
    const plan = await InvestmentPlan.findById(planId);

    if (!plan) {
      return res.status(404).json({ message: "Investment plan not found." });
    }

    // 3. Validate if the user's requested 'amount' matches the plan's 'amount'
    if (amount !== plan.amount) {
      return res.status(400).json({
        message: `Investment amount must be exactly ${plan.amount}.`,
      });
    }

    // 4. Find the User and check balance
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    if (user.balance < amount) {
      return res.status(400).json({ message: "Insufficient balance." });
    }

    // 5. Calculate Investment Details
    const durationInMs = plan.durationHours * 60 * 60 * 1000;
    const now = new Date();
    const endDate = new Date(now.getTime() + durationInMs);

    // 6. Create the Investment record
    const investment = await Investment.create({
      userId,
      amount,
      plan: plan.name, // Store plan name for easier display
      duration: plan.durationHours,
      roi: plan.roiPercent,
      status: "active", // Default status
      startDate: now,
      endDate,
      // Consider storing capitalInsurancePercent and commissionPercent here if they apply per investment
    });

    // 7. Deduct balance and update user's active investments
    user.balance -= amount;
    user.activeInvestments += 1;
    await user.save();

    // 8. Create a Transaction record
    await Transaction.create({
      user: userId,
      amount,
      coin: "USDT", // <-- This is where 'coin' is provided
      type: "investment",
      details: {
        planName: plan.name,
        roiPercent: plan.roiPercent,
        endDate: endDate,
      },
      status: "approved",
      notes: `Investment in ${plan.name} plan.`,
    });

    res.status(201).json({ message: "Investment successful.", investment });
  } catch (error) {
    console.error("Invest error:", error); // Keep detailed error in console for debugging
    res.status(500).json({
      message: "Investment failed due to an internal server error.",
      error: error.message,
    });
  }
});

// GET /invest/my
// Fetches all investments for the authenticated user
router.get("/my", verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const investments = await Investment.find({ userId }).sort({
      startDate: -1,
    }); // Sort by newest first
    res.status(200).json(investments);
  } catch (error) {
    console.error("Fetch user investments error:", error);
    res.status(500).json({
      message: "Failed to fetch investments.",
      error: error.message,
    });
  }
});

module.exports = router;
