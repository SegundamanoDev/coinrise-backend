// models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: {
      type: String,
      required: [true, "Please add an email"],
      unique: true,
      trim: true,
      match: [
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
        "Please enter a valid email",
      ],
    },
    password: { type: String, required: true },
    country: String,
    currency: String,
    phone: String,
    address: String,
    city: String,
    zip: String,
    currentPlan: {
      type: String, // e.g., 'basic', 'standard', 'premium', or 'free'
      default: "free", // Default plan for new users
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    referralCode: { type: String, unique: true },
    referredBy: String,
    balance: { type: Number, default: 0 },
    totalProfits: { type: Number, default: 0 },
    referralEarnings: { type: Number, default: 0 },
    resetPasswordToken: { type: String },
    resetPasswordExpire: { type: Date },
    // --- NEW FIELDS FOR LAST LOGIN ---
    lastLoginAt: { type: Date, default: Date.now }, // Stores the timestamp of the last login
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
