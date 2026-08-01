/* TourHome AI — service worker
 * Strategy:
 *   navigations  → network-first, fall back to cache, then /offline
 *   static assets→ stale-while-revalidate
 *   media (Supabase Storage, panoramas) → cache-first with a capped cache
 * Never touches non-GET requests, auth endpoints or the Supabase REST API.
 */
const VERSION = "v1";
const SHELL = `tourhome-shell-${VERSION}`;
const ASSETS = `tourhome-assets-${VERSION}`;
const MEDIA = `tourhome-media-${VERSION}`;
const MEDIA_LIMIT = 60;

const PRECACHE = ["/offline", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => ![SHELL, ASSETS, MEDIA].includes(k)).map((k) => caches.delete(k)),
      ),
    ).then(() => self.clients.claim()),
  );
});

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (url.pathname.startsWith("/api/")) return;              // analytics, leads, QR — always live
  if (url.pathname.startsWith("/auth/")) return;             // auth callbacks
  if (url.pathname.includes("/auth/v1") || url.pathname.includes("/rest/v1")) return; // Supabase API

  // 1. navigations
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(request, copy));
          return res;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match("/offline"))),
    );
    return;
  }

  // 2. panoramas / photos from Supabase Storage
  if (url.pathname.includes("/storage/v1/object/public/")) {
    event.respondWith(
      caches.open(MEDIA).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) {
          cache.put(request, res.clone());
          trimCache(MEDIA, MEDIA_LIMIT);
        }
        return res;
      }),
    );
    return;
  }

  // 3. build output + icons — stale-while-revalidate
  if (url.origin === self.location.origin &&
      (url.pathname.startsWith("/_next/") || url.pathname.startsWith("/icons/"))) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const hit = await cache.match(request);
        const net = fetch(request).then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        }).catch(() => hit);
        return hit || net;
      }),
    );
  }
});
