const express = require("express");
const router = express.Router();
const {
  getSettings,
  updateSettings,
} = require("../controllers/settingsController");
const { authenticate, isAdmin } = require("../middlewares/auth");

router.get("/", authenticate, getSettings);
router.put("/", authenticate, isAdmin, updateSettings);

module.exports = router;
