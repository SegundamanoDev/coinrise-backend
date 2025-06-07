// routes/auth.js (or wherever your auth routes are defined)
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const Transaction = require("../models/Transaction"); // Assuming this model is defined elsewhere

// Define constants
const REFERRAL_BONUS = 30; // Define your referral bonus amount
const PLATFORM_COIN = "USDT"; // Define a default coin for platform transactions like referral bonus or investments

// Helper function to generate referral code
function generateReferralCode() {
  return Math.random().toString(36).substr(2, 8).toUpperCase();
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const {
      fullName,
      email,
      password,
      country,
      currency,
      phone,
      occupation,
      referredBy,
    } = req.body;

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
      occupation,
      referralCode,
      referredBy,
      lastLoginAt: new Date(),
      lastLoginIpAddress: req.ip || req.connection.remoteAddress,
    });

    await newUser.save();

    if (referredBy) {
      const referrer = await User.findOne({ referralCode: referredBy });
      if (referrer) {
        referrer.referralEarnings += REFERRAL_BONUS;
        referrer.balance += REFERRAL_BONUS;
        await referrer.save();

        // Ensure these match Transaction Model enums and required fields
        const referralTxn = new Transaction({
          user: referrer._id, // Use 'user' as per Transaction model
          type: "referral_bonus",
          amount: REFERRAL_BONUS,
          coin: PLATFORM_COIN, // <--- ADDED: Specify coin for transaction
          status: "completed", // Ensure 'completed' is in Transaction status enum
          notes: `Referral bonus for inviting ${newUser.fullName} (${newUser.email})`, // Use 'notes'
        });
        await referralTxn.save();
      }
    }

    return res.status(201).json({
      success: true,
      message: "Registered successfully",
      // Optionally, you might want to return user data or a token here too
      // user: {
      //   _id: newUser._id,
      //   fullName: newUser.fullName,
      //   email: newUser.email,
      //   role: newUser.role, // Include role here if sending user data
      //   // ... other fields
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
    return res.status(400).json({ message: "Invalid credentials" });
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return res.status(400).json({ message: "Invalid credentials" });
  }

  user.lastLoginAt = new Date();
  user.lastLoginIpAddress = req.ip || req.connection.remoteAddress;
  await user.save();

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  res.json({
    token: token,
    user,
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

  // --- Integrate potential password breach check for newPassword here ---
  // You would need a function like checkPasswordBreach(newPassword)
  // if (await checkPasswordBreach(newPassword)) {
  //   return res.status(403).json({ message: "The new password was found in a data breach. Please choose a different one." });
  // }
  // --- End integration ---

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

    const resetUrl = `https://coinrise-khaki.vercel.app/reset-password/${resetToken}`; // Verify this URL in production

    // Email configuration
    const transporter = nodemailer.createTransport({
      service: process.env.NODEMAILER_SERVICE,
      auth: {
        user: process.env.NODEMAILER_USER,
        pass: process.env.NODEMAILER_PASS,
      },
    });

    const mailOptions = {
      from: `"Support" <noreply@trustvest.com>`,
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

    // --- Integrate potential password breach check for newPassword here ---
    // if (await checkPasswordBreach(newPassword)) {
    //   return res.status(403).json({ message: "The new password was found in a data breach. Please choose a different one." });
    // }
    // --- End integration ---

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
