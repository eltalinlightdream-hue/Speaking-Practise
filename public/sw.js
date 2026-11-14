/*
 * Speaking Easy service worker: lets the website open and work without internet.
 *
 * - Files that never change (/_next/static, icons, fonts): taken from the phone
 *   once saved ("cache first").
 * - Pages: always asked from the server first. A good answer is saved; without
 *   internet the saved copy is shown, or /offline.html if there is none.
 * - Page changes inside the app (RSC requests): without internet, if a saved copy
 *   of that page exists, the app is told to load it as a full page (which then
 *   comes from the saved copy). Otherwise Next.js waits and retries by itself.
 * - Everything else (API, sign-in, admin pages, POST requests) is never saved.
 * - Signing out (or reaching the login page) deletes the saved pages, because
 *   they contain the student's own data.
 */

const STATIC_CACHE = "se-static-v1";
const PAGE_CACHE = "se-pages-v1";
const KEEP = [STATIC_CACHE, PAGE_CACHE];
const OFFLINE_URL = "/offline.html";
const MAX_STATIC = 400;

// Pages a student needs offline; saved in the background (see "warm" below).
const WARM_PAGES = ["/home", "/practice/ielts/general", "/practice/ielts/mock", "/progress", "/recordings", "/settings"];
// Never saved: per-request or private to admins, or not useful offline.
const NO_SAVE = ["/api/", "/auth/", "/admin", "/owner", "/progress/report", "/login", "/onboarding", "/design"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((c) => c.addAll([OFFLINE_URL, "/icons/icon-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("se-") && !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isStatic(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === OFFLINE_URL ||
    url.pathname === "/favicon.ico" ||
    url.pathname === "/apple-icon.png" ||
    url.pathname === "/manifest.webmanifest"
  );
}

function savable(url) {
  return !NO_SAVE.some((p) => (p.endsWith("/") ? url.pathname.startsWith(p) : url.pathname === p || url.pathname.startsWith(`${p}/`)));
}

/** The saved-page key: the address without Next.js's internal _rsc parameter. */
function pageKey(url) {
  const u = new URL(url);
  u.searchParams.delete("_rsc");
  u.hash = "";
  return u.toString();
}

async function trimStatic() {
  const cache = await caches.open(STATIC_CACHE);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_STATIC; i++) await cache.delete(keys[i]);
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request, { ignoreSearch: request.url.includes("/icons/") });
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && res.type === "basic") cache.put(request, res.clone());
  return res;
}

function clearPages() {
  return caches.delete(PAGE_CACHE);
}

async function savePage(url, res) {
  if (!res.ok || res.type !== "basic" || res.redirected) return;
  if (!(res.headers.get("content-type") || "").includes("text/html")) return;
  const cache = await caches.open(PAGE_CACHE);
  await cache.put(pageKey(url), res);
}

async function savedPage(url) {
  const cache = await caches.open(PAGE_CACHE);
  return (await cache.match(pageKey(url))) || (await cache.match(pageKey(url), { ignoreSearch: true }));
}

async function networkFirstPage(event) {
  const url = new URL(event.request.url);
  try {
    const res = await fetch(event.request);
    if (res.ok && (url.pathname === "/login" || url.pathname === "/")) {
      // Only signed-out visitors get these pages: forget the last user's pages.
      event.waitUntil(clearPages());
    } else if (savable(url)) {
      event.waitUntil(savePage(url, res.clone()));
    }
    return res;
  } catch (err) {
    const hit = await savedPage(url);
    if (hit) return hit;
    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;
    throw err;
  }
}

async function rscRequest(event) {
  try {
    return await fetch(event.request);
  } catch (err) {
    // A saved copy exists: answer with a non-RSC response, so Next.js loads
    // the page as a full page, which networkFirstPage then serves offline.
    if (await savedPage(new URL(event.request.url))) return new Response("", { status: 503, headers: { "Cache-Control": "no-store" } });
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.method !== "GET") {
    if (url.pathname === "/auth/signout") event.waitUntil(clearPages());
    return;
  }
  if (isStatic(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (request.headers.get("RSC") === "1") {
    // Prefetches just fail offline; real page changes may use a saved page.
    if (request.headers.get("Next-Router-Prefetch")) return;
    event.respondWith(rscRequest(event));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(event));
  }
});

/** Save the main pages and every script and style they use, for offline use. */
async function warm() {
  const staticCache = await caches.open(STATIC_CACHE);
  const assets = new Set();
  for (const path of WARM_PAGES) {
    try {
      const res = await fetch(path, { credentials: "same-origin", headers: { Accept: "text/html" } });
      if (!res.ok || res.redirected) continue;
      const html = await res.clone().text();
      await savePage(new URL(path, self.location.origin).toString(), res);
      for (const m of html.matchAll(/\/_next\/static\/[^"'\s)\\<>]+/g)) assets.add(m[0]);
    } catch {
      return; // Offline again: try another time.
    }
  }
  for (const a of assets) {
    if (await staticCache.match(a)) continue;
    try {
      const res = await fetch(a);
      if (res.ok) await staticCache.put(a, res);
    } catch {
      return;
    }
  }
  await trimStatic();
}

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "warm") event.waitUntil(warm());
  if (data.type === "clear-pages") event.waitUntil(clearPages());
});
