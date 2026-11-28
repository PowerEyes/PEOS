/* PowerOS ERP service worker. Deliberately no offline cache until a reviewed
   caching strategy is implemented. This prevents stale registration requests
   from returning 404 and leaves network behavior unchanged. */
self.addEventListener("install", (event) => {
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener("fetch", (event) => {
  // Pass through to the network; do not cache sensitive ERP/portal responses.
});
