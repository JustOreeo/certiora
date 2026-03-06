import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { seedTenantFsrsParams } from "../src/lib/fsrs";

const prisma = new PrismaClient();

async function main() {
  // Backfill FsrsParams for existing tenants (Phase 1: no row yet)
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  for (const t of tenants) {
    const existing = await prisma.fsrsParams.findFirst({
      where: { tenantId: t.id, userId: null },
    });
    if (!existing) {
      await prisma.fsrsParams.create({
        data: seedTenantFsrsParams(t.id),
      });
      console.log("FsrsParams seeded for tenant:", t.id);
    }
  }

  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set");
  }

  const existing = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN" },
  });

  if (existing) {
    console.log("Super admin already exists:", existing.email);
    return;
  }

  const passwordHash = await hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      name: "Super Admin",
      role: "SUPER_ADMIN",
      passwordHash,
      tenantId: null,
    },
  });

  console.log("Super admin created:", user.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
