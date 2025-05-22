const express = require("express");
const router = express.Router();
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const Transaction = require("../models/transaction");

function generateReferralCode() {
  return Math.random().toString(36).substr(2, 8).toUpperCase();
}

const REFERRAL_BONUS = 15;

router.post("/register", async (req, res) => {
  try {
    const { fullName, email, password, country, currency, phone, referredBy } =
      req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "Email already exists" });
    }

    let referralCode;
    do {
      referralCode = generateReferralCode();
    } while (await User.findOne({ referralCode }));

    const newUser = new User({
      fullName,
      email,
      password,
      country,
      currency,
      phone,
      referralCode,
      referredBy,
    });
    console.log(newUser);
    await newUser.save();

    if (referredBy) {
      const referrer = await User.findOne({ referralCode: referredBy });
      if (referrer) {
        referrer.referralEarnings += REFERRAL_BONUS;
        referrer.balance += REFERRAL_BONUS;
        await referrer.save();

        const referralTxn = new Transaction({
          userId: referrer._id,
          type: "referral_bonus",
          amount: REFERRAL_BONUS,
          status: "completed",
          description: `Referral bonus for inviting ${newUser.fullName}`,
        });
        await referralTxn.save();
      }
    }

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;

// POST /api/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ error: "Invalid credentials" });

  const isMatch = await user.comparePassword(password);
  if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
  res.json({ token: token, user: user });
});

// PUT /api/update-password/:userId
router.put("/update-password/:userId", async (req, res) => {
  const { oldPassword, newPassword, confirmPassword } = req.body;
  const user = await User.findById(req.params.userId);

  if (!user) return res.status(404).json({ error: "User not found" });

  const isMatch = await user.comparePassword(oldPassword);
  if (!isMatch)
    return res.status(400).json({ error: "Incorrect old password" });

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match" });
  }

  user.password = newPassword; // Will be hashed via pre-save
  await user.save();

  res.json({ message: "Password updated successfully" });
});

module.exports = router;
