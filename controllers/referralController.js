const Referral = require("../models/Referral");
const User = require("../models/user");

// @desc    Get all referral logs
// @route   GET /api/referrals
// @access  Admin
const getAllReferrals = async (req, res) => {
  try {
    const referrals = await Referral.find().populate(
      "user referredUser",
      "fullname email"
    );
    res.status(200).json(referrals);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch referrals", error: err.message });
  }
};

// @desc    Get referrals for a specific user
// @route   GET /api/referrals/:userId
// @access  Admin/User
const getUserReferrals = async (req, res) => {
  try {
    const userId = req.params.userId;
    const referrals = await Referral.find({ user: userId }).populate(
      "referredUser",
      "fullname email"
    );
    res.status(200).json(referrals);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch user referrals", error: err.message });
  }
};

// @desc    Create referral record (typically called during user registration)
// @route   POST /api/referrals
// @access  Public/internal
const createReferral = async (req, res) => {
  try {
    const { user, referredUser } = req.body;

    const newReferral = new Referral({ user, referredUser });
    await newReferral.save();

    res.status(201).json(newReferral);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to create referral", error: err.message });
  }
};

module.exports = {
  getAllReferrals,
  getUserReferrals,
  createReferral,
};
