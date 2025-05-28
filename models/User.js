// models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    country: String,
    currency: String,
    phone: String,
    isAdmin: { type: Boolean, default: false },
    referralCode: { type: String, unique: true },
    referredBy: String,
    balance: { type: Number, default: 0 },
    totalProfits: { type: Number, default: 0 },
    referralEarnings: { type: Number, default: 0 },
    resetPasswordToken: { type: String },
    resetPasswordExpire: { type: Date },
    // --- NEW FIELDS FOR LAST LOGIN ---
    lastLoginAt: { type: Date }, // Stores the timestamp of the last login
    lastLoginIpAddress: { type: String }, // Stores the IP address of the last login
    // --- END NEW FIELDS ---
  },
  {
    timestamps: true, // Adds createdAt and updatedAt timestamps automatically
  }
);

// Hash password before saving or updating
userSchema.pre("save", async function (next) {
  // Only hash if the password field is modified (e.g., on registration or password change)
  if (!this.isModified("password")) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare passwords
userSchema.methods.comparePassword = function (inputPassword) {
  return bcrypt.compare(inputPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
