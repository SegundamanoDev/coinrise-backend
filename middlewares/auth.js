const jwt = require("jsonwebtoken");
const User = require("../models/User");

const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    if (!req.user) throw new Error();
    next();
  } catch (err) {
    res.status(403).json({ error: "Invalid token" });
  }
};

const isAdmin = (req, res, next) => {
  if (!req.user?.isAdmin)
    return res.status(403).json({ error: "Admin access only" });
  next();
};

module.exports = { verifyToken, isAdmin };
