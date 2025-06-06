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
      return {
        success: true,
        investmentId: investment._id,
        message: "Already completed.",
      };
    }

    const user = await User.findById(investment.userId);
    if (!user) {
      console.error(
        `User ${investment.userId} not found for investment ${investment._id}. Cannot complete.`
      );
      return {
        success: false,
        investmentId: investment._id,
        error: `User not found for investment ${investment._id}`,
      };
    }

    const roiAmount = (investment.amount * investment.roi) / 100;
    const totalPayout = investment.amount + roiAmount;

    // Use a transaction here if atomicity across multiple models is critical
    // For simplicity, directly updating and saving. Consider MongoDB transactions for production.
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
    return {
      success: true,
      investmentId: investment._id,
      message: `Investment completed, payout: ${totalPayout}`,
    };
  } catch (error) {
    console.error(
      `Cron Job Error completing investment ${investment._id}:`,
      error
    );
    return {
      success: false,
      investmentId: investment._id,
      error: error.message || "Unknown error",
    };
  }
}

// Schedule the cron job
const startCronJobs = () => {
  // Schedule to run every hour
  // If you expect many investments to complete at once, you might need a more frequent schedule
  // or a system that queues these completions to avoid overloading a single hourly run.
  cron.schedule("0 * * * *", async () => {
    // Runs at the beginning of every hour (e.g., 00:00, 01:00, 02:00 etc.)
    const startTime = new Date();
    console.log(
      `Running cron job to check for completed investments at ${startTime.toISOString()}...`
    );

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

        // Process investments concurrently using Promise.allSettled
        // Promise.allSettled allows all promises to run to completion (fulfilled or rejected)
        // without stopping if one fails, which is important for cron jobs.
        const completionPromises = investmentsToComplete.map((investment) =>
          completeInvestment(investment)
        );

        const results = await Promise.allSettled(completionPromises);

        let completedCount = 0;
        let failedCount = 0;

        results.forEach((result, index) => {
          if (result.status === "fulfilled" && result.value.success) {
            completedCount++;
            // Log successes from completeInvestment function
          } else {
            failedCount++;
            console.error(
              `Failed to complete investment at index ${index}:`,
              result.status === "rejected" ? result.reason : result.value.error
            );
          }
        });

        console.log(
          `Cron Job Summary: Completed ${completedCount} investments, Failed ${failedCount} investments.`
        );
      } else {
        console.log("No investments found to complete at this time.");
      }
    } catch (error) {
      console.error("Cron job main execution error:", error);
    } finally {
      const endTime = new Date();
      const duration = (endTime - startTime) / 1000; // duration in seconds
      console.log(
        `Cron job finished at ${endTime.toISOString()}. Duration: ${duration.toFixed(
          2
        )} seconds.`
      );
    }
  });
  console.log("Investment auto-completion cron job scheduled.");
};

module.exports = startCronJobs;
