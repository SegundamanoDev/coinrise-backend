const express = require("express");
const router = express.Router();
const {
  getAllReferrals,
  getUserReferrals,
  createReferral,
} = require("../controllers/referralController");
const { authenticate, isAdmin } = require("../middlewares/auth");

// Admin can view all
router.get("/", authenticate, isAdmin, getAllReferrals);

// User/Admin can view specific user’s referrals
router.get("/:userId", authenticate, getUserReferrals);

// Internal or public route to create a referral entry
router.post("/", createReferral);

module.exports = router;
