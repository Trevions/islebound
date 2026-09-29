// Offline cache so the installed app works without a connection.
const CACHE = 'islebound-v2';
const FILES = [
  './', 'index.html', 'css/style.css', 'icon.svg', 'manifest.webmanifest',
  'src/main.js', 'src/core/util.js', 'src/core/rng.js', 'src/core/save.js', 'src/core/i18n.js', 'src/core/audio.js', 'src/core/input.js', 'src/core/draw.js',
  'src/data/balance.js', 'src/data/realms.js', 'src/data/enemies.js', 'src/data/bosses.js', 'src/data/weapons.js', 'src/data/creatures.js', 'src/data/progression.js', 'src/data/lore.js', 'src/data/levels.js',
  'src/game/meta.js', 'src/game/weapons.js', 'src/game/enemyAI.js', 'src/game/bossAI.js', 'src/game/fx.js', 'src/game/run.js', 'src/game/well.js', 'src/game/islandView.js',
  'src/ui/ui.js', 'src/game/render3d.js', 'src/core/leaderboard.js', 'src/config.js', 'lib/three.min.js',
];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
