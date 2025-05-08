const express = require("express");
const {
  createInvestment,
  getUserInvestments,
  getAllInvestments,
  updateInvestmentStatus,
  deleteInvestment,
} = require("../controllers/investmentController");
const {
  authenticate,
  isAdmin,
  checkMaintenanceMode,
} = require("../middlewares/auth");

const router = express.Router();

router.use(authenticate, checkMaintenanceMode);
router.post("/", createInvestment);
router.get("/my", getUserInvestments);

router.use(isAdmin);
router.get("/all", getAllInvestments);
router.put("/:id/cancel", deleteInvestment);
router.put("/roi/global", updateInvestmentStatus);

module.exports = router;
