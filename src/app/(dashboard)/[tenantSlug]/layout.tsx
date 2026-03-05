import { ReactNode } from "react";
import { tenantService } from "@/services/tenant";
import { TenantBrandingProvider } from "@/contexts/TenantBrandingContext";
import StudentNav from "./StudentNav";

export default async function TenantLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { tenantSlug: string };
}) {
  const tenant = await tenantService.getBySlug(params.tenantSlug);
  const branding = tenant
    ? {
        name: tenant.name,
        logoUrl: tenant.logoUrl ?? null,
        primaryColor: tenant.primaryColor ?? null,
      }
    : { name: "Certiora", logoUrl: null, primaryColor: null };

  return (
    <TenantBrandingProvider value={branding}>
      <StudentNav tenantSlug={params.tenantSlug}>
        <div data-tenant-slug={params.tenantSlug}>{children}</div>
      </StudentNav>
    </TenantBrandingProvider>
  );
}
