"use client";

import { useEffect } from "react";
import { trackScrollDepth, trackSectionView } from "../lib/analytics";

export function AnalyticsEvents() {
  useEffect(() => {
    // Scroll depth tracking — fires once per threshold
    const fired = new Set<number>();
    const thresholds: Array<25 | 50 | 75 | 90> = [25, 50, 75, 90];

    function onScroll() {
      const scrolled = window.scrollY + window.innerHeight;
      const total = document.documentElement.scrollHeight;
      const pct = (scrolled / total) * 100;
      for (const t of thresholds) {
        if (pct >= t && !fired.has(t)) {
          fired.add(t);
          trackScrollDepth(t);
        }
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });

    // Section visibility tracking — fires once per section
    const seen = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            if (id && !seen.has(id)) {
              seen.add(id);
              trackSectionView(id);
            }
          }
        }
      },
      { threshold: 0.3 },
    );

    // Observe all sections that have an id attribute
    document.querySelectorAll("section[id], main[id]").forEach((el) => {
      observer.observe(el);
    });

    return () => {
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, []);

  return null;
}
