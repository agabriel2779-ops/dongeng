/* Service worker "dongeng sebelum boboo"
   - halaman, .js, .json: network-first (update dari Vercel langsung kebaca, offline tetap bisa buka)
   - cover, ikon, font: simpan di cache supaya cepat dan tetap muncul offline
   - audio: sengaja TIDAK dicache di sini (file besar + butuh dukungan Range), jadi dibiarkan diurus browser
   - admin.html: tidak disentuh sama sekali
   Naikkan angka VERSI kalau mau memaksa cache lama dibersihkan. */
const VERSI = "dongeng-v2";
const SHELL = ["./", "index.html", "manifest.json", "supabase-config.js", "icon-192.png", "icon-512.png", "icon-maskable-512.png"];

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
const SB_HOST = /\.supabase\.co$/;

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

  const sama = url.origin === self.location.origin;

  if (sama) {
    // halaman admin tidak boleh ikut dicache
    if (/\/admin(\.html)?$/i.test(url.pathname)) return;

    // halaman, skrip, manifest: network-first
    if (req.mode === "navigate" || /\.(js|json|html)$/i.test(url.pathname)) {
      e.respondWith(
        fetch(req).then(res => simpan(req, res))
          .catch(() => caches.match(req).then(r => r || (req.mode === "navigate" ? caches.match("index.html") : undefined)))
      );
      return;
    }
  } else {
    // cover dari Supabase Storage dan font Google: boleh dicache
    const coverSupabase = SB_HOST.test(url.hostname) && url.pathname.includes("/storage/v1/object/public/dongeng/gambar/");
    if (!coverSupabase && !FONT_HOST.test(url.hostname)) return;   // selain itu (termasuk API data) langsung ke jaringan
  }

  // sisanya (gambar, ikon, font): stale-while-revalidate
  e.respondWith(
    caches.match(req).then(cache => {
      const jaringan = fetch(req).then(res => simpan(req, res)).catch(() => cache);
      return cache || jaringan;
    })
  );
});
