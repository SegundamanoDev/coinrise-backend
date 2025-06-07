// routes/userRoutes.js

const express = require("express");
const router = express.Router();
const User = require("../models/User"); // Your Mongoose User model
const { verifyToken } = require("../middlewares/auth"); // Your authentication middleware
const Transaction = require("../models/Transaction"); // Your Transaction model

// --- NEW IMPORTS FOR FILE UPLOAD AND CLOUDINARY ---
const multer = require("multer"); // Middleware for handling multipart/form-data
const cloudinary = require("../utils/cloudinaryConfig"); // Your Cloudinary configuration
// --- END NEW IMPORTS ---

// --- Multer Configuration ---
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB (matches frontend)
  fileFilter: (req, file, cb) => {
    // Only allow common image formats (jpeg, png, gif, webp) for avatars
    if (file.mimetype.startsWith("image/")) {
      cb(null, true); // Accept the file
    } else {
      // Reject the file if it's not an allowed image type
      cb(
        new Error(
          "Invalid file type. Only image files (JPG, PNG, GIF, WebP) are allowed for avatars."
        ),
        false
      );
    }
  },
});

// --- Cloudinary Upload Helper Function (Made slightly more generic for re-use) ---
// This function takes a file buffer and uploads it to Cloudinary using a preset.
// It also takes an optional 'tags' array for better organization/searchability in Cloudinary.
const uploadToCloudinary = async (file, customTags = []) => {
  if (!file) return null; // Return null if no file is provided

  // Convert the file buffer to a Base64 data URI
  const b64 = Buffer.from(file.buffer).toString("base64");
  const dataUri = `data:${file.mimetype};base64,${b64}`;

  // Upload the file to Cloudinary with the specified upload preset and tags
  const result = await cloudinary.uploader.upload(dataUri, {
    upload_preset: "segun", // Use the "segun" upload preset as requested
    resource_type: "auto", // Cloudinary will automatically detect if it's an image or raw (for PDF)
    tags: customTags, // Add custom tags for Cloudinary management (e.g., 'avatar', 'kyc')
  });

  // Return the secure URL and public ID of the uploaded file
  return { secure_url: result.secure_url, public_id: result.public_id };
};

// ====================================================================
// SECTION 1: SPECIFIC, LITERAL PATH ROUTES (MUST COME FIRST)
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
  const { fullName, country, phone, address, city, zip, occupation } = req.body;
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      user.fullName = fullName || user.fullName;
      user.country = country || user.country;
      user.phone = phone || user.phone;
      user.address = address || user.address;
      user.city = city || user.city;
      user.zip = zip || user.zip;
      user.occupation = occupation || user.occupation;
      const updatedUser = await user.save();
      res.json({
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        country: updatedUser.country,
        phone: updatedUser.phone,
        address: updatedUser.address,
        city: updatedUser.city,
        zip: updatedUser.zip,
        currentPlan: updatedUser.currentPlan,
        avatar: updatedUser.avatar, // Ensure avatar is returned
        balance: updatedUser.balance,
        totalProfits: updatedUser.totalProfits,
        referralEarnings: updatedUser.referralEarnings,
        lastLoginAt: updatedUser.lastLoginAt,
        lastLoginIpAddress: updatedUser.lastLoginIpAddress,
        kycStatus: updatedUser.kycStatus,
        kycRejectionReason: updatedUser.kycRejectionReason,
        occupation: updatedUser.occupation,
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

// 3. PUT Change User Password (e.g., /api/users/password)
router.put("/password", verifyToken, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    console.log("Backend: New password and confirm password do not match.");
    return res
      .status(400)
      .json({ message: "New password and confirm password do not match." });
  }

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

    const isCurrentPasswordMatch = await user.comparePassword(currentPassword);

    if (!isCurrentPasswordMatch) {
      console.log(
        "Backend: Invalid current password provided by user:",
        user.email
      );
      return res.status(401).json({ message: "Invalid current password." });
    }

    user.password = newPassword;
    await user.save();

    console.log("Backend: Password updated successfully for user:", user.email);
    res.json({ message: "Password updated successfully!" });
  } catch (error) {
    console.error("Backend: Server error during password change:", error);
    res
      .status(500)
      .json({ message: "Server error occurred while changing password." });
  }
});

// --- NEW ROUTE FOR KYC SUBMISSION ---
router.post(
  "/kyc/submit", // This is the route you requested: the base path of the router
  verifyToken,
  upload.fields([
    { name: "proofOfId", maxCount: 1 },
    { name: "proofOfAddress", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const userId = req.user._id;
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }

      const proofOfIdFile = req.files["proofOfId"]
        ? req.files["proofOfId"][0]
        : null;
      const proofOfAddressFile = req.files["proofOfAddress"]
        ? req.files["proofOfAddress"][0]
        : null;

      if (!proofOfIdFile || !proofOfAddressFile) {
        return res.status(400).json({
          message:
            "Both Proof of Identity and Proof of Address files are required for KYC submission.",
        });
      }

      const [idUploadResult, addressUploadResult] = await Promise.all([
        uploadToCloudinary(proofOfIdFile, ["kyc", "proof_of_id"]), // Added tags for clarity
        uploadToCloudinary(proofOfAddressFile, ["kyc", "proof_of_address"]), // Added tags for clarity
      ]);

      user.kycStatus = "pending";
      user.kycDocuments = [];

      if (idUploadResult) {
        user.kycDocuments.push({
          secure_url: idUploadResult.secure_url,
          public_id: idUploadResult.public_id,
          docType: "proofOfId",
          uploadedAt: new Date(),
        });
      }

      if (addressUploadResult) {
        user.kycDocuments.push({
          secure_url: addressUploadResult.secure_url,
          public_id: addressUploadResult.public_id,
          docType: "proofOfAddress",
          uploadedAt: new Date(),
        });
      }

      user.kycRejectionReason = null;

      await user.save();

      res.status(200).json({
        message:
          "KYC documents submitted successfully for review. Your status has been updated to pending.",
        user: user,
      });
    } catch (error) {
      console.error("Error in POST /users route (KYC submission):", error);

      if (error instanceof multer.MulterError) {
        return res
          .status(400)
          .json({ message: `File upload error: ${error.message}` });
      }
      if (
        error.message ===
        "Invalid file type. Only images (JPG, PNG, GIF, WebP) and PDFs are allowed."
      ) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({
        message: "Server error during KYC submission.",
        error: error.message,
      });
    }
  }
);
// --- END NEW ROUTE FOR KYC SUBMISSION ---

// --- NEW ADMIN ROUTE FOR KYC STATUS UPDATE ---
router.patch("/kyc/:id/status", verifyToken, async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Access denied. Admin rights required." });
    }

    const { id } = req.params;
    const { kycStatus, kycRejectionReason } = req.body;

    const allowedStatuses = [
      "pending",
      "approved",
      "rejected",
      "not_submitted",
    ];
    if (!allowedStatuses.includes(kycStatus)) {
      return res.status(400).json({ message: "Invalid KYC status provided." });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    user.kycStatus = kycStatus;
    if (kycStatus === "rejected") {
      user.kycRejectionReason =
        kycRejectionReason || "No specific reason provided.";
    } else {
      user.kycRejectionReason = null;
    }

    await user.save();

    const updatedUserResponse = user.toObject();
    delete updatedUserResponse.password;

    res.status(200).json({
      message: `KYC status for user ${user.email} updated to ${kycStatus}.`,
      user: updatedUserResponse,
    });
  } catch (error) {
    console.error("Error updating user KYC status by admin:", error);
    if (error.name === "CastError" && error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid User ID format." });
    }
    res.status(500).json({ message: "Server error updating KYC status." });
  }
});
// --- END NEW ADMIN ROUTE FOR KYC STATUS UPDATE ---

// --- NEW ROUTE FOR AVATAR UPLOAD ---
// PUT /api/users/profile/avatar
router.put(
  "/profile/avatar", // Specific route for avatar upload
  verifyToken, // User must be authenticated
  upload.single("avatar"), // Expects a single file named 'avatar'
  async (req, res) => {
    try {
      const userId = req.user._id;
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No avatar file provided." });
      }

      // Upload the new avatar to Cloudinary
      const avatarUploadResult = await uploadToCloudinary(req.file, [
        "avatar",
        "user_profile",
      ]);

      // If user had an old avatar, you might want to delete it from Cloudinary
      // to save storage and keep things clean. This requires storing the public_id.
      // Example:
      // if (user.avatar_public_id) { // Assuming you stored public_id
      //   await cloudinary.uploader.destroy(user.avatar_public_id);
      // }

      user.avatar = avatarUploadResult.secure_url;
      // user.avatar_public_id = avatarUploadResult.public_id; // Store if you need to delete later

      await user.save();

      // Return the updated user profile (without password)
      const updatedUserResponse = user.toObject();
      delete updatedUserResponse.password;

      res.status(200).json({
        message: "Profile picture updated successfully!",
        user: updatedUserResponse,
      });
    } catch (error) {
      console.error("Error updating user avatar:", error);
      if (error instanceof multer.MulterError) {
        return res
          .status(400)
          .json({ message: `File upload error: ${error.message}` });
      }
      if (
        error.message ===
        "Invalid file type. Only image files (JPG, PNG, GIF, WebP) are allowed for avatars."
      ) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Server error uploading avatar." });
    }
  }
);
// --- END NEW ROUTE FOR AVATAR UPLOAD ---

// 4. GET All Users (e.g., /api/users) - Admin only
router.get("/", verifyToken, async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Access denied. Admin rights required." });
    }
    const users = await User.find().select("-password").sort({ createdAt: -1 });
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
// ====================================================================

// 6. GET Single User by ID (e.g., /api/users/:id) - Admin only
router.get("/:id", verifyToken, async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Access denied. Admin rights required." });
    }
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    console.error(
      `Backend: Error in /users/:id GET route with ID "${req.params.id}":`,
      err
    );
    res.status(500).json({ message: err.message });
  }
});

// 7. PUT Update User by ID (e.g., /api/users/:id) - Admin only
router.put("/:id", verifyToken, async (req, res) => {
  console.log(req.body);
  try {
    if (!req.user || req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Access denied. Admin rights required." });
    }

    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    for (const key in req.body) {
      if (req.body.hasOwnProperty(key)) {
        if (key === "password") {
          console.warn(
            `Attempted to update password via general /users/:id PUT route for user ${userId}. This action was blocked.`
          );
          continue;
        }
        if (
          key === "kycStatus" ||
          key === "kycRejectionReason" ||
          key === "avatar"
        ) {
          console.warn(
            `Attempted to update ${key} via general /users/:id PUT route. This action was blocked.`
          );
          continue;
        }
        user[key] = req.body[key];
      }
    }

    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;

    res.json(userResponse);
  } catch (err) {
    console.error(
      `Backend: Error in /users/:id PUT route for user ID "${req.params.id}":`,
      err
    );

    if (err.name === "CastError" && err.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid User ID format." });
    }
    if (err.name === "ValidationError") {
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

// 8. POST Top up Profit (e.g., /api/users/topup-profit/:userId) - Admin only
router.post("/topup-profit/:userId", verifyToken, async (req, res) => {
  const { amount, notes } = req.body;
  const parsedAmount = parseFloat(amount);

  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res
      .status(400)
      .json({ message: "Invalid amount. Must be a positive number." });
  }

  try {
    if (!req.user || req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Access denied. Admin rights required." });
    }

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.totalProfits += parsedAmount;
    user.balance += parsedAmount;
    await user.save();

    await Transaction.create({
      user: user._id,
      amount: parsedAmount,
      coin: "USDT",
      type: "profit",
      status: "completed",
      notes: notes || ` ${parsedAmount} Trading Profit Credited`,
    });

    res.json({ message: "Profit topped up successfully", user });
  } catch (err) {
    console.error("Error topping up profit:", err);
    res.status(500).json({ message: err.message });
  }
});

// 9. DELETE User by ID (e.g., /api/users/:id) - Admin only
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
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
