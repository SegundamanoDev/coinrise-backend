const jwt = require("jsonwebtoken");
const User = require("../models/User"); // Ensure this path is correct

const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  // If no token is provided, respond with unauthorized status
  if (!token) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  try {
    // Verify the token using the secret key
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find the user by ID from the decoded token payload
    const user = await User.findById(decoded.id);

    // If no user is found with the ID from the token, it's an invalid token/user
    if (!user) {
      // Throw an error to be caught by the catch block below
      throw new Error("User not found for token.");
    }

    // --- NEW LOGIC: Update lastSeenAt timestamp ---
    // Update the user's lastSeenAt timestamp to the current time.
    // We use findByIdAndUpdate for an atomic update and do not 'await' it,
    // allowing the main request flow to continue without delay.
    // '.catch' is used to log any errors from this non-blocking update.
    User.findByIdAndUpdate(
      user._id,
      { lastSeenAt: new Date() },
      { new: false, runValidators: false } // new:false as we don't need the updated doc back
    ).catch((err) => {
      // Log the error but don't prevent the request from proceeding
      console.error("Error updating user lastSeenAt:", err);
    });
    // --- END NEW LOGIC ---

    // Attach the user object to the request for subsequent middleware/route handlers
    req.user = user;
    next(); // Proceed to the next middleware or route handler
  } catch (err) {
    // Handle specific JWT errors or generic errors
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Unauthorized: Token expired" });
    }
    if (err.name === "JsonWebTokenError") {
      return res.status(403).json({ error: "Forbidden: Invalid token" });
    }
    // Catch-all for any other errors during the process
    res.status(403).json({ error: "Forbidden: Token verification failed" });
  }
};

module.exports = { verifyToken };
