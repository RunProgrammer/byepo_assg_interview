const express = require("express");
const router = express.Router();
const { z } = require("zod");
const { authenticate, requireRole } = require("../middleware/auth.middleware");
const prisma = require("../prisma");
const { invalidateOrgCache } = require("../services/flagCache.service");

router.use(authenticate, requireRole("ORG_ADMIN"));

const createFlagSchema = z.object({
  featureKey: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9_]+$/, "feature_key must be lowercase letters, numbers, and underscores only"),
  isEnabled: z.boolean().default(false),
});

const updateFlagSchema = z.object({
  isEnabled: z.boolean().optional(),
  featureKey: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9_]+$/)
    .optional(),
});

// GET /admin/flags
router.get("/flags", async (req, res, next) => {
  try {
    const flags = await prisma.featureFlag.findMany({
      where: { orgId: req.user.orgId },
      orderBy: { createdAt: "desc" },
    });
    res.json(flags);
  } catch (err) {
    next(err);
  }
});

// POST /admin/flags
router.post("/flags", async (req, res, next) => {
  try {
    const parsed = createFlagSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }

    const { featureKey, isEnabled } = parsed.data;
    const orgId = req.user.orgId;

    const flag = await prisma.featureFlag.create({
      data: { featureKey, isEnabled, orgId },
    });

    invalidateOrgCache(orgId);
    res.status(201).json(flag);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Feature key already exists in this organization" });
    }
    next(err);
  }
});

// PATCH /admin/flags/:id
router.patch("/flags/:id", async (req, res, next) => {
  try {
    const parsed = updateFlagSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }

    const orgId = req.user.orgId;

    // Ensure the flag belongs to this admin's org
    const existing = await prisma.featureFlag.findFirst({
      where: { id: req.params.id, orgId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Feature flag not found" });
    }

    const updated = await prisma.featureFlag.update({
      where: { id: req.params.id },
      data: parsed.data,
    });

    invalidateOrgCache(orgId);
    res.json(updated);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Feature key already exists in this organization" });
    }
    next(err);
  }
});

// DELETE /admin/flags/:id
router.delete("/flags/:id", async (req, res, next) => {
  try {
    const orgId = req.user.orgId;

    const existing = await prisma.featureFlag.findFirst({
      where: { id: req.params.id, orgId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Feature flag not found" });
    }

    await prisma.featureFlag.delete({ where: { id: req.params.id } });

    invalidateOrgCache(orgId);
    res.json({ message: "Feature flag deleted" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
