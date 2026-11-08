import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, relative, sep } from "node:path";
import { defineConfig, type Plugin } from "vite";

function offlineServiceWorker(): Plugin {
  return {
    name: "cw-player-offline-service-worker",
    closeBundle() {
      const output = resolve("dist");
      const files: { path: string; contents: Buffer }[] = [];
      const walk = (directory: string) => {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
          const path = resolve(directory, entry.name);
          if (entry.isDirectory()) walk(path);
          else if (entry.name !== "sw.js")
            files.push({
              path: `/${relative(output, path).split(sep).join("/")}`,
              contents: readFileSync(path),
            });
        }
      };
      walk(output);
      files.sort((a, b) => a.path.localeCompare(b.path));
      const hash = createHash("sha256");
      for (const file of files)
        hash.update(file.path).update("\0").update(file.contents).update("\0");
      const version = hash.digest("hex").slice(0, 12);
      const filePaths = files.map((file) => file.path);
      const source = `const CACHE = "cw-player-shell-${version}";
const PRECACHE = ${JSON.stringify([
        "/",
        ...filePaths,
        "/vendor/streamsaver/mitm.html?version=2.0.0",
      ])};
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("cw-player-shell-") && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(request).then(cached => {
    if (cached) return cached;
    return fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        void caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => undefined);
      }
      return response;
    }).catch(async () => {
      if (request.mode === "navigate") return (await caches.match("/index.html")) ?? (await caches.match("/"));
      throw new Error("CW Player is offline and this resource is not cached.");
    });
  }));
});
`;
      writeFileSync(resolve(output, "sw.js"), source);
    },
  };
}

/**
 * Host names Vite accepts in the Host header. Vite rejects unknown names to
 * prevent DNS rebinding, which also blocks Tailscale Serve hostnames such as
 * `<machine>.<tailnet>.ts.net`. Override with a comma-separated
 * `CW_ALLOWED_HOSTS` when using another tunnel or a custom domain.
 */
export function allowedHosts(value = process.env.CW_ALLOWED_HOSTS) {
  const configured = value
    ?.split(",")
    .map((host) => host.trim())
    .filter(Boolean);
  return configured?.length ? configured : [".ts.net"];
}

export default defineConfig({
  plugins: [offlineServiceWorker()],
  server: { allowedHosts: allowedHosts() },
  preview: { allowedHosts: allowedHosts() },
});
