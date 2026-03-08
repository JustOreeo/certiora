"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex=\"-1\"])";

function getFocusables(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
}

/**
 * Traps focus inside the given container when open. On open: focus first focusable.
 * Tab cycles within container; Shift+Tab cycles backward. Escape calls onClose.
 * On close: restores focus to the element that was active when the trap opened.
 * WCAG 2.1: focus trap and return focus for modals/dialogs.
 */
export function useFocusTrap(
  open: boolean,
  onClose: () => void,
  options?: { containerRef?: RefObject<HTMLElement | null> }
): RefObject<HTMLElement | null> {
  const innerRef = useRef<HTMLElement>(null);
  const containerRef = options?.containerRef ?? innerRef;
  const previousActiveRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousActiveRef.current = document.activeElement as HTMLElement | null;

    const container = containerRef.current;
    if (!container) return;

    const focusables = getFocusables(container);
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (first) {
      requestAnimationFrame(() => first.focus());
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      if (focusables.length === 0) return;

      const current = document.activeElement as HTMLElement;
      if (!container.contains(current)) return;

      if (e.shiftKey) {
        if (current === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (current === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousActiveRef.current?.focus?.();
    };
  }, [open, onClose]);

  return containerRef;
}
