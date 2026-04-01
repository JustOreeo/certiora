import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { randomBytes } from "crypto";
import { ADMIN_INVITE_DEFAULT_EXPIRY_DAYS } from "@/lib/invitation-config";

type RowResult =
  | { status: "created"; email: string; tenantName: string; tenantSlug: string; invitationUrl: string }
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

  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    return NextResponse.json({ error: "CSV must have a header row and at least one data row" }, { status: 400 });
  }

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const emailIdx = header.indexOf("email");
  const nameIdx = header.indexOf("tenantname");
  const slugIdx = header.indexOf("tenantslug");
  const daysIdx = header.indexOf("expiresindays");

  if (emailIdx === -1 || nameIdx === -1 || slugIdx === -1) {
    return NextResponse.json(
      { error: "CSV must have columns: email, tenantName, tenantSlug (and optionally expiresInDays)" },
      { status: 400 }
    );
  }

  const results: RowResult[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const email = cols[emailIdx] ?? "";
    const tenantName = cols[nameIdx] ?? "";
    const tenantSlug = cols[slugIdx] ?? "";
    const rawDays = daysIdx !== -1 ? parseInt(cols[daysIdx] ?? "", 10) : NaN;
    const expiresInDays = isNaN(rawDays) ? ADMIN_INVITE_DEFAULT_EXPIRY_DAYS : Math.min(Math.max(rawDays, 1), 30);

    if (!email || !tenantName || !tenantSlug) {
      results.push({ status: "skipped", email, tenantSlug, reason: "Missing required field(s)" });
      continue;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      results.push({ status: "skipped", email, tenantSlug, reason: "Invalid email" });
      continue;
    }

    if (!/^[a-z0-9-]+$/.test(tenantSlug)) {
      results.push({ status: "skipped", email, tenantSlug, reason: "Invalid slug format" });
      continue;
    }

    // Check slug not taken by existing tenant
    const existingTenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true } });
    if (existingTenant) {
      results.push({ status: "skipped", email, tenantSlug, reason: "Slug already taken" });
      continue;
    }

    // Check no active pending invitation for same slug
    const existingInvite = await prisma.invitation.findFirst({
      where: { tenantSlug, usedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    if (existingInvite) {
      results.push({ status: "skipped", email, tenantSlug, reason: "Active invitation already exists for this slug" });
      continue;
    }

    // Check email not already registered
    const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) {
      results.push({ status: "skipped", email, tenantSlug, reason: "Email already registered" });
      continue;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

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

    results.push({
      status: "created",
      email,
      tenantName,
      tenantSlug,
      invitationUrl: `/accept-invitation?token=${invitation.token}`,
    });
  }

  const created = results.filter((r) => r.status === "created").length;
  const skipped = results.filter((r) => r.status === "skipped").length;

  return NextResponse.json({ created, skipped, results }, { status: 201 });
}
