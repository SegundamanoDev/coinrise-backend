const Investment = require("../models/investment");
const Plan = require("../models/plan");

// @desc    Get all investments (admin view with filtering)
// @route   GET /api/investments
// @access  Admin
exports.getAllInvestments = async (req, res) => {
  try {
    const investments = await Investment.find().populate("user plan");
    res.status(200).json(investments);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// @desc    Get user's investments
// @route   GET /api/investments/user
// @access  Private
exports.getUserInvestments = async (req, res) => {
  try {
    const investments = await Investment.find({ user: req.user._id }).populate(
      "plan"
    );
    res.status(200).json(investments);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// @desc    Create new investment
// @route   POST /api/investments
// @access  Private
exports.createInvestment = async (req, res) => {
  const { planId } = req.body;

  try {
    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }

    const investment = new Investment({
      user: req.user._id,
      plan: plan._id,
      amount: plan.amount,
      roi: plan.roi,
      duration: plan.duration,
      status: "active",
      startDate: new Date(),
    });

    await investment.save();
    res.status(201).json(investment);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// @desc    Update investment status (admin)
// @route   PUT /api/investments/:id/status
// @access  Admin
exports.updateInvestmentStatus = async (req, res) => {
  const { status } = req.body;

  try {
    const investment = await Investment.findById(req.params.id);
    if (!investment) {
      return res.status(404).json({ message: "Investment not found" });
    }

    investment.status = status;
    await investment.save();

    res.status(200).json({ message: "Investment status updated", investment });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// @desc    Delete investment (admin)
// @route   DELETE /api/investments/:id
// @access  Admin
exports.deleteInvestment = async (req, res) => {
  try {
    const investment = await Investment.findByIdAndDelete(req.params.id);
    if (!investment) {
      return res.status(404).json({ message: "Investment not found" });
    }
    res.status(200).json({ message: "Investment deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
