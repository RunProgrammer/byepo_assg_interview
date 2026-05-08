const express = require("express");
const router = express.Router();
const { z } = require("zod");
const { authenticate, requireRole } = require("../middleware/auth.middleware");
const prisma = require("../prisma");

// GET /super/organizations/public — no auth required, used by signup dropdowns
router.get("/organizations/public", async (req, res, next) => {
  try {
    const orgs = await prisma.organization.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    res.json(orgs);
  } catch (err) {
    next(err);
  }
});

// All routes below require SUPER_ADMIN
router.use(authenticate, requireRole("SUPER_ADMIN"));

const createOrgSchema = z.object({
  name: z.string().min(2).max(100),
});

// GET /super/organizations
router.get("/organizations", async (req, res, next) => {
  try {
    const orgs = await prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { users: true, featureFlags: true } } },
    });
    res.json(orgs);
  } catch (err) {
    next(err);
  }
});

// POST /super/organizations
router.post("/organizations", async (req, res, next) => {
  try {
    const parsed = createOrgSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }

    const { name } = parsed.data;

    const existing = await prisma.organization.findUnique({ where: { name } });
    if (existing) {
      return res.status(409).json({ error: "Organization name already taken" });
    }

    const org = await prisma.organization.create({ data: { name } });
    res.status(201).json(org);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
