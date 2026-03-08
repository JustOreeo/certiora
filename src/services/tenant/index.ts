import { Prisma } from "@prisma/client";
import { prisma, tenantScope } from "@/lib/db";

export type TenantCreateInput = {
  slug: string;
  name: string;
  logoUrl?: string;
  primaryColor?: string;
  customDomain?: string;
  settings?: Record<string, unknown>;
};

export type TenantUpdateInput = Partial<
  Omit<TenantCreateInput, "slug">
>;

export const tenantService = {
  async getBySlug(slug: string) {
    return prisma.tenant.findUnique({
      where: { slug },
    });
  },

  async getById(id: string) {
    return prisma.tenant.findUnique({
      where: { id },
    });
  },

  async getByCustomDomain(domain: string) {
    return prisma.tenant.findUnique({
      where: { customDomain: domain },
    });
  },

  async create(data: TenantCreateInput) {
    return prisma.tenant.create({
      data: {
        slug: data.slug,
        name: data.name,
        logoUrl: data.logoUrl,
        primaryColor: data.primaryColor,
        customDomain: data.customDomain,
        settings: data.settings as Prisma.InputJsonValue ?? undefined,
      },
    });
  },

  async update(tenantId: string, data: TenantUpdateInput) {
    return prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name: data.name,
        logoUrl: data.logoUrl,
        primaryColor: data.primaryColor,
        customDomain: data.customDomain,
        settings: data.settings as Prisma.InputJsonValue | undefined,
      },
    });
  },

  async resolveFromRequest(slugOrDomain: string) {
    const bySlug = await this.getBySlug(slugOrDomain);
    if (bySlug) return bySlug;
    return this.getByCustomDomain(slugOrDomain);
  },
};
