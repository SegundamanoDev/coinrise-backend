// utils/cronJobs.js
const cron = require("node-cron");
const Investment = require("../models/Investment"); // Adjust path as needed
const User = require("../models/User"); // Adjust path as needed
const Transaction = require("../models/Transaction"); // Adjust path as needed

// Function to handle completion of an investment
async function completeInvestment(investment) {
  try {
    // Prevent re-completing if already completed
    if (investment.status === "completed") {
      console.log(`Investment ${investment._id} already completed. Skipping.`);
      return;
    }

    const user = await User.findById(investment.userId);
    if (!user) {
      console.error(
        `User ${investment.userId} not found for investment ${investment._id}. Cannot complete.`
      );
      return;
    }

    const roiAmount = (investment.amount * investment.roi) / 100;
    const totalPayout = investment.amount + roiAmount;

    user.balance += totalPayout;
    investment.status = "completed";

    await investment.save();
    await user.save();

    // Create a transaction record for the auto-completion payout
    await Transaction.create({
      user: investment.userId,
      amount: totalPayout,
      coin: "USDT", // Assuming USDT, adjust if needed
      type: "investment_payout",
      details: {
        investmentId: investment._id,
        planName: investment.plan,
        roiPercent: investment.roi,
        principalAmount: investment.amount,
        roiAmount: roiAmount,
        completedBy: "cron_job",
      },
      status: "approved",
      notes: `Auto-completed investment payout for plan: ${investment.plan} (ID: ${investment._id})`,
    });

    console.log(
      `Cron Job: Investment ${investment._id} for user ${user.email} completed. Payout: ${totalPayout}`
    );
  } catch (error) {
    console.error(
      `Cron Job Error completing investment ${investment._id}:`,
      error
    );
  }
}

// Schedule the cron job
const startCronJobs = () => {
  // Schedule to run every hour
  // In a production environment, you might want a more frequent check (e.g., every 5 minutes or every minute)
  // For testing, you might use '* * * * *' to run every minute.
  cron.schedule("0 * * * *", async () => {
    // Runs at the beginning of every hour (e.g., 00:00, 01:00, 02:00 etc.)
    console.log("Running cron job to check for completed investments...");
    try {
      // Find all active investments whose endDate is less than or equal to the current time
      const investmentsToComplete = await Investment.find({
        status: "active",
        endDate: { $lte: new Date() },
      });

      if (investmentsToComplete.length > 0) {
        console.log(
          `Found ${investmentsToComplete.length} investments to complete.`
        );
        for (const investment of investmentsToComplete) {
          await completeInvestment(investment);
        }
      } else {
        console.log("No investments found to complete at this time.");
      }
    } catch (error) {
      console.error("Cron job main execution error:", error);
    }
  });
  console.log("Investment auto-completion cron job scheduled.");
};

module.exports = startCronJobs;
