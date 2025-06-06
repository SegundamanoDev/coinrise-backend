// routes/transaction.js

const express = require("express");
const { verifyToken } = require("../middlewares/auth.js"); // Your JWT verification middleware
const Transaction = require("../models/Transaction.js");
const User = require("../models/User.js");
const router = express.Router();
const upload = require("../utils/multer.js"); // Your Multer setup for file uploads
const fs = require("fs"); // For file system operations (e.g., reading local file, deleting local file)
const path = require("path"); // For path manipulation

// --- NEW IMPORTS FOR CLOUDINARY ---
const cloudinary = require("../utils/cloudinaryConfig"); // Your Cloudinary configuration
// --- END NEW IMPORTS ---

// --- Cloudinary Upload Helper Function (Now handles both buffer and path from Multer) ---
// This function takes a file object (from Multer) and uploads it to Cloudinary.
// It explicitly sets the 'upload_preset' and adds tags for organization.
const uploadToCloudinary = async (file, customTags = []) => {
  if (!file) {
    return null;
  }

  let fileBuffer;
  let mimetype = file.mimetype; // Multer provides mimetype regardless of storage type

  if (file.buffer) {
    // If Multer is configured with memoryStorage, file.buffer will be available
    fileBuffer = file.buffer;
  } else if (file.path) {
    // If Multer is configured with diskStorage, file.path will be available
    try {
      fileBuffer = fs.readFileSync(file.path);
    } catch (readError) {
      console.error("Error reading file from disk:", readError);
      throw new Error("Failed to read file from disk for Cloudinary upload.");
    }
  } else {
    // If neither buffer nor path is available, it's an unexpected file object
    throw new Error(
      "File object does not contain required buffer or path for upload."
    );
  }

  const b64 = fileBuffer.toString("base64");
  const dataUri = `data:${mimetype};base64,${b64}`;

  try {
    // Upload the file to Cloudinary with the specified upload preset and tags
    const result = await cloudinary.uploader.upload(dataUri, {
      upload_preset: "segun", // Use the "segun" upload preset
      resource_type: "auto", // Cloudinary will automatically detect if it's an image or raw (for PDF)
      tags: customTags, // Add custom tags for Cloudinary management (e.g., 'deposit_proof', 'upgrade_proof')
    });

    // Return the secure URL and public ID of the uploaded file
    return { secure_url: result.secure_url, public_id: result.public_id };
  } catch (cloudinaryError) {
    console.error("Cloudinary upload error:", cloudinaryError);
    // Re-throw to be caught by the route's try-catch block
    throw new Error("Failed to upload file to Cloudinary.");
  }
};

// Helper function to update user balance (DRY principle)
const updateUserBalance = async (
  userId,
  amount,
  type,
  action,
  transactionId
) => {
  const user = await User.findById(userId);
  if (!user) {
    console.error(`User not found for ID: ${userId}`);
    throw new Error("User not found.");
  }

  switch (type) {
    case "deposit":
    case "referral_bonus": // Assuming referral bonus is added to balance
      if (action === "approve") {
        user.balance += amount;
      }
      // No action needed for decline of deposit/bonus as balance wasn't deducted initially
      break;
    case "withdrawal":
    case "investment":
      if (action === "decline") {
        user.balance += amount; // Refund the deducted amount
      }
      // No action needed for approval of withdrawal/investment as balance was deducted initially
      break;
    case "account_upgrade": // Handle account upgrade approval
      if (action === "approve") {
        // You would define your upgrade logic here, e.g.,
        // user.currentPlan = 'standard'; // Set a new plan based on the upgrade details
      }
      // If an upgrade is declined, no balance change as it was a fee
      break;
  }
  await user.save();
  return user;
};

// --- MODIFIED ROUTE: Request Account Upgrade (Now explicitly sets method and details) ---
router.post(
  "/upgrade-request",
  verifyToken,
  upload.single("proof"), // 'proof' must match the field name in FormData
  async (req, res) => {
    const { amount, coin, type, planId, planName, depositWalletAddress } =
      req.body; // Added depositWalletAddress

    try {
      // Input validation
      if (!amount || !coin || !type) {
        return res
          .status(400)
          .json({ message: "Amount, coin, and type are required." });
      }

      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res
          .status(400)
          .json({ message: "Invalid amount. Must be a positive number." });
      }

      // Proof of payment is required for 'deposit' and 'upgrade_deposit' types
      if ((type === "deposit" || type === "upgrade_deposit") && !req.file) {
        return res.status(400).json({
          message:
            "Proof of payment file is required for this transaction type.",
        });
      }

      // Specific validation for 'upgrade_deposit' type
      if (type === "upgrade_deposit") {
        if (!planId || !planName) {
          return res.status(400).json({
            message:
              "Plan ID and Plan Name are required for upgrade transactions.",
          });
        }
        if (!depositWalletAddress) {
          // Wallet address is required for crypto upgrade deposits
          return res.status(400).json({
            message: "Deposit wallet address is required for crypto upgrade.",
          });
        }
      }

      const user = await User.findById(req.user._id);
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }

      const transactionData = {
        user: req.user._id,
        amount: parsedAmount,
        coin: coin, // BTC, USDT (symbol)
        type: type, // upgrade_deposit
        status: "pending",
        method: coin, // METHOD IS NOW THE COIN SYMBOL (BTC, USDT)
      };

      // Populate details object
      transactionData.details = {
        depositWalletAddress: depositWalletAddress, // The platform's wallet address for this deposit
        // Add other details here if needed for upgrades
      };

      // Add plan details if it's an upgrade
      if (type === "upgrade_deposit") {
        transactionData.planId = planId;
        transactionData.planName = planName;
        // Merge plan details into general details if desired, or keep separate
        transactionData.details.planName = planName; // Example: Also put planName in details
      }

      let uploadedProof = null;
      // Upload file to Cloudinary and store URL/Public ID
      if (req.file) {
        uploadedProof = await uploadToCloudinary(req.file, [`${type}_proof`]);
        transactionData.paymentProof = {
          secure_url: uploadedProof.secure_url,
          public_id: uploadedProof.public_id,
        };
      }

      const transaction = new Transaction(transactionData);
      await transaction.save();

      res.status(201).json({
        message: `Account upgrade request submitted successfully! Awaiting admin approval.`,
        transaction: transaction,
      });
    } catch (error) {
      console.error("Error initiating transaction (upgrade-request):", error);
      // Clean up local file if Multer used disk storage and an error occurred before Cloudinary upload or DB save
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({
        message: "Server error. Please try again later.",
        error: error.message,
      });
    }
  }
);

// --- MODIFIED ROUTE: Request Deposit/Withdrawal/Investment ---
router.post(
  "/request",
  verifyToken,
  upload.single("paymentProof"), // 'paymentProof' for deposits only
  async (req, res) => {
    try {
      const {
        type,
        amount,
        coin,
        method,
        details,
        depositWalletAddress,
        withdrawalWalletAddress,
      } = req.body;
      const userId = req.user._id;

      if (!type || !amount) {
        return res
          .status(400)
          .json({ message: "Missing required fields: type and amount." });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }

      // Prepare base transaction data
      const transactionData = {
        user: userId,
        type,
        amount: Number(amount),
        status: "pending",
        details: {}, // Initialize details object
      };

      // Type-specific logic and validation
      if (type === "deposit") {
        if (!req.file) {
          return res
            .status(400)
            .json({ message: "Deposit requires payment proof." });
        }
        if (!coin) {
          // `coin` is now the symbol (BTC, USDT)
          return res
            .status(400)
            .json({ message: "Deposit requires coin type." });
        }
        if (!depositWalletAddress) {
          // The platform's wallet address user sent to
          return res
            .status(400)
            .json({ message: "Deposit wallet address is required." });
        }
        transactionData.coin = coin; // e.g., "BTC"
        transactionData.method = coin; // METHOD IS NOW THE COIN SYMBOL (e.g., "BTC")
        transactionData.details.depositWalletAddress = depositWalletAddress; // The platform's address
      } else if (type === "withdrawal") {
        if (!method) {
          // This `method` is "Bank Transfer" or "Crypto Wallet"
          return res
            .status(400)
            .json({ message: "Withdrawal requires a method." });
        }
        if (method === "Crypto Wallet" && !withdrawalWalletAddress) {
          // User's withdrawal crypto address
          return res.status(400).json({
            message: "Withdrawal via Crypto Wallet requires a wallet address.",
          });
        }

        if (amount > user.balance) {
          return res
            .status(400)
            .json({ message: `Insufficient balance for withdrawal.` });
        }
        user.balance -= amount; // Deduct immediately for withdrawals
        await user.save();

        transactionData.method = method; // e.g., "Crypto Wallet", "Bank Transfer"
        transactionData.details.withdrawalMethod = method; // Redundant, but ensures it's in details if needed
        if (withdrawalWalletAddress) {
          transactionData.details.withdrawalWalletAddress =
            withdrawalWalletAddress; // User's address
        }
        // You might add bank details to `transactionData.details` here if method is "Bank Transfer"
        if (details) {
          // Allow general details to be passed, e.g., for bank info
          transactionData.details = { ...transactionData.details, ...details };
        }
      } else if (type === "investment") {
        if (!method) {
          return res
            .status(400)
            .json({ message: "Investment requires a method (e.g., Staking)." });
        }
        if (amount > user.balance) {
          return res
            .status(400)
            .json({ message: `Insufficient balance for investment.` });
        }
        user.balance -= amount; // Deduct immediately for investments
        await user.save();
        transactionData.method = method;
        if (details) {
          transactionData.details = { ...transactionData.details, ...details };
        }
      }

      let uploadedProof = null;
      // Upload paymentProof to Cloudinary for deposits
      if (type === "deposit" && req.file) {
        uploadedProof = await uploadToCloudinary(req.file, ["deposit_proof"]);
        transactionData.paymentProof = {
          secure_url: uploadedProof.secure_url,
          public_id: uploadedProof.public_id,
        };
      }

      // Create the transaction
      const transaction = await Transaction.create(transactionData);

      res.status(201).json(transaction);
    } catch (error) {
      console.error("Error creating transaction (request):", error);
      // Clean up local file if Multer used disk storage and an error occurred before Cloudinary upload or DB save
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      if (error.name === "ValidationError") {
        return res
          .status(400)
          .json({ message: error.message, errors: error.errors });
      }
      res.status(500).json({
        message: "Failed to create transaction",
        error: error.message,
      });
    }
  }
);

// Admin: Get all transactions
router.get("/admin", verifyToken, async (req, res) => {
  try {
    // Ensure only admins can access this route
    if (req.user && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Access denied. Admin rights required." });
    }

    const { type, status } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;

    const transactions = await Transaction.find(filter)
      .populate("user", "fullName email balance currency accountLevel")
      .sort({ createdAt: -1 });

    res.status(200).json(transactions);
  } catch (error) {
    console.error("Error fetching admin transactions:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch transactions", error: error.message });
  }
});

// Admin: Update transaction status (Approve/Decline)
router.patch("/transactions-update", verifyToken, async (req, res) => {
  try {
    // Ensure only admins can access this route
    if (req.user && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Access denied. Admin rights required." });
    }

    const { id, action } = req.body;

    if (!id || !["approve", "decline"].includes(action)) {
      return res.status(400).json({
        message: "Invalid request: Transaction ID or action missing/invalid.",
      });
    }

    const transaction = await Transaction.findById(id);
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found." });
    }

    if (transaction.status !== "pending") {
      return res
        .status(400)
        .json({ message: "Transaction already processed." });
    }

    const newStatus = action === "approve" ? "approved" : "declined";

    // Update user balance/account level based on transaction type and action
    const user = await updateUserBalance(
      transaction.user,
      transaction.amount,
      transaction.type,
      action,
      transaction._id
    );

    transaction.status = newStatus;
    await transaction.save({ validateBeforeSave: false });

    // If transaction is declined AND it has a paymentProof with a public_id, delete from Cloudinary
    if (
      action === "decline" &&
      transaction.paymentProof &&
      transaction.paymentProof.public_id
    ) {
      try {
        await cloudinary.uploader.destroy(transaction.paymentProof.public_id);
        console.log(
          `Deleted Cloudinary proof for transaction ${transaction._id}: ${transaction.paymentProof.public_id}`
        );
      } catch (cloudinaryErr) {
        console.error(
          `Failed to delete Cloudinary proof ${transaction.paymentProof.public_id}:`,
          cloudinaryErr
        );
        // Log the error but don't prevent the transaction status update
      }
    }

    // Return the updated transaction with populated user data for the frontend
    const updatedTransaction = await Transaction.findById(id).populate(
      "user",
      "fullName email balance currency accountLevel"
    );

    return res.status(200).json({
      message: `Transaction ${newStatus}.`,
      transaction: updatedTransaction,
      balance: user.balance, // Return updated user balance
    });
  } catch (error) {
    console.error("Transaction update error:", error);
    res
      .status(500)
      .json({ message: "Failed to update transaction", error: error.message });
  }
});

// User: Get their own transactions
router.get("/my", verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const transactions = await Transaction.find({ user: userId })
      .populate("user", "fullName email balance currency accountLevel")
      .sort({ createdAt: -1 });

    res.status(200).json(transactions);
  } catch (error) {
    console.error("Error fetching user transactions:", error);
    res.status(500).json({
      message: "Failed to fetch your transactions",
      error: error.message,
    });
  }
});

// User: Get their deposit history (specific route)
router.get("/deposits-history", verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    // Include 'upgrade_deposit' type in deposit history if you want to show it
    const deposits = await Transaction.find({
      user: userId,
      type: { $in: ["deposit", "upgrade_deposit"] }, // Changed from account_upgrade to upgrade_deposit
    })
      .populate("user", "currency accountLevel")
      .sort({ createdAt: -1 });

    res.json(deposits);
  } catch (err) {
    console.error("Error fetching deposit history:", err);
    res
      .status(500)
      .json({ message: "Failed to fetch deposit history", error: err.message });
  }
});

// Get single transaction by ID.
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id).populate(
      "user",
      "fullName email balance currency accountLevel"
    );

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found." });
    }
    // Optional: Ensure user can only fetch their own transactions unless they are admin
    if (
      transaction.user._id.toString() !== req.user._id.toString() &&
      req.user &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ message: "Unauthorized to view this transaction." });
    }

    res.json(transaction);
  } catch (err) {
    console.error("Error fetching transaction by ID:", err);
    res
      .status(500)
      .json({ message: "Failed to fetch transaction", error: err.message });
  }
});

module.exports = router;
