/* Regression checks for atomic, scope-isolated offline releases. */
'use strict';
var assert = require('node:assert/strict');
var fs = require('node:fs');
var vm = require('node:vm');
function worker(fail) {
  var handlers = {}, requests = [], removed = [], stores = new Map(), promoted = false;
  var scope = 'https://example.github.io/HomeStock/';
  var prefix = 'homestock:' + scope + ':';
  var context = {
    URL: URL, Request: Request,
    self: { registration: { scope: scope }, clients: { claim: async function () {} },
      skipWaiting: async function () { promoted = true; },
      addEventListener: function (type, callback) { handlers[type] = callback; } },
    fetch: async function (request) {
      requests.push(request);
      if (fail) throw new Error('offline');
      return { ok: true, url: request.url };
    },
    caches: {
      open: async function (name) {
        if (!stores.has(name)) stores.set(name, new Map());
        var entries = stores.get(name);
        return {
          put: async function (key, value) { entries.set(key, value); },
          match: async function (key, options) {
            var url = new URL(typeof key === 'string' ? key : key.url);
            if (options && options.ignoreSearch) url.search = '';
            return entries.get(url.href);
          }
        };
      },
      keys: async function () { return [prefix + 'old', 'pantry-v2.2.0', 'another-app']; },
      delete: async function (key) { removed.push(key); }
    }
  };
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../sw.js'), 'utf8'), context);
  return { handlers, requests, removed, stores, prefix, promoted: function () { return promoted; } };
}
async function lifecycle(w, name) {
  var task;
  w.handlers[name]({ waitUntil: function (p) { task = p; } });
  await task;
}
(async function () {
  var w = worker(false);
  await lifecycle(w, 'install');
  assert(w.promoted());
  assert(w.requests.length > 10);
  assert(w.requests.some(function(r){return new URL(r.url).pathname.endsWith('/barcode.js');}));
  assert(w.requests.some(function(r){return new URL(r.url).pathname.endsWith('/vendor/zxing.min.js');}));
  assert(w.requests.some(function(r){return new URL(r.url).pathname.endsWith('/brand.js');}));
  assert(w.requests.some(function(r){return new URL(r.url).pathname.endsWith('/icons/icon.svg');}));
  assert(w.requests.some(function(r){return new URL(r.url).pathname.endsWith('/home-model.js');}));
  assert(w.requests.some(function(r){return new URL(r.url).pathname.endsWith('/workspace.css');}));
  assert(w.requests.some(function(r){return new URL(r.url).pathname.endsWith('/sync/github-sync.js');}));
  assert(w.requests.some(function(r){return new URL(r.url).pathname.endsWith('/dropdown.js');}));
  assert(w.requests.some(function(r){return new URL(r.url).pathname.endsWith('/design.css');}));
  assert(w.requests.some(function(r){return new URL(r.url).pathname.endsWith('/fonts/Rubik.ttf');}));
  assert(w.requests.every(function (r) { return r.cache === 'reload' && new URL(r.url).searchParams.get('__release') === 'v4.3.60'; }));
  await lifecycle(w, 'activate');
  assert.deepEqual(w.removed, [w.prefix + 'old']);
  var response;
  w.handlers.fetch({request:{method:'GET',url:'https://example.github.io/HomeStock/app.js?v=2.2.1'},respondWith:function(p){response=p;}});
  assert.equal((await response).url, 'https://example.github.io/HomeStock/app.js?__release=v4.3.60');
  var intercepted = false;
  w.handlers.fetch({request:{method:'GET',url:'https://example.github.io/another-app/'},respondWith:function(){intercepted=true;}});
  assert.equal(intercepted,false);
  w.handlers.fetch({request:{method:'GET',url:'https://api.github.com/repos/owner/data/contents/household.json'},respondWith:function(){intercepted=true;}});
  assert.equal(intercepted,false,'private API responses must never enter the Pages service worker cache');
  var broken = worker(true);
  await assert.rejects(lifecycle(broken,'install'), /offline/);
  assert.equal(broken.promoted(),false);
  console.log('PASS: versioned fresh precache, canonical lookup, scope isolation, failed install keeps previous worker');
})().catch(function (err) { console.error(err); process.exit(1); });
