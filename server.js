require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");

const app = express();

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: "https://coinrise-khaki.vercel.app ",
  })
);
app.use(morgan("dev"));

// Route Imports
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/settings", require("./routes/settingsRoutes"));
app.use("/api/deposits", require("./routes/depositRoutes"));
app.use("/api/withdrawals", require("./routes/withdrawalRoutes"));
// app.use("/api/investments", require("./routes/investmentRoutes"));
// app.use("/api/plans", require("./routes/planRoutes"));
app.use("/api/referrals", require("./routes/referralRoutes"));
app.use("/api/transactions", require("./routes/transactionRoutes"));

// DB and Server Init
const PORT = process.env.PORT || 5000;
mongoose
  .connect(process.env.MONGO_URI)
  .then(() =>
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
  )
  .catch((err) => console.error("DB connection error:", err));
