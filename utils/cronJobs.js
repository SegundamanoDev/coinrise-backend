const cron = require("node-cron");
const Investment = require("../models/Investment");
const User = require("../models/User");
const Transaction = require("../models/Transaction");

function startCronJobs() {
  // Runs every day at midnight
  cron.schedule("0 0 * * *", async () => {
    console.log("Running daily ROI job...");

    try {
      const today = new Date();

      const maturedInvestments = await Investment.find({
        status: "active",
        endDate: { $lte: today },
      });

      for (const inv of maturedInvestments) {
        const user = await User.findById(inv.userId);
        if (!user) continue;

        const profit = (inv.amount * inv.roi) / 100;

        user.balance += profit;
        user.totalProfits += profit;
        await user.save();

        inv.status = "completed";
        await inv.save();

        await new Transaction({
          userId: user._id,
          type: "profit",
          amount: profit,
          description: `ROI credited from ${inv.plan} plan`,
          status: "completed",
        }).save();
      }

      console.log("ROI job finished.");
    } catch (error) {
      console.error("ROI cron job error:", error.message);
    }
  });
}

module.exports = startCronJobs;
