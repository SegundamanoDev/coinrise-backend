const express = require("express");
const router = express.Router();
const InvestmentPlan = require("../models/InvestmentPlan");

// Create a new investment plan (admin)
router.post("/create", async (req, res) => {
  try {
    const {
      name,
      minAmount,
      maxAmount,
      roiPercent,
      durationHours,
      support,
      dailyReport,
      commissionPercent,
      capitalInsurancePercent,
    } = req.body;
    console.log(req.body);
    const existingPlan = await InvestmentPlan.findOne({ name });
    if (existingPlan)
      return res
        .status(400)
        .json({ error: "Plan with this name already exists." });

    const plan = new InvestmentPlan({
      name,
      minAmount,
      maxAmount,
      roiPercent,
      durationHours,
      support,
      dailyReport,
      commissionPercent,
      capitalInsurancePercent,
    });
    console.log(plan);
    await plan.save();
    res.status(201).json(plan);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to create plan", details: err.message });
  }
});

// Get all investment plans
router.get("/", async (req, res) => {
  try {
    const plans = await InvestmentPlan.find();
    console.log(plans);
    res.json(plans);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch plans", details: err.message });
  }
});

// Get a single investment plan
router.get("/:id", async (req, res) => {
  try {
    const plan = await InvestmentPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ error: "Plan not found" });
    res.json(plan);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch plan", details: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const plan = await InvestmentPlan.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true }
    );
    if (!plan) return res.status(404).json({ error: "Plan not found" });
    res.json(plan);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to delete plan", details: err.message });
  }
});

// Delete a plan (admin only - assuming auth middleware handles this)
router.delete("/:id", async (req, res) => {
  try {
    const plan = await InvestmentPlan.findByIdAndDelete(req.params.id);
    if (!plan) return res.status(404).json({ error: "Plan not found" });
    res.json({ message: "Plan deleted successfully" });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to delete plan", details: err.message });
  }
});

module.exports = router;
