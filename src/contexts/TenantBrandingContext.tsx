"use client";

import { createContext, useContext, ReactNode } from "react";

export type TenantBranding = {
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
};

const defaultBranding: TenantBranding = {
  name: "Certiora",
  logoUrl: null,
  primaryColor: null,
};

const TenantBrandingContext = createContext<TenantBranding>(defaultBranding);

export function TenantBrandingProvider({
  value,
  children,
}: {
  value: TenantBranding;
  children: ReactNode;
}) {
  return (
    <TenantBrandingContext.Provider value={value}>
      {children}
    </TenantBrandingContext.Provider>
  );
}

export function useTenantBranding(): TenantBranding {
  return useContext(TenantBrandingContext);
}

/**
 * Darken a hex color by a percentage (0–1). Used for hover/active states.
 */
export function darkenHex(hex: string, amount: number): string {
  const match = hex.replace(/^#/, "").match(/.{2}/g);
  if (!match) return hex;
  const [r, g, b] = match.map((x) => Math.max(0, Math.min(255, parseInt(x, 16) * (1 - amount))));
  return `#${[r, g, b].map((x) => Math.round(x).toString(16).padStart(2, "0")).join("")}`;
}
