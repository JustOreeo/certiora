import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { randomBytes } from "crypto";
import { z } from "zod";
import Papa from "papaparse";
import { ADMIN_INVITE_DEFAULT_EXPIRY_DAYS, ADMIN_INVITE_MAX_EXPIRY_DAYS } from "@/lib/invitation-config";
import { addEmailJob } from "@/lib/queue";
import { adminInvitationEmail } from "@/lib/email/templates";

const MAX_FILE_SIZE_BYTES = 512 * 1024; // 512 KB
const MAX_ROWS = 500;

const rowSchema = z.object({
  email: z.string().email("Invalid email"),
  tenantname: z.string().min(1, "tenantName is required"),
  tenantslug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  expiresindays: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      const n = Number(v);
      return isNaN(n) ? ADMIN_INVITE_DEFAULT_EXPIRY_DAYS : Math.min(Math.max(Math.round(n), 1), ADMIN_INVITE_MAX_EXPIRY_DAYS);
    }),
});

type RowResult =
  | { status: "created"; email: string; tenantName: string; tenantSlug: string; invitationUrl: string; expiresInDays: number }
  | { status: "skipped"; email: string; tenantSlug: string; reason: string };

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "CSV file required" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: `File too large. Maximum size is ${MAX_FILE_SIZE_BYTES / 1024} KB.` }, { status: 400 });
  }

  const text = await file.text();

  const { data: rows, errors } = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  if (errors.length > 0 && rows.length === 0) {
    return NextResponse.json({ error: "Failed to parse CSV. Check the file format." }, { status: 400 });
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "CSV has no data rows." }, { status: 400 });
  }

  if (rows.length > MAX_ROWS) {
    return NextResponse.json({ error: `Too many rows. Maximum is ${MAX_ROWS} per upload.` }, { status: 400 });
  }

  const firstRow = rows[0];
  if (!("email" in firstRow) || !("tenantname" in firstRow) || !("tenantslug" in firstRow)) {
    return NextResponse.json(
      { error: "CSV must have columns: email, tenantName, tenantSlug (and optionally expiresInDays)" },
      { status: 400 }
    );
  }

  const inviterUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true } });
  const results: RowResult[] = [];

  for (const row of rows) {
    const parsed = rowSchema.safeParse(row);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      results.push({
        status: "skipped",
        email: row.email ?? "",
        tenantSlug: row.tenantslug ?? "",
        reason: firstError.message,
      });
      continue;
    }

    const { email, tenantname: tenantName, tenantslug: tenantSlug, expiresindays: expiresInDays } = parsed.data;

    // Check slug not taken by existing tenant
    const existingTenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true } });
    if (existingTenant) {
      results.push({ status: "skipped", email, tenantSlug, reason: "This tenant slug is not available" });
      continue;
    }

    // Check no active pending invitation for same slug
    const existingInvite = await prisma.invitation.findFirst({
      where: { tenantSlug, usedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    if (existingInvite) {
      results.push({ status: "skipped", email, tenantSlug, reason: "This tenant slug is not available" });
      continue;
    }

    // Check email not already registered
    const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) {
      results.push({ status: "skipped", email, tenantSlug, reason: "Email already registered" });
      continue;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (expiresInDays ?? ADMIN_INVITE_DEFAULT_EXPIRY_DAYS));

    const invitation = await prisma.invitation.create({
      data: {
        token: randomBytes(32).toString("hex"),
        email,
        role: "ADMIN",
        tenantName,
        tenantSlug,
        invitedBy: session.user.id,
        expiresAt,
      },
    });

    const emailTemplate = adminInvitationEmail({
      email,
      tenantName,
      inviterName: inviterUser?.name ?? null,
      token: invitation.token,
      expiresAt,
    });
    await addEmailJob({ to: email, ...emailTemplate });

    const actualDays = expiresInDays ?? ADMIN_INVITE_DEFAULT_EXPIRY_DAYS;
    results.push({
      status: "created",
      email,
      tenantName,
      tenantSlug,
      invitationUrl: `/accept-invitation?token=${invitation.token}`,
      expiresInDays: actualDays,
    });
  }

  const created = results.filter((r) => r.status === "created").length;
  const skipped = results.filter((r) => r.status === "skipped").length;

  return NextResponse.json({ created, skipped, results }, { status: 201 });
}
