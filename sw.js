// Guarda a tela do app no aparelho para abrir rápido e funcionar sem internet.
// Os dados ficam no IndexedDB (cuidado pela própria tela); aqui só os arquivos do site.
const CACHE = 'controle-maquinas-v8';
const ARQUIVOS = ['./', './index.html', './manifest.json', './icone-180.png', './icone-192.png', './icone-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(ARQUIVOS.map(function (a) { return c.add(a).catch(function () { }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;   // o servidor (Apps Script) nunca passa por aqui
  const pagina = req.mode === 'navigate' || /\/(index\.html)?$/.test(url.pathname);
  if (pagina) {
    // página: tenta a versão nova por até 3 s; sem resposta, abre a guardada
    e.respondWith(new Promise(function (ok) {
      let feito = false;
      const guardada = function () { return caches.match('./index.html').then(function (r) { return r || caches.match('./'); }); };
      const t = setTimeout(function () { guardada().then(function (r) { if (r && !feito) { feito = true; ok(r); } }); }, 3000);
      fetch(req).then(function (r) {
        if (r && r.ok) { const c = r.clone(); caches.open(CACHE).then(function (k) { k.put('./index.html', c); }); }
        clearTimeout(t); if (!feito) { feito = true; ok(r); }
      }).catch(function () {
        clearTimeout(t); guardada().then(function (r) { if (!feito) { feito = true; ok(r || Response.error()); } });
      });
    }));
    return;
  }
  // ícones e manifest: o guardado primeiro
  e.respondWith(caches.match(req).then(function (r) { return r || fetch(req).then(function (x) { const c = x.clone(); caches.open(CACHE).then(function (k) { k.put(req, c); }); return x; }); }));
});
