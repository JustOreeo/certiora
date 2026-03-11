import { z } from "zod";

export const updateTenantSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens")
    .optional(),
  customDomain: z
    .string()
    .regex(
      /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/,
      "Invalid hostname format"
    )
    .nullable()
    .optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color (#RRGGBB)")
    .nullable()
    .optional(),
  logoUrl: z.string().url("Invalid URL format").nullable().optional(),
  isActive: z.boolean().optional(),
  organizationId: z.string().nullable().optional(),
});

export const createCourseSchema = z.object({
  name: z.string().min(1, "Course name is required").max(150),
  description: z.string().max(500).optional().nullable(),
  targetExamDate: z
    .string()
    .refine((val) => !isNaN(new Date(val).getTime()), "Must be a valid date")
    .optional()
    .nullable(),
});

export const updateCourseSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  description: z.string().max(500).nullable().optional(),
  targetExamDate: z
    .string()
    .refine((val) => !isNaN(new Date(val).getTime()), "Must be a valid date")
    .nullable()
    .optional(),
  isActive: z.boolean().optional(),
});

export const createOrganizationSchema = z.object({
  name: z.string().min(1, "Organization name is required").max(200),
  logoUrl: z.string().url("Invalid URL format").optional().nullable(),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  logoUrl: z.string().url("Invalid URL format").nullable().optional(),
});
