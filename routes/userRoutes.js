const express = require("express");
const router = express.Router();

const { authenticate } = require("../middlewares/auth");
const { getUserDashboard } = require("../controllers/userController");

router.use(authenticate);
router.get("/dashboard", getUserDashboard);

module.exports = router;
