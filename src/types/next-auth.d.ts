import "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    tenantId?: string;
    tenantSlug?: string;
    role?: string;
    credentialsExpiresAt?: string;
  }
  interface Session {
    user: { id: string; email?: string | null; name?: string | null; image?: string | null };
    tenantId?: string;
    tenantSlug?: string;
    role?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    tenantId?: string;
    tenantSlug?: string;
    role?: string;
    credentialsExpiresAt?: string;
  }
}
