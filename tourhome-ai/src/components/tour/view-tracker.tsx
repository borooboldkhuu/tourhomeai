"use client";

import { useEffect } from "react";

/** Fires a single view event per session per property. */
export function ViewTracker({ propertyId }: { propertyId: string }) {
  useEffect(() => {
    const key = `th_view_${propertyId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");

    let sessionId = sessionStorage.getItem("th_session");
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem("th_session", sessionId);
    }

    void fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId, eventType: "view", sessionId }),
      keepalive: true,
    }).catch(() => {});
  }, [propertyId]);

  return null;
}

/** Helper used by the viewer to log room changes. */
export function trackEvent(propertyId: string, eventType: string, sceneKey?: string) {
  void fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      propertyId,
      eventType,
      sceneKey,
      sessionId: typeof window !== "undefined" ? sessionStorage.getItem("th_session") : null,
    }),
    keepalive: true,
  }).catch(() => {});
}
