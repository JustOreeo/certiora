"use client";

import { useEffect, useRef, useCallback, type RefObject } from "react";

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
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  open: boolean,
  onClose: () => void,
  options?: { containerRef?: RefObject<T> }
): RefObject<T> {
  const innerRef = useRef<T>(null as unknown as T);
  const containerRef = (options?.containerRef ?? innerRef) as RefObject<T>;
  const previousActiveRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const stableOnClose = useCallback(() => onCloseRef.current(), []);

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
        stableOnClose();
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
  }, [open, stableOnClose]);

  return containerRef;
}
