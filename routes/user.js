const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { verifyToken } = require("../middlewares/auth");
const Transaction = require("../models/Transaction");

// ====================================================================
// SECTION 1: SPECIFIC, LITERAL PATH ROUTES (MUST COME FIRST)
// These routes handle exact string matches before Express tries to
// interpret parts of the URL as parameters for more general routes.
// ====================================================================

// 1. GET Current User's Profile (e.g., /api/users/profile)
router.get("/profile", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (err) {
    console.error("Error fetching user profile:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 2. PUT Update Current User's Profile (e.g., /api/users/profile)
router.put("/profile", verifyToken, async (req, res) => {
  const { fullName, country, phone, address, city, zip } = req.body;
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      user.fullName = fullName || user.fullName;
      user.country = country || user.country;
      user.phone = phone || user.phone;
      user.address = address || user.address;
      user.city = city || user.city;
      user.zip = zip || user.zip;
      const updatedUser = await user.save();
      // Return updated profile data
      res.json({
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        country: updatedUser.country,
        phone: updatedUser.phone,
        address: updatedUser.address,
        city: updatedUser.city,
        zip: updatedUser.zip,
        currentPlan: updatedUser.currentPlan, // Assuming currentPlan maps to previous accountLevel
        avatar: updatedUser.avatar,
        balance: updatedUser.balance,
        totalProfits: updatedUser.totalProfits,
        referralEarnings: updatedUser.referralEarnings,
        lastLoginAt: updatedUser.lastLoginAt,
        lastLoginIpAddress: updatedUser.lastLoginIpAddress,
      });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    console.error("Error updating user profile:", error);
    if (error.name === "ValidationError") {
      res.status(400).json({ message: error.message });
    } else {
      res.status(500).json({ message: "Server error" });
    }
  }
});

// 3. PUT Change User Password (e.g., /api/users/password) - THIS IS YOUR TARGET ROUTE
router.put("/password", verifyToken, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    console.log("Backend: New password and confirm password do not match.");
    return res
      .status(400)
      .json({ message: "New password and confirm password do not match." });
  }

  // Optional: Add new password validation (e.g., minimum length, complexity)
  if (newPassword.length < 8) {
    console.log("Backend: New password is too short.");
    return res
      .status(400)
      .json({ message: "New password must be at least 8 characters long." });
  }

  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      console.error(
        "Backend: User not found from token ID during password change."
      );
      return res.status(404).json({ message: "User not found." });
    }

    // Compare the current password
    const isCurrentPasswordMatch = await user.comparePassword(currentPassword);

    if (!isCurrentPasswordMatch) {
      console.log(
        "Backend: Invalid current password provided by user:",
        user.email
      );
      return res.status(401).json({ message: "Invalid current password." });
    }

    // Update the password. The pre-save hook in your User model will hash this.
    user.password = newPassword;
    await user.save();

    console.log("Backend: Password updated successfully for user:", user.email);
    res.json({ message: "Password updated successfully!" });
  } catch (error) {
    console.error("Backend: Server error during password change:", error);
    // Be more specific with error messages if possible, but avoid leaking internal details
    res
      .status(500)
      .json({ message: "Server error occurred while changing password." });
  }
});

// 4. GET All Users (e.g., /api/users) - Admin only
router.get("/", verifyToken, async (req, res) => {
  try {
    if (req.user && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Access denied. Admin rights required." });
    }
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    console.error("Error fetching all users:", err);
    res.status(500).json({ message: err.message });
  }
});

// 5. GET Total User Count (e.g., /api/users/stats/count)
router.get("/stats/count", verifyToken, async (req, res) => {
  try {
    const count = await User.countDocuments();
    res.json({ totalUsers: count });
  } catch (err) {
    console.error("Error fetching user count:", err);
    res.status(500).json({ message: err.message });
  }
});

// ====================================================================
// SECTION 2: PARAMETERIZED ROUTES (MUST COME AFTER SPECIFIC ROUTES)
// These routes use dynamic parameters like ':id' or ':userId'.
// ====================================================================

// 6. GET Single User by ID (e.g., /api/users/:id) - Admin only
router.get("/:id", verifyToken, async (req, res) => {
  try {
    if (req.user && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Access denied. Admin rights required." });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    // This catch block is where your "Cast to ObjectId failed for value 'password'" error *was* occurring
    console.error(
      `Backend: Error in /users/:id GET route with ID "${req.params.id}":`,
      err
    );
    res.status(500).json({ message: err.message });
  }
});

// 7. PUT Update User by ID (e.g., /api/users/:id) - Admin only
router.put("/:id", verifyToken, async (req, res) => {
  try {
    if (req.user && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Access denied. Admin rights required." });
    }

    const userId = req.params.id;

    // Find the user first
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Iterate over the fields in req.body and apply updates
    // This approach ensures that only fields present in req.body are updated
    // and correctly triggers pre('save') hooks if 'password' is actually changed.
    for (const key in req.body) {
      if (req.body.hasOwnProperty(key)) {
        // IMPORTANT: Handle password separately if it's explicitly part of the update.
        // However, it's strongly recommended to use a separate route for password changes.
        // If you are sending password from frontend in this general update,
        // this is where you'd need special handling.
        // For security, if this route is NOT meant for password changes,
        // you should still strip it if it accidentally comes through.
        if (key === "password") {
          console.warn(
            `Attempted to update password via general /users/:id PUT route for user ${userId}. This action was blocked.`
          );
          continue; // Skip the password field
        }
        user[key] = req.body[key];
      }
    }

    // Save the modified user document.
    // This will trigger pre('save') hooks and full schema validation.
    await user.save();

    // After updating, return the user *without* the password field
    const userResponse = user.toObject(); // Convert Mongoose document to plain JS object
    delete userResponse.password; // Remove password before sending to client

    res.json(userResponse); // Send the updated user object (without password)
  } catch (err) {
    console.error(
      `Backend: Error in /users/:id PUT route for user ID "${req.params.id}":`,
      err
    );

    // Provide more specific error messages
    if (err.name === "CastError" && err.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid User ID format." });
    }
    if (err.name === "ValidationError") {
      // Mongoose validation error
      const errors = Object.keys(err.errors).map(
        (key) => err.errors[key].message
      );
      return res.status(400).json({ message: errors.join(", ") });
    }

    res
      .status(500)
      .json({ message: err.message || "An unexpected error occurred." });
  }
});
router.post("/topup-profit/:userId", verifyToken, async (req, res) => {
  const { amount, notes } = req.body;
  const parsedAmount = parseFloat(amount);

  // Basic validation
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res
      .status(400)
      .json({ message: "Invalid amount. Must be a positive number." });
  }

  try {
    if (req.user && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Access denied. Admin rights required." });
    }

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.totalProfits += parsedAmount;
    user.balance += parsedAmount;
    await user.save();

    // --- NEW: Create a transaction record for the top-up ---
    await Transaction.create({
      user: user._id,
      amount: parsedAmount,
      coin: "USDT", // Or whatever default coin you use for internal transfers
      type: "profit", // This is the new type
      status: "completed", // Admin actions are typically completed immediately
      notes: notes || ` ${parsedAmount} Trading Profit Credited`, // Use provided notes or a default
    });
    // --- END NEW ---

    res.json({ message: "Profit topped up successfully", user });
  } catch (err) {
    console.error("Error topping up profit:", err);
    res.status(500).json({ message: err.message });
  }
});

// 9. DELETE User by ID (e.g., /api/users/:id) - Admin only
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    if (req.user && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Access denied. Admin rights required." });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "User deleted" });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
