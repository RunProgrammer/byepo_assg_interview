const jwt = require("jsonwebtoken");

/**
 * Verifies JWT and attaches decoded user to req.user
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { userId, email, role, orgId }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

/**
 * Role-based guard — use after authenticate
 * requireRole("SUPER_ADMIN") or requireRole(["ORG_ADMIN", "END_USER"])
 */
const requireRole = (roles) => {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden: insufficient permissions" });
    }
    next();
  };
};

module.exports = { authenticate, requireRole };
