"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Animates a number from 0 to `target` over `duration` ms with ease-out.
 * Returns the current displayed value (integer).
 */
export function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  const frame = useRef(0);

  useEffect(() => {
    if (target === 0) {
      setValue(0);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
      }
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [target, duration]);

  return value;
}
