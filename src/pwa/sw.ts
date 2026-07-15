/// <reference lib="webworker" />
/// <reference types="vite-plugin-pwa/client" />

import { clientsClaim } from "workbox-core";
import { ExpirationPlugin } from "workbox-expiration";
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from "workbox-strategies";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(
  ({ request }) => request.mode === "navigate",
  async ({ event }) => {
    const fetchEvent = event as FetchEvent;
    const strategy = new NetworkFirst({
      cacheName: "barber-booking-pages",
      networkTimeoutSeconds: 3,
      plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
    });

    try {
      const preloadResponse = await fetchEvent.preloadResponse;
      if (preloadResponse) {
        return preloadResponse;
      }

      return await strategy.handle({ event, request: fetchEvent.request });
    } catch {
      return (await matchPrecache("/offline.html")) ?? Response.error();
    }
  },
);

registerRoute(
  ({ request }) => request.destination === "style" || request.destination === "script" || request.destination === "worker",
  new StaleWhileRevalidate({
    cacheName: "barber-booking-static",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  }),
);

registerRoute(
  ({ request }) => request.destination === "image" || request.url.endsWith(".avif"),
  new CacheFirst({
    cacheName: "barber-booking-images",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 120, maxAgeSeconds: 60 * 24 * 60 * 60 }),
    ],
  }),
);

registerRoute(
  ({ url }) => url.origin === "https://fonts.googleapis.com",
  new StaleWhileRevalidate({
    cacheName: "barber-booking-font-styles",
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
  }),
);

registerRoute(
  ({ url }) => url.origin === "https://fonts.gstatic.com",
  new CacheFirst({
    cacheName: "barber-booking-font-files",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 }),
    ],
  }),
);

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
