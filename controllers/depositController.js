const Deposit = require("../models/deposit");
const User = require("../models/user");

// @desc    Create new deposit request
// @route   POST /api/deposits
// @access  Private (user)
exports.createDeposit = async (req, res) => {
  try {
    const { amount, method, proofImage } = req.body;
    const userId = req.user._id;

    const newDeposit = new Deposit({
      user: userId,
      amount,
      method,
      proofImage,
      status: "pending",
    });

    await newDeposit.save();

    res.status(201).json({ message: "Deposit submitted successfully." });
  } catch (err) {
    res.status(500).json({ error: "Deposit creation failed." });
  }
};

// @desc    Get all deposits (Admin)
// @route   GET /api/deposits
// @access  Private (admin)
exports.getAllDeposits = async (req, res) => {
  try {
    const deposits = await Deposit.find()
      .populate("user", "fullname email")
      .sort({ createdAt: -1 });

    res.status(200).json(deposits);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch deposits." });
  }
};

// @desc    Get user deposits
// @route   GET /api/deposits/user
// @access  Private (user)
exports.getUserDeposits = async (req, res) => {
  try {
    const userId = req.user._id;

    const deposits = await Deposit.find({ user: userId }).sort({
      createdAt: -1,
    });

    res.status(200).json(deposits);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch deposits." });
  }
};

// @desc    Approve deposit
// @route   PATCH /api/deposits/:id/approve
// @access  Private (admin)
exports.approveDeposit = async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id);

    if (!deposit) return res.status(404).json({ error: "Deposit not found." });

    deposit.status = "approved";
    await deposit.save();

    // Optional: Update user balance
    const user = await User.findById(deposit.user);
    user.balance += deposit.amount;
    await user.save();

    res.status(200).json({ message: "Deposit approved." });
  } catch (err) {
    res.status(500).json({ error: "Approval failed." });
  }
};

// @desc    Reject deposit
// @route   PATCH /api/deposits/:id/reject
// @access  Private (admin)
exports.rejectDeposit = async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id);

    if (!deposit) return res.status(404).json({ error: "Deposit not found." });

    deposit.status = "rejected";
    await deposit.save();

    res.status(200).json({ message: "Deposit rejected." });
  } catch (err) {
    res.status(500).json({ error: "Rejection failed." });
  }
};
