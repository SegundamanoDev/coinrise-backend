// routes/transaction.js

const express = require("express");
const { verifyToken } = require("../middlewares/auth.js"); // Your JWT verification middleware
const Transaction = require("../models/Transaction.js");
const User = require("../models/User.js");
const router = express.Router();
const upload = require("../utils/multer.js"); // Your Multer setup for file uploads
const fs = require("fs"); // For file system operations (e.g., reading local file, deleting local file)
const path = require("path"); // For path manipulation

const cloudinary = require("../utils/cloudinaryConfig"); // Your Cloudinary configuration

// Cloudinary Upload Helper Function
const uploadToCloudinary = async (file, customTags = []) => {
  if (!file) {
    return null;
  }

  let fileBuffer;
  let mimetype = file.mimetype;

  if (file.buffer) {
    fileBuffer = file.buffer;
  } else if (file.path) {
    try {
      fileBuffer = fs.readFileSync(file.path);
    } catch (readError) {
      console.error("Error reading file from disk:", readError);
      throw new Error("Failed to read file from disk for Cloudinary upload.");
    } finally {
      // Clean up local file if Multer used disk storage
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    }
  } else {
    throw new Error(
      "File object does not contain required buffer or path for upload."
    );
  }

  const b64 = fileBuffer.toString("base64");
  const dataUri = `data:${mimetype};base64,${b64}`;

  try {
    const result = await cloudinary.uploader.upload(dataUri, {
      upload_preset: "segun", // Use your Cloudinary upload preset
      resource_type: "auto",
      tags: customTags,
    });
    return { secure_url: result.secure_url, public_id: result.public_id };
  } catch (cloudinaryError) {
    console.error(
      "Cloudinary upload error:",
      cloudinaryError.message,
      cloudinaryError.http_code,
      cloudinaryError.name
    );
    if (cloudinaryError.error) {
      console.error("Cloudinary API Error Details:", cloudinaryError.error);
    }
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
    case "referral_bonus":
      if (action === "approve") {
        user.balance += amount;
      }
      break;
    case "withdrawal":
    case "investment":
      if (action === "decline") {
        user.balance += amount; // Refund the deducted amount
      }
      break;
    case "account_upgrade": // Or "upgrade_deposit"
      if (action === "approve") {
        // Implement upgrade logic if necessary
      }
      break;
  }
  await user.save();
  return user;
};

// Route: Request Account Upgrade (POST)
router.post(
  "/upgrade-request",
  verifyToken,
  upload.single("proof"),
  async (req, res) => {
    const { amount, coin, type, planId, planName, depositWalletAddress } =
      req.body;

    try {
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

      if ((type === "deposit" || type === "upgrade_deposit") && !req.file) {
        return res.status(400).json({
          message:
            "Proof of payment file is required for this transaction type.",
        });
      }

      if (type === "upgrade_deposit") {
        if (!planId || !planName) {
          return res.status(400).json({
            message:
              "Plan ID and Plan Name are required for upgrade transactions.",
          });
        }
        if (!depositWalletAddress) {
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
        coin: coin,
        type: type,
        status: "pending",
        method: coin,
        details: {
          depositWalletAddress: depositWalletAddress,
        },
      };

      if (type === "upgrade_deposit") {
        transactionData.planId = planId;
        transactionData.planName = planName;
        transactionData.details.planName = planName;
      }

      let uploadedProof = null;
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
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      if (error.name === "ValidationError") {
        return res
          .status(400)
          .json({ message: error.message, errors: error.errors });
      }
      res.status(500).json({
        message: "Server error. Please try again later.",
        error: error.message,
      });
    }
  }
);

// Route: Request Deposit/Withdrawal/Investment (POST)
router.post(
  "/request",
  verifyToken,
  upload.single("paymentProof"),
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

      const transactionData = {
        user: userId,
        type,
        amount: Number(amount),
        status: "pending",
        details: {},
      };

      if (type === "deposit") {
        if (!req.file) {
          return res
            .status(400)
            .json({ message: "Deposit requires payment proof." });
        }
        if (!coin) {
          return res
            .status(400)
            .json({ message: "Deposit requires coin type." });
        }
        if (!depositWalletAddress) {
          return res
            .status(400)
            .json({ message: "Deposit wallet address is required." });
        }
        transactionData.coin = coin;
        transactionData.method = coin;
        transactionData.details.depositWalletAddress = depositWalletAddress;
      } else if (type === "withdrawal") {
        if (!method) {
          return res
            .status(400)
            .json({ message: "Withdrawal requires a method." });
        }
        if (method === "Crypto Wallet" && !withdrawalWalletAddress) {
          return res.status(400).json({
            message: "Withdrawal via Crypto Wallet requires a wallet address.",
          });
        }

        if (amount > user.balance) {
          return res
            .status(400)
            .json({ message: `Insufficient balance for withdrawal.` });
        }
        user.balance -= amount;
        await user.save();

        transactionData.method = method;
        transactionData.details.withdrawalMethod = method;
        if (withdrawalWalletAddress) {
          transactionData.details.withdrawalWalletAddress =
            withdrawalWalletAddress;
        }
        if (details) {
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
        user.balance -= amount;
        await user.save();
        transactionData.method = method;
        if (details) {
          transactionData.details = { ...transactionData.details, ...details };
        }
      }

      let uploadedProof = null;
      if (type === "deposit" && req.file) {
        uploadedProof = await uploadToCloudinary(req.file, ["deposit_proof"]);
        transactionData.paymentProof = {
          secure_url: uploadedProof.secure_url,
          public_id: uploadedProof.public_id,
        };
      }

      const transaction = await Transaction.create(transactionData);

      res.status(201).json(transaction);
    } catch (error) {
      console.error("Error creating transaction (request):", error);
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
      }
    }

    const updatedTransaction = await Transaction.findById(id).populate(
      "user",
      "fullName email balance currency accountLevel"
    );

    return res.status(200).json({
      message: `Transaction ${newStatus}.`,
      transaction: updatedTransaction,
      balance: user.balance,
    });
  } catch (error) {
    console.error("Transaction update error:", error);
    res
      .status(500)
      .json({ message: "Failed to update transaction", error: error.message });
  }
});

// Admin: Delete a transaction (NEW/CONFIRMED ROUTE)
router.delete("/admin/:id", verifyToken, async (req, res) => {
  try {
    // Ensure only admins can access this route
    if (req.user && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Access denied. Admin rights required." });
    }

    const { id } = req.params;
    const transaction = await Transaction.findById(id);

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found." });
    }

    // If there's a payment proof, delete it from Cloudinary to free up storage
    if (transaction.paymentProof && transaction.paymentProof.public_id) {
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
        // Log the error but continue to delete the transaction document in MongoDB
      }
    }

    await Transaction.findByIdAndDelete(id);

    res.status(200).json({ message: "Transaction deleted successfully." });
  } catch (error) {
    console.error("Error deleting transaction:", error);
    res
      .status(500)
      .json({ message: "Failed to delete transaction", error: error.message });
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
    const deposits = await Transaction.find({
      user: userId,
      type: { $in: ["deposit", "upgrade_deposit"] },
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

    // Authorization: Allow user to fetch their own transaction or admin to fetch any transaction
    if (
      transaction.user._id.toString() !== req.user._id.toString() &&
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
