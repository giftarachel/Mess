const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  // Support token in Authorization header (standard) OR query string (SSE EventSource)
  const headerToken = req.headers.authorization?.split(" ")[1];
  const queryToken  = req.query?.token;
  const token = headerToken || queryToken;

  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
};
