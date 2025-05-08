const Plan = require("../models/plan");

// @desc    Get all investment plans
exports.getPlans = async (req, res) => {
  try {
    const plans = await Plan.find();
    res.status(200).json(plans);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch plans", error });
  }
};

// @desc    Create new investment plan (admin only)
exports.createPlan = async (req, res) => {
  const { name, amount, roi, duration } = req.body;
  try {
    const newPlan = new Plan({ name, amount, roi, duration });
    await newPlan.save();
    res
      .status(201)
      .json({ message: "Plan created successfully", plan: newPlan });
  } catch (error) {
    res.status(500).json({ message: "Failed to create plan", error });
  }
};

// @desc    Delete a plan (admin only)
exports.deletePlan = async (req, res) => {
  try {
    const plan = await Plan.findByIdAndDelete(req.params.id);
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    res.status(200).json({ message: "Plan deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete plan", error });
  }
};

// @desc    Update a plan (admin only)
exports.updatePlan = async (req, res) => {
  const { name, amount, roi, duration } = req.body;
  try {
    const plan = await Plan.findByIdAndUpdate(
      req.params.id,
      { name, amount, roi, duration },
      { new: true }
    );
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    res.status(200).json({ message: "Plan updated", plan });
  } catch (error) {
    res.status(500).json({ message: "Failed to update plan", error });
  }
};
