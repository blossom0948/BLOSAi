"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker.register("service-worker.js").catch(() => {
      // PWA registration should never block the app.
    });
  }, []);

  return null;
}
