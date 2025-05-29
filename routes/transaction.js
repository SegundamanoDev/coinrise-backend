// routes/transaction.js (Updated)

const express = require("express");
const { verifyToken } = require("../middlewares/auth.js"); // Your JWT verification middleware
const Transaction = require("../models/Transaction.js");
const User = require("../models/User.js");
const router = express.Router();
const upload = require("../utils/multer.js"); // Your Multer setup for file uploads
const fs = require("fs"); // For file system operations (e.g., deleting proof on decline)
const path = require("path"); // For path manipulation

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
      // No action needed for decline of deposit/bonus as balance wasn't deducted
      break;
    case "withdrawal":
    case "investment":
      if (action === "decline") {
        user.balance += amount; // Refund the deducted amount
      }
      // No action needed for approval of withdrawal/investment as balance was deducted initially
      break;
    case "account_upgrade": // NEW: Handle account upgrade approval
      if (action === "approve") {
        // Assuming the upgrade fee is just a fee, not added to balance.
        // Instead, update the user's account level.
        // You'll need to define your upgrade logic here.
        // For example, if you have a tiered system (Standard, Silver, Gold, Diamond)
        // You might set a specific level, or increment based on previous level.
        // For simplicity, let's just set them to 'Silver' as a base upgrade.
        // In a real app, you might map amounts to levels.
        // Or derive from transaction details if user picked a level
        // user.upgradeCount = (user.upgradeCount || 0) + 1; // If you track upgrade counts
      }
      // If an upgrade is declined, no balance change as it was a fee,
      // but you might want to delete the uploaded proof file if it's no longer needed.
      break;
  }
  await user.save();
  return user;
};

// --- NEW ROUTE: Request Account Upgrade ---
router.post(
  "/upgrade-request",
  verifyToken,
  upload.single("proof"),
  async (req, res) => {
    const { amount, coin, type, planId, planName } = req.body; // Added planId, planName

    // Input validation
    if (!amount || !coin || !type) {
      if (req.file) {
        // Clean up uploaded file if validation fails
        fs.unlinkSync(req.file.path);
      }
      return res
        .status(400)
        .json({ message: "Amount, coin, and type are required." });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res
        .status(400)
        .json({ message: "Invalid amount. Must be a positive number." });
    }

    // Proof of payment is required for 'deposit' and 'upgrade_deposit' types
    if ((type === "deposit" || type === "upgrade_deposit") && !req.file) {
      return res.status(400).json({
        message: "Proof of payment is required for this transaction type.",
      });
    }

    // Specific validation for 'upgrade_deposit' type
    if (type === "upgrade_deposit") {
      if (!planId || !planName) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({
          message:
            "Plan ID and Plan Name are required for upgrade transactions.",
        });
      }
      // Optional: Add server-side validation to ensure planId and amount match predefined plans
      // const selectedPlan = UPGRADE_PLANS.find(p => p.id === planId); // If you have UPGRADE_PLANS on backend
      // if (!selectedPlan || selectedPlan.amount !== parsedAmount) {
      //     if (req.file) fs.unlinkSync(req.file.path);
      //     return res.status(400).json({ message: "Invalid plan or amount for upgrade." });
      // }
    }

    try {
      const user = await User.findById(req.user._id);
      if (!user) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(404).json({ message: "User not found." });
      }

      const transactionData = {
        user: req.user._id,
        amount: parsedAmount,
        coin: coin,
        type: type,
        status: "pending",
      };

      // Add proofOfPayment if a file was uploaded (for deposit/upgrade_deposit)
      if (req.file) {
        transactionData.proofOfPayment = `/uploads/proofs/${req.file.filename}`;
      }

      // Add plan details if it's an upgrade
      if (type === "upgrade_deposit") {
        transactionData.planId = planId;
        transactionData.planName = planName;
      }

      const transaction = new Transaction(transactionData);
      await transaction.save();

      res.status(201).json({
        message: `${
          type === "upgrade_deposit" ? "Account upgrade" : "Deposit"
        } request submitted successfully! Awaiting admin approval.`,
        transaction: transaction,
      });
    } catch (error) {
      console.error("Error initiating transaction:", error);
      // Delete the uploaded file if there's a server error
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      res
        .status(500)
        .json({ message: "Server error. Please try again later." });
    }
  }
);
// --- Existing Routes (with minor adjustments) ---

// Route for requesting deposit and withdrawal
router.post(
  "/request",
  verifyToken,
  upload.single("paymentProof"), // 'paymentProof' must match the field name in FormData
  async (req, res) => {
    try {
      const { type, amount, coin, method, details } = req.body;
      const userId = req.user._id;
      const paymentProofPath = req.file
        ? `/uploads/${req.file.filename}`
        : undefined;

      if (!type || !amount) {
        return res
          .status(400)
          .json({ message: "Missing required fields: type and amount." });
      }

      const user = await User.findById(userId);
      if (!user) {
        if (req.file) fs.unlinkSync(req.file.path); // Delete file if user not found
        return res.status(404).json({ message: "User not found." });
      }

      // Input validation based on type
      // NOTE: Removed deposit proof validation here because upgrade_request now handles that for upgrades.
      // If 'deposit' also uses paymentProof, ensure this validation is still relevant.
      if (type === "deposit" && (!coin || !paymentProofPath)) {
        return res
          .status(400)
          .json({ message: "Deposit requires coin type and payment proof." });
      }
      if (type === "withdrawal" && !method) {
        return res
          .status(400)
          .json({ message: "Withdrawal requires a method." });
      }
      if (type === "investment" && !method) {
        return res
          .status(400)
          .json({ message: "Investment requires a method (e.g., Staking)." });
      }

      // Balance check and initial deduction for withdrawals/investments
      if (type === "withdrawal" || type === "investment") {
        if (amount > user.balance) {
          return res
            .status(400)
            .json({ message: `Insufficient balance for this ${type}.` });
        }
        user.balance -= amount; // Deduct immediately for withdrawals/investments
        await user.save();
      }

      // Create the transaction
      const transaction = await Transaction.create({
        user: userId,
        type,
        amount: Number(amount),
        coin: ["deposit", "account_upgrade"].includes(type) ? coin : undefined, // Only set coin for deposits/upgrades
        method: method,
        paymentProof: paymentProofPath, // Store the path to the uploaded file
        details: details || {},
      });

      res.status(201).json(transaction);
    } catch (error) {
      console.error("Error creating transaction:", error);
      if (req.file) {
        fs.unlinkSync(req.file.path); // Delete file if error occurred
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
    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Access denied. Admin rights required." });
    }

    const { type, status } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;

    const transactions = await Transaction.find(filter)
      .populate(
        "user",
        "fullName email balance currency accountLevel" // NEW: Populate accountLevel
      )
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
    if (req.user.role !== "admin") {
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
      transaction._id // Pass transaction ID for logging
    );

    transaction.status = newStatus;
    await transaction.save({ validateBeforeSave: false });

    // If transaction is declined and it has a paymentProof, consider deleting the file
    if (action === "decline" && transaction.paymentProof) {
      const filePath = path.join(
        __dirname,
        "../uploads",
        path.basename(transaction.paymentProof)
      );
      fs.unlink(filePath, (err) => {
        if (err) console.error(`Error deleting file ${filePath}:`, err);
        else console.log(`Deleted proof file: ${filePath}`);
      });
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
      .populate("user", "fullName email balance currency accountLevel") // NEW: Populate accountLevel
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
    // Include 'account_upgrade' type in deposit history if you want to show it
    const deposits = await Transaction.find({
      user: userId,
      type: { $in: ["deposit", "account_upgrade"] }, // Include upgrade deposits
    })
      .populate("user", "currency accountLevel") // Populate user with currency and accountLevel
      .sort({ createdAt: -1 });

    res.json(deposits);
  } catch (err) {
    console.error("Error fetching deposit history:", err);
    res
      .status(500)
      .json({ message: "Failed to fetch deposit history", error: err.message });
  }
});

// Get single transaction by ID
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id).populate(
      "user",
      "fullName email balance currency accountLevel" // NEW: Populate accountLevel
    );

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found." });
    }
    // Optional: Ensure user can only fetch their own transactions unless they are admin
    if (
      transaction.user._id.toString() !== req.user._id.toString() &&
      req.user.role !== "admin" // Assuming req.user.isAdmin is now req.user.role === 'admin'
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
