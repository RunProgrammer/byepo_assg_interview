const express = require("express");
const router = express.Router();
const { z } = require("zod");
const { authenticate, requireRole } = require("../middleware/auth.middleware");
const prisma = require("../prisma");
const { getFromCache, setCache } = require("../services/flagCache.service");

router.use(authenticate, requireRole("END_USER"));

const checkFlagSchema = z.object({
  featureKey: z.string().min(1),
});

// POST /user/flags/check
router.post("/flags/check", async (req, res, next) => {
  try {
    const parsed = checkFlagSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }

    const { featureKey } = parsed.data;
    const orgId = req.user.orgId;
    const cacheKey = `${orgId}:${featureKey}`;

    // Check in-memory cache first
    const cached = getFromCache(cacheKey);
    if (cached !== null) {
      return res.json({ featureKey, isEnabled: cached, source: "cache" });
    }

    const flag = await prisma.featureFlag.findUnique({
      where: { featureKey_orgId: { featureKey, orgId } },
    });

    if (!flag) {
      return res.status(404).json({ error: "Feature flag not found for your organization" });
    }

    // Store in cache
    setCache(cacheKey, flag.isEnabled);

    res.json({ featureKey, isEnabled: flag.isEnabled, source: "db" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
