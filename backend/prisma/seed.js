const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL || "admin@byepo.com";
  const password = process.env.SUPER_ADMIN_PASSWORD || "superadmin123";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Super admin already exists, skipping seed.");
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: "SUPER_ADMIN",
      orgId: null,
    },
  });

  console.log(`Super admin created: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
