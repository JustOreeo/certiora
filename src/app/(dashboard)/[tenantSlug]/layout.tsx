import { ReactNode } from "react";
import StudentNav from "./StudentNav";

export default function TenantLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { tenantSlug: string };
}) {
  return (
    <StudentNav tenantSlug={params.tenantSlug}>
      <div data-tenant-slug={params.tenantSlug}>
        {children}
      </div>
    </StudentNav>
  );
}
