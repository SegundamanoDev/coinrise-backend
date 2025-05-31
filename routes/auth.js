// routes/auth.js (or wherever your auth routes are defined)
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const Transaction = require("../models/Transaction"); // Assuming this model is defined elsewhere

// Define constants
const REFERRAL_BONUS = 15;

// Helper function to generate referral code
function generateReferralCode() {
  return Math.random().toString(36).substr(2, 8).toUpperCase();
}

// POST /api/auth/register
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
      // When a new user registers, this is their first "login"
      lastLoginAt: new Date(),
      lastLoginIpAddress: req.ip || req.connection.remoteAddress,
    });
    console.log("New user registering:", newUser.email); // More descriptive log
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

    // Optionally, log in the user immediately after registration
    // and send a token/user object, similar to the login route.
    // For now, keeping it as a simple success message.
    return res.status(201).json({
      success: true,
      message: "Registered successfully",
      // You might want to return user data or a token here too
      // user: {
      //   id: newUser._id,
      //   fullName: newUser.fullName,
      //   email: newUser.email,
      //   currency: newUser.currency,
      //   balance: newUser.balance,
      //   lastLoginAt: newUser.lastLoginAt,
      //   lastLoginIpAddress: newUser.lastLoginIpAddress,
      //   // ... other fields you want to expose
      // }
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).json({ error: "Invalid credentials" });
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return res.status(400).json({ error: "Invalid credentials" });
  }

  // --- NEW LOGIC FOR LAST LOGIN UPDATE ---
  user.lastLoginAt = new Date(); // Set current timestamp
  // req.ip is generally preferred in Express as it handles X-Forwarded-For headers
  // if your app is behind a proxy/load balancer.
  user.lastLoginIpAddress = req.ip || req.connection.remoteAddress;
  await user.save(); // Save the updated user to the database
  // --- END NEW LOGIC ---

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  res.json({
    token: token,
    user: {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      country: user.country,
      currency: user.currency,
      phone: user.phone,
      currentPlan: user.currentPlan,
      role: user.role,
      referralCode: user.referralCode,
      referredBy: user.referredBy,
      balance: user.balance,
      totalProfits: user.totalProfits,
      referralEarnings: user.referralEarnings,
      lastLoginAt: user.lastLoginAt, // Include the new field
      lastLoginIpAddress: user.lastLoginIpAddress, // Include the new field
      // Do NOT send password or reset tokens
    },
  });
});

// PUT /api/auth/update-password/:userId
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

  user.password = newPassword; // Will be hashed via pre-save hook
  await user.save();

  res.json({ message: "Password updated successfully" });
});

// POST /api/auth/forgot-password
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  console.log("Forgot password request for:", email);
  try {
    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(404)
        .json({ error: "No account with that email found" });

    // Generate a reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpire = Date.now() + 1000 * 60 * 60; // 1 hour expiry

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpire = resetTokenExpire;
    await user.save();

    const resetUrl = `https://coinrise-khaki.vercel.app/reset-password/${resetToken}`;

    // Email configuration
    const transporter = nodemailer.createTransport({
      service: process.env.NODEMAILER_SERVICE,
      auth: {
        user: process.env.NODEMAILER_USER,
        pass: process.env.NODEMAILER_PASS,
      },
    });

    const mailOptions = {
      from: '"Support" <noreply@trustvest.com>',
      to: user.email,
      subject: "Password Reset",
      html: `
        <p>Hello ${user.fullName},</p>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <a href="${resetUrl}" target="_blank">${resetUrl}</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you did not request this, ignore this email.</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.json({ message: "Password reset email sent successfully" });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/auth/reset-password/:token
router.put("/reset-password/:token", async (req, res) => {
  const { newPassword, confirmPassword } = req.body;

  try {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpire: { $gt: Date.now() }, // token must not be expired
    });

    if (!user)
      return res.status(400).json({ error: "Invalid or expired token" });

    if (newPassword !== confirmPassword)
      return res.status(400).json({ error: "Passwords do not match" });

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();
    res.json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
