"use client";

import { useEffect } from "react";

type ToastVariant = "success" | "error" | "info";

type ToastProps = {
  message: string;
  variant?: ToastVariant;
  onDismiss: () => void;
  duration?: number;
};

const variantStyles: Record<ToastVariant, string> = {
  success: "bg-success-bg border-success-border text-success",
  error: "bg-error-bg border-error-border text-error",
  info: "bg-info-bg border-info-border text-info",
};

export function Toast({ message, variant = "success", onDismiss, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [onDismiss, duration]);

  return (
    <div className="fixed bottom-5 right-5 z-50 animate-in fade-in slide-in-from-bottom-2">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-md text-sm font-medium ${variantStyles[variant]}`}>
        {variant === "success" && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
        {message}
        <button onClick={onDismiss} className="ml-1 opacity-60 hover:opacity-100 transition-opacity">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
