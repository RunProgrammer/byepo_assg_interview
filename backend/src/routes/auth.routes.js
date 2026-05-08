const express = require("express");
const router = express.Router();
const { z } = require("zod");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const prisma = require("../prisma");

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  orgId: z.string().uuid(),
  role: z.enum(["ORG_ADMIN", "END_USER"]).default("END_USER"),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// ── Helpers ────────────────────────────────────────────────

function signAccessToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role, orgId: user.orgId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "15m" }
  );
}

async function createRefreshToken(userId) {
  const token = crypto.randomBytes(64).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await prisma.refreshToken.create({ data: { token, userId, expiresAt } });
  return token;
}

async function rotateRefreshToken(oldToken) {
  // Validate the old token exists and is not expired
  const stored = await prisma.refreshToken.findUnique({ where: { token: oldToken } });

  if (!stored) throw { status: 401, message: "Invalid refresh token" };
  if (stored.expiresAt < new Date()) {
    // Clean up expired token
    await prisma.refreshToken.delete({ where: { token: oldToken } });
    throw { status: 401, message: "Refresh token expired, please log in again" };
  }

  // Delete old token (rotation — each refresh token is single-use)
  await prisma.refreshToken.delete({ where: { token: oldToken } });

  // Issue new refresh token
  const newToken = crypto.randomBytes(64).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({ data: { token: newToken, userId: stored.userId, expiresAt } });

  return { newRefreshToken: newToken, userId: stored.userId };
}

// ── Routes ─────────────────────────────────────────────────

// POST /auth/login
router.post("/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const accessToken = signAccessToken(user);
    const refreshToken = await createRefreshToken(user.id);

    res.json({
      accessToken,
      refreshToken,
      role: user.role,
      orgId: user.orgId,
      email: user.email,
    });
  } catch (err) {
    next(err);
  }
});

// POST /auth/signup
router.post("/signup", async (req, res, next) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }

    const { email, password, orgId, role } = parsed.data;

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return res.status(400).json({ error: "Organization not found" });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, passwordHash, role, orgId } });

    const accessToken = signAccessToken(user);
    const refreshToken = await createRefreshToken(user.id);

    res.status(201).json({
      accessToken,
      refreshToken,
      role: user.role,
      orgId: user.orgId,
      email: user.email,
    });
  } catch (err) {
    next(err);
  }
});

// POST /auth/refresh
router.post("/refresh", async (req, res, next) => {
  try {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "refreshToken is required" });
    }

    const { newRefreshToken, userId } = await rotateRefreshToken(parsed.data.refreshToken);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(401).json({ error: "User not found" });

    const accessToken = signAccessToken(user);

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// POST /auth/logout
router.post("/logout", async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: "refreshToken is required" });

    // Silently succeed even if token not found (idempotent logout)
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });

    res.json({ message: "Logged out successfully" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
