// server.js

const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path"); // Import the 'path' module
const startCronJobs = require("./utils/cronJobs");

dotenv.config();

const app = express();
app.use(morgan("dev"));

app.use(express.json());
app.use(cors());
app.set("trust proxy", true);

// --- NEW: Serve static files from the 'uploads' directory ---
// This line makes files in the 'uploads' folder accessible via /uploads URL
// For example, if you upload 'image.png' to 'your_project_root/uploads/',
// it will be accessible at 'http://yourdomain.com/uploads/image.png'
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// --- END NEW ---

// Import route files
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const dashboardRoutes = require("./routes/dashboard");
const transactionRoutes = require("./routes/transaction");
const investmentRoutes = require("./routes/investment");
const investmentPlanRoutes = require("./routes/investmentPlan");
const adminRoutes = require("./routes/admin");
const contactRoute = require("./routes/contact");

// Use routes
app.use("/api/investments", investmentRoutes);
app.use("/api/plans", investmentPlanRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", contactRoute);

startCronJobs();
// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
