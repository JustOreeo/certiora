import { NextResponse } from "next/server";
import { tenantService } from "@/services/tenant";

/**
 * GET /api/[tenantSlug]/tenant
 * Returns public tenant info for branding (name, logoUrl, primaryColor).
 * No auth required — used by layout to render white-label UI.
 */
export async function GET(
  _request: Request,
  { params }: { params: { tenantSlug: string } }
) {
  const tenant = await tenantService.getBySlug(params.tenantSlug);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }
  return NextResponse.json({
    name: tenant.name,
    logoUrl: tenant.logoUrl ?? null,
    primaryColor: tenant.primaryColor ?? null,
  });
}
