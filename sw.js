/* Service worker "dongeng sebelum boboo"
   - halaman: network-first (kalau ada update dari Vercel langsung kebaca, offline tetap bisa buka)
   - cover, ikon, font: simpan di cache supaya cepat dan tetap muncul offline
   - audio: sengaja TIDAK dicache di sini (file besar + butuh dukungan Range), jadi dibiarkan diurus browser
   Naikkan angka VERSI kalau mau memaksa cache lama dibersihkan. */
const VERSI = "dongeng-v1";
const SHELL = ["./", "index.html", "manifest.json", "icon-192.png", "icon-512.png", "icon-maskable-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(VERSI)
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VERSI).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const AUDIO = /\.(mp3|m4a|aac|wav|ogg|opus|flac)(\?.*)?$/i;
const FONT_HOST = /(^|\.)fonts\.(googleapis|gstatic)\.com$/;

function simpan(req, res) {
  if (res && (res.ok || res.type === "opaque")) {
    const salinan = res.clone();
    caches.open(VERSI).then(c => c.put(req, salinan)).catch(() => {});
  }
  return res;
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // audio & permintaan Range: biarkan browser yang urus
  if (req.headers.has("range") || req.destination === "audio" || AUDIO.test(url.pathname)) return;

  // halaman utama: network-first
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(res => simpan("index.html", res))
        .catch(() => caches.match("index.html").then(r => r || caches.match("./")))
    );
    return;
  }

  const sama = url.origin === self.location.origin;
  if (!sama && !FONT_HOST.test(url.hostname)) return;

  // sisanya (cover, ikon, manifest, font): stale-while-revalidate
  e.respondWith(
    caches.match(req).then(cache => {
      const jaringan = fetch(req).then(res => simpan(req, res)).catch(() => cache);
      return cache || jaringan;
    })
  );
});
