const express = require("express");
const {
  createDeposit,
  getUserDeposits,
  approveDeposit,
  rejectDeposit,
  getAllDeposits,
} = require("../controllers/depositController");
const {
  authenticate,
  isAdmin,
  checkMaintenanceMode,
} = require("../middlewares/auth");

const router = express.Router();

router.use(authenticate, checkMaintenanceMode);
router.post("/", createDeposit);
router.get("/my", getUserDeposits);

router.use(isAdmin);
router.get("/all", getAllDeposits);
router.put("/:id/approve", approveDeposit);
router.put("/:id/reject", rejectDeposit);

module.exports = router;
