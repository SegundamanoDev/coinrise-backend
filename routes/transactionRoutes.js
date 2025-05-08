const express = require("express");
const router = express.Router();
const {
  getAllTransactions,
  getUserTransactions,
} = require("../controllers/transactionController");
const { authenticate, isAdmin } = require("../middlewares/auth");

router.get("/", authenticate, isAdmin, getAllTransactions);
router.get("/me", authenticate, getUserTransactions);

module.exports = router;
