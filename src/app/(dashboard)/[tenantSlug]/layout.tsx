import { ReactNode } from "react";

export default function TenantLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { tenantSlug: string };
}) {
  return (
    <div data-tenant-slug={params.tenantSlug}>
      {children}
    </div>
  );
}
