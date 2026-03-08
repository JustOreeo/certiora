import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { seedTenantFsrsParams } from "../src/lib/fsrs";

const prisma = new PrismaClient();

const TEST_TENANTS = [
  { name: "Review Center 1", slug: "review-center-1" },
  { name: "Review Center 2", slug: "review-center-2" },
  { name: "Review Center 3", slug: "review-center-3" },
];

async function seedSuperAdmin() {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set");
  }

  const existing = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  if (existing) {
    console.log("Super admin already exists:", existing.email);
    return;
  }

  const passwordHash = await hash(password, 10);
  const user = await prisma.user.create({
    data: { email, name: "Super Admin", role: "SUPER_ADMIN", passwordHash, tenantId: null },
  });
  console.log("Super admin created:", user.email);
}

async function seedTestTenants() {
  if (process.env.NODE_ENV !== "development") {
    console.log("Skipping test tenant seeding in non-development environment");
    return;
  }

  const adminPassword = await hash("Admin123!", 10);
  const studentPassword = await hash("Student123!", 10);

  for (const { name, slug } of TEST_TENANTS) {
    // Create tenant (idempotent)
    let tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) {
      tenant = await prisma.tenant.create({ data: { name, slug } });
      console.log("Tenant created:", slug);
    } else {
      console.log("Tenant already exists:", slug);
    }

    // Seed FSRS params
    const existingParams = await prisma.fsrsParams.findFirst({
      where: { tenantId: tenant.id, userId: null },
    });
    if (!existingParams) {
      await prisma.fsrsParams.create({ data: seedTenantFsrsParams(tenant.id) });
      console.log("FsrsParams seeded for:", slug);
    }

    // Create admin
    const adminEmail = `admin@${slug}.com`;
    const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!existingAdmin) {
      await prisma.user.create({
        data: {
          email: adminEmail,
          name: `Admin (${name})`,
          role: "ADMIN",
          passwordHash: adminPassword,
          tenantId: tenant.id,
        },
      });
      console.log("Admin created:", adminEmail);
    }

    // Create 3 students
    for (let i = 1; i <= 3; i++) {
      const studentEmail = `student${i}@${slug}.com`;
      const existingStudent = await prisma.user.findUnique({ where: { email: studentEmail } });
      if (!existingStudent) {
        await prisma.user.create({
          data: {
            email: studentEmail,
            name: `Student ${i} (${name})`,
            role: "STUDENT",
            passwordHash: studentPassword,
            tenantId: tenant.id,
          },
        });
        console.log("Student created:", studentEmail);
      }
    }
  }
}

async function backfillFsrsParams() {
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  for (const t of tenants) {
    const existing = await prisma.fsrsParams.findFirst({
      where: { tenantId: t.id, userId: null },
    });
    if (!existing) {
      await prisma.fsrsParams.create({ data: seedTenantFsrsParams(t.id) });
      console.log("FsrsParams backfilled for tenant:", t.id);
    }
  }
}

async function main() {
  await backfillFsrsParams();
  await seedSuperAdmin();
  await seedTestTenants();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
