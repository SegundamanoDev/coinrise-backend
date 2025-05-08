const User = require("../models/user");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

// Generate JWT
const generateToken = (userId, isAdmin = false) => {
  return jwt.sign({ userId, isAdmin }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

async function generateUniqueReferralCode() {
  let code;
  let exists = true;
  while (exists) {
    code = Math.random().toString(36).substring(2, 8);
    const user = User.findOne({ referralCode: code });

    if (!user) {
      exists = false;
    }
  }
  return code;
}
// Register User
exports.register = async (req, res) => {
  try {
    const {
      fullname,
      email,
      number,
      password,
      confirmPassword,
      referredBy,
      country,
      currency,
    } = req.body;

    // Validate
    if (!fullname || !email || !password || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "Email already in use" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      fullname,
      email,
      number,
      password: hashedPassword,
      referralCode: generateUniqueReferralCode(),
      referredBy: referredBy || null,
      country,
      currency,
    });

    res.status(201).json({
      user: user,
    });
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};

// Login User
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    res.json({
      user: user,
    });
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};
