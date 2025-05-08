const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Setting = require("../models/setting");

const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: "User not found" });

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    return next();
  }
  return res.status(403).json({ message: "Access denied" });
};

const checkMaintenanceMode = async (req, res, next) => {
  try {
    const settings = await Setting.findOne();
    if (settings?.maintenanceMode && req.user?.role !== "admin") {
      return res.status(503).json({ message: "System under maintenance" });
    }
    next();
  } catch (error) {
    console.error("Maintenance check failed", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { authenticate, isAdmin, checkMaintenanceMode };
