"use client";

import { useEffect, useState } from "react";

/**
 * Returns true once the page has been scrolled past `threshold` pixels.
 * Used to switch the header into its compact, glassy "scrolled" state.
 */
export function useScrolled(threshold = 16) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return scrolled;
}
