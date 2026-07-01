"use client";

import { useEffect } from "react";

export default function MobileViewportFix() {
  useEffect(() => {
    function updateViewportVars() {
      const viewport = window.visualViewport;
      const keyboardOffset = viewport
        ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        : 0;

      document.documentElement.style.setProperty("--keyboard-offset", `${keyboardOffset}px`);
      document.documentElement.style.setProperty(
        "--visual-height",
        `${viewport?.height || window.innerHeight}px`
      );
    }

    updateViewportVars();

    window.visualViewport?.addEventListener("resize", updateViewportVars);
    window.visualViewport?.addEventListener("scroll", updateViewportVars);
    window.addEventListener("resize", updateViewportVars);

    return () => {
      window.visualViewport?.removeEventListener("resize", updateViewportVars);
      window.visualViewport?.removeEventListener("scroll", updateViewportVars);
      window.removeEventListener("resize", updateViewportVars);
    };
  }, []);

  return null;
}
