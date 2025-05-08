const express = require("express");
const {
  getUserWithdrawals,
  createWithdrawal,
  getAllWithdrawals,
  updateWithdrawalStatus,
  deleteWithdrawal,
} = require("../controllers/withdrawalController");
const {
  authenticate,
  isAdmin,
  checkMaintenanceMode,
} = require("../middlewares/auth");

const router = express.Router();

router.use(authenticate, checkMaintenanceMode);
router.post("/", createWithdrawal);
router.get("/my", getUserWithdrawals);

router.use(isAdmin);
router.get("/all", getAllWithdrawals);
router.put("/:id/approve", updateWithdrawalStatus);
router.put("/:id/reject", deleteWithdrawal);

module.exports = router;
