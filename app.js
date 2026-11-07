/* HomeStock — Smart Home Inventory. Vanilla client-side app logic. Global `App`. */
(function () {
  'use strict';

  var t = window.I18N.t;
  var tc = window.I18N.tc;
  var Home = window.HomeModel;

  // ---- Static data ----
  var CATEGORIES = [
    { id: 'produce', emoji: '🥦' },
    { id: 'fruit', emoji: '🍎' },
    { id: 'dairy', emoji: '🧀' },
    { id: 'meat', emoji: '🥩' },
    { id: 'bakery', emoji: '🍞' },
    { id: 'dry', emoji: '🥫' },
    { id: 'grains', emoji: '🌾' },
    { id: 'frozen', emoji: '🧊' },
    { id: 'drinks', emoji: '🥤' },
    { id: 'snacks', emoji: '🍫' },
    { id: 'condiments', emoji: '🧂' },
    { id: 'care', emoji: '🧴' },
    { id: 'paper', emoji: '🧻' },
    { id: 'household', emoji: '🔋' },
    { id: 'other', emoji: '🍽️' },
  ];
  var SPACES = [
    { id: 'Kitchen', label: 'מטבח', icon: 'shelf', defaultLocation: 'Pantry' },
    { id: 'Bathroom', label: 'חדר רחצה', icon: 'bath', defaultLocation: 'Toilet' },
    { id: 'House', label: 'כללי', icon: 'house', defaultLocation: 'House' }
  ];
  // Legacy location IDs stay unchanged, preserving existing inventory/sync rows.
  var LOCATIONS = [
    { id: 'Pantry', space: 'Kitchen', emoji: '🗄️' },
    { id: 'Fridge', space: 'Kitchen', emoji: '🧊' },
    { id: 'Freezer', space: 'Kitchen', emoji: '❄️' },
    { id: 'Toilet', space: 'Bathroom', emoji: '🧻' },
    { id: 'Shower', space: 'Bathroom', emoji: '🚿' },
    { id: 'House', space: 'House', emoji: '🏠' }
  ];

  function locationSpace(location) {
    for (var i = 0; i < LOCATIONS.length; i++) {
      if (LOCATIONS[i].id === location) return LOCATIONS[i].space;
    }
    return 'Kitchen';
  }

  function defaultInventoryLocation() {
    if (inventoryLocation !== 'all' && inventoryLocation !== 'low') return inventoryLocation;
    return SPACES.filter(function(space){return space.id === inventorySpace;})[0].defaultLocation;
  }

  function locationPicker(get, set) {
    var wrap = h('div', {class:'location-picker'});
    function render() {
      wrap.innerHTML = '';
      var selectedSpace = locationSpace(get());
      var spaces = h('div', {class:'segment', 'aria-label':'בחירת אזור בבית'});
      SPACES.forEach(function(space){
        spaces.appendChild(h('button',{type:'button',class:'segment-item'+(space.id===selectedSpace?' active':''),'aria-pressed':String(space.id===selectedSpace),onclick:function(){set(space.defaultLocation);render();}},uiIcon(space.icon),h('span',{text:space.label})));
      });
      wrap.appendChild(spaces);
      var locations = LOCATIONS.filter(function(loc){return loc.space===selectedSpace;});
      if(locations.length>1) {
        wrap.appendChild(h('p',{class:'location-picker-label',text:'איפה בדיוק?'}));
        var sub = h('div',{class:'segment location-subspaces','aria-label':'בחירת מקום אחסון'});
        locations.forEach(function(loc){
          sub.appendChild(h('button',{type:'button',class:'segment-item'+(get()===loc.id?' active':''),'aria-pressed':String(get()===loc.id),onclick:function(){set(loc.id);render();}},loc.emoji+' '+t('locations.'+loc.id)));
        });
        wrap.appendChild(sub);
      }
    }
    render();
    return wrap;
  }

  var UNITS = ['pcs', 'pack', 'kg', 'g', 'L', 'ml', 'box', 'can'];

  function categoryEmoji(id) {
    for (var i = 0; i < CATEGORIES.length; i++)
      if (CATEGORIES[i].id === id) return CATEGORIES[i].emoji;
    return '🍽️';
  }

  // Emoji shown for an item: its specific emoji, else its category emoji.
  function itemEmoji(item) {
    return item.emoji || categoryEmoji(item.categoryId);
  }

  // Rounded visual for an item everywhere it appears: its on-device image if
  // present, otherwise the emoji placeholder. Never yields a broken image.
  function itemThumb(item, extraClass) {
    var cls = 'badge' + (extraClass ? ' ' + extraClass : '');
    var src = thumbImageFor(item);
    if (src) {
      var img = h('img', {
        class: 'thumb-img',
        src: src,
        alt: '',
        loading: 'lazy',
      });
      img.addEventListener('load', function () {
        img.classList.add('loaded');
      });
      return h('div', { class: cls + ' has-img' }, img);
    }
    return h('div', { class: cls, text: itemEmoji(item || {}) });
  }

  // Current user's avatar (image) or an initials tile. Used in header/profile.
  function avatarEl(extraClass) {
    var cls = 'avatar' + (extraClass ? ' ' + extraClass : '');
    var av = window.CurrentUser && window.CurrentUser.avatar();
    if (av) {
      return h('div', { class: cls + ' has-img' }, h('img', { class: 'avatar-img', src: av, alt: '' }));
    }
    return h('div', { class: cls, text: window.CurrentUser ? window.CurrentUser.initials() : '?' });
  }

  // ---- Local food database (autocomplete + emoji assignment) ----
  var FOODS = window.FOODS || [];

  // Precompute a lowercased search index per entry: [name, he, ...aliases].
  // Enables fast start-of-word matching across both languages + synonyms.
  FOODS.forEach(function (f) {
    var terms = [f.name.toLowerCase()];
    if (f.he) terms.push(f.he.toLowerCase());
    (f.aliases || []).forEach(function (a) {
      if (a) terms.push(String(a).toLowerCase());
    });
    f._s = terms;
  });

  function foodLabel(f) {
    return window.I18N.getLang() === 'he' && f.he ? f.he : f.name;
  }

  // ---- Language-aware naming ----
  // Detect the primary language of a free-text string by scanning for Hebrew
  // codepoints (U+0590–U+05FF). Anything without Hebrew letters is treated as
  // English (the app's only other language).
  function detectLang(str) {
    return /[\u0590-\u05FF]/.test(String(str || '')) ? 'he' : 'en';
  }

  // Resolve the display name of any name-bearing object (inventory item,
  // scan-session entry, barcode record, or monthly-shortfall snapshot) for the
  // active UI language, gracefully falling back across the multilingual fields
  // and the legacy single `name`. Fields recognised: nameHe/nameEn (items),
  // he/name (session + barcode + catalog).
  function localName(o) {
    if (!o) return '';
    if (o.nameHe || o.he) return o.nameHe || o.he;
    var original = o.nameEn || o.name || '';
    var match = foodMatch(original);
    // Translate known catalog labels without rewriting a user's custom text.
    if (match && match.he && scoreFood(match, original.trim().toLowerCase()) === 0) return match.he;
    return original;
  }
  // Alias kept expressive at call sites that operate on inventory items.
  var itemName = localName;

  // Given a typed/entered name plus any known bilingual pair (e.g. from a
  // catalog pick), produce the {nameEn, nameHe} to persist. When the pair is
  // unknown, detect the typed language, fill that side, and best-effort enrich
  // the other side from the bundled foods catalog. Never fabricates a bad
  // translation — the opposite side is left null for fallback if unknown.
  function resolveNames(typed, knownEn, knownHe) {
    typed = (typed || '').trim();
    var en = (knownEn || '').trim();
    var he = (knownHe || '').trim();
    if (en || he) return { nameEn: en || null, nameHe: he || null };
    if (!typed) return { nameEn: null, nameHe: null };
    var m = foodMatch(typed);
    if (detectLang(typed) === 'he') {
      return { nameHe: typed, nameEn: m && m.name ? m.name : null };
    }
    return { nameEn: typed, nameHe: m && m.he ? m.he : null };
  }

  // Best score for a query against an entry's search terms.
  // 0 = exact, 1 = starts-with, 2 = contains, -1 = no match.
  function scoreFood(f, q) {
    var best = -1;
    var terms = f._s;
    for (var i = 0; i < terms.length; i++) {
      var s = terms[i];
      var sc;
      if (s === q) sc = 0;
      else if (s.indexOf(q) === 0) sc = 1;
      else if (s.indexOf(q) !== -1) sc = 2;
      else continue;
      if (best === -1 || sc < best) best = sc;
      if (best === 0) break;
    }
    return best;
  }

  // Ranked matches for the autocomplete dropdown (EN + HE + aliases).
  function foodSearch(query) {
    var q = (query || '').trim().toLowerCase();
    if (!q) return [];
    var res = [];
    for (var i = 0; i < FOODS.length; i++) {
      var sc = scoreFood(FOODS[i], q);
      if (sc >= 0) res.push({ f: FOODS[i], score: sc });
    }
    res.sort(function (a, b) {
      return a.score - b.score || a.f.name.localeCompare(b.f.name);
    });
    return res.slice(0, 8).map(function (r) {
      return r.f;
    });
  }

  // Best-effort exact/prefix match used to auto-assign emoji/unit on save.
  function foodMatch(name) {
    var q = (name || '').trim().toLowerCase();
    if (!q) return null;
    var prefix = null;
    for (var i = 0; i < FOODS.length; i++) {
      var sc = scoreFood(FOODS[i], q);
      if (sc === 0) return FOODS[i];
      if (sc === 1 && !prefix) prefix = FOODS[i];
    }
    return prefix;
  }

  // Map Open Food Facts category tags to our category ids.
  function deriveCategory(tags) {
    var s = (tags || []).join(' ').toLowerCase();
    var rules = [
      ['dairy', ['dairies', 'dairy', 'milk', 'cheese', 'yogurt', 'egg']],
      ['meat', ['meat', 'fish', 'seafood', 'poultry', 'chicken', 'beef']],
      ['frozen', ['frozen']],
      ['drinks', ['beverage', 'drink', 'water', 'soda', 'juice', 'coffee', 'tea']],
      ['snacks', ['snack', 'chocolate', 'biscuit', 'confection', 'candy', 'sweet', 'chips', 'crisp']],
      ['bakery', ['bread', 'bakery', 'pastr', 'viennoiser']],
      ['fruit', ['fruit']],
      ['produce', ['vegetable', 'legume', 'salad']],
      ['dry', ['canned', 'tinned', 'cereal', 'pasta', 'rice', 'grocer', 'flour']],
      ['condiments', ['sauce', 'condiment', 'spice', 'seasoning', 'oil']],
    ];
    for (var i = 0; i < rules.length; i++) {
      var kws = rules[i][1];
      for (var j = 0; j < kws.length; j++) {
        if (s.indexOf(kws[j]) !== -1) return rules[i][0];
      }
    }
    return 'other';
  }

  // ---- tiny DOM helper ----
  function h(tag, attrs) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function')
        el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null) continue;
      var list = Array.isArray(c) ? c : [c];
      list.forEach(function (child) {
        if (child == null) return;
        el.appendChild(
          typeof child === 'string' ? document.createTextNode(child) : child
        );
      });
    }
    return el;
  }

  function productCount(n){return n===1?'מוצר אחד':n+' מוצרים';}

  function formatQty(n) {
    return Number.isInteger(n) ? String(n) : new Intl.NumberFormat('he-IL',{useGrouping:false,maximumFractionDigits:6}).format(n);
  }

  // ---- Image pipeline (on-device compression, WebP-preferred, deduped) ----
  // Two resolutions are produced per image: a FULL variant for detail/edit and
  // a small THUMB variant for lists/cards. Encoding prefers WebP when the
  // browser supports it (much smaller than JPEG at equal quality) and falls
  // back to JPEG otherwise. Nothing leaves the device.
  var IMG_FULL_MAX = 512; // long-edge px for detail/edit resolution
  var IMG_THUMB_MAX = 96; // long-edge px for list/card resolution

  // Feature-detect WebP canvas export once and cache the result.
  var _webpOk = null;
  function webpSupported() {
    if (_webpOk !== null) return _webpOk;
    try {
      var c = document.createElement('canvas');
      c.width = 1;
      c.height = 1;
      _webpOk = c.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    } catch (e) {
      _webpOk = false;
    }
    return _webpOk;
  }

  function encodeCanvas(canvas, quality) {
    if (webpSupported()) {
      var w = canvas.toDataURL('image/webp', quality);
      if (w.indexOf('data:image/webp') === 0) return w;
    }
    return canvas.toDataURL('image/jpeg', quality);
  }

  function scaleToCanvas(img, max) {
    var scale = Math.min(1, max / Math.max(img.width, img.height));
    var w = Math.max(1, Math.round(img.width * scale));
    var hgt = Math.max(1, Math.round(img.height * scale));
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = hgt;
    canvas.getContext('2d').drawImage(img, 0, 0, w, hgt);
    return canvas;
  }

  // Produce { full, thumb } data URLs from a loaded <img>. Returns null on error.
  function variantsFromImage(img) {
    try {
      return {
        full: encodeCanvas(scaleToCanvas(img, IMG_FULL_MAX), 0.72),
        thumb: encodeCanvas(scaleToCanvas(img, IMG_THUMB_MAX), 0.7),
      };
    } catch (e) {
      return null;
    }
  }

  // Compress an uploaded File/Blob entirely on-device. Calls cb({full,thumb})
  // on success or cb(null) on any failure.
  function processImage(file, cb) {
    var reader = new FileReader();
    reader.onerror = function () {
      cb(null);
    };
    reader.onload = function () {
      var img = new Image();
      img.onerror = function () {
        cb(null);
      };
      img.onload = function () {
        cb(variantsFromImage(img));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  // Derive { full, thumb } from an existing data URL (used by the OFF/scanner
  // paths and the one-time inline-image migration). cb(null) on failure.
  function variantsFromDataUrl(dataUrl, cb) {
    if (!dataUrl) return cb(null);
    var img = new Image();
    img.onerror = function () {
      cb(null);
    };
    img.onload = function () {
      cb(variantsFromImage(img));
    };
    img.src = dataUrl;
  }

  // ---- Content-hash image de-duplication (per-user, shared image store) ----
  // Images are keyed by the SHA-256 of their full data URL, so an identical
  // photo used by many items is stored exactly once (dedup-on-write). Items
  // reference an image via item.imageHash. An in-memory map mirrors the store
  // so cards/lists render synchronously without per-item async reads.
  var imageMap = {}; // hash -> { hash, full, thumb }

  function sha256Hex(str) {
    try {
      if (window.crypto && window.crypto.subtle && window.TextEncoder) {
        var bytes = new TextEncoder().encode(str);
        return window.crypto.subtle
          .digest('SHA-256', bytes)
          .then(function (buf) {
            var arr = Array.prototype.slice.call(new Uint8Array(buf));
            return arr
              .map(function (b) {
                return b.toString(16).padStart(2, '0');
              })
              .join('');
          });
      }
    } catch (e) {}
    // Deterministic non-crypto fallback (still fine for dedup keying).
    var h = 5381;
    var i = str.length;
    while (i) h = (h * 33) ^ str.charCodeAt(--i);
    return Promise.resolve('f' + (h >>> 0).toString(16));
  }

  // Store a { full, thumb } pair de-duplicated by content hash; return the hash.
  function storeImagePair(pair) {
    if (!pair || !pair.full) return Promise.resolve(null);
    return sha256Hex(pair.full).then(function (hash) {
      if (imageMap[hash]) return hash; // already stored (dedup-on-write)
      var rec = { hash: hash, full: pair.full, thumb: pair.thumb || pair.full };
      imageMap[hash] = rec;
      return window.PantryDB.putImage(rec).then(function () {
        return hash;
      });
    });
  }

  // Persist an image given only a FULL data URL: derive a thumb, then dedup.
  function persistFullImage(full) {
    if (!full) return Promise.resolve(null);
    return new Promise(function (resolve) {
      variantsFromDataUrl(full, function (pair) {
        if (!pair) return resolve(null);
        storeImagePair(pair).then(resolve);
      });
    });
  }

  // Release an image when no remaining item references it (refcount-by-scan GC).
  function releaseImage(hash) {
    if (!hash) return Promise.resolve();
    var stillUsed = items.some(function (it) {
      return it.imageHash === hash;
    });
    if (stillUsed) return Promise.resolve();
    delete imageMap[hash];
    return window.PantryDB.deleteImage(hash);
  }

  // Resolve display sources for an item: hashed store first, then any legacy
  // inline image (pre-migration / scanner-session entries that carry .image).
  function fullImageFor(item) {
    if (!item) return null;
    if (item.imageHash && imageMap[item.imageHash])
      return imageMap[item.imageHash].full;
    return item.image || null;
  }
  function thumbImageFor(item) {
    if (!item) return null;
    if (item.imageHash && imageMap[item.imageHash]) {
      var r = imageMap[item.imageHash];
      return r.thumb || r.full;
    }
    return item.image || null;
  }

  // One-time migration: move any legacy inline item.image into the deduped
  // image store, set item.imageHash, and drop the inline copy. Per-user flag,
  // idempotent, and safe if interrupted (re-runs only over items still inline).
  function migrateInlineImages() {
    var uid = window.CurrentUser && window.CurrentUser.id();
    if (!uid) return Promise.resolve();
    var FLAG = 'pantry.imgmig.v1.' + uid;
    try {
      if (localStorage.getItem(FLAG)) return Promise.resolve();
    } catch (e) {}
    var pending = items.filter(function (i) {
      return i.image && !i.imageHash;
    });
    if (!pending.length) {
      try {
        localStorage.setItem(FLAG, '1');
      } catch (e) {}
      return Promise.resolve();
    }
    var chain = Promise.resolve();
    pending.forEach(function (it) {
      chain = chain.then(function () {
        return persistFullImage(it.image).then(function (hash) {
          // Only drop the inline copy once it is safely deduped — never lose it.
          if (!hash) return;
          it.imageHash = hash;
          it.image = null;
          return window.PantryDB.put(it);
        });
      });
    });
    return chain.then(function () {
      try {
        localStorage.setItem(FLAG, '1');
      } catch (e) {}
    });
  }

  // One-time migration: give legacy single-`name` items a bilingual pair.
  // Detects the language of the existing name, fills that side, and best-effort
  // enriches the other side from the bundled foods catalog. The legacy `name`
  // is always preserved (render fallback), so this is loss-free. Per-user flag,
  // idempotent, and interrupt-safe (only re-processes items still missing both
  // localized names).
  function migrateItemNames() {
    var uid = window.CurrentUser && window.CurrentUser.id();
    if (!uid) return Promise.resolve();
    var FLAG = 'pantry.namemig.v1.' + uid;
    try {
      if (localStorage.getItem(FLAG)) return Promise.resolve();
    } catch (e) {}
    var pending = items.filter(function (i) {
      return !i.nameEn && !i.nameHe && i.name;
    });
    if (!pending.length) {
      try {
        localStorage.setItem(FLAG, '1');
      } catch (e) {}
      return Promise.resolve();
    }
    var chain = Promise.resolve();
    pending.forEach(function (it) {
      chain = chain.then(function () {
        var resolved = resolveNames(it.name, null, null);
        // Never blank out the legacy name; only add the localized fields.
        it.nameEn = resolved.nameEn;
        it.nameHe = resolved.nameHe;
        return window.PantryDB.put(it);
      });
    });
    return chain.then(function () {
      try {
        localStorage.setItem(FLAG, '1');
      } catch (e) {}
    });
  }

  // ---- Lazy scanner library loader (ZXing, ~336KB) ----
  // Loaded only on first scanner open — kept off the startup/parse path. The
  // service worker precaches vendor/zxing.min.js, so this resolves from cache
  // offline too. Debounced via a single shared promise so it loads once.
  var zxingPromise = null;
  function loadZXing() {
    if (typeof ZXing !== 'undefined') return Promise.resolve(ZXing);
    if (zxingPromise) return zxingPromise;
    zxingPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = './vendor/zxing.min.js';
      s.async = true;
      s.onload = function () {
        if (typeof ZXing !== 'undefined') resolve(ZXing);
        else {
          zxingPromise = null;
          reject(new Error('ZXing unavailable after load'));
        }
      };
      s.onerror = function () {
        zxingPromise = null; // allow a retry on the next scanner open
        reject(new Error('Failed to load scanner library'));
      };
      document.head.appendChild(s);
    });
    return zxingPromise;
  }

  // ---- Reusable form controls (shared by add/edit form + scanner dialogs) ----

  // On-device photo control. `state` is mutated in place (state.imageFull /
  // state.imageThumb); the placeholder falls back to state.emoji or category.
  function photoControl(state) {
    var fileInput = h('input', { class: 'photo-file', type: 'file', accept: 'image/*' });
    var cameraInput=h('input',{class:'photo-file',type:'file',accept:'image/*',capture:'environment','aria-label':'צילום תמונת מוצר'});
    var inputs=h('div',{hidden:true},fileInput,cameraInput);
    var row = h('div', { class: 'photo-row' });
    function render() {
      row.innerHTML = '';
      var preview = state.imageThumb || state.imageFull;
      var tile = preview
        ? h(
            'div',
            { class: 'photo-preview has-img' },
            h('img', { class: 'thumb-img loaded', src: preview, alt: '' })
          )
        : h(
            'div',
            { class: 'photo-preview' },
            h('span', { text: state.emoji || categoryEmoji(state.categoryId) })
          );
      var addBtn = h(
        'button',
        { class: 'btn ghost', type: 'button', onclick: function () { fileInput.click(); } },
        preview ? t('form.changePhoto') : t('form.addPhoto')
      );
      var rm = preview
        ? h(
            'button',
            {
              class: 'btn ghost danger',
              type: 'button',
              onclick: function () { state.imageFull = null; state.imageThumb = null; render(); },
            },
            t('form.removePhoto')
          )
        : null;
      row.appendChild(tile);
      var cameraBtn=h('button',{class:'btn ghost',type:'button',text:'צילום מוצר',onclick:function(){cameraInput.click();}});
      row.appendChild(h('div', { class: 'photo-actions' }, cameraBtn,addBtn, rm));
    }
    function readPhoto(input) {
      var f = input.files && input.files[0];
      if (!f) return;
      processImage(f, function (pair) {
        if (pair) { state.imageFull = pair.full; state.imageThumb = pair.thumb; render(); }
        else showToast(t('form.imageError'));
        input.value = '';
      });
    }
    fileInput.addEventListener('change',function(){readPhoto(fileInput);});
    cameraInput.addEventListener('change',function(){readPhoto(cameraInput);});
    render();
    return { row: row, input: inputs, render: render };
  }

  // A min-1 quantity stepper bound to get/set accessors.
  function stepperBox(get, set) {
    var val = h('span', { class: 'qty', text: formatQty(get()) });
    function upd() { val.textContent = formatQty(get()); }
    return h(
      'div',
      { class: 'qty-box' },
      h(
        'div',
        { class: 'stepper' },
        h('button', { class: 'step-btn', type: 'button', onclick: function () { set(Math.max(1, get() - 1)); upd(); } }, '−'),
        h('div', { class: 'step-value' }, val),
        h('button', { class: 'step-btn primary', type: 'button', onclick: function () { set(get() + 1); upd(); } }, '+')
      )
    );
  }

  // Category selection chips bound to get/set accessors.
  function categoryChips(get, set) {
    var chips = h('div', { class: 'chips' });
    CATEGORIES.forEach(function (cat) {
      chips.appendChild(
        h(
          'button',
          {
            class: 'chip' + (get() === cat.id ? ' active' : ''),
            type: 'button',
            onclick: function () {
              set(cat.id);
              Array.prototype.forEach.call(chips.children, function (c, idx) {
                c.className = 'chip' + (CATEGORIES[idx].id === cat.id ? ' active' : '');
              });
            },
          },
          h('span', { text: cat.emoji }),
          h('span', { text: t('categories.' + cat.id) })
        )
      );
    });
    return chips;
  }

  // Unit selection chips bound to get/set accessors.
  function unitChipsBox(get, set) {
    var chips = h('div', { class: 'chips' });
    UNITS.forEach(function (u) {
      chips.appendChild(
        h(
          'button',
          {
            class: 'chip unit' + (get() === u ? ' active' : ''),
            type: 'button',
            onclick: function () {
              set(u);
              Array.prototype.forEach.call(chips.children, function (c, idx) {
                c.className = 'chip unit' + (UNITS[idx] === u ? ' active' : '');
              });
            },
          },
          t('units.' + u)
        )
      );
    });
    return chips;
  }

  // ---- State ----
  var items = [];
  // Shopping List — a SEPARATE model (shopping_list_items), NOT derived from
  // inventory. Held in its own in-memory array and persisted via PantryDB
  // shopping CRUD. Inventory (`items`) and this list never share write paths.
  var shoppingItems = [];
  var root;

  // True only in a real browser DOM. Lets data-layer actions (add/purchase/
  // remove shopping) run in a headless test harness without a DOM by making
  // the UI-refresh calls safely no-op.
  function hasDOM() {
    return typeof document !== 'undefined' && typeof document.getElementById === 'function';
  }

  function load() {
    return window.PantryDB.getAll()
      .then(function (arr) {
        // Normalize legacy records that predate desiredAmount.
        items = arr.map(function (i) {
          if (typeof i.desiredAmount !== 'number') i.desiredAmount = 0;
          if (typeof i.image === 'undefined') i.image = null; // migrate legacy
          return i;
        });
      })
      .then(function () {
        // Load this user's Shopping List (independent store, per-user scoped).
        return window.PantryDB.getAllShopping();
      })
      .then(function (shop) {
        shoppingItems = shop || [];
      })
      .then(function () {
        // Hydrate the in-memory image cache so cards render synchronously.
        return window.PantryDB.getAllImages();
      })
      .then(function (imgs) {
        imageMap = {};
        (imgs || []).forEach(function (r) {
          if (r && r.hash) imageMap[r.hash] = r;
        });
      });
  }

  // ================= Monthly restock tracking =================
  // A lightweight per-month log keyed by YYYY-MM:
  //   restocked = sum of quantity increases (stepper +, restock +, new items)
  //   consumed  = sum of quantity decreases (stepper -)
  //   shortfall = snapshot of items below their desired amount (par level)
  function ym(date) {
    var d = date || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  function monthEntry(log, key) {
    if (!log[key]) log[key] = { restocked: 0, consumed: 0, shortfall: [] };
    if (typeof log[key].restocked !== 'number') log[key].restocked = 0;
    if (typeof log[key].consumed !== 'number') log[key].consumed = 0;
    if (!Array.isArray(log[key].shortfall)) log[key].shortfall = [];
    return log[key];
  }
  // Prices are stored as integer agorot; historical purchase snapshots do not
  // change when stock is consumed, an item is deleted, or its price is edited.
  function parseUnitPrice(value) {
    var text = String(value == null ? '' : value).trim().replace(',', '.');
    if (!text) return null;
    if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error('invalid price');
    var parts = text.split('.');
    var result = Number(parts[0]) * 100 + Number(((parts[1] || '') + '00').slice(0,2));
    if (!Number.isSafeInteger(result)) throw new Error('invalid price');
    return result;
  }
  function priceText(value) {
    return Number.isSafeInteger(value) && value >= 0 ? (value / 100).toFixed(2) : '';
  }
  function formatMoney(agorot) {
    return new Intl.NumberFormat('he-IL', {style:'currency',currency:'ILS'}).format(agorot / 100);
  }
  function purchaseAmount(quantity,unitPrice){return Home.purchaseAmount(quantity,unitPrice);}
  function recordExpense(item, quantity) {
    var amount = purchaseAmount(quantity, item.unitPriceAgorot);
    if (amount === null) return null;
    var log = window.PantryDB.getMonthlyLog();
    var month = monthEntry(log, ym());
    if (!Array.isArray(month.expenses)) month.expenses = [];
    var entry = {
      id:'purchase_' + Date.now().toString(36) + Math.random().toString(36).slice(2),
      at:new Date().toISOString(), itemId:item.id, name:itemName(item),
      location:item.location, quantity:quantity, unit:item.unit,
      unitPriceAgorot:item.unitPriceAgorot, amountAgorot:amount
    };
    month.expenses.push(entry);
    if (window.PantryDB.setMonthlyLog(log) === false) {
      showToast('המלאי נשמר, אך אין מקום לשמור את ההוצאה במכשיר.');
      return null;
    }
    return entry.id;
  }
  function undoExpense(id) {
    if (!id) return;
    var log = window.PantryDB.getMonthlyLog();
    Object.keys(log).forEach(function(key){
      if (Array.isArray(log[key].expenses)) log[key].expenses = log[key].expenses.filter(function(e){return e.id !== id;});
    });
    window.PantryDB.setMonthlyLog(log);
  }
  function expenseTotal(entries) {
    return (entries || []).reduce(function(total, entry){
      return total + (Number.isSafeInteger(entry.amountAgorot) && entry.amountAgorot >= 0 ? entry.amountAgorot : 0);
    },0);
  }
  function priceField(initial, getQuantity, estimateLabel) {
    var wrap = h('div',{class:'price-field'});
    var input = h('input',{class:'input price-input',type:'text',inputmode:'decimal',dir:'ltr',
      'aria-label':'מחיר ליחידה בשקלים',placeholder:'0.00',value:priceText(initial)});
    var total = h('p',{class:'price-preview','aria-live':'polite'});
    function update() {
      try {
        var price = parseUnitPrice(input.value);
        var amount = purchaseAmount(getQuantity(),price);
        total.textContent = price !== null && getQuantity() <= 0 ? 'שינוי מחיר בלבד לא יוסיף הוצאה. הוסיפו כמות כדי לרשום קנייה.' : amount === null ? 'מחיר הוא רשות. פריטים ללא מחיר לא נכללים בהוצאות.' : (estimateLabel || 'הוצאה עבור התוספת למלאי') + ': ' + formatMoney(amount);
        input.removeAttribute('aria-invalid');
      } catch(e) {total.textContent='הזינו מחיר מאפס ומעלה, עם עד שתי ספרות אחרי הנקודה.';}
    }
    input.addEventListener('input',update);
    wrap.appendChild(h('label',{class:'field-label'},'מחיר ליחידה (₪)', input));
    wrap.appendChild(total);
    update();
    return {element:wrap,input:input,update:update,read:function(){
      try {return parseUnitPrice(input.value);} catch(e){input.setAttribute('aria-invalid','true');input.focus();throw e;}
    }};
  }

  function recordDelta(delta) {
    if (!delta) return;
    var log = window.PantryDB.getMonthlyLog();
    var e = monthEntry(log, ym());
    if (delta > 0) e.restocked += delta;
    else e.consumed += -delta;
    window.PantryDB.setMonthlyLog(log);
  }
  function computeShortfall(src) {
    return (src || items)
      .filter(function (i) {
        return (i.desiredAmount || 0) > 0 && i.quantity < i.desiredAmount;
      })
      .map(function (i) {
        return {
          id: i.id,
          name: i.name,
          // Snapshot both names so past months render correctly in either
          // language even after the item is edited or removed.
          nameEn: i.nameEn || null,
          nameHe: i.nameHe || null,
          emoji: itemEmoji(i),
          missing: i.desiredAmount - i.quantity,
          have: i.quantity,
          target: i.desiredAmount,
        };
      });
  }
  function recomputeShortfall() {
    var log = window.PantryDB.getMonthlyLog();
    var e = monthEntry(log, ym());
    e.shortfall = computeShortfall();
    window.PantryDB.setMonthlyLog(log);
  }

  // Targeted-render caches: the DOM node per item id + the "To restock" section
  // container. A quantity change updates only the affected card (O(1)) and
  // rebuilds just the restock section (O(shortfall)) instead of re-rendering
  // the entire list (O(n)) on every tap.
  var cardRefs = {};

  // ---- Responsive layout / shared Shopping List ----
  // The Shopping List is its OWN editable model (shoppingItems, backed by the
  // PantryDB `shopping` store) — NOT derived from inventory. The inventory
  // "To restock" (computeShortfall) is surfaced only as optional SUGGESTIONS
  // with an explicit "add to shopping list" action. It is rendered by ONE
  // shared renderer (renderShoppingList) used in two modes:
  //   - 'sidebar' : desktop side panel next to inventory (>= BREAKPOINT)
  //   - 'page'    : mobile dedicated full-width page (< BREAKPOINT)
  // Only one instance is ever mounted at a time (tracked by shoppingListEl).
  var BREAKPOINT = 1024;
  var mqWide = null; // cached MediaQueryList
  var shoppingListEl = null; // the currently-mounted shared list container
  var shoppingListMode = null; // 'sidebar' | 'page'
  var currentView = 'inventory'; // mobile page selection ('inventory'|'shopping')
  var SHOP_COLLAPSE_KEY = 'pantry.shoppingPanel.collapsed';

  // Pure breakpoint mapping (space-based, no user-agent sniffing) — testable.
  function layoutModeForWidth(w) {
    return w >= BREAKPOINT ? 'sidebar' : 'page';
  }
  function isWide() {
    if (!mqWide && typeof window.matchMedia === 'function') {
      mqWide = window.matchMedia('(min-width: ' + BREAKPOINT + 'px)');
    }
    return mqWide ? mqWide.matches : false;
  }
  function shopCollapsed() {
    try {
      return localStorage.getItem(SHOP_COLLAPSE_KEY) === '1';
    } catch (e) {
      return false;
    }
  }
  function setShopCollapsed(v) {
    try {
      localStorage.setItem(SHOP_COLLAPSE_KEY, v ? '1' : '0');
    } catch (e) {}
  }

  // ---- Shopping List model helpers (independent of inventory) ----
  // Normalized identity used to (a) coalesce duplicate shopping entries and
  // (b) match a purchased shopping item to an inventory item. Never writes.
  function normName(s) {
    return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' ');
  }
  function shopKey(rec) {
    return normName((rec && (rec.nameEn || rec.name || rec.nameHe)) || '');
  }
  function activeShopping() {
    return shoppingItems.filter(function (x) { return !x.purchased; });
  }
  function findActiveShoppingByKey(key,unit) {
    for (var i = 0; i < shoppingItems.length; i++) {
      if (!shoppingItems[i].purchased && shopKey(shoppingItems[i]) === key && (!unit || (shoppingItems[i].unit||'pcs')===unit)) return shoppingItems[i];
    }
    return null;
  }
  function findInventoryByKey(key) {
    for (var i = 0; i < items.length; i++) {
      if (shopKey(items[i]) === key) return items[i];
    }
    return null;
  }
  function upsertLocalShopping(rec) {
    var idx = shoppingItems.findIndex(function (x) { return x.id === rec.id; });
    if (idx >= 0) shoppingItems[idx] = rec; else shoppingItems.push(rec);
  }

  // Re-render the mounted Shopping List (sidebar or page) without touching data.
  function refreshShopping() {
    if(currentView==='shopping'){renderCurrentView();return;}
    if (shoppingListEl && shoppingListEl.parentNode) {
      renderShoppingList(shoppingListEl, shoppingListMode);
    } else {
      renderCurrentView();
    }
  }

  // ADD TO SHOPPING LIST — writes ONLY to the shopping store. Never creates or
  // modifies an inventory item. Adding an existing (active) entry bumps its
  // needed quantity instead of duplicating.
  function addToShoppingList(input) {
    input = input || {};
    var qty = typeof input.quantity === 'number' && input.quantity > 0 ? input.quantity : 1;
    var key = normName(input.nameEn || input.name || input.nameHe || '');
    var existing = key ? findActiveShoppingByKey(key,input.unit||'pcs') : null;
    var rec;
    if (existing) {
      existing.quantity = (typeof existing.quantity === 'number' ? existing.quantity : 0) + qty;
      if(Number.isSafeInteger(input.unitPriceAgorot)) existing.unitPriceAgorot=input.unitPriceAgorot;
      rec = existing;
    } else {
      rec = {
        name: (input.name || '').trim() || null,
        nameEn: (input.nameEn || '').trim() || null,
        nameHe: (input.nameHe || '').trim() || null,
        quantity: qty,
        unit: input.unit || 'pcs',
        categoryId: input.categoryId || 'other',
        unitPriceAgorot: Number.isSafeInteger(input.unitPriceAgorot) ? input.unitPriceAgorot : null,
        note: input.note || null,
        purchased: false,
      };
    }
    return window.PantryDB.putShopping(rec).then(function (saved) {
      upsertLocalShopping(saved);
      recomputeShortfall();
      refreshShopping();
      showToast(t('shopping.addedToList'));
      return saved;
    });
  }

  // Adjust a shopping item's NEEDED quantity (edits the shopping model only).
  function changeShoppingQty(shop, delta) {
    var next = (typeof shop.quantity === 'number' ? shop.quantity : 1) + delta;
    if (next < 1) next = 1;
    shop.quantity = next;
    window.PantryDB.putShopping(shop).then(function (saved) {
      upsertLocalShopping(saved);
      refreshShopping();
    });
  }

  // PURCHASE FLOW — the ONLY place the Shopping List affects inventory. Adds the
  // needed quantity to the matching inventory item (creating it if none exists),
  // then removes the shopping entry. Reversible via undo.
  var purchasesInFlight=Object.create(null);
  function purchaseShoppingItem(shop) {
    if(shop.purchased)return Promise.resolve();
    if(purchasesInFlight[shop.id])return purchasesInFlight[shop.id];
    var pending=completeShoppingPurchase(shop);
    purchasesInFlight[shop.id]=pending;
    pending.then(function(){delete purchasesInFlight[shop.id];},function(){
      delete purchasesInFlight[shop.id];refreshShopping();showToast('הקנייה לא הושלמה. בדקו את המלאי לפני ניסיון נוסף.');
    });
    return pending;
  }
  function completeShoppingPurchase(shop) {
    var qty = typeof shop.quantity === 'number' && shop.quantity > 0 ? shop.quantity : 1;
    var key = shopKey(shop);
    var inv = key ? findInventoryByKey(key) : null;
    var createdNew = false;
    var expenseId = null;
    var prevPrice = inv ? inv.unitPriceAgorot : null;
    var prevQty = inv ? inv.quantity : 0;
    var applyInv;
    if (inv) {
      if(Number.isSafeInteger(shop.unitPriceAgorot)) inv.unitPriceAgorot=shop.unitPriceAgorot;
      inv.quantity = (typeof inv.quantity === 'number' ? inv.quantity : 0) + qty;
      applyInv = window.PantryDB.put(inv).then(function () { return inv; });
    } else {
      applyInv = window.PantryDB.create({
        name: shop.name, nameEn: shop.nameEn, nameHe: shop.nameHe,
        location: defaultInventoryLocation(),
        unitPriceAgorot: shop.unitPriceAgorot,
        quantity: qty, unit: shop.unit || 'pcs', categoryId: shop.categoryId || 'other',
      }).then(function (ni) { createdNew = true; items.push(ni); return ni; });
    }
    return applyInv.then(function (invItem) {
      recordDelta(qty);
      expenseId=recordExpense(invItem,qty);
      return window.PantryDB.putShopping(Object.assign({},shop,{purchased:true,purchasedAt:new Date().toISOString()})).then(function (saved) {
        upsertLocalShopping(saved);
        recomputeShortfall();
        refreshAfterMutation(invItem);
        showToast(t('shopping.purchased'), function () {
          var revert;
          if (createdNew) {
            revert = window.PantryDB.remove(invItem.id).then(function () {
              items = items.filter(function (x) { return x.id !== invItem.id; });
            });
          } else {
            invItem.quantity = prevQty;
            invItem.unitPriceAgorot=prevPrice;
            revert = window.PantryDB.put(invItem);
          }
          revert.then(function () {
            recordDelta(-qty);
            undoExpense(expenseId);
            return window.PantryDB.putShopping(shop);
          }).then(function (saved) {
            upsertLocalShopping(saved);
            recomputeShortfall();
            refreshAfterMutation(invItem);
          });
        });
      });
    });
  }

  // Remove a shopping entry (does NOT touch inventory). Reversible via undo.
  function removeShoppingItem(shop) {
    return window.PantryDB.removeShopping(shop.id).then(function () {
      shoppingItems = shoppingItems.filter(function (x) { return x.id !== shop.id; });
      refreshShopping();
      showToast(t('shopping.removed'), function () {
        window.PantryDB.putShopping(shop).then(function (saved) {
          upsertLocalShopping(saved);
          refreshShopping();
        });
      });
    });
  }

  // THE single shared Shopping List renderer (both sidebar + page modes). Backed
  // by the separate shopping model; inventory shortfall is shown as suggestions.
  function renderShoppingList(container, mode) {
    shoppingListEl = container;
    shoppingListMode = mode;
    container.innerHTML = '';
    var collapsed = mode === 'sidebar' && shopCollapsed();
    var active = activeShopping();

    var head = h(
      'div',
      { class: 'shopping-head' },
      uiIcon('bag'),
      h('h2', { class: 'shopping-title', text: t('shopping.title') }),
      h('span', { class: 'section-count', text: String(active.length) })
    );
    if (mode === 'sidebar') {
      head.appendChild(
        h(
          'button',
          {
            class: 'shopping-collapse',
            type: 'button',
            'aria-label': collapsed ? t('shopping.expand') : t('shopping.collapse'),
            title: collapsed ? t('shopping.expand') : t('shopping.collapse'),
            onclick: function () {
              setShopCollapsed(!collapsed);
              var panel = document.querySelector('.shopping-panel');
              if (panel) panel.classList.toggle('collapsed', shopCollapsed());
              renderShoppingList(container, mode);
            },
          },
          collapsed ? '»' : '«'
        )
      );
    }
    if (mode === 'sidebar') container.appendChild(head);
    if (collapsed) return; // header-only when collapsed

    // Add-item control — opens the dedicated Shopping List add form (writes to
    // the shopping model only, never inventory).
    container.appendChild(
      h(
        'button',
        {
          class: 'btn ghost shopping-add',
          type: 'button',
          onclick: function () { openShoppingForm(null); },
        },
        '＋ ' + t('shopping.addItem')
      )
    );

    // Suggestions from inventory "to restock" not already on the list.
    var activeKeys = {};
    active.forEach(function (s) { activeKeys[shopKey(s)] = true; });
    var suggestions=Home.shoppingPlan(items,shoppingItems).map(function(need){return Object.assign({},need.item,{missing:need.quantity});});

    if (!active.length) {
      container.appendChild(
        h(
          'div',
          { class: 'shopping-empty' },
          h('div', { class: 'shopping-empty-emoji' }, uiIcon('bag')),
          h('div', { class: 'shopping-empty-text', text: 'הרשימה נקייה. מה חסר בבית?' })
        )
      );
    } else {
      var listWrap = h('div', { class: 'shopping-items' });
      active.forEach(function (s) { listWrap.appendChild(renderShoppingRow(s)); });
      container.appendChild(listWrap);
    }

    var bought=shoppingItems.filter(function(item){return item.purchased;});
    if(bought.length){
      var archive=h('details',{class:'shopping-bought'},h('summary',{text:'נקנו ('+bought.length+')'}));
      bought.forEach(function(item){archive.appendChild(h('div',{class:'shopping-bought-row'},
        h('span',{'aria-hidden':'true',text:'✓'}),
        h('span',{dir:'auto',text:itemName(item)}),
        h('span',{text:formatQty(item.quantity)+' '+t('units.'+(item.unit||'pcs'))})));});
      container.appendChild(archive);
    }

    if (suggestions.length) {
      container.appendChild(
        h('div', { class: 'shopping-suggest-head' },
          h('span', { class: 'shopping-suggest-title', text: t('shopping.suggestions') }),
          h('span', { class: 'shopping-suggest-sub', text: t('shopping.suggestionsSub') })
        )
      );
      var sugWrap = h('div', { class: 'shopping-suggestions' });
      suggestions.forEach(function (sf) { sugWrap.appendChild(renderSuggestionRow(sf)); });
      container.appendChild(sugWrap);
    }
  }

  // One row of the Shopping List (a shopping-model item). name + needed qty +
  // stepper, a purchased checkbox (=> purchase flow), and remove.
  function renderShoppingRow(shop) {
    var unit = t('units.' + (shop.unit || 'pcs'));
    var checkbox=h('button',{type:'button',class:'shopping-buy','aria-label':'נקנה: '+itemName(shop),onclick:function(){
      checkbox.disabled=true;
      purchaseShoppingItem(shop).catch(function(){checkbox.disabled=false;});
    }},'נקנה ✓');
    var minus = h('button', {
      class: 'step-btn',
      'aria-label': t('a11y.decrease'),
      onclick: function (e) { e.stopPropagation(); changeShoppingQty(shop, -1); },
    }, '−');
    var plus = h('button', {
      class: 'step-btn primary',
      'aria-label': t('a11y.increase'),
      onclick: function (e) { e.stopPropagation(); changeShoppingQty(shop, 1); },
    }, '+');
    var remove = h('button', {
      class: 'shopping-remove',
      'aria-label': t('shopping.remove'),
      title: t('shopping.remove'),
      onclick: function (e) { e.stopPropagation(); removeShoppingItem(shop); },
    }, '✕');
    var row=h(
      'div',
      { class: 'card shopping-row' },
      checkbox,
      h(
        'button',
        { class: 'card-info shopping-item-open',type:'button','aria-label':'עריכת '+itemName(shop),onclick:function(){openShoppingForm(shop);} },
        h('span', { class: 'card-name', dir: 'auto', text: itemName(shop) }),
        h('span', {
          class: 'card-meta',
          text: t('shopping.needQty', { qty: formatQty(shop.quantity || 1), unit: unit })+(Number.isSafeInteger(shop.unitPriceAgorot)?' · '+formatMoney(purchaseAmount(shop.quantity||1,shop.unitPriceAgorot)) : ' · ללא מחיר'),
        })
      ),
      remove,
      h('div', { class: 'shopping-step' }, minus, plus)
    );
    var touchStart=null,suppressClick=false;
    row.addEventListener('click',function(event){if(suppressClick){event.preventDefault();event.stopPropagation();suppressClick=false;}},true);
    row.addEventListener('pointerdown',function(event){
      if(event.pointerType!=='touch'||event.target.closest('.shopping-buy,.shopping-remove,.shopping-step,input'))return;
      touchStart={x:event.clientX,y:event.clientY};
    });
    row.addEventListener('pointerup',function(event){
      if(!touchStart)return;
      var dx=event.clientX-touchStart.x,dy=event.clientY-touchStart.y;touchStart=null;
      if(Math.abs(dx)>90&&Math.abs(dy)<30&&!checkbox.disabled){checkbox.click();suppressClick=true;setTimeout(function(){suppressClick=false;},400);}
    });
    row.addEventListener('pointercancel',function(){touchStart=null;});
    return row;
  }

  // A suggestion row (inventory running low). The ＋ writes to the shopping
  // list only — it does NOT modify inventory.
  function renderSuggestionRow(sf) {
    var inv = itemById(sf.id);
    var unit = t('units.' + ((inv && inv.unit) || 'pcs'));
    return h(
      'div',
      { class: 'card shopping-suggest-row' },
      h(
        'div',
        { class: 'card-info' },
        h('div', { class: 'card-name', dir: 'auto', text: itemName(sf) }),
        h('div', { class: 'card-meta', text: t('shopping.need', { missing: formatQty(sf.missing), unit: unit }) })
      ),
      h('button', {
        class: 'step-btn primary shopping-suggest-add',
        'aria-label': t('shopping.addToList'),
        title: t('shopping.addToList'),
        onclick: function (e) {
          e.stopPropagation();
          addToShoppingList({
            name: inv ? inv.name : sf.name,
            nameEn: sf.nameEn, nameHe: sf.nameHe,
            quantity: sf.missing, unit: inv ? inv.unit : 'pcs',
            categoryId: inv ? inv.categoryId : 'other',
            unitPriceAgorot: inv ? inv.unitPriceAgorot : null,
          });
        },
      }, '＋')
    );
  }

  // Compact add/edit form for a Shopping List item (writes to shopping only).
  function openShoppingForm(existing) {
    var editing = !!existing;
    var overlay = h('div', { class: 'overlay center' });
    var prevReopen = reopenTop;
    var myReopen = function () { openShoppingForm(existing); };
    reopenTop = myReopen;
    function close() {
      if(unitSel)unitSel.destroy();
      overlay.remove();
      if (reopenTop === myReopen) reopenTop = prevReopen;
    }
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

    var nameInput = h('input', {
      class: 'input', type: 'text', dir: 'auto',
      placeholder: t('shopping.namePlaceholder'),
      value: editing ? itemName(existing) : '',
    });
    var qtyInput = h('input', {
      class: 'input', type: 'number', min: '1', inputmode: 'numeric',
      value: String(editing ? (existing.quantity || 1) : 1),
    });
    var unitSel = window.HomeDropdown.create({
      label:'יחידת מידה',
      value:editing ? existing.unit : 'pcs',
      options:UNITS.map(function(unit){return {value:unit,label:t('units.'+unit)};})
    });

    var price = priceField(editing ? existing.unitPriceAgorot : null,function(){return Number(qtyInput.value)||0;},'עלות מתוכננת');
    qtyInput.addEventListener('input',price.update);
    var card = h(
      'div', { class: 'sync-body shopping-form' },
      h('h3', { dir: 'auto', text: editing ? t('shopping.editTitle') : t('shopping.addItem') }),
      h('label', { class: 'field-label', text: t('shopping.nameLabel') }),
      nameInput,
      h('label', { class: 'field-label', text: t('shopping.quantity') }),
      qtyInput,
      h('label', { class: 'field-label', text: t('form.unit') }),
      unitSel.element
    );
    card.appendChild(price.element);
    card.appendChild(h('p',{class:'price-note',text:'ההוצאה תירשם רק לאחר סימון הפריט כנרכש.'}));
    var actions = h('div', { class: 'conflict-actions' });
    actions.appendChild(h('button', { class: 'btn ghost', type: 'button', onclick: close }, t('form.cancel')));
    actions.appendChild(h('button', { class: 'btn save', type: 'button', onclick: function () {
      var nm = nameInput.value.trim();
      if (!nm) { nameInput.focus(); return; }
      var qv = parseInt(qtyInput.value, 10);
      if (!(qv > 0)) qv = 1;
      var unitPrice;try{unitPrice=price.read();}catch(e){return;}
      var lang = window.I18N.getLang();
      if (editing) {
        // Update the existing shopping record's active-language name + fields.
        if (lang === 'he') existing.nameHe = nm; else existing.nameEn = nm;
        existing.name = nm;
        existing.quantity = qv;
        existing.unit = unitSel.value;
        existing.unitPriceAgorot=unitPrice;
        window.PantryDB.putShopping(existing).then(function (saved) {
          upsertLocalShopping(saved);
          refreshShopping();
        });
      } else {
        var input = { name: nm, quantity: qv, unit: unitSel.value,unitPriceAgorot:unitPrice };
        if (lang === 'he') input.nameHe = nm; else input.nameEn = nm;
        addToShoppingList(input);
      }
      close();
    } }, t('shopping.save')));
    card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    try { nameInput.focus(); } catch (e) {}
  }

  // Re-render the current base screen (mobile page vs. inventory+panel) without
  // reloading data — used on breakpoint crossing and language change.
  var scannerCleanup=null;
  var restoringNavigation=false;
  function routeView(){
    var view=location.hash.slice(2);
    return ['inventory','shopping','expenses','settings','scanner'].indexOf(view)>=0?view:'inventory';
  }
  function pageAddress(view) {
    if(view!=='scanner'&&scannerCleanup){var cleanup=scannerCleanup;scannerCleanup=null;cleanup();}
    if(restoringNavigation)return;
    var hash='#/'+view;
    try{
      if(location.hash!==hash){
        history.replaceState(Object.assign({},history.state,{scrollY:window.scrollY||0}),'');
        history.pushState({view:view,scrollY:0},'',hash);

      }
    }catch(error){console.warn('Navigation address unavailable',error);}
  }
  if(window.addEventListener)window.addEventListener('popstate',function(event){
    if(!window.CurrentUser||!window.CurrentUser.id())return;
    restoringNavigation=true;
    try{
      // Close editor overlays through their cleanup handlers before restoring a page.
      var overlays=document.querySelectorAll('.overlay');
      if(overlays.length)overlays[overlays.length-1].dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
      var nextView=routeView();
      if(nextView!=='scanner'&&scannerCleanup){var cleanup=scannerCleanup;scannerCleanup=null;cleanup();}
      currentView=nextView;renderCurrentView();
      window.scrollTo({top:event.state&&event.state.scrollY||0,behavior:'instant'});
    }finally{restoringNavigation=false;}
  });
  function renderCurrentView() {
    if(!hasDOM())return;
    if(!root)root=document.getElementById('root');
    var active=document.activeElement;
    var focusKey=active&&root&&root.contains(active)&&active.getAttribute('data-focus-key');
    var selection=focusKey==='inventory-search'?[active.selectionStart,active.selectionEnd]:null;
    if(currentView==='shopping')renderShopping();else if(currentView==='expenses')openMonthly();else if(currentView==='settings')openSettings();else if(currentView==='scanner'){if(!document.querySelector('.scanner-page'))openScanner();}else renderMain();
    if(focusKey){
      var target=Array.prototype.find.call(root.querySelectorAll('[data-focus-key]'),function(node){return node.getAttribute('data-focus-key')===focusKey;});
      if(target){target.focus({preventScroll:true});if(selection)target.setSelectionRange(selection[0],selection[1]);}
      else {var search=root.querySelector('.inventory-search');if(search)search.focus({preventScroll:true});}
    }
  }

  // One render path keeps room counts, filters, planned totals and stock
  // statuses consistent after local edits and incoming device updates.
  function refreshAfterMutation() { renderCurrentView(); }

  function openShopping() { pageAddress('shopping');currentView='shopping';renderShopping();window.scrollTo({top:0,behavior:'auto'}); }

  function renderShopping() {
    if(!hasDOM())return;
    if(!root)root=document.getElementById('root');
    pageAddress('shopping');currentView='shopping';prepareWorkspace();
    var page=h('main',{class:'kitchen-workspace shopping-workspace',id:'main-content',tabindex:'-1'});
    page.appendChild(h('header',{class:'kitchen-header'},h('div',{},
      h('h1',{text:'הקנייה הבאה'}),h('p',{class:'kitchen-subtitle',text:'מסמנים מה נקנה. המלאי וההוצאות מתעדכנים יחד.'}))));
    var estimate=Home.shoppingEstimate(shoppingItems);
    var trip=h('section',{class:'shopping-brief','aria-label':'תכנון הקנייה'},
      h('div',{},h('span',{class:'brief-label',text:'סכום משוער'}),h('strong',{dir:'auto',text:formatMoney(estimate.totalAgorot)})),
      h('p',{text:estimate.unknown?estimate.unknown+' מוצרים ללא מחיר. הסכום חלקי.':estimate.count?'לפי הכמויות והמחירים ברשימה.':'הוסיפו מוצרים כדי לתכנן את הקנייה.'}),
      h('span',{class:'trip-count',text:productCount(estimate.count)+' לקנייה'}));
    page.appendChild(trip);
    var list=h('div',{class:'shopping-page'});renderShoppingList(list,'page');page.appendChild(list);root.appendChild(page);
  }

  // ---- Rendering (main screen) ----
  // Reopener for the top-most state-preserving modal. Each such dialog sets
  // this to a closure that re-creates itself with a snapshot of its in-progress
  // state, and restores the previous value on close (so nested dialogs unwind
  // correctly). On a language change we re-run it after the base re-render so
  // the open dialog comes back translated with its state intact.
  var reopenTop = null;

  var inventoryQuery = '';
  var inventoryLocation = 'all';
  var inventorySpace = 'Kitchen';

  function uiIcon(name) {
    var paths = {
      bath: '<path d="M3 12h18v3a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5v-3Zm3 8v2m12-2v2M5 12V5a3 3 0 0 1 6 0"/><path d="M9 6h4"/>',
      house: '<path d="m3 11 9-8 9 8M5 10v11h14V10M10 21v-7h4v7"/>',
      trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6m4-6v6"/>',
      shelf: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 12h16M9 7v2m0 6v2"/>',
      bag: '<path d="M5 7h14l1 14H4L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>',
      scan: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M7 8v8m3-8v8m4-8v8m3-8v8"/>',
      calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-12 4h1m4 0h1"/>',
      settings: '<path d="m9 3-1 3-3 1 1 3-2 2 2 2-1 3 3 1 1 3h6l1-3 3-1-1-3 2-2-2-2 1-3-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/>',
      search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      cloud: '<path d="M6 18a5 5 0 0 1-1-10 7 7 0 0 1 13-1 5.5 5.5 0 0 1 0 11H6Z"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      leaf: '<path d="M20 4C7 2 2 9 6 16c7 4 14-1 14-12Z"/><path d="M4 21 16 9"/>',
      arrow: '<path d="m14 6-6 6 6 6M8 12h13"/>'
    };
    return h('span', { class: 'ui-icon', 'aria-hidden': 'true', html:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">' + (paths[name] || paths.shelf) + '</svg>' });
  }

  var pageTransition=null;
  function transitionPage(action){
    if(!document.startViewTransition||window.matchMedia('(prefers-reduced-motion: reduce)').matches){action();return;}
    if(pageTransition)pageTransition.skipTransition();
    var transition=document.startViewTransition(function(){action();});
    pageTransition=transition;
    transition.ready.catch(function(){});
    transition.finished.catch(function(){}).then(function(){if(pageTransition===transition)pageTransition=null;});
  }
  function actionButton(label, icon, cls, action) {
    return h('button', { type: 'button', class: cls, 'aria-label':label, onclick: function(event){
      if(cls.split(' ').indexOf('nav-link')>=0){
        if(event.currentTarget.getAttribute('aria-current')==='page')return;
        transitionPage(function(){action();});
      }else action(event);
    } }, uiIcon(icon), h('span', {text:label}));
  }

  function prepareWorkspace(){
    if(!root)root=document.getElementById('root');
    var nav=root.querySelector('.kitchen-nav');
    if(!nav)nav=renderNavigation();
    else{
      var views=['inventory','shopping','scanner','expenses','settings'];
      nav.querySelectorAll('.nav-link').forEach(function(button,index){
        var active=views[index]===currentView;
        button.classList.toggle('active',active);
        if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
      });
    }
    root.replaceChildren(nav);
  }
  function renderNavigation() {
    var nav = h('nav', { class: 'kitchen-nav', 'aria-label': 'ניווט ראשי' });
    nav.appendChild(h('a', {class:'brand', href:'./', 'aria-label':'הום סטוק — המלאי שלי'},
      h('span',{class:'brand-mark','aria-hidden':'true',html:window.HomeStockBrand.svg()}),
      h('span',{class:'brand-word',dir:'rtl',text:'הום סטוק'})));
    nav.appendChild(h('p',{class:'nav-caption',text:'כל הבית. במקום אחד.'}));
    nav.appendChild(h('a',{class:'skip-link',href:'#main-content',text:'דילוג לתוכן'}));
    var links = h('div', {class:'nav-links'});
    links.appendChild(actionButton('המלאי שלי','shelf','nav-link' + (currentView === 'inventory' ? ' active':''),function(){
      currentView='inventory'; inventoryLocation='all'; renderMain();window.scrollTo({top:0,behavior:'auto'});
    }));
    links.appendChild(actionButton('רשימת קניות','bag','nav-link' + (currentView === 'shopping' ? ' active':''),openShopping));
    links.appendChild(actionButton('סריקת מוצר','scan','nav-link nav-scan'+(currentView==='scanner'?' active':''),openScanner));
    links.appendChild(actionButton('הוצאות','calendar','nav-link nav-monthly'+(currentView==='expenses'?' active':''),openMonthly));
    links.appendChild(actionButton('הגדרות','settings','nav-link nav-settings'+(currentView==='settings'?' active':''),openSettings));
    nav.appendChild(links);
    var current=links.querySelector('.active');if(current)current.setAttribute('aria-current','page');
    return nav;
  }

  function filteredInventory(rows, query, location, space) {
    query = String(query || '').trim().toLocaleLowerCase('he');
    return rows.filter(function(item){
      var matchesLocation = location === 'all' || item.location === location ||
        (location === 'low' && item.quantity < (item.desiredAmount || 0));
      var name = [item.name,item.nameHe,item.nameEn].filter(Boolean).join(' ').toLocaleLowerCase('he');
      return (!space || locationSpace(item.location) === space) && matchesLocation && (!query || name.indexOf(query) !== -1);
    });
  }

  var inventoryStatus='all',inventorySort='attention';
  var inventoryFilterButtons=[],inventoryTitle=null;
  function inventorySelection(filter){return Home.select(items,{query:inventoryQuery,space:inventorySpace,location:inventoryLocation,filter:filter||inventoryStatus,sort:inventorySort});}

  function addMissingToShopping(button){
    var plan=Home.shoppingPlan(items,shoppingItems);
    if(!plan.length)return;
    button.disabled=true;
    var count=0;
    plan.reduce(function(chain,need){return chain.then(function(){
      var item=need.item;
      var rec=need.existing?Object.assign({},need.existing,{quantity:need.existing.quantity+need.quantity}):{
        name:item.name,nameHe:item.nameHe,nameEn:item.nameEn,quantity:need.quantity,unit:item.unit,
        categoryId:item.categoryId,unitPriceAgorot:item.unitPriceAgorot,note:item.note,purchased:false};
      return window.PantryDB.putShopping(rec).then(function(saved){upsertLocalShopping(saved);count++;});
    });},Promise.resolve()).then(function(){renderCurrentView();showToast(count+' מוצרים נוספו לרשימת הקניות');})
      .catch(function(){renderCurrentView();showToast('חלק מהמוצרים לא נשמרו. נסו שוב; מוצרים שכבר נוספו לא יתווספו פעמיים.');});
  }

  function renderInventoryShelf(container) {
    container.innerHTML='';cardRefs={};
    var filtered=inventorySelection();
    inventoryFilterButtons.forEach(function(entry){
      var count=inventorySelection(entry.id).length;
      entry.button.setAttribute('aria-pressed',String(inventoryStatus===entry.id));
      entry.button.classList.toggle('active',inventoryStatus===entry.id);
      entry.count.textContent=String(count);
    });
    var room=SPACES.find(function(space){return space.id===inventorySpace;});
    if(inventoryTitle)inventoryTitle.textContent=inventoryQuery?'תוצאות בכל הבית':room.label;
    container.appendChild(h('p',{class:'inventory-caption sr-only',role:'status',text:productCount(filtered.length)+' בתצוגה'}));
    if(!filtered.length){
      var isEmpty=!items.some(function(item){return Home.space(item)===inventorySpace;})&&!inventoryQuery;
      var title=inventoryQuery?'לא מצאנו התאמה.':isEmpty?'מה יש ב'+(inventorySpace==='Kitchen'?'מטבח':inventorySpace==='Bathroom'?'חדר הרחצה':'אזור הכללי')+'?':inventoryStatus==='attention'?'לא חסר כאן דבר.':inventoryStatus==='out'?'יש מהכול.':'לא מצאנו התאמה.';
      container.appendChild(h('section',{class:'kitchen-empty'},
        h('div',{class:'empty-room-symbol','aria-hidden':'true'},uiIcon(isEmpty?room.icon:'check')),
        h('h2',{text:title}),h('p',{text:isEmpty?'מתחילים במה שכבר נמצא בבית. מוסיפים מוצר, כמות ומחיר, והכול מקבל מקום.':inventoryQuery?'נסו שם אחר. החיפוש כולל מוצרים מכל אזורי הבית.':'אפשר לחזור לכל המוצרים או לבחור אזור אחר.'}),
        isEmpty?(!items.length?actionButton('הוספת מוצר ראשון','plus','kitchen-button primary',function(){openForm(null);}):null):
          actionButton('הצגת כל המוצרים','shelf','kitchen-button secondary',function(){inventoryStatus='all';inventoryQuery='';inventoryLocation='all';renderMain();})));
      return;
    }
    LOCATIONS.forEach(function(loc){
      var rows=filtered.filter(function(item){return item.location===loc.id;});if(!rows.length)return;
      var roomLabel=SPACES.find(function(space){return space.id===loc.space;}).label;
      var heading=inventoryQuery?roomLabel+' / '+t('locations.'+loc.id):t('locations.'+loc.id);
      var section=h('section',{class:'storage-shelf storage-'+loc.id.toLowerCase(),'aria-label':heading},
        h('div',{class:'shelf-heading'},h('span',{class:'shelf-symbol','aria-hidden':'true',text:loc.emoji}),h('h3',{text:heading}),h('span',{class:'shelf-count',text:productCount(rows.length)})));
      var list=h('div',{class:'shelf-items'});
      rows.forEach(function(item){var card=renderCard(item);cardRefs[item.id]=card;list.appendChild(card);});
      section.appendChild(list);container.appendChild(section);
    });
  }

  function renderMain() {
    if(!hasDOM())return;if(!root)root=document.getElementById('root');
    pageAddress('inventory');currentView='inventory';shoppingListEl=null;shoppingListMode=null;
    prepareWorkspace();
    var summary=Home.summary(items),month=window.PantryDB.getMonthlyLog()[ym()]||{};
    var workspace=h('main',{class:'kitchen-workspace',id:'main-content',tabindex:'-1'});
    workspace.appendChild(h('header',{class:'kitchen-header'},h('div',{},
      h('p',{class:'today-label',text:new Intl.DateTimeFormat('he-IL',{weekday:'long',day:'numeric',month:'long'}).format(new Date())}),
      h('div',{class:'home-heading'},h('span',{class:'mobile-home-mark','aria-hidden':'true',html:window.HomeStockBrand.svg()}),h('h1',{text:'בית'})),h('p',{class:'kitchen-subtitle',text:items.length?productCount(summary.total)+' בבית. '+(summary.attention?summary.attention+' צריכים השלמה.':'יש מהכול.'): 'מהמטבח ועד ארון הניקיון. יודעים מה יש ומה חסר.'})),
      items.length?actionButton('הוספת מוצר','plus','kitchen-button primary header-add',function(){openForm(null);}):null));
    var expiring=items.filter(function(item){var status=Home.expiry(item);return item.quantity>0&&status&&status.urgent;});
    if(expiring.length)workspace.appendChild(h('div',{class:'expiry-notice',role:'status'},
      h('strong',{text:'כדאי לבדוק את התוקף'}),
      h('p',{text:expiring.map(function(item){return itemName(item)+' — '+Home.expiry(item).label;}).join(' · ')})));
    var rooms=h('div',{class:'space-tabs','aria-label':'בית — מטבח, חדר רחצה וכללי'});
    SPACES.forEach(function(space){
      var stat=summary.rooms[space.id],selected=inventorySpace===space.id&&!inventoryQuery;
      rooms.appendChild(h('button',{type:'button',class:'space-tab room-'+space.id.toLowerCase()+(selected?' active':''),'aria-pressed':String(selected),onclick:function(){
        inventorySpace=space.id;inventoryLocation='all';inventoryQuery='';inventoryStatus='all';renderMain();
      }},h('span',{class:'room-symbol','aria-hidden':'true'},uiIcon(space.icon)),
        h('span',{class:'space-tab-name',text:space.label}),h('span',{class:'space-tab-count',text:productCount(stat.total)}),
        h('span',{class:'room-status'+(stat.attention?' needs':' ready'),text:stat.attention?stat.attention+' להשלמה':stat.total?'הכול במקום':'עדיין ריק'})));
    });workspace.appendChild(rooms);
    if(!items.length){inventoryFilterButtons=[];inventoryTitle=null;var initial=h('div',{class:'inventory-shelves'});renderInventoryShelf(initial);workspace.appendChild(initial);root.appendChild(workspace);return;}
    var strip=h('div',{class:'house-brief'});
    var plan=Home.shoppingPlan(items,shoppingItems);
    strip.appendChild(h('div',{class:'shopping-nudge'+(plan.length?' has-needs':'')},uiIcon('bag'),h('div',{},
      h('strong',{text:plan.length?'משלימים את מה שחסר':activeShopping().length?'הרשימה לקנייה הבאה מוכנה':'קונים רק מה שצריך'}),
      h('span',{text:plan.length?productCount(plan.length)+' עוד לא מכוסים ברשימת הקניות':activeShopping().length?productCount(activeShopping().length)+' ברשימה':'הרשימה ריקה כרגע'})),
      plan.length?actionButton('הוספת '+plan.length+' חוסרים לרשימה','plus','kitchen-button secondary',function(e){addMissingToShopping(e.currentTarget);}):null));
    strip.appendChild(h('div',{class:'month-glance'},h('span',{text:'נרשם החודש'}),h('strong',{dir:'auto',text:formatMoney(expenseTotal(month.expenses||[]))})));
    workspace.appendChild(strip);
    var content=h('section',{class:'inventory-workbench','aria-label':'מוצרים בבית'}),shelf=h('div',{class:'inventory-shelves'});
    var search=h('input',{type:'search',name:'inventory-search',autocomplete:'off',class:'inventory-search',placeholder:'חיפוש בכל הבית…','aria-label':'חיפוש בכל הבית',value:inventoryQuery,'data-focus-key':'inventory-search',
      oninput:function(e){inventoryQuery=e.target.value;tabs.hidden=!!inventoryQuery;renderInventoryShelf(shelf);Array.prototype.forEach.call(rooms.children,function(button){button.classList.toggle('active',!inventoryQuery&&button.textContent.indexOf(SPACES.find(function(space){return space.id===inventorySpace;}).label)>=0);button.setAttribute('aria-pressed',String(button.classList.contains('active')));});},
      onkeydown:function(e){if(e.key==='Escape'){e.preventDefault();inventoryQuery='';search.value='';renderCurrentView();}}});
    var locations=LOCATIONS.filter(function(loc){return loc.space===inventorySpace;});
    var tabs=h('div',{class:'storage-tabs','aria-label':'מקום אחסון'});
    if(locations.length>1)[{id:'all',label:'כל המקומות'}].concat(locations.map(function(loc){return {id:loc.id,label:t('locations.'+loc.id)};})).forEach(function(loc){
      tabs.appendChild(h('button',{type:'button',class:'storage-tab'+(inventoryLocation===loc.id?' active':''),'aria-pressed':String(inventoryLocation===loc.id),onclick:function(){inventoryLocation=loc.id;inventoryQuery='';renderMain();}},loc.label));
    });
    tabs.hidden=!!inventoryQuery;
    content.appendChild(h('div',{class:'inventory-toolbar'},h('label',{class:'inventory-search-wrap'},uiIcon('search'),search,h('kbd',{class:'search-key',text:'/'})),tabs));
    inventoryTitle=h('h2',{class:'inventory-section-title'});
    var filters=h('div',{class:'status-filters','aria-label':'מצב המלאי'});inventoryFilterButtons=[];
    [{id:'all',label:'הכול'},{id:'attention',label:'להשלמה'},{id:'out',label:'אזל'}].forEach(function(filter){
      var count=h('span',{class:'filter-count'}),button=h('button',{type:'button',class:'status-filter','data-focus-key':'filter-'+filter.id,onclick:function(){inventoryStatus=filter.id;renderInventoryShelf(shelf);}},filter.label,count);
      filters.appendChild(button);inventoryFilterButtons.push({id:filter.id,button:button,count:count});
    });
    var sort=window.HomeDropdown.create({label:'מיון מוצרים',value:inventorySort,options:[{value:'attention',label:'החסרים קודם'},{value:'name',label:'לפי שם'},{value:'recent',label:'עודכנו לאחרונה'}],onChange:function(value){inventorySort=value;renderInventoryShelf(shelf);}});
    content.appendChild(h('div',{class:'inventory-section-head'},inventoryTitle,sort.element));
    content.appendChild(filters);renderInventoryShelf(shelf);content.appendChild(shelf);workspace.appendChild(content);root.appendChild(workspace);
  }

  function itemById(id) {
    for (var i = 0; i < items.length; i++) if (items[i].id === id) return items[i];
    return null;
  }

  function renderCard(item) {
    var stock=Home.state(item),unit=t('units.'+item.unit);
    var stepper=h('div',{class:'stepper','aria-label':'כמות '+itemName(item)},
      h('button',{type:'button',class:'step-btn',disabled:item.quantity<=0?'disabled':null,'aria-label':'הפחתת '+itemName(item),'data-focus-key':'minus-'+item.id,onclick:function(){changeQty(item,-1);}},'−'),
      h('div',{class:'step-value'},h('span',{class:'qty',text:formatQty(item.quantity)}),h('span',{class:'qty-unit',text:unit})),
      h('button',{type:'button',class:'step-btn primary','aria-label':'הוספת '+itemName(item),'data-focus-key':'plus-'+item.id,onclick:function(){changeQty(item,1);}},'+'));
    var label=stock==='out'?'אזל מהמלאי':stock==='low'?'נותרו '+formatQty(item.quantity)+' מתוך '+formatQty(item.desiredAmount):item.desiredAmount>0?'יעד בבית: '+formatQty(item.desiredAmount):t('categories.'+item.categoryId);
    return h('article',{class:'card stock-'+stock},
      h('button',{type:'button',class:'item-open','aria-label':'עריכת '+itemName(item),'data-focus-key':'edit-'+item.id,onclick:function(){openForm(item);}},
        itemThumb(item),h('span',{class:'card-info'},h('span',{class:'card-name',dir:'auto',text:itemName(item)}),
          h('span',{class:'card-meta'},h('span',{class:'stock-label',text:label}),
            item.noExpiry?h('span',{class:'expiry-label',text:'ללא תאריך תפוגה'}):item.expiryDate?h('span',{class:'expiry-label'+(Home.expiry(item)&&Home.expiry(item).urgent?' expiry-urgent':''),text:Home.expiry(item)?Home.expiry(item).label:''}):null,
            Number.isSafeInteger(item.unitPriceAgorot)?h('span',{class:'item-price',text:formatMoney(item.unitPriceAgorot)+' / '+unit}):null))),stepper);
  }

  // ---- Actions ----
  var quantityQueues=Object.create(null);
  function changeQty(item,delta) {
    var id=item.id;
    var operation=(quantityQueues[id]||Promise.resolve()).then(function(){
      // Read the committed record per queued tap. Rapid taps cannot race each
      // other, overwrite a fresher object, or count a failed write as a purchase.
      return window.PantryDB.getItem(id).then(function(live){
        if(!live)return;
        var next=Math.max(0,live.quantity+delta),real=next-live.quantity;if(!real)return;
        var updated=Object.assign({},live,{quantity:next});
        return window.PantryDB.put(updated).then(function(saved){
          Object.assign(item,saved);var current=itemById(id);if(current)Object.assign(current,saved);
          recordDelta(real);if(real>0)recordExpense(saved,real);recomputeShortfall();refreshAfterMutation();return saved;
        });
      });
    }).catch(function(){showToast('הכמות לא השתנתה. לא ניתן לשמור כרגע; נסו שוב.');refreshAfterMutation();});
    quantityQueues[id]=operation;
    operation.then(function(){if(quantityQueues[id]===operation)delete quantityQueues[id];});
    return operation;
  }

  function refresh() {
    return load().then(function () {
      recomputeShortfall();
      renderCurrentView();
    });
  }

  function parseStockQuantity(value) {
    var text=String(value == null ? '' : value).trim().replace(',','.');
    if(!/^\d+(?:\.\d+)?$/.test(text)) throw new Error('invalid quantity');
    var quantity=Number(text);
    if(!Number.isFinite(quantity) || quantity>Number.MAX_SAFE_INTEGER) throw new Error('invalid quantity');
    return quantity;
  }

  // A product passport: identity first, stock and place next, optional details
  // last. Only the body scrolls; the consequence of Save stays in view.
  var editorCounter=0;
  function openForm(existing, opts) {
    opts=opts||{};
    var prefill=opts.prefill||{};
    var editing=!!existing;
    var previousFocus=document.activeElement;
    var originalQuantity=editing?existing.quantity:0;
    var state=opts.stateOverride||{
      name:editing?itemName(existing):prefill.name||'',
      nameEn:editing?existing.nameEn:prefill.nameEn,
      nameHe:editing?existing.nameHe:prefill.nameHe,
      quantity:editing?existing.quantity:prefill.quantity!=null?prefill.quantity:1,
      unit:editing?existing.unit:prefill.unit||'pcs',
      unitPriceAgorot:editing?existing.unitPriceAgorot:prefill.unitPriceAgorot,
      categoryId:editing?existing.categoryId:prefill.categoryId||'other',
      location:editing?existing.location:prefill.location||defaultInventoryLocation(),
      note:editing?existing.note||'':'',
      desiredAmount:editing?existing.desiredAmount||0:0,
      expiryDate:editing?existing.expiryDate||'':prefill.expiryDate||'',noExpiry:editing?!!existing.noExpiry:false,
      barcode:editing?existing.barcode:prefill.barcode,
      emoji:editing?existing.emoji:prefill.emoji,
      imageFull:editing?fullImageFor(existing):prefill.imageFull||prefill.image||null,
      imageThumb:editing?thumbImageFor(existing):prefill.imageThumb||prefill.image||null
    };
    var voiceRecognition=null;
    var saving=false, closed=false, suggestions=[], activeIndex=-1, searchTimer;
    var titleId='product-editor-title-'+(++editorCounter);
    var overlay=h('div',{class:'overlay editor-overlay'});
    var sheet=h('div',{class:'sheet product-editor',role:'dialog','aria-modal':'true','aria-labelledby':titleId});
    var body=h('div',{class:'sheet-body product-editor-body'});
    var headerLocation=h('p',{class:'editor-breadcrumb'});
    var title=h('h2',{class:'sheet-title',id:titleId,tabindex:'-1',text:editing?'עריכת מוצר':'מוצר חדש בבית'});
    var closeButton=h('button',{class:'sheet-close',type:'button','aria-label':'סגירה',onclick:function(){close();}},'✕');
    sheet.appendChild(h('div',{class:'grabber'}));
    sheet.appendChild(h('div',{class:'sheet-header editor-header'},h('div',{},title,headerLocation),closeButton));

    var prevReopen=reopenTop;
    var myReopen=function(){
      var snapshot=Object.assign({},state,{name:nameInput.value,note:noteInput.value,priceDraft:price.input.value,targetDraft:targetInput.value});
      close(true);
      openForm(existing,{prefill:prefill,stateOverride:snapshot});
    };
    reopenTop=myReopen;
    function close(force) {
      if(closed || (saving && force!==true))return;
      closed=true;
      if(voiceRecognition)voiceRecognition.abort();
      clearTimeout(searchTimer);
      window.removeEventListener('resize',fitEditorViewport);
      if(window.visualViewport){window.visualViewport.removeEventListener('resize',fitEditorViewport);window.visualViewport.removeEventListener('scroll',fitEditorViewport);}
      if(unitChoice)unitChoice.destroy();
      if(categoryChoice)categoryChoice.destroy();
      overlay.remove();
      if(reopenTop===myReopen)reopenTop=prevReopen;
      if(previousFocus && previousFocus.isConnected)previousFocus.focus({preventScroll:true});
    }
    overlay.addEventListener('click',function(event){if(event.target===overlay)close();});
    overlay.addEventListener('keydown',function(event){
      if(event.key==='Escape'){event.preventDefault();close();return;}
      if(event.key!=='Tab')return;
      var focusable=Array.prototype.slice.call(sheet.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]')).filter(function(el){return el.getClientRects().length>0;});
      if(!focusable.length)return;
      var first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey && (document.activeElement===first || document.activeElement===title)){event.preventDefault();last.focus();}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
    });

    var photo=photoControl(state);
    var nameInput=h('input',{class:'input editor-name',type:'text',dir:'auto',value:state.name,'aria-label':'שם המוצר',placeholder:'מה מוסיפים לבית?',autocomplete:'off'});
    var acBox=h('div',{class:'ac-box editor-suggestions',role:'listbox','aria-label':'הצעות למוצר',id:titleId+'-suggestions',style:'display:none'});
    nameInput.setAttribute('aria-controls',acBox.id);
    nameInput.setAttribute('aria-autocomplete','list');
    nameInput.setAttribute('role','combobox');
    nameInput.setAttribute('aria-expanded','false');
    var categoryChoice=window.HomeDropdown.create({label:'קטגוריה',value:state.categoryId,
      options:CATEGORIES.map(function(cat){return{value:cat.id,label:cat.emoji+' '+t('categories.'+cat.id)};}),
      onChange:function(value){state.categoryId=value;state.emoji=null;photo.render();}
    });
    var identity=h('section',{class:'product-identity','aria-label':'פרטי המוצר'},
      h('div',{class:'editor-photo'},photo.row,photo.input),
      h('div',{class:'editor-identity-fields'},h('label',{class:'editor-caption'},'שם המוצר',nameInput),acBox,
        h('div',{class:'editor-category'},h('span',{class:'editor-caption',text:'קטגוריה'}),categoryChoice.element)));
    body.appendChild(identity);

    function closeSuggestions(){acBox.style.display='none';acBox.innerHTML='';nameInput.setAttribute('aria-expanded','false');nameInput.removeAttribute('aria-activedescendant');suggestions=[];activeIndex=-1;}
    function chooseFood(food){
      nameInput.value=foodLabel(food);state.name=nameInput.value;
      state.nameEn=food.name||null;state.nameHe=food.he||null;state.emoji=food.emoji||null;
      if(food.category){state.categoryId=food.category;categoryChoice.value=food.category;}
      if(food.unit && UNITS.indexOf(food.unit)!==-1){state.unit=food.unit;unitChoice.value=food.unit;}
      photo.render();closeSuggestions();updateSummary();
    }
    function highlightSuggestion(){
      Array.prototype.forEach.call(acBox.children,function(row,index){row.classList.toggle('active',index===activeIndex);row.setAttribute('aria-selected',String(index===activeIndex));});
      if(activeIndex>=0)nameInput.setAttribute('aria-activedescendant',titleId+'-food-'+activeIndex);
    }
    function showSuggestions(){
      if(closed)return;
      suggestions=foodSearch(nameInput.value.trim());activeIndex=-1;acBox.innerHTML='';
      if(!nameInput.value.trim() || !suggestions.length){closeSuggestions();return;}
      suggestions.forEach(function(food,index){
        acBox.appendChild(h('div',{class:'ac-item',role:'option',id:titleId+'-food-'+index,'aria-selected':'false',
          onpointerdown:function(event){if(event.pointerType!=='touch')event.preventDefault();},
          onclick:function(){chooseFood(food);nameInput.focus();}},
          h('span',{class:'ac-emoji',text:food.emoji}),h('span',{class:'ac-name',text:foodLabel(food)})));
      });
      acBox.style.display='block';nameInput.setAttribute('aria-expanded','true');
    }
    nameInput.addEventListener('input',function(){
      state.name=nameInput.value;state.nameEn=null;state.nameHe=null;state.emoji=null;
      nameInput.removeAttribute('aria-invalid');if(footerError)footerError.textContent='';clearTimeout(searchTimer);searchTimer=setTimeout(showSuggestions,100);
    });
    nameInput.addEventListener('blur',function(){clearTimeout(searchTimer);searchTimer=setTimeout(closeSuggestions,170);});
    nameInput.addEventListener('keydown',function(event){
      if(acBox.style.display==='none')return;
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeSuggestions();}
      else if(event.key==='ArrowDown'||event.key==='ArrowUp'){
        event.preventDefault();activeIndex=(activeIndex+(event.key==='ArrowDown'?1:-1)+suggestions.length)%suggestions.length;highlightSuggestion();
      } else if(event.key==='Enter'&&activeIndex>=0){event.preventDefault();chooseFood(suggestions[activeIndex]);}
    });

    var quantityInput=h('input',{class:'editor-quantity-input',type:'text',inputmode:'decimal',dir:'ltr',value:formatQty(state.quantity),'aria-label':'כמות במלאי'});
    var minus=h('button',{class:'step-btn',type:'button','aria-label':'הפחתת הכמות',onclick:function(){
      state.quantity=Math.max(0,state.quantity-1);quantityInput.value=formatQty(state.quantity);quantityInput.removeAttribute('aria-invalid');updateSummary();
    }},'−');
    var plus=h('button',{class:'step-btn primary',type:'button','aria-label':'הגדלת הכמות',onclick:function(){
      state.quantity=state.quantity+1;quantityInput.value=formatQty(state.quantity);quantityInput.removeAttribute('aria-invalid');updateSummary();
    }},'+');
    var unitChoice=window.HomeDropdown.create({label:'יחידת מידה',value:state.unit,
      options:UNITS.map(function(unit){return{value:unit,label:t('units.'+unit)};}),
      onChange:function(value){state.unit=value;updateSummary();}
    });
    quantityInput.addEventListener('input',function(){
      try{state.quantity=parseStockQuantity(quantityInput.value);quantityInput.removeAttribute('aria-invalid');}
      catch(e){quantityInput.setAttribute('aria-invalid','true');}
      updateSummary();
    });
    var stock=h('section',{class:'editor-section editor-stock','aria-label':'כמות ומחיר'},
      h('h3',{class:'editor-section-title',text:'כמה יש בבית?'}),
      h('div',{class:'editor-stock-controls'},h('div',{class:'stepper editor-quantity'},minus,quantityInput,plus),
        h('div',{class:'editor-unit'},unitChoice.element)));
    var price=priceField(state.unitPriceAgorot,function(){return Math.max(0,state.quantity-originalQuantity);});
    if(state.priceDraft!=null)price.input.value=state.priceDraft;
    stock.appendChild(price.element);
    stock.appendChild(h('p',{class:'editor-price-hint',text:'המחיר הוא ליחידת המידה שנבחרה. אין חובה להזין מחיר.'}));
    var where=h('section',{class:'editor-section editor-place','aria-label':'מיקום בבית'},
      h('h3',{class:'editor-section-title',text:'איפה המוצר נמצא?'}),
      locationPicker(function(){return state.location;},function(value){state.location=value;updateSummary();}));
    body.appendChild(h('div',{class:'editor-main-grid'},stock,where));

    var targetInput=h('input',{class:'editor-quantity-input',type:'text',inputmode:'decimal',dir:'ltr',value:state.targetDraft!=null?state.targetDraft:formatQty(state.desiredAmount),'aria-label':'כמות רצויה בבית'});
    function changeTarget(delta){
      var value;
      try{value=parseStockQuantity(targetInput.value||'0');}
      catch(error){targetInput.setAttribute('aria-invalid','true');targetInput.focus();return;}
      targetInput.value=formatQty(Math.max(0,value+delta));
      targetInput.removeAttribute('aria-invalid');
      if(footerError)footerError.textContent='';
    }
    targetInput.addEventListener('input',function(){
      try{parseStockQuantity(targetInput.value||'0');targetInput.removeAttribute('aria-invalid');}
      catch(error){targetInput.setAttribute('aria-invalid','true');}
    });
    var targetStepper=h('div',{class:'stepper editor-quantity editor-target',role:'group','aria-label':'כמות רצויה בבית'},
      h('button',{class:'step-btn',type:'button','aria-label':'הפחתת הכמות הרצויה',onclick:function(){changeTarget(-1);}},'−'),
      targetInput,
      h('button',{class:'step-btn primary',type:'button','aria-label':'הגדלת הכמות הרצויה',onclick:function(){changeTarget(1);}},'+'));
    var noteInput=h('textarea',{class:'input note',rows:'2',value:state.note,'aria-label':'הערה למוצר',placeholder:'מותג מועדף, גודל אריזה או תזכורת לקנייה הבאה'});
    // textarea values are properties, not HTML value attributes.
    noteInput.value=state.note;
    where.appendChild(h('div',{class:'editor-location-details'},
      h('div',{class:'editor-detail-field'},h('h3',{class:'editor-section-title',text:'הערה למוצר'}),noteInput)));
    var expiryInput=h('input',{class:'input',type:'date',value:state.expiryDate,'aria-label':'תאריך תפוגה',oninput:function(){state.expiryDate=this.value;}});
    var noExpiry=h('input',{type:'checkbox',checked:state.noExpiry,onchange:function(){state.noExpiry=this.checked;expiryInput.disabled=this.checked;}});
    noExpiry.checked=state.noExpiry;expiryInput.disabled=state.noExpiry;
    stock.appendChild(h('section',{class:'editor-expiry'},
      h('h3',{class:'editor-section-title',text:'תאריך תפוגה'}),expiryInput,
      h('label',{class:'expiry-none'},noExpiry,'אין תאריך תפוגה'),
      h('p',{class:'settings-help',text:'אפשר להשאיר ריק אם התאריך לא ידוע. התראה תופיע באפליקציה בשבוע שלפני התפוגה.'})));
    stock.appendChild(h('div',{class:'editor-location-details'},h('div',{class:'editor-detail-field'},h('h3',{class:'editor-section-title',text:'כמות רצויה בבית'}),targetStepper)));
    var Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
    var voiceStatus=h('p',{class:'settings-help',role:'status',text:Speech?'אפשר לומר שם, כמות, מקום ומחיר. הדיבור עשוי להישלח לשירות הזיהוי של הדפדפן.':'זיהוי דיבור אינו נתמך בדפדפן הזה. אפשר למלא את השדות ידנית.'});
    function markVoice(element){element.classList.add('voice-filled');element.addEventListener('input',function(){element.classList.remove('voice-filled');},{once:true});}
    var voiceButton=h('button',{type:'button',class:'btn ghost',disabled:!Speech,text:'מילוי בקול',onclick:function(){
      if(voiceRecognition){voiceRecognition.stop();return;}
      var recognition=new Speech();voiceRecognition=recognition;recognition.lang='he-IL';recognition.continuous=false;recognition.interimResults=false;
      recognition.onresult=function(event){
        if(closed||saving)return;
        var text=event.results[0][0].transcript,draft=window.HomeVoice.parse(text),filled=[];
        if(draft.name){nameInput.value=draft.name;state.name=draft.name;state.nameEn=null;state.nameHe=null;markVoice(nameInput);filled.push('שם');}
        if(draft.quantity!=null){state.quantity=draft.quantity;quantityInput.value=formatQty(draft.quantity);quantityInput.removeAttribute('aria-invalid');markVoice(quantityInput);filled.push('כמות');}
        if(draft.unitPriceAgorot!=null){price.input.value=String(draft.unitPriceAgorot/100);markVoice(price.input);filled.push('מחיר ליחידה');}
        if(draft.location){state.location=draft.location;var picker=where.querySelector('.location-picker');picker.replaceWith(locationPicker(function(){return state.location;},function(value){state.location=value;updateSummary();}));filled.push('מיקום');}
        if(draft.expiryDate){state.expiryDate=draft.expiryDate;state.noExpiry=false;noExpiry.checked=false;expiryInput.disabled=false;expiryInput.value=draft.expiryDate;markVoice(expiryInput);filled.push('תאריך תפוגה');}
        updateSummary();voiceStatus.textContent='נשמע: ״'+text+'״. מולאו: '+filled.join(', ')+'. בדקו ותקנו את השדות לפני השמירה.';
      };
      recognition.onerror=function(event){if(!closed)voiceStatus.textContent=event.error==='not-allowed'?'הגישה למיקרופון נחסמה. אפשר למלא ידנית.':'לא זוהה דיבור. נסו שוב או מלאו ידנית.';};
      recognition.onend=function(){if(voiceRecognition===recognition)voiceRecognition=null;if(!closed)voiceButton.textContent='מילוי בקול';};
      try{recognition.start();voiceButton.textContent='סיום ההאזנה';voiceStatus.textContent='מקשיב…';}catch(error){voiceRecognition=null;voiceStatus.textContent='לא ניתן להפעיל את המיקרופון. אפשר למלא ידנית.';}
    }});
    body.insertBefore(h('div',{class:'editor-voice'},voiceButton,voiceStatus),body.firstChild);
    sheet.appendChild(body);

    var consequence=h('div',{class:'editor-save-summary','aria-live':'polite'});
    var footerError=h('p',{class:'editor-error',role:'alert'});
    var saveButton=actionButton(editing?'שמירת שינויים':'הוספת מוצר','check','btn save editor-save',save);
    var deleteButton=editing?h('button',{class:'editor-delete',type:'button','aria-label':'מחיקת מוצר',title:'מחיקת מוצר',onclick:function(){confirmDelete(existing,function(){close(true);});}},uiIcon('trash')):null;
    sheet.appendChild(h('footer',{class:'product-editor-footer'},consequence,footerError,
      h('div',{class:'editor-actions'+(editing?' with-delete':'')},deleteButton,saveButton)));

    function updateSummary(){
      if(!price)return;
      if(footerError)footerError.textContent='';
      price.update();
      var space=SPACES.filter(function(s){return s.id===locationSpace(state.location);})[0];
      headerLocation.textContent=space.label+(state.location==='House'?'':' / '+t('locations.'+state.location));
      minus.disabled=state.quantity<=0;
      if(quantityInput.getAttribute('aria-invalid')==='true'){
        consequence.textContent='הזינו כמות תקינה מאפס ומעלה.';return;
      }
      try{
        var unitPrice=parseUnitPrice(price.input.value);
        var added=Math.max(0,state.quantity-originalQuantity);
        var amount=purchaseAmount(added,unitPrice);
        consequence.textContent=amount!==null ? 'תוספת של '+formatQty(added)+' '+t('units.'+state.unit)+' · הוצאה חדשה '+formatMoney(amount) :
          unitPrice!==null && !added ? 'שמירת הפרטים לא תיצור הוצאה חדשה.' : 'המלאי יתעדכן. לא תירשם הוצאה ללא מחיר.';
        consequence.classList.toggle('has-expense',amount!==null);
      }catch(e){consequence.textContent='בדקו את המחיר: עד שתי ספרות אחרי הנקודה.';}
    }
    price.input.addEventListener('input',updateSummary);
    updateSummary();
    function setSaving(value){
      saving=value;saveButton.disabled=value;closeButton.disabled=value;
      if(deleteButton)deleteButton.disabled=value;
      body.inert=value;
      saveButton.querySelector('span:last-child').textContent=value?'שומר…':editing?'שמירת שינויים':'הוספת מוצר';
    }
    function save(){
      if(saving)return;
      footerError.textContent='';
      var quantity,desired,unitPrice;
      if(!nameInput.value.trim()){
        nameInput.setAttribute('aria-invalid','true');nameInput.focus();consequence.textContent='';footerError.textContent='מה שם המוצר?';return;
      }
      try{quantity=parseStockQuantity(quantityInput.value);}catch(e){quantityInput.setAttribute('aria-invalid','true');quantityInput.focus();consequence.textContent='';footerError.textContent='הזינו כמות תקינה מאפס ומעלה.';return;}
      try{desired=parseStockQuantity(targetInput.value||'0');}catch(e){targetInput.setAttribute('aria-invalid','true');targetInput.focus();footerError.textContent='הזינו כמות רצויה תקינה מאפס ומעלה.';return;}
      try{unitPrice=price.read();}catch(e){consequence.textContent='';footerError.textContent='הזינו מחיר תקין עם עד שתי ספרות אחרי הנקודה.';return;}
      state.quantity=quantity;
      var name=nameInput.value.trim();
      var match=foodMatch(name);
      var names=resolveNames(name,state.nameEn,state.nameHe);
      var payload={name:name,nameEn:names.nameEn,nameHe:names.nameHe,quantity:quantity,
        unit:state.unit,unitPriceAgorot:unitPrice,categoryId:state.categoryId,
        location:state.location,note:noteInput.value.trim()||null,desiredAmount:desired,
        expiryDate:state.noExpiry?null:state.expiryDate||null,noExpiry:state.noExpiry,
        barcode:state.barcode||null,emoji:state.emoji||(match&&match.emoji)||null};
      if(payload.categoryId==='other'&&match&&match.category)payload.categoryId=match.category;
      var added=Math.max(0,quantity-originalQuantity);
      var previousHash=editing?existing.imageHash:null;
      var savedId=null;
      setSaving(true);
      var image=state.imageFull?storeImagePair({full:state.imageFull,thumb:state.imageThumb}):Promise.resolve(null);
      image.then(function(hash){
        payload.imageHash=hash;payload.image=null;
        return editing?window.PantryDB.put(Object.assign({},existing,payload)):window.PantryDB.create(payload);
      }).then(function(saved){
        savedId=saved.id;
        if(editing)Object.assign(existing,saved);
        if(added){recordDelta(added);recordExpense(saved,added);}
        if(previousHash&&previousHash!==saved.imageHash)return releaseImage(previousHash).catch(function(){});
      }).then(function(){close(true);return refresh();}).then(function(){
        var next=cardRefs[savedId]?cardRefs[savedId].querySelector('.item-open'):document.querySelector('.nav-link.active');
        if(next&&next.isConnected)next.focus({preventScroll:true});
      }).catch(function(error){
        console.error('Product save failed',error);
        if(!closed){setSaving(false);footerError.textContent='לא ניתן לשמור כרגע. הפרטים נשמרו בטופס, נסו שוב.';}
      });
    }
    function fitEditorViewport(){
      var view=window.visualViewport;
      overlay.style.height=(view?view.height:window.innerHeight)+'px';
      overlay.style.top=(view?view.offsetTop:0)+'px';
      overlay.style.bottom='auto';
    }
    window.addEventListener('resize',fitEditorViewport);
    if(window.visualViewport){window.visualViewport.addEventListener('resize',fitEditorViewport);window.visualViewport.addEventListener('scroll',fitEditorViewport);}
    fitEditorViewport();
    overlay.appendChild(sheet);document.body.appendChild(overlay);
    setTimeout(function(){if(!closed){if(!editing&&!state.name)nameInput.focus();else title.focus({preventScroll:true});}},40);
  }

  // ---- Delete confirm ----
  function confirmDelete(item, afterClose) {
    var overlay = h('div', { class: 'overlay center' });
    function close() {
      overlay.remove();
    }
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });
    var dialog = h(
      'div',
      { class: 'dialog' },
      h('h2', { class: 'dialog-title', text: t('deleteConfirm.title') }),
      h('p', {
        class: 'dialog-msg',
        text: t('deleteConfirm.message', { name: itemName(item) }),
      }),
      h(
        'div',
        { class: 'actions' },
        h(
          'button',
          { class: 'btn cancel', type: 'button', onclick: close },
          t('deleteConfirm.cancel')
        ),
        h(
          'button',
          {
            class: 'btn danger',
            type: 'button',
            onclick: function () {
              window.PantryDB.remove(item.id).then(function () {
                close();
                if (afterClose) afterClose();
                refresh();
              });
            },
          },
          t('deleteConfirm.confirm')
        )
      )
    );
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
  }

  // ---- Monthly restock view ----
  function openMonthly(opts) {
    currentView="expenses";pageAddress("expenses");
    opts = opts || {};
    var previousFocus=document.activeElement;
    recomputeShortfall();
    var log = window.PantryDB.getMonthlyLog();
    var current = ym();
    var keys = Home.expenseMonths(current,log);

    var overlay = h('div', { class: 'kitchen-workspace standalone-page',id:'main-content' });
    var content = h('div', { class: 'monthly-content' });

    function monthLabel(key) {
      var parts = key.split('-');
      var d = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
      try {
        return d.toLocaleDateString('he-IL', {
          month: 'long',
          year: 'numeric',
        });
      } catch (e) {
        return key;
      }
    }

    function renderContent(key) {
      content.innerHTML = '';
      var e = log[key] || { restocked: 0, consumed: 0, shortfall: [] };
      // For the current month, show a live shortfall.
      var shortfall = key === current ? computeShortfall() : e.shortfall || [];

      var purchases = (e.expenses || []).slice().sort(function(a,b){return String(b.at||'').localeCompare(String(a.at||''));});
      content.appendChild(h('section',{class:'expense-summary','aria-label':'הוצאות החודש'},
        h('span',{class:'expense-heading',text:'הוצאות שנרשמו החודש'}),
        h('strong',{class:'expense-total',dir:'auto',text:formatMoney(expenseTotal(purchases))}),
        h('p',{text:purchases.length === 1 ? 'קנייה אחת עם מחיר שנרשם' : purchases.length ? purchases.length+' קניות עם מחיר שנרשם' : 'עדיין אין קניות עם מחיר בחודש הזה.'})));
      if(purchases.length){
        var breakdown=Home.expensesBySpace(purchases),total=expenseTotal(purchases);
        var chart=h('section',{class:'expense-rooms','aria-label':'הוצאות לפי אזור בבית'},h('h3',{text:'לאן הכסף הלך?'}));
        SPACES.forEach(function(space){if(!breakdown[space.id])return;
          var share=total?Math.round(breakdown[space.id]/total*100):0;
          chart.appendChild(h('div',{class:'expense-room'},h('span',{},uiIcon(space.icon),space.label),
            h('div',{class:'expense-track','aria-hidden':'true'},h('i',{style:'width:'+share+'%'})),h('strong',{dir:'auto',text:formatMoney(breakdown[space.id])})));
        });content.appendChild(chart);
      }
      content.appendChild(h('p',{class:'expense-disclaimer',text:'הסכום כולל רק תוספות למלאי עם מחיר. עדכון מחיר אינו משנה קניות קודמות. ההיסטוריה נשמרת גם במכשירים המחוברים לאחר השלמת העדכון.'}));
      if(purchases.length) {
        var purchaseList=h('div',{class:'expense-list'});
        purchases.forEach(function(entry){
          purchaseList.appendChild(h('div',{class:'expense-row'},
            h('div',{},h('strong',{text:entry.name,dir:'auto'}),h('span',{text:new Date(entry.at).toLocaleDateString('he-IL')+' · '+formatQty(entry.quantity)+' '+t('units.'+entry.unit)+' × '+formatMoney(entry.unitPriceAgorot)})),
            h('strong',{class:'expense-row-amount',dir:'auto',text:formatMoney(entry.amountAgorot)}),
            h('button',{class:'expense-remove',type:'button','aria-label':'מחיקת רישום הוצאה של '+entry.name,onclick:function(){
              if(!window.confirm('למחוק את רישום ההוצאה? הכמות במלאי לא תשתנה.'))return;
              undoExpense(entry.id);log=window.PantryDB.getMonthlyLog();renderContent(key);
            }},'×')));
        });
        content.appendChild(purchaseList);
      }

      content.appendChild(
        h(
          'div',
          { class: 'stat-row' },
          h(
            'div',
            { class: 'stat' },
            h('div', { class: 'stat-num', text: formatQty(e.restocked || 0) }),
            h('div', { class: 'stat-label', text: t('monthly.restocked') })
          ),
          h(
            'div',
            { class: 'stat' },
            h('div', { class: 'stat-num', text: formatQty(e.consumed || 0) }),
            h('div', { class: 'stat-label', text: t('monthly.consumed') })
          )
        )
      );

      content.appendChild(
        h('div', { class: 'monthly-needs-title', text: t('monthly.needs') })
      );
      if (!shortfall.length) {
        content.appendChild(h('div', { class: 'monthly-empty', text: t('monthly.none') }));
      } else {
        var ul = h('div', { class: 'monthly-list' });
        shortfall.forEach(function (s) {
          // Use the live item's thumb when available, else the snapshot emoji.
          var live = itemById(s.id);
          var thumb = live
            ? itemThumb(live, 'sm')
            : h('div', { class: 'badge sm', text: s.emoji || '🍽️' });
          ul.appendChild(
            h(
              'div',
              { class: 'monthly-item' },
              h(
                'div',
                { class: 'monthly-item-main' },
                thumb,
                h('span', { class: 'monthly-item-name', dir: 'auto', text: localName(s) })
              ),
              h('span', {
                class: 'monthly-item-miss',
                text: t('restock.missing', {
                  missing: formatQty(s.missing),
                  have: formatQty(s.have),
                  target: formatQty(s.target),
                }),
              })
            )
          );
        });
        content.appendChild(ul);
      }
    }

    var select = window.HomeDropdown.create({
      label:t('monthly.month'),icon:'calendar',
      options:keys.map(function(key){return {value:key,label:monthLabel(key),description:key===current?'החודש הנוכחי':''};}),
      onChange:function(value){renderContent(value);}
    });

    var dialog = h(
      'div',
      { class: 'page-content monthly-page', role:'main','aria-label':t('monthly.title') },
      h(
        'div',
        { class: 'sheet-header' },
        h('h1', { class: 'page-title', text: t('monthly.title') })
      ),
      h('label', { class: 'field-label', text: t('monthly.month') }),
      select.element,
      content
    );
    overlay.appendChild(dialog);
    prepareWorkspace();root.appendChild(overlay);dialog.removeAttribute('aria-modal');dialog.setAttribute('role','main');
    var initial = opts.month && keys.indexOf(opts.month) !== -1 ? opts.month : current;
    select.value = initial;
    renderContent(initial);
    dialog.setAttribute('tabindex','-1');dialog.focus({preventScroll:true});
  }

  // ---- Toast ----
  function showToast(message, undoFn) {
    if (!hasDOM()) return;
    var existing = document.querySelector('.toast');
    if (existing) existing.remove();
    var toast = h('div', { class: 'toast', role:'status', 'aria-live':'polite' }, h('span', { text: message }));
    var timer;
    function dismiss() {
      clearTimeout(timer);
      toast.remove();
    }
    if (undoFn) {
      toast.appendChild(
        h(
          'button',
          {
            class: 'toast-undo',
            onclick: function () {
              dismiss();
              undoFn();
            },
          },
          t('scan.undo')
        )
      );
    }
    document.body.appendChild(toast);
    timer = setTimeout(dismiss, 6000);
  }

  // ================= Smart barcode scanner =================

  // Find an existing inventory item that already carries this barcode.
  function itemByBarcode(code) {
    code = window.HomeBarcode.key(code);
    for (var i = 0; i < items.length; i++)
      if (items[i].barcode && window.HomeBarcode.key(items[i].barcode) === code) return items[i];
    return null;
  }

  // Success feedback: short vibration + a soft WebAudio beep (no asset needed).
  var audioCtx = null;
  function scanFeedback() {
    try {
      if (navigator.vibrate) navigator.vibrate(60);
    } catch (e) {}
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioCtx) audioCtx = new AC();
      var o = audioCtx.createOscillator();
      var g = audioCtx.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      g.gain.value = 0.05;
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start();
      setTimeout(function () { try { o.stop(); } catch (e) {} }, 110);
    } catch (e) {}
  }

  // Fetch + compress a remote (Open Food Facts) image to a local data URL so it
  // works offline afterwards. Resolves null on any failure (never a broken img).
  function fetchImageLocal(url) {
    return new Promise(function(resolve){
      var controller=new AbortController(),finished=false;
      function done(image){if(finished)return;finished=true;clearTimeout(timer);resolve(image);}
      var timer=setTimeout(function(){controller.abort();done(null);},3500);
      try{
        var source=new URL(url);
        if(source.protocol!=='https:'||!/(^|\.)open(food|beauty|products|petfood)facts\.org$/.test(source.hostname)){done(null);return;}
        fetch(source.href,{signal:controller.signal,credentials:'omit'}).then(function(response){return response.ok?response.blob():null;})
          .then(function(blob){if(!blob){done(null);return;}processImage(blob,function(pair){done(pair?pair.full:null);});}).catch(function(){done(null);});
      }catch(e){done(null);}
    });
  }

  function mapPublicProduct(product,code) {
    var name=String(product.product_name_en||product.product_name||product.generic_name||'').trim();
    var he=String(product.product_name_he||'').trim(),type=product.product_type||'food';
    if(!name&&!he)return Promise.resolve(null);
    var match=foodMatch(he||name),category=deriveCategory(product.categories_tags);
    if(type==='beauty')category='care';
    else if(type==='product')category=match?match.category:'household';
    else if(match&&category==='other')category=match.category;
    var image=product.image_front_small_url||product.image_small_url||product.image_front_url;
    return (image?fetchImageLocal(image):Promise.resolve(null)).then(function(localImage){return {
      barcode:code,name:name,he:he||match&&match.he||'',productType:type,
      brand:String(product.brands||'').split(',')[0].trim(),size:String(product.quantity||'').trim(),
      categoryId:category,unit:match&&match.unit||'pcs',emoji:match&&match.emoji||null,image:localImage,source:'off'
    };});
  }

  function scanDisplayName(p) {
    return localName(p) || t('scan.unknownName');
  }

  // ---- Shared barcode lookup pipeline ----
  // THE single source of truth used by BOTH camera detection (single + session)
  // and manual barcode entry. Given a raw barcode, it resolves, in order:
  //   1) an existing inventory item carrying that barcode        -> 'inventory'
  //   2) the per-user saved barcode->product mapping / cache      -> 'cache'
  //   3) an Open Food Facts online lookup (cached on success)     -> 'off'
  //   4) otherwise a create-new-product fallback (barcode filled) -> 'new'
  //      ('offline' is a distinct new-product case with no network)
  // Never rejects; always resolves to a normalized { source, ... } descriptor.
  var sharedBarcodeLookup=null;
  function lookupBarcode(code) {
    if(!sharedBarcodeLookup)sharedBarcodeLookup=window.HomeBarcode.createLookup({
      db:window.PantryDB,items:function(){return items;},online:function(){return navigator.onLine!==false;},
      fetch:function(url,options){return fetch(url,options);},map:mapPublicProduct
    });
    return sharedBarcodeLookup(code);
  }

  // Shared UI router: turn a lookupBarcode() result into the correct dialog.
  // Identical for camera single-scan and manual entry, so both paths behave the
  // same for the same barcode. onCancel/onSaved wire the calling flow.
  function openBarcodeResult(res, code, onCancel, onSaved) {
    if (res.source === 'inventory') { openAddUnits(res.item, onCancel, onSaved); return; }
    if (res.source === 'cache') {
      openBarcodeProduct({ barcode: code, product: res.product, hint: t('scan.fromCatalog') }, onCancel, onSaved);
      return;
    }
    if (res.source === 'off') {
      openBarcodeProduct({ barcode: code, product: res.product, hint: t('scan.fromOff') }, onCancel, onSaved);
      return;
    }
    // offline / new (not found / unreachable) -> create new, barcode prefilled.
    if (res.source === 'offline') showToast(t('scan.offline'));
    else if (res.reason === 'rate-limit') showToast('המאגר עמוס כרגע. אפשר למלא פרטים ידנית ולנסות שוב בעוד דקה.');
    else if (res.reason === 'unreachable') showToast(t('scan.offUnreachable'));
    else showToast(t('scan.notFound'));
    openBarcodeProduct({ barcode: code, product: res.product, isNew: true }, onCancel, onSaved);
  }

  // ---- Manual barcode entry (type or paste) ----
  // Uses the SAME lookupBarcode + openBarcodeResult pipeline as the camera.
  function openManualBarcode(handlers) {
    handlers = handlers || {};
    var overlay = h('div', { class: 'overlay center' });
    var closed=false,looking=false;
    function close() {closed=true;overlay.remove();}
    overlay.addEventListener('click', function (e) { if (e.target === overlay) { close(); if (handlers.onCancel) handlers.onCancel(); } });

    var input = h('input', {
      class: 'input',
      type: 'text',
      inputmode: 'numeric',
      dir: 'ltr', // barcodes are always LTR digit strings, even in RTL UI
      autocomplete: 'off',
      placeholder: t('scan.manualBarcodePlaceholder'),
      'aria-label': t('scan.manualBarcodeTitle'),
    });
    var status = h('div', { class: 'scan-status', role:'status',text: '' });

    function submit() {
      if(looking||closed)return;
      var code = window.HomeBarcode.normalize(input.value);
      if (!code) { input.classList.add('error'); input.focus(); return; }
      looking=true;submitButton.disabled=true;
      status.textContent = t('scan.looking');
      lookupBarcode(code).then(function (res) {
        if(closed)return;
        close();
        openBarcodeResult(res, code, handlers.onCancel, handlers.onSaved);
      });
    }
    input.addEventListener('input', function () { input.classList.remove('error'); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submit(); } });

    var submitButton=h('button',{class:'btn save',type:'button',onclick:submit},t('scan.manualBarcodeSubmit'));
    var dialog = h(
      'div',
      { class: 'dialog',role:'dialog','aria-modal':'true','aria-label':t('scan.manualBarcodeTitle') },
      h('div', { class: 'sheet-header' },
        h('h2', { class: 'dialog-title', text: t('scan.manualBarcodeTitle') }),
        h('button', { class: 'sheet-close', 'aria-label': t('a11y.close'), onclick: function () { close(); if (handlers.onCancel) handlers.onCancel(); } }, '✕')
      ),
      h('label', { class: 'field-label', text: t('scan.manualBarcodeLabel') }),
      input,
      status,
      h('div', { class: 'actions' },
        h('button', { class: 'btn cancel', type: 'button', onclick: function () { close(); if (handlers.onCancel) handlers.onCancel(); } }, t('form.cancel')),
        submitButton
      )
    );
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    setTimeout(function () { input.focus(); }, 50);
  }

  function openScanner() {
    if(scannerCleanup){var cleanup=scannerCleanup;scannerCleanup=null;cleanup();}
    currentView='scanner';pageAddress('scanner');
    if(!root)root=document.getElementById('root');
    prepareWorkspace();
    var scannerPage=h('main',{class:'kitchen-workspace scanner-page',id:'main-content'},
      h('h1',{class:'page-title',text:'סריקת מוצר'}),
      h('p',{text:'כוונו את המצלמה לברקוד, או הזינו אותו ידנית.'}));
    root.appendChild(scannerPage);

    // No camera support → manual barcode entry (no need to load ZXing).
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      openManualBarcode({ onSaved: function () { refresh(); } });
      return;
    }
    // Lazy-load the scanner library on first open, showing a small loading
    // indicator. If it fails (e.g. offline before it was ever cached), fall
    // back to manual entry. Debounced via loadZXing's shared promise.
    if (typeof ZXing !== 'undefined') {
      startScanner();
      return;
    }
    var aborted = false;
    var loader = h(
      'div',
      { class: 'scanner-content' },
      h(
        'div',
        { class: 'scan-loading' },
        h('div', { class: 'scan-spinner' }),
        h('div', { class: 'scan-loading-text', text: t('scan.loading') })
      )
    );
    loader.addEventListener('click', function (e) {
      if (e.target === loader) { aborted = true; loader.remove(); }
    });
    scannerPage.appendChild(loader);
    scannerCleanup=function(){aborted=true;loader.remove();};
    loadZXing()
      .then(function () {
        if (loader.parentNode) loader.remove();
        if (!aborted) startScanner();
      })
      .catch(function () {
        if (loader.parentNode) loader.remove();
        if (aborted) return;
        showToast(t('scan.loadError'));
        openManualBarcode({ onSaved: function () { refresh(); } });
      });
  }

  // Builds and runs the camera scanner UI. Assumes ZXing is loaded.
  function startScanner() {
    var continuous = false;
    var session = []; // grouped entries: {barcode,name,he,image,emoji,categoryId,unit,count,itemId,source}
    var byKey = {};
    var busy = false; // gate reads while a single-scan dialog is open
    var lastCode = null;
    var lastTime = 0;
    var closed = false;

    // Restrict to the 1D retail product symbologies (much more robust than
    // "try every format") and enable TRY_HARDER so slightly rotated / lower
    // quality codes still decode. This is the key fix for real EAN-13 codes
    // like 7290116537351 that failed under the default (all-format, no
    // try-harder, 2 fps) configuration.
    var SCAN_FORMATS = [
      ZXing.BarcodeFormat.EAN_13,
      ZXing.BarcodeFormat.UPC_A,
      ZXing.BarcodeFormat.UPC_E,
      ZXing.BarcodeFormat.EAN_8,
    ];
    var hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, SCAN_FORMATS);
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
    // 2nd arg = ms between decode attempts. 80ms ≈ 12 attempts/sec (was 500 =
    // 2/sec), so a code in view is found far faster.
    var reader = new ZXing.MultiFormatReader();
    var captureCanvas=document.createElement('canvas'),captureContext;
    try{captureContext=captureCanvas.getContext('2d',{willReadFrequently:true});}catch(e){captureContext=captureCanvas.getContext('2d');}
    var controls = null;

    // Dev-only debug telemetry (see maybeAttachDebug). Cheap counters kept
    // regardless; the panel is only rendered when the debug flag is on.
    var dbg = { attempts: 0, lastAttempts: 0, fps: 0, lastCode: '-', w: 0, h: 0,
      running: false, format: '-', lastError: '-' };
    var dbgTimer = null;
    var dbgEls = null;

    // Own resilient decode loop state (see startLoop). We drive decoding
    // ourselves rather than relying on ZXing's decodeContinuously, whose loop
    // permanently STOPS on any non-decoding throw (e.g. decoding a not-yet-sized
    // video frame) — the root cause of "camera works but zero detections".
    var stream = null;
    var loopTimer = null;
    var startedAt = 0;
    var tipsShown = false;
    var TIP_MS = 6000; // show guidance if nothing found after ~6s (keep scanning)

    var overlay = h('div', { class: 'scanner-content' });
    var video = h('video', { class: 'scan-video' });
    video.muted=true;video.autoplay=true;video.playsInline=true;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('muted', 'true');
    video.setAttribute('autoplay', 'true');
    var codeBadge = h('div', { class: 'scan-code', dir: 'ltr' });
    var frame = h('div', { class: 'scan-frame' }, video, h('div', { class: 'scan-reticle' }), codeBadge);
    var status = h('div', { class: 'scan-status', text: t('scan.point') });

    // Guidance shown on the detection timeout (hidden until then). The camera
    // keeps decoding in the background while these tips are visible.
    var tips = h(
      'div',
      { class: 'scan-tips', style: 'display:none' },
      h('div', { class: 'scan-tips-title', text: t('scan.tipsTitle') }),
      h(
        'ul',
        { class: 'scan-tips-list' },
        h('li', { text: t('scan.tipCloser') }),
        h('li', { text: t('scan.tipLight') }),
        h('li', { text: t('scan.tipSteady') }),
        h('li', { text: t('scan.tipRotate') }),
        h('li', { text: t('scan.tipManual') })
      )
    );
    function showTips() { tipsShown = true; tips.style.display = 'block'; }
    function hideTips() { tipsShown = false; tips.style.display = 'none'; }

    var toggleInput = h('input', { type: 'checkbox', class: 'scan-toggle-input' });
    toggleInput.addEventListener('change', function () {
      continuous = toggleInput.checked;
      renderSession();
    });
    var toggle = h(
      'label',
      { class: 'scan-toggle' },
      toggleInput,
      h('span', { class: 'scan-switch' }),
      h('span', { class: 'scan-toggle-label', text: t('scan.continuous') })
    );

    var sessionBox = h('div', { class: 'scan-session' });
    var addAllBtn = h(
      'button',
      { class: 'btn save', type: 'button', onclick: commitSession },
      t('scan.addAll', { count: 0 })
    );
    // Secondary action: type/paste a barcode. Pauses the live camera decode
    // while the dialog is open, then runs the SAME shared lookup pipeline.
    var manualBtn = h(
      'button',
      {
        class: 'btn cancel',
        type: 'button',
        onclick: function () {
          pauseLoop();
          openManualBarcode({ onCancel: resume, onSaved: closeSaved });
        },
      },
      t('scan.manualBarcode')
    );
    var panel = h(
      'div',
      { class: 'scan-panel' },
      frame,
      toggle,
      status,
      tips,
      sessionBox,
      h('div', { class: 'actions' }, manualBtn)
    );
    overlay.appendChild(panel);
    var page=document.querySelector('.scanner-page');
    if(!page)return;
    page.appendChild(overlay);
    scannerCleanup=close;

    // Pause decoding but KEEP the live stream (instant resume for the
    // single-scan result / manual dialogs). No camera re-acquisition needed.
    function pauseLoop() {
      dbg.running = false;
      if (loopTimer) { clearTimeout(loopTimer); loopTimer = null; }
    }
    // Full teardown: stop decoding, release the ZXing capture canvas, and stop
    // the camera tracks. Called on close.
    function stop() {
      pauseLoop();
      try { if (controls && controls.stop) controls.stop(); } catch (e) {}
      try { if (reader.reset) reader.reset(); } catch (e) {}
      try {
        if (stream && stream.getTracks) stream.getTracks().forEach(function (tr) { tr.stop(); });
      } catch (e) {}
      try { video.srcObject = null; } catch (e) {}
      stream = null;captureCanvas.width=0;captureCanvas.height=0;
    }

    // ---- Dev-only debug panel ----
    // Enabled via localStorage 'pantry.debug'==='1' or a ?debug=1 URL param.
    // Surfaces camera resolution, active decoder formats, live FPS (decode
    // attempts/sec), the last detected barcode, total attempts, and status.
    function debugOn() {
      try {
        return localStorage.getItem('pantry.debug') === '1' ||
          /[?&]debug=1/.test(location.search || '');
      } catch (e) { return false; }
    }
    function maybeAttachDebug() {
      if (!debugOn()) return;
      function row(label) {
        var val = h('span', { class: 'scan-debug-val', text: '-' });
        panel.appendChild(h('div', { class: 'scan-debug-row' },
          h('span', { class: 'scan-debug-label', text: label }), val));
        return val;
      }
      var box = h('div', { class: 'scan-debug' });
      panel.appendChild(box);
      panel.appendChild(h('div', { class: 'scan-debug-title', text: t('scan.debug.title') }));
      dbgEls = {
        camera: row(t('scan.debug.camera')),
        formats: row(t('scan.debug.formats')),
        fps: row(t('scan.debug.fps')),
        running: row(t('scan.debug.running')),
        frames: row(t('scan.debug.frames')),
        last: row(t('scan.debug.last')),
        format: row(t('scan.debug.format')),
        error: row(t('scan.debug.error')),
        status: row(t('scan.debug.status')),
      };
      dbgEls.formats.textContent = 'אירופי 13, אירופי 8, אמריקאי מלא ומקוצר';
      dbgTimer = setInterval(function () {
        dbg.fps = dbg.attempts - dbg.lastAttempts; // frames processed in the last second
        dbg.lastAttempts = dbg.attempts;
        dbgEls.camera.textContent = dbg.w && dbg.h ? dbg.w + '×' + dbg.h : '-';
        dbgEls.fps.textContent = String(dbg.fps);
        dbgEls.running.textContent = dbg.running ? t('scan.debug.yes') : t('scan.debug.no');
        dbgEls.running.classList.toggle('ok', !!dbg.running);
        dbgEls.frames.textContent = String(dbg.attempts);
        dbgEls.last.textContent = dbg.lastCode;
        dbgEls.format.textContent = {'EAN-13':'אירופי 13','EAN-8':'אירופי 8','UPC-A':'אמריקאי מלא','UPC-E':'אמריקאי מקוצר'}[dbg.format] || 'לא זוהה';
        dbgEls.error.textContent = dbg.lastError;
        dbgEls.error.classList.toggle('bad', dbg.lastError !== '-');
        dbgEls.status.textContent = (status.textContent || '').slice(0, 40);
      }, 1000);
    }
    function close() {
      if (closed) return;
      closed = true;
      if (dbgTimer) { clearInterval(dbgTimer); dbgTimer = null; }
      stop();
      overlay.remove();
    }
    function flash() {
      frame.classList.add('hit');
      setTimeout(function () { frame.classList.remove('hit'); }, 320);
    }
    function hit() { flash(); scanFeedback(); }

    // Best-effort post-start camera tuning: continuous autofocus (where the
    // device/browser exposes it) and reading back the actual resolution for the
    // debug panel. Unsupported constraints are silently ignored — never fatal.
    function applyAdvancedCamera() {
      try {
        var stream = video.srcObject;
        var track = stream && stream.getVideoTracks && stream.getVideoTracks()[0];
        if (!track) return;
        var caps = track.getCapabilities ? track.getCapabilities() : {};
        var adv = [];
        if (caps.focusMode && caps.focusMode.indexOf('continuous') !== -1)
          adv.push({ focusMode: 'continuous' });
        if (adv.length && track.applyConstraints)
          track.applyConstraints({ advanced: adv }).catch(function () {});
        var s = track.getSettings ? track.getSettings() : {};
        dbg.w = s.width || 0;
        dbg.h = s.height || 0;
      } catch (e) {}
    }

    // Map a ZXing BarcodeFormat enum value to a human label for the debug panel.
    var FORMAT_NAMES = {};
    (function () {
      var B = ZXing.BarcodeFormat;
      FORMAT_NAMES[B.EAN_13] = 'EAN-13';
      FORMAT_NAMES[B.UPC_A] = 'UPC-A';
      FORMAT_NAMES[B.UPC_E] = 'UPC-E';
      FORMAT_NAMES[B.EAN_8] = 'EAN-8';
    })();
    // NotFound/Checksum/Format => "no valid code in this frame": ignore & keep
    // looping. Anything else is a REAL error we surface (debug + never fatal).
    function isNoCode(err) {
      return err instanceof ZXing.NotFoundException ||
        err instanceof ZXing.ChecksumException ||
        err instanceof ZXing.FormatException;
    }

    // Explicitly acquire the REAR camera. We prefer facingMode:environment (the
    // proven path that already showed a rear preview) and, when the platform
    // exposes labels, refine to a back/rear/environment deviceId so multi-cam
    // devices don't grab a wide/ultrawide lens that focuses poorly on barcodes.
    function pickConstraints() {
      var base = { width: { ideal: 1280 }, height: { ideal: 720 } };
      var envConstraints = { audio: false, video: Object.assign({ facingMode: { ideal: 'environment' } }, base) };
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices)
        return Promise.resolve(envConstraints);
      return navigator.mediaDevices.enumerateDevices().then(function (devs) {
        var cams = (devs || []).filter(function (d) { return d.kind === 'videoinput'; });
        var rear = null;
        for (var i = 0; i < cams.length; i++) {
          var lbl = (cams[i].label || '').toLowerCase();
          if (/back|rear|environment|arrière|arriere|traseir|trás|tras|rück/.test(lbl)) { rear = cams[i]; break; }
        }
        if (rear && rear.deviceId)
          return { audio: false, video: Object.assign({ deviceId: { exact: rear.deviceId } }, base) };
        return envConstraints;
      }).catch(function () { return envConstraints; });
    }

    function startDecode() {
      status.classList.remove('error');
      status.textContent = t('scan.point');
      hideTips();
      pickConstraints()
        .then(function (constraints) { return navigator.mediaDevices.getUserMedia(constraints).catch(function(error){
          if(error.name!=='OverconstrainedError'&&error.name!=='NotFoundError')throw error;
          return navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'}}});
        }); })
        .then(function (s) {
          if (closed) { s.getTracks().forEach(function (tr) { tr.stop(); }); return; }
          stream = s;
          video.srcObject = s;
          video.setAttribute('playsinline', 'true');
          var p = video.play();
          if (p && p.catch) p.catch(function () {}); // autoplay policies: non-fatal
          applyAdvancedCamera();
          startLoop();
        })
        .catch(function (err) {
          if (closed) return;
          status.textContent = t('scan.'+window.HomeBarcode.cameraErrorKey(err));
          status.classList.add('error');
          dbg.lastError = 'לא ניתן לגשת למצלמה';
        });
    }

    // The heart of the fix: our OWN frame-by-frame loop. It NEVER dies on an
    // unexpected throw, only decodes once the frame is genuinely ready (guarding
    // the 0×0-canvas throw that silently killed ZXing's own loop), ignores
    // "no code" exceptions, surfaces real ones, and keeps FPS/frame counters
    // that truly reflect decoding — visible in the debug overlay.
    function startLoop() {
      dbg.running = true;
      startedAt = Date.now();
      tipsShown = false;
      var DELAY = 90; // ~11 decode attempts/sec
      function tick() {
        if (closed || !dbg.running) return;
        if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
          dbg.w = video.videoWidth;
          dbg.h = video.videoHeight;
          dbg.attempts++; // FRAMES PROCESSED
          try {
            // Capture pixels explicitly. The legacy browser wrapper did not
            // decode otherwise valid live frames in the browser regression.
            // Keep the canvas sized to the current stream and use the same
            // core decode path verified by the image and video fixtures.
            var width=Math.min(video.videoWidth,960),height=Math.max(1,Math.round(video.videoHeight*width/video.videoWidth));
            if(captureCanvas.width!==width||captureCanvas.height!==height){captureCanvas.width=width;captureCanvas.height=height;}
            captureContext.drawImage(video,0,0,width,height);
            var luminance=new ZXing.HTMLCanvasElementLuminanceSource(captureCanvas,false);
            var bitmap=new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(luminance));
            var result = reader.decode(bitmap,hints);
            if (result) {
              var text = result.getText();
              dbg.lastCode = text;
              try {
                var fmt = result.getBarcodeFormat && result.getBarcodeFormat();
                dbg.format = FORMAT_NAMES[fmt] || String(fmt);
              } catch (e) {}
              onCode(text);
            }
          } catch (err) {
            if (!isNoCode(err)) dbg.lastError = 'לא ניתן לפענח את הברקוד';
          }
        }
        // Timeout guidance: keep decoding, just reveal tips once.
        if (!tipsShown && !busy && !session.length && Date.now() - startedAt > TIP_MS) showTips();
        loopTimer = setTimeout(tick, DELAY);
      }
      tick();
    }

    // Re-arm after a single-scan / manual dialog was cancelled. Instant when the
    // stream is still live (OFF mode pauses rather than tears down); otherwise
    // re-acquires the camera.
    function resume() {
      if (closed) return;
      busy = false;
      lastCode = null;
      lastTime = 0;
      status.classList.remove('error');
      status.textContent = t('scan.point');
      codeBadge.classList.remove('show');
      hideTips();
      if (stream && stream.active !== false) {
        startLoop();
      } else {
        startDecode();
      }
    }

    function renderSession() {
      sessionBox.innerHTML = '';
      if (!continuous) {
        sessionBox.style.display = 'none';
        if (addAllBtn.parentNode) addAllBtn.parentNode.removeChild(addAllBtn);
        return;
      }
      sessionBox.style.display = 'block';
      sessionBox.appendChild(h('div', { class: 'scan-session-title', text: t('scan.sessionTitle') }));
      if (!session.length) {
        sessionBox.appendChild(h('div', { class: 'scan-session-empty', text: t('scan.sessionEmpty') }));
      } else {
        var list = h('div', { class: 'scan-session-list' });
        session.forEach(function (e) {
          list.appendChild(
            h(
              'div',
              { class: 'scan-row' },
              itemThumb(e, 'sm'),
              (e.name||e.he)?h('span', { class: 'scan-row-name', dir: 'auto', text: scanDisplayName(e) }):h('input',{class:'input scan-row-name',type:'text','aria-label':'שם המוצר עבור '+e.barcode,placeholder:'שם המוצר…',value:e.nameDraft||'',oninput:function(event){e.nameDraft=event.target.value;}}),
              h('span', { class: 'scan-row-count', text: '×' + e.count }),
              h('input',{class:'input batch-price',type:'text',inputmode:'decimal',dir:'ltr',placeholder:'מחיר ₪',
                'aria-label':'מחיר ליחידה בשקלים עבור '+scanDisplayName(e),value:e.priceDraft,
                oninput:function(event){e.priceDraft=event.target.value;}})
            )
          );
        });
        sessionBox.appendChild(list);
      }
      var total = session.reduce(function (n, e) { return n + e.count; }, 0);
      addAllBtn.textContent = t('scan.addAll', { count: total });
      if (session.length) {
        if (!addAllBtn.parentNode) panel.insertBefore(addAllBtn, panel.lastChild);
      } else if (addAllBtn.parentNode) {
        addAllBtn.parentNode.removeChild(addAllBtn);
      }
    }

    function addToSession(prod) {
      var e = byKey[window.HomeBarcode.key(prod.barcode)];
      if (e) {
        e.count += 1;
      } else {
        e = {
          barcode: prod.barcode,
          name: prod.name || '',
          he: prod.he || '',
          image: prod.image || null,
          emoji: prod.emoji || null,
          categoryId: prod.categoryId || 'other',
          unit: prod.unit || 'pcs',
          location:prod.location||(prod.productType==='beauty'?'Shower':prod.productType==='product'?'House':defaultInventoryLocation()),
          count: 1,
          unitPriceAgorot: prod.unitPriceAgorot,
          priceDraft: priceText(prod.unitPriceAgorot),
          itemId: prod.itemId || null,
          source: prod.source || 'user',
        };
        byKey[window.HomeBarcode.key(prod.barcode)] = e;
        session.push(e);
      }
      status.textContent = t('scan.found');
      renderSession();
    }

    // Continuous-mode: resolve via the shared pipeline, then add to the batch
    // session (rather than opening a dialog).
    function resolveForSession(code) {
      status.textContent = t('scan.looking');
      lookupBarcode(code).then(function (res) {
        if(closed)return;
        if (res.source === 'inventory') {
          var it = res.item;
          addToSession({
            barcode: code, name: it.nameEn || it.name || '', he: it.nameHe || '',
            image: thumbImageFor(it), emoji: it.emoji,
            categoryId: it.categoryId, unit: it.unit, unitPriceAgorot:it.unitPriceAgorot,itemId: it.id, source: 'inventory',
          });
          return;
        }
        if (res.source === 'cache' || res.source === 'off') {
          addToSession(res.product);
          return;
        }
        if (res.source === 'offline') status.textContent = t('scan.offline');
        // Unknown/unreachable → placeholder entry; editable later in inventory.
        addToSession({ barcode: code, name: '', categoryId: 'other', unit: 'pcs' });
      });
    }

    // Single-scan: resolve via the shared pipeline, then route to the same
    // dialogs that manual entry uses. resume() re-arms the camera on cancel;
    // closeSaved() closes the scanner + refreshes on success.
    function handleSingle(code) {
      lookupBarcode(code).then(function (res) {
        if(closed)return;
        openBarcodeResult(res, code, resume, closeSaved);
      });
    }

    // Called by single-scan dialogs on success (auto-close scanner + refresh).
    function closeSaved() {
      close();
      refresh();
    }

    // Briefly surface the raw detected number so the user immediately knows a
    // scan landed (paired with the frame flash + beep + vibrate in hit()).
    function showCode(code) {
      codeBadge.textContent = code;
      codeBadge.classList.add('show');
    }

    function onCode(code) {
      code=window.HomeBarcode.normalize(code);
      var now = Date.now();
      if (closed||busy) return;
      if (window.HomeBarcode.key(code) === window.HomeBarcode.key(lastCode) && now - lastTime < 2500) return; // debounce dupes (~2.5s cooldown)
      lastCode = code;
      lastTime = now;
      hideTips();
      hit();          // flash frame + beep + vibrate
      showCode(code); // show the detected barcode number
      if (continuous) {
        resolveForSession(code);
      } else {
        if (busy) return;
        busy = true;
        stop(); // OFF: detect first code → stop the camera, then look up & route
        status.textContent = t('scan.looking');
        handleSingle(code);
      }
    }

    function commitSession() {
      if(addAllBtn.disabled)return;
      var entries = session.filter(function(e){return !e.committed;});
      if(entries.some(function(e){return !String(e.name||e.he||e.nameDraft||'').trim();})){showToast('יש להשלים שם לכל מוצר שלא זוהה לפני השמירה.');return;}
      entries.forEach(function(e){if(!e.name&&!e.he)e.he=String(e.nameDraft||'').trim();});
      try {entries.forEach(function(e){e.unitPriceAgorot=parseUnitPrice(e.priceDraft);});} catch(error){showToast('בדקו את המחירים. מותר להזין עד שתי ספרות אחרי הנקודה.');return;}
      addAllBtn.disabled=true;
      if (!entries.length) { close(); return; }
      var total = entries.reduce(function (n, e) { return n + e.count; }, 0);
      var chain = Promise.resolve();
      entries.forEach(function (e) {
        chain = chain.then(function () {
          var existing = e.itemId ? itemById(e.itemId) : itemByBarcode(e.barcode);
          if (existing) {
            var updated=Object.assign({},existing,{quantity:existing.quantity+e.count,unitPriceAgorot:e.unitPriceAgorot});
            return window.PantryDB.put(updated).then(function () { Object.assign(existing,updated);recordDelta(e.count);recordExpense(updated,e.count); });
          }
          var nm = e.name || e.he || t('scan.unknownName');
          // Dedup the image into the shared store first, then reference by hash.
          return persistFullImage(e.image)
            .then(function (imageHash) {
              return window.PantryDB.create({
                name: nm, nameEn: e.name || null, nameHe: e.he || null,
                unitPriceAgorot:e.unitPriceAgorot,
                quantity: e.count, unit: e.unit, categoryId: e.categoryId,
                location: e.location, barcode: e.barcode, emoji: e.emoji, imageHash: imageHash || null,
              });
            })
            .then(function (item) {
              e.itemId=item.id;items.push(item);
              recordDelta(item.quantity);
              recordExpense(item,item.quantity);
              return window.PantryDB.putBarcode({
                barcode: e.barcode, name: e.name || '', he: e.he || '',
                categoryId: e.categoryId, unit: e.unit, image: e.image || null,
                emoji: e.emoji || null, source: e.source || 'user',
              }).catch(function(){return null;});
            });
        }).then(function(){e.committed=true;});
      });
      chain.then(function () {
        close();
        refresh().then(function () { showToast(t('scan.committed', { count: total })); });
      }).catch(function(){addAllBtn.disabled=false;showToast('לא ניתן להשלים את השמירה. נסו שוב.');});
    }

    renderSession();
    maybeAttachDebug();
    startDecode();
  }

  // Known product already in inventory: choose how many units to add, then
  // increment the existing item (no duplicate). onCancel/onSaved handle flow.
  function openAddUnits(item, onCancel, onSaved) {
    var qty = 1,saving=false;
    var overlay = h('div', { class: 'overlay center' });
    function close(saved) {
      if(saving&&!saved)return;
      overlay.remove();
      if (saved) { if (onSaved) onSaved(); }
      else if (onCancel) onCancel();
    }
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(false); });

    var price = priceField(item.unitPriceAgorot,function(){return qty;});
    var saveButton=h('button',{class:'btn save',type:'button',onclick:function(){
      if(saving)return;var unitPrice;try{unitPrice=price.read();}catch(e){return;}
      saving=true;saveButton.disabled=true;
      window.PantryDB.getItem(item.id).then(function(live){
        if(!live)throw new Error('missing');
        return window.PantryDB.put(Object.assign({},live,{unitPriceAgorot:unitPrice,quantity:live.quantity+qty}));
      }).then(function(saved){Object.assign(item,saved);recordDelta(qty);recordExpense(saved,qty);close(true);})
        .catch(function(){saving=false;saveButton.disabled=false;showToast('הכמות לא השתנתה. לא ניתן לשמור כרגע; נסו שוב.');});
    }},t('scan.add'));
    var dialog = h(
      'div',
      { class: 'dialog' },
      h('div', { class: 'sheet-header' },
        h('h2', { class: 'dialog-title', text: t('scan.addUnitsTitle') }),
        h('button', { class: 'sheet-close', 'aria-label': t('a11y.close'), onclick: function () { close(false); } }, '✕')
      ),
      h('div', { class: 'scan-hero' },
        itemThumb(item),
        h('div', { class: 'scan-hero-info' },
          h('div', { class: 'scan-hero-name', dir: 'auto', text: itemName(item) }),
          h('div', { class: 'scan-hero-sub', text: t('scan.inStock', { qty: formatQty(item.quantity), unit: t('units.' + item.unit) }) })
        )
      ),
      h('label', { class: 'field-label', text: t('scan.howMany') }),
      stepperBox(function () { return qty; }, function (v) { qty = v; }),
      price.element,
      h('div', { class: 'actions' },
        h('button', { class: 'btn cancel', type: 'button', onclick: function () { close(false); } }, t('form.cancel')),
        saveButton
      )
    );
    dialog.addEventListener('click',price.update);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
  }

  // Review (OFF import / cached) or create-new (unknown) product dialog. Saves
  // an inventory item and caches the barcode->product mapping for next time.
  function openBarcodeProduct(opts, onCancel, onSaved) {
    var product = opts.product || {};
    var barcode = String(opts.barcode || product.barcode || '');
    var st = {
      en: product.name || '',
      he: product.he || '',
      categoryId: product.categoryId || 'other',
      unit: product.unit || 'pcs',
      qty: 1,
      location:product.location||(product.productType==='beauty'?'Shower':product.productType==='product'?'House':defaultInventoryLocation()),
      unitPriceAgorot: product.unitPriceAgorot,
      emoji: product.emoji || null,
      // Full image from OFF/cache; thumb (if any) is set when a photo is picked.
      imageFull: product.image || null,
      imageThumb: null,
    };

    var overlay = h('div', { class: 'overlay' });
    var sheet = h('div', { class: 'sheet' });
    function close(saved) {
      if(saving&&!saved)return;
      overlay.remove();
      if (saved) { if (onSaved) onSaved(); }
      else if (onCancel) onCancel();
    }
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(false); });

    sheet.appendChild(h('div', { class: 'grabber' }));
    sheet.appendChild(
      h('div', { class: 'sheet-header' },
        h('h2', { class: 'sheet-title', text: opts.isNew ? t('scan.newTitle') : t('scan.reviewTitle') }),
        h('button', { class: 'sheet-close', 'aria-label': t('a11y.close'), onclick: function () { close(false); } }, '✕')
      )
    );
    var body = h('div', { class: 'sheet-body' });

    if (opts.hint) body.appendChild(h('div', { class: 'scan-hint', text: opts.hint }));
    if(product.source==='off')body.appendChild(h('a',{class:'scan-data-credit',href:window.HomeBarcode.sourceUrl(product.productType)+'/product/'+encodeURIComponent(barcode),target:'_blank',rel:'noopener noreferrer',text:'פרטי המוצר במאגר הפתוח'}));

    // Photo
    body.appendChild(h('label', { class: 'field-label', text: t('form.photo') }));
    var photo = photoControl(st);
    body.appendChild(photo.row);
    body.appendChild(photo.input);

    // Barcode (read-only)
    body.appendChild(h('label', { class: 'field-label', text: t('scan.barcode') }));
    var bcInput = h('input', { class: 'input', type: 'text', value: barcode, readonly: 'readonly' });
    body.appendChild(bcInput);

    // Keep imported names as metadata, with one visible product-name field.
    var enInput = h('input', { class: 'input', type: 'text', dir: 'auto', value: st.en, placeholder: t('form.namePlaceholder'), autocomplete: 'off' });
    body.appendChild(h('label', { class: 'field-label', text: t('form.name') }));
    var heInput = h('input', { class: 'input', type: 'text', value: st.he || st.en, dir: 'auto', autocomplete: 'off' });
    body.appendChild(heInput);

    if (product.brand)
      body.appendChild(h('div', { class: 'scan-meta', text: t('scan.brand') + ': ' + product.brand + (product.size ? ' · ' + product.size : '') }));

    // Category + unit + quantity
    body.appendChild(h('label', { class: 'field-label', text: t('form.category') }));
    body.appendChild(categoryChips(function () { return st.categoryId; }, function (v) { st.categoryId = v; photo.render(); }));
    body.appendChild(h('label', { class: 'field-label', text: t('form.unit') }));
    body.appendChild(unitChipsBox(function () { return st.unit; }, function (v) { st.unit = v; }));
    body.appendChild(h('label', { class: 'field-label', text: t('form.quantity') }));
    body.appendChild(stepperBox(function () { return st.qty; }, function (v) { st.qty = v; }));

    var price = priceField(st.unitPriceAgorot,function(){return st.qty;});
    body.appendChild(price.element);
    body.appendChild(h('label',{class:'field-label',text:'מיקום בבית'}));
    body.appendChild(locationPicker(function(){return st.location;},function(value){st.location=value;}));
    body.addEventListener('click',price.update);
    sheet.appendChild(body);

    var saving=false;
    function save() {
      if(saving)return;
      var unitPrice;try{unitPrice=price.read();}catch(e){return;}
      var en = enInput.value.trim();
      var he = heInput.value.trim();
      if (!he) {
        heInput.classList.add('error');heInput.focus();
        showToast(t('scan.nameRequired'));
        return;
      }
      var primary = window.I18N.getLang() === 'he' ? he || en : en || he;
      var emoji = st.emoji;
      if (!emoji) {
        var m = foodMatch(en || he);
        if (m) emoji = m.emoji;
      }
      // Dedup the image into the shared store first (prefer an explicit thumb
      // from a user upload; otherwise derive one from the full image).
      var imgP = st.imageThumb
        ? storeImagePair({ full: st.imageFull, thumb: st.imageThumb })
        : persistFullImage(st.imageFull);
      saving=true;saveButton.disabled=true;
      imgP.then(function (imageHash) {
        var existing = itemByBarcode(barcode);
        var p;
        if (existing) {
          var updated=Object.assign({},existing,{quantity:existing.quantity+st.qty,unitPriceAgorot:unitPrice});
          var prevHash = existing.imageHash || null;
          if (imageHash) { updated.imageHash = imageHash; updated.image = null; }
          p = window.PantryDB.put(updated).then(function () {
            Object.assign(existing,updated);
            recordDelta(st.qty);
            recordExpense(updated,st.qty);
            if (imageHash && prevHash && prevHash !== imageHash) return releaseImage(prevHash).catch(function(){});
          });
        } else {
          p = window.PantryDB.create({
            name: primary, nameEn: en || null, nameHe: he || null,
            unitPriceAgorot: unitPrice,
            quantity: st.qty, unit: st.unit, categoryId: st.categoryId,
            location: st.location, barcode: barcode, emoji: emoji || null, imageHash: imageHash || null,
          }).then(function (item) { recordDelta(item.quantity);recordExpense(item,item.quantity); });
        }
        return p.then(function () {
          return window.PantryDB.putBarcode({
            barcode: barcode, name: en, he: he, categoryId: st.categoryId,
            unit: st.unit,location:st.location, image: st.imageFull || null, emoji: emoji || null,
            brand: product.brand || '', size: product.size || '',
            source: opts.isNew ? 'user' : product.source || 'off',
          }).catch(function(){return null;}).then(function(){close(true);});
        });
      }).catch(function(){saving=false;saveButton.disabled=false;showToast('לא ניתן להשלים את השמירה. בדקו את החיבור ואת הכמות במלאי לפני ניסיון נוסף.');});
    }

    var saveButton=h('button',{class:'btn save',type:'button',onclick:save},t('scan.save'));
    sheet.appendChild(
      h('div', { class: 'actions' },
        h('button', { class: 'btn cancel', type: 'button', onclick: function () { close(false); } }, t('form.cancel')),
        saveButton
      )
    );

    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
  }

  // ---- Shared helpers for the passwordless profile UI ----
  function initialsOf(name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // Reusable avatar picker bound to state.avatar (a data URL or null). The
  // placeholder shows initials via getInitials(). Used by create/edit/profile.
  function avatarControl(state, getInitials) {
    var box = h('div', { class: 'profile-avatar' });
    var fileInput = h('input', { class: 'photo-file', type: 'file', accept: 'image/*' });
    function render() {
      box.innerHTML = '';
      var tile = state.avatar
        ? h('div', { class: 'avatar lg has-img' }, h('img', { class: 'avatar-img', src: state.avatar, alt: '' }))
        : h('div', { class: 'avatar lg', text: getInitials() });
      var addBtn = h('button', { class: 'btn ghost', type: 'button', onclick: function () { fileInput.click(); } },
        state.avatar ? t('auth.changeAvatar') : t('auth.addAvatar'));
      var rm = state.avatar
        ? h('button', { class: 'btn ghost danger', type: 'button', onclick: function () { state.avatar = null; render(); } }, t('auth.removeAvatar'))
        : null;
      box.appendChild(tile);
      box.appendChild(h('div', { class: 'photo-actions', style: 'justify-content:center' }, addBtn, rm));
    }
    fileInput.addEventListener('change', function () {
      var f = fileInput.files && fileInput.files[0];
      if (!f) return;
      processImage(f, function (pair) {
        if (pair) { state.avatar = pair.thumb || pair.full; render(); }
        else showToast(t('form.imageError'));
        fileInput.value = '';
      });
    });
    render();
    return { box: box, input: fileInput, rerender: render };
  }

  // ---- Household profile ----
  function openProfile(opts) {
    opts = opts || {};
    var cu = window.CurrentUser;
    var overlay = h('div', { class: opts.inline ? 'profile-inline' : 'overlay center' });

    // State-preserving reopener for a live language switch from within.
    var prevReopen = reopenTop;
    var myReopen = function () {
      openProfile({ displayName: nameInput.value, avatar: state.avatar });
    };
    reopenTop = myReopen;
    function close() {
      overlay.remove();
      if (reopenTop === myReopen) reopenTop = prevReopen;
    }
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

    var state = {
      avatar: opts.avatar !== undefined ? opts.avatar : cu.avatar(),
      lang: window.I18N.getLang(),
    };
    var nameInput = h('input', { class: 'input', type: 'text', dir: 'auto', value: opts.displayName != null ? opts.displayName : cu.displayName() || '', 'aria-label': t('auth.displayName') });
    var avc = avatarControl(state, function () { return initialsOf(nameInput.value) || cu.initials(); });
    nameInput.addEventListener('input', function () { avc.rerender(); });
    function save() {
      var dn = nameInput.value.trim() || cu.username() || cu.displayName();
      window.Auth.updateProfile({ displayName: dn, avatar: state.avatar, lang: state.lang });
      if(githubSync)githubSync.sync().catch(function(){showToast('הפרופיל נשמר במכשיר. הסנכרון ינסה שוב בהמשך.');});
      close();
      renderCurrentView();
    }

    var dialog = h(
      'div',
      { class: opts.inline ? 'profile-dialog profile-inline-form' : 'dialog profile-dialog' },
      h('div', { class: 'sheet-header' },
        h('h2', { class: 'dialog-title', text: t('auth.profile') }),
        h('button', { class: 'sheet-close', 'aria-label': t('a11y.close'), onclick: close }, '✕')
      ),
      avc.box,
      avc.input,
      h('label', { class: 'field-label', text: t('auth.displayName') }),
      nameInput,
      h('div', { class: 'actions' },
        h('button', { class: 'btn cancel', type: 'button', onclick: close }, t('form.cancel')),
        h('button', { class: 'btn save', type: 'button', onclick: save }, t('auth.save'))
      )
    );
    overlay.appendChild(dialog);
    if(opts.inline){opts.inline.appendChild(overlay);}else document.body.appendChild(overlay);
    setTimeout(function () { nameInput.focus(); }, 50);
  }

  // ---- Settings (gear) ----
  // Household details and synchronization settings.
  // ============================ Cross-device sync ============================
  // DORMANT by default. Nothing here touches the network unless the app has a
  // Supabase URL + anon key AND this profile is linked to a cloud identity.
  var SYNC_URL_KEY = 'pantry.sync.url';
  var SYNC_ANON_KEY = 'pantry.sync.anonKey';
  var syncMgr = null; // HomeSync.SyncManager instance (when active)
  var syncMgrProfile = null; // local profile id the running engine is bound to
  var homeSyncPromise = null; // lazy-load promise for sync/homesync.js
  var qrPromise = null; // lazy-load promise for vendor/qrcode.js
  var suppressSyncHook = false; // guard so remote-applied writes don't re-queue
  var pendingLinkToken = null; // a #link= token captured at startup (auto-join)
  var syncSchemaOutdated = false; // set when join_or_create_household is missing

  // Parse a device-link token from the current URL (#link= or ?link=).
  function parseLinkToken() {
    try {
      var m =
        /[#&?]link=([^&]+)/.exec(location.hash || '') ||
        /[?&]link=([^&]+)/.exec(location.search || '');
      return m ? decodeURIComponent(m[1]) : null;
    } catch (e) {
      return null;
    }
  }
  // Remove the link token from the URL so it isn't re-processed or shared.
  function cleanLinkUrl() {
    try {
      if (!history.replaceState) return;
      var search = (location.search || '').replace(/([?&])link=[^&]*/, '$1').replace(/[?&]$/, '');
      var hash = (location.hash || '').replace(/([#&])link=[^&]*/, '$1').replace(/[#&]$/, '');
      if (hash === '#') hash = '';
      history.replaceState(null, '', location.pathname + search + hash);
    } catch (e) {}
  }

  // Effective config: Settings (localStorage) overrides config.js. Pure read.
  function syncGetConfig() {
    if(window.HOMESTOCK_CONFIG && window.HOMESTOCK_CONFIG.CLOUD_SYNC_ENABLED === false) return {url:'',anonKey:''};
    var url = '';
    var anon = '';
    try {
      url = localStorage.getItem(SYNC_URL_KEY) || '';
      anon = localStorage.getItem(SYNC_ANON_KEY) || '';
    } catch (e) {}
    var c = window.HOMESTOCK_CONFIG || {};
    if (!url) url = c.SUPABASE_URL || '';
    if (!anon) anon = c.SUPABASE_ANON_KEY || '';
    return { url: String(url).trim(), anonKey: String(anon).trim() };
  }
  function syncConfigured() {
    var c = syncGetConfig();
    return !!(c.url && c.anonKey);
  }
  // Per-profile link state (cloud identity + anonymous session + device id).
  function syncStateKey() {
    var id = window.CurrentUser && window.CurrentUser.id() ? window.CurrentUser.id() : 'anon';
    return 'pantry.sync.state.' + id;
  }
  function syncLoadState() {
    try {
      return JSON.parse(localStorage.getItem(syncStateKey()) || 'null') || {};
    } catch (e) {
      return {};
    }
  }
  function syncSaveState(s) {
    try {
      localStorage.setItem(syncStateKey(), JSON.stringify(s || {}));
    } catch (e) {}
  }
  function syncLinked() {
    var s = syncLoadState();
    return !!(s && s.cloudUserId && s.session);
  }

  // ---- Automatic profile-based household (deterministic, no QR) -------------
  function syncProfileId() {
    return (window.CurrentUser && window.CurrentUser.id && window.CurrentUser.id()) || 'anon';
  }
  function syncProfileName() {
    try {
      return (window.CurrentUser && window.CurrentUser.displayName && window.CurrentUser.displayName()) || '';
    } catch (e) { return ''; }
  }
  // Optional "family sync code" (shared passphrase), persisted per profile.
  // Empty = auto-share by name only. When set, it must match on other devices.
  function syncFamilyCodeKey() { return 'pantry.sync.familyCode.' + syncProfileId(); }
  function syncGetFamilyCode() {
    try { return localStorage.getItem(syncFamilyCodeKey()) || ''; } catch (e) { return ''; }
  }
  function syncSetFamilyCode(v) {
    try {
      if (v) localStorage.setItem(syncFamilyCodeKey(), v);
      else localStorage.removeItem(syncFamilyCodeKey());
    } catch (e) {}
  }
  // Per-profile opt-out: set when the user taps Disconnect so we DON'T silently
  // auto-rejoin on the next login. Cleared by "Enable sync".
  function syncOptOutKey() { return 'pantry.sync.optout.' + syncProfileId(); }
  function syncOptedOut() {
    try { return localStorage.getItem(syncOptOutKey()) === '1'; } catch (e) { return false; }
  }
  function syncSetOptedOut(on) {
    try {
      if (on) localStorage.setItem(syncOptOutKey(), '1');
      else localStorage.removeItem(syncOptOutKey());
    } catch (e) {}
  }
  // Does an error from the join RPC mean the DB schema hasn't been re-run?
  function isSchemaMissingError(err) {
    var msg = (err && err.message) || '';
    return !!(
      (err && err.status === 404) ||
      /PGRST202|join_or_create_household|Could not find the function|does not exist|42883/i.test(msg)
    );
  }

  function loadHomeSync() {
    if (typeof window.HomeSync !== 'undefined' && window.HomeSync) {
      return Promise.resolve(window.HomeSync);
    }
    if (homeSyncPromise) return homeSyncPromise;
    homeSyncPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = './sync/homesync.js';
      s.async = true;
      s.onload = function () {
        if (window.HomeSync) resolve(window.HomeSync);
        else {
          homeSyncPromise = null;
          reject(new Error('HomeSync unavailable after load'));
        }
      };
      s.onerror = function () {
        homeSyncPromise = null;
        reject(new Error('Failed to load sync layer'));
      };
      document.head.appendChild(s);
    });
    return homeSyncPromise;
  }

  // ---- local <-> cloud record mapping ----
  function cloudTableFor(localTable) {
    if (localTable === 'inventoryItems') return 'inventory_items';
    if (localTable === 'barcodeMappings') return 'barcode_mappings';
    if (localTable === 'shoppingItems') return 'shopping_list_items';
    return localTable;
  }
  function mapItemToCloud(rec, uid) {
    return {
      id: rec.id,
      user_id: uid,
      product_id: rec.productId || null,
      barcode: rec.barcode || null,
      name: rec.name || null,
      name_en: rec.nameEn || null,
      name_he: rec.nameHe || null,
      quantity: typeof rec.quantity === 'number' ? rec.quantity : null,
      image_hash: rec.imageHash || null,
      data: rec,
      updated_at: rec.updatedAt || new Date().toISOString(),
    };
  }
  function mapBarcodeToCloud(rec, uid) {
    return {
      id: String(rec.barcode),
      user_id: uid,
      barcode: String(rec.barcode),
      product_id: rec.productId || null,
      data: rec,
      updated_at: rec.updatedAt || new Date().toISOString(),
    };
  }
  function cloudRowToItem(row) {
    var d = (row && row.data) || {};
    d.id = row.id;
    if (row.updated_at) d.updatedAt = row.updated_at;
    if (typeof row.quantity === 'number') d.quantity = row.quantity;
    return d;
  }
  // Shopping List <-> shopping_list_items. product_id/list_id are left null
  // (local refs live in `data`, same approach as inventory) to avoid uuid
  // coercion against the deployed schema.
  function mapShoppingToCloud(rec, uid) {
    return {
      id: rec.id,
      user_id: uid,
      list_id: null,
      product_id: null,
      name: rec.name || rec.nameEn || rec.nameHe || null,
      quantity: typeof rec.quantity === 'number' ? rec.quantity : null,
      checked: !!rec.purchased,
      data: rec,
      updated_at: rec.updatedAt || new Date().toISOString(),
    };
  }
  function cloudRowToShopping(row) {
    var d = (row && row.data) || {};
    d.id = row.id;
    if (row.updated_at) d.updatedAt = row.updated_at;
    if (typeof row.quantity === 'number') d.quantity = row.quantity;
    if (typeof row.checked === 'boolean') d.purchased = row.checked;
    return d;
  }

  // Tear down the running engine WITHOUT clearing stored credentials (used when
  // switching profiles or when a profile becomes unlinked). Safe to call anytime.
  function syncStopEngine() {
    if (syncMgr && syncMgr.stop) syncMgr.stop();
    syncMgr = null;
    syncMgrProfile = null;
    if (window.PantryDB && window.PantryDB.onMutation) window.PantryDB.onMutation(null);
  }

  // Boot / refresh cross-device sync. Called on every login (enterApp) and after
  // enabling/linking. Safe to call anytime; no-ops when dormant. When already
  // running for the SAME profile it just triggers a full sync (push + pull) so
  // each login pulls the latest; when the profile changed it rebinds cleanly.
  function syncBoot() {
    var profile = (window.CurrentUser && window.CurrentUser.id()) || null;
    if (!syncConfigured() || !syncLinked()) {
      // Dormant / unlinked for this profile — stop any engine from a prior one.
      if (syncMgr) syncStopEngine();
      return;
    }
    if (syncMgr && syncMgrProfile === profile) {
      // Already active for this profile: a login/return should pull latest now.
      syncMgr.syncNow();
      return;
    }
    if (syncMgr) syncStopEngine(); // profile changed -> rebind to the new one
    loadHomeSync()
      .then(function (HS) {
        // Guard against a profile switch mid-load.
        if (((window.CurrentUser && window.CurrentUser.id()) || null) !== profile) return;
        var cfg = syncGetConfig();
        var st = syncLoadState();
        var repo = new HS.CloudRepository(cfg, st.session);
        // Persist refreshed tokens so a stale JWT never resurfaces as an error.
        repo.onSession = function (sess) {
          var cur = syncLoadState();
          cur.session = sess;
          syncSaveState(cur);
        };
        var queue = new HS.SyncQueue(localStorage, 'pantry.sync.queue.' + st.cloudUserId);
        syncMgr = new HS.SyncManager({
          cfg: cfg,
          repo: repo,
          queue: queue,
          storage: localStorage,
          getUserId: function () { return st.cloudUserId; },
          onStatus: function (s) { updateSyncIndicator(s); },
          pullIntervalMs: 25000, // lightweight periodic pull while active + online
        });
        syncMgrProfile = profile;
        syncMgr.onPull = function () { return syncPull(HS, repo, st); };
        // Capture local mutations -> queue + debounced push (unless we are the
        // ones applying a remote change).
        window.PantryDB.onMutation(function (m) {
          if (!syncMgr || suppressSyncHook) return;
          var payload =
            m.table === 'inventoryItems'
              ? mapItemToCloud(m.record, st.cloudUserId)
              : m.table === 'barcodeMappings'
              ? mapBarcodeToCloud(m.record, st.cloudUserId)
              : m.table === 'shoppingItems'
              ? mapShoppingToCloud(m.record, st.cloudUserId)
              : Object.assign({}, m.record, { user_id: st.cloudUserId });
          var recordId = m.record && (m.record.id || m.record.barcode);
          syncMgr.notifyLocalMutation({
            table: cloudTableFor(m.table),
            opType: m.opType,
            recordId: recordId,
            payload: payload,
          });
        });
        syncMgr.start(); // attaches focus/visibility/online + periodic pull, runs a sync
        updateSyncIndicator(syncMgr.status);
      })
      .catch(function () {
        /* stay offline-first; sync just stays dormant */
      });
  }

  // Pure rule: is this a TRUE concurrent quantity conflict worth a dialog?
  // A pulled `remote` is already a delta (changed since `since`); it conflicts
  // only when the local copy ALSO changed since `since` and the quantities
  // disagree. Without a `since` (first sync) we can't tell, so it's not a
  // conflict (last-write-wins handles it).
  function isConcurrentQtyConflict(local, remote, since) {
    return !!(
      local && remote && since &&
      typeof local.quantity === 'number' &&
      typeof remote.quantity === 'number' &&
      local.quantity !== remote.quantity &&
      String(local.updatedAt || '') > String(since)
    );
  }

  // Pull remote inventory deltas and merge into local IDB. Last-write-wins by
  // updatedAt; a TRUE concurrent quantity conflict (both sides changed the same
  // item since the last sync, to different values) is surfaced via a dialog.
  // Remote-applied writes are guarded so they don't re-enter the sync queue.
  // Re-renders the CURRENT view live (only when something changed) so a device
  // "updates by itself" without losing the active profile or an open dialog.
  function syncPull(HS, repo, st) {
    var since = null;
    try { since = localStorage.getItem('pantry.sync.lastAt'); } catch (e) {}
    // Pull inventory first, then the (separate) Shopping List. Independent
    // tables, independent merges — a failure in one doesn't block the other's
    // resolution, and each re-renders live.
    return syncPullInventory(HS, repo, st, since).then(function () {
      return syncPullShopping(HS, repo, st, since);
    });
  }

  function syncPullInventory(HS, repo, st, since) {
    return repo.selectSince('inventory_items', st.cloudUserId, since).then(function (rows) {
      if (!rows || !rows.length) return null;
      return window.PantryDB.getAll().then(function (localItems) {
        var localById = {};
        localItems.forEach(function (x) { localById[x.id] = x; });
        var chain = Promise.resolve();
        var applied = 0;
        var conflicts = [];
        rows.map(cloudRowToItem).forEach(function (r) {
          var local = localById[r.id];
          // True concurrent quantity conflict: the local copy also changed
          // since the last sync (remote is a delta by definition) and the two
          // quantities disagree. First sync (no `since`) can't tell -> LWW.
          if (isConcurrentQtyConflict(local, r, since)) {
            conflicts.push({ local: local, remote: r });
            return;
          }
          var winner = HS.ConflictResolver.resolveRecord(local, r);
          if (winner === r) {
            applied++;
            chain = chain.then(function () {
              suppressSyncHook = true;
              return window.PantryDB.put(r).then(
                function () { suppressSyncHook = false; },
                function () { suppressSyncHook = false; }
              );
            });
          }
        });
        return chain.then(function () {
          var done = Promise.resolve();
          if (applied) {
            // Reload the merged rows into memory so the live re-render reflects
            // pulled changes (not the stale pre-merge snapshot).
            done = window.PantryDB.getAll().then(function (fresh) {
              items = (fresh || []).map(function (i) {
                if (typeof i.desiredAmount !== 'number') i.desiredAmount = 0;
                return i;
              });
              recomputeShortfall();
              renderCurrentView();
            });
          }
          return done.then(function () {
            if (conflicts.length) syncQueueConflicts(HS, conflicts);
          });
        });
      });
    });
  }

  // Pull the Shopping List (its own table). Last-write-wins by updatedAt; no
  // quantity-conflict dialog (needed-quantity edits are low-stakes) — remote
  // deletions/edits simply merge. Updates the in-memory model + re-renders.
  function syncPullShopping(HS, repo, st, since) {
    return repo.selectSince('shopping_list_items', st.cloudUserId, since).then(function (rows) {
      if (!rows || !rows.length) return null;
      return window.PantryDB.getAllShopping().then(function (localShop) {
        var localById = {};
        localShop.forEach(function (x) { localById[x.id] = x; });
        var chain = Promise.resolve();
        var applied = 0;
        rows.map(cloudRowToShopping).forEach(function (r) {
          var winner = HS.ConflictResolver.resolveRecord(localById[r.id], r);
          if (winner === r) {
            applied++;
            chain = chain.then(function () {
              suppressSyncHook = true;
              return window.PantryDB.putShopping(r).then(
                function () { suppressSyncHook = false; },
                function () { suppressSyncHook = false; }
              );
            });
          }
        });
        return chain.then(function () {
          if (applied) {
            return window.PantryDB.getAllShopping().then(function (fresh) {
              shoppingItems = fresh || [];
              refreshShopping();
            });
          }
        });
      });
    });
  }

  // Resolve true concurrent quantity conflicts one at a time via a small dialog.
  // While unresolved they sit in syncMgr.pendingConflicts so the status shows
  // "Conflict". Each choice is written locally (which re-queues a push).
  function syncQueueConflicts(HS, conflicts) {
    if (!syncMgr) return;
    conflicts.forEach(function (c) {
      // De-dupe by id so repeated pulls don't stack the same conflict.
      var exists = syncMgr.pendingConflicts.some(function (p) {
        return p.local && c.local && p.local.id === c.local.id;
      });
      if (!exists) syncMgr.pendingConflicts.push(c);
    });
    updateSyncIndicator('conflict');
    syncShowNextConflict(HS);
  }

  function syncShowNextConflict(HS) {
    if (!syncMgr || !syncMgr.pendingConflicts.length) {
      if (syncMgr) updateSyncIndicator(syncMgr.status);
      return;
    }
    var c = syncMgr.pendingConflicts[0];
    openQuantityConflict(c.local, c.remote, function (chosenQty) {
      var merged = Object.assign({}, c.remote, {
        quantity: chosenQty,
        updatedAt: new Date().toISOString(),
      });
      suppressSyncHook = false; // this local write SHOULD push our decision
      window.PantryDB.put(merged)
        .then(function () {})
        .catch(function () {})
        .then(function () {
          syncMgr.pendingConflicts.shift();
          recomputeShortfall();
          renderCurrentView();
          if (!syncMgr.pendingConflicts.length) updateSyncIndicator(syncMgr.status);
          syncShowNextConflict(HS);
        });
    });
  }

  // Dialog for a single quantity conflict: keep this device / keep other / add.
  function openQuantityConflict(local, remote, onChoose) {
    var name = itemName(local) || itemName(remote) || '';
    var lq = typeof local.quantity === 'number' ? local.quantity : 0;
    var rq = typeof remote.quantity === 'number' ? remote.quantity : 0;
    var overlay = h('div', { class: 'overlay center' });
    var card = h('div', { class: 'sync-body conflict-card' });
    card.appendChild(h('h3', { dir: 'auto', text: t('sync.conflictTitle') }));
    if (name) card.appendChild(h('p', { class: 'sync-note', dir: 'auto', text: name }));
    card.appendChild(h('p', { class: 'sync-note', dir: 'auto', text: t('sync.conflictBody') }));
    function pick(qty) { overlay.remove(); onChoose(qty); }
    var row = h('div', { class: 'conflict-actions' });
    row.appendChild(h('button', { class: 'btn', type: 'button',
      onclick: function () { pick(lq); } }, t('sync.keepLocal') + ' (' + lq + ')'));
    row.appendChild(h('button', { class: 'btn', type: 'button',
      onclick: function () { pick(rq); } }, t('sync.keepCloud') + ' (' + rq + ')'));
    row.appendChild(h('button', { class: 'btn ghost', type: 'button',
      onclick: function () { pick(lq + rq); } }, t('sync.addTogether') + ' (' + (lq + rq) + ')'));
    card.appendChild(row);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }

  // ===== Automatic profile-based join (the zero-friction path) =============
  // Derives a deterministic household key from the active profile (normalized
  // display name + optional family code), signs in anonymously (reusing any
  // saved session), and calls join_or_create_household so this device converges
  // to the SAME shared household as the same profile on any other device — with
  // NO QR/link step. Then it uploads local data (idempotent) and boots the
  // engine (push + pull) so the device shows the merged shared data.
  //
  // Idempotent + safe to call on every login: same profile => same household.
  // If the profile previously created its OWN separate household, this converges
  // it to the deterministic one and re-uploads local rows to the shared id.
  // Degrades gracefully if the RPC is missing (schema not re-run yet).
  function syncAutoJoin(opts) {
    opts = opts || {};
    if (!syncConfigured()) return Promise.resolve(false);
    if (syncOptedOut() && !opts.force) return Promise.resolve(false);
    var name = syncProfileName();
    if (!name) return Promise.resolve(false); // need an identity to derive a key
    var profile = syncProfileId();
    return loadHomeSync()
      .then(function (HS) {
        if (syncProfileId() !== profile) return false; // profile switched mid-load
        var cfg = syncGetConfig();
        var st = syncLoadState();
        var repo = new HS.CloudRepository(cfg, st.session);
        repo.onSession = function (sess) {
          var cur = syncLoadState();
          cur.session = sess;
          syncSaveState(cur);
        };
        return HS.HouseholdKey.deriveKeyHash(name, syncGetFamilyCode()).then(function (keyHash) {
          if (!keyHash) return false;
          var ensure = st.session ? Promise.resolve(st.session) : repo.signInAnonymously();
          return ensure
            .then(function () {
              // Persist the anon session immediately (before the RPC) so a
              // missing RPC / transient failure doesn't mint a brand-new
              // anonymous user on every login. No cloudUserId yet => still
              // dormant until the join succeeds.
              if (repo.session && repo.session !== st.session) {
                var cur = syncLoadState();
                cur.session = repo.session;
                if (!cur.deviceId) cur.deviceId = HS.DeviceLink.generateToken(8);
                syncSaveState(cur);
              }
              return repo.joinOrCreateHousehold(keyHash);
            })
            .then(function (hid) {
              hid = normalizeHouseholdId(hid);
              if (!hid) return false;
              syncSchemaOutdated = false;
              var changed = st.cloudUserId && st.cloudUserId !== hid;
              var next = {
                cloudUserId: hid,
                session: repo.session,
                deviceId: st.deviceId || HS.DeviceLink.generateToken(8),
                keyHash: keyHash,
              };
              syncSaveState(next);
              syncSetOptedOut(false);
              // Household changed (family code edited, or converging away from a
              // pre-existing separate household): pull the whole shared set and
              // re-upload local rows under the new household id.
              if (changed) { try { localStorage.removeItem('pantry.sync.lastAt'); } catch (e) {} }
              return syncMigrateLocal(HS, repo, next).then(function () {
                if (syncProfileId() === profile) syncBoot();
                return true;
              });
            });
        });
      })
      .catch(function (err) {
        if (isSchemaMissingError(err)) {
          // Not an app error: the user just needs to re-run schema.sql once.
          syncSchemaOutdated = true;
          updateSyncIndicator(syncMgr ? syncMgr.status : 'idle');
        }
        return false;
      });
  }

  // PostgREST scalar RPCs may return the bare uuid, a quoted string, or a
  // single-element array depending on version — normalize to a plain string.
  function normalizeHouseholdId(v) {
    if (v == null) return null;
    if (Array.isArray(v)) return v.length ? normalizeHouseholdId(v[0]) : null;
    if (typeof v === 'object') return v.household_id || v.id || null;
    return String(v);
  }

  // First device: anonymous sign-in, create household, migrate local data up.
  function syncEnableFirstDevice() {
    return loadHomeSync().then(function (HS) {
      var cfg = syncGetConfig();
      var repo = new HS.CloudRepository(cfg);
      return repo.signInAnonymously().then(function () {
        return repo.createHousehold().then(function (hid) {
          var st = {
            cloudUserId: hid,
            session: repo.session,
            deviceId: HS.DeviceLink.generateToken(8),
          };
          syncSaveState(st);
          return syncMigrateLocal(HS, repo, st).then(function () {
            syncBoot();
            return st;
          });
        });
      });
    });
  }

  // Other devices: anonymous sign-in, redeem a link code to join the household.
  function syncLinkThisDevice(code) {
    return loadHomeSync().then(function (HS) {
      var cfg = syncGetConfig();
      var repo = new HS.CloudRepository(cfg);
      return repo.signInAnonymously().then(function () {
        return repo.redeemLinkToken(String(code).trim()).then(function (hid) {
          var st = {
            cloudUserId: hid,
            session: repo.session,
            deviceId: HS.DeviceLink.generateToken(8),
          };
          syncSaveState(st);
          syncBoot();
          return st;
        });
      });
    });
  }

  // Auto-join from a #link= token (opened link / scanned QR). Reuses the same
  // redeem_link_token flow — no manual code entry. Backend config is baked, so
  // the token is all that's needed. No-op when unconfigured.
  function syncAutoRedeem(token) {
    if (!token || !syncConfigured()) return Promise.resolve(false);
    return loadHomeSync()
      .then(function (HS) {
        var cfg = syncGetConfig();
        var st = syncLoadState();
        var repo = new HS.CloudRepository(cfg, st.session);
        var ensure = st.session ? Promise.resolve() : repo.signInAnonymously();
        return ensure.then(function () {
          return repo.redeemLinkToken(String(token).trim()).then(function (hid) {
            syncSaveState({
              cloudUserId: hid,
              session: repo.session,
              deviceId: st.deviceId || HS.DeviceLink.generateToken(8),
            });
            syncBoot();
            if (typeof showToast === 'function') showToast(t('sync.linkedOk'));
            renderMain();
            return true;
          });
        });
      })
      .catch(function () {
        if (typeof showToast === 'function') showToast(t('sync.errLink'));
        return false;
      });
  }

  // Lazy-load the vendored (local, no-CDN) QR generator.
  function loadQR() {
    if (window.QRCodeMini) return Promise.resolve(window.QRCodeMini);
    if (qrPromise) return qrPromise;
    qrPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = './vendor/qrcode.js';
      s.async = true;
      s.onload = function () {
        if (window.QRCodeMini) resolve(window.QRCodeMini);
        else {
          qrPromise = null;
          reject(new Error('QR generator unavailable'));
        }
      };
      s.onerror = function () {
        qrPromise = null;
        reject(new Error('Failed to load QR generator'));
      };
      document.head.appendChild(s);
    });
    return qrPromise;
  }

  // Existing member: mint a fresh crypto-random link token for another device.
  function syncCreateLinkCode() {
    return loadHomeSync().then(function (HS) {
      var st = syncLoadState();
      var repo = new HS.CloudRepository(syncGetConfig(), st.session);
      var token = HS.DeviceLink.generateToken();
      return repo.createLinkToken(token, 60).then(function () { return token; });
    });
  }

  // Idempotent local -> cloud upload. Never deletes local data.
  function syncMigrationStateKey() {
    var s = syncLoadState();
    return 'pantry.sync.migration.' + (s.cloudUserId || 'none');
  }
  function syncMigrateLocal(HS, repo, st) {
    var key = 'pantry.sync.migration.' + st.cloudUserId;
    var state;
    try { state = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) {}
    state = state || HS.Migration.emptyState();
    return window.PantryDB.getAll().then(function (items) {
      var plan = HS.Migration.planUploads(items, state);
      var uploadInv = Promise.resolve();
      if (plan.length) {
        var rows = plan.map(function (r) { return mapItemToCloud(r, st.cloudUserId); });
        uploadInv = repo.upsert('inventory_items', rows).then(function () {
          var next = HS.Migration.markUploaded(state, plan.map(function (r) { return r.id; }));
          try { localStorage.setItem(key, JSON.stringify(next)); } catch (e) {}
        });
      }
      return uploadInv.then(function () { return syncMigrateShopping(HS, repo, st); });
    });
  }

  // Idempotent upload of any locally-created Shopping List items (separate
  // store, separate migration checkpoint). Never deletes local data.
  function syncMigrateShopping(HS, repo, st) {
    var key = 'pantry.sync.migration.shopping.' + st.cloudUserId;
    var state;
    try { state = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) {}
    state = state || HS.Migration.emptyState();
    return window.PantryDB.getAllShopping().then(function (shop) {
      var plan = HS.Migration.planUploads(shop || [], state);
      if (!plan.length) return null;
      var rows = plan.map(function (r) { return mapShoppingToCloud(r, st.cloudUserId); });
      return repo.upsert('shopping_list_items', rows).then(function () {
        var next = HS.Migration.markUploaded(state, plan.map(function (r) { return r.id; }));
        try { localStorage.setItem(key, JSON.stringify(next)); } catch (e) {}
      });
    });
  }

  function syncDisconnect() {
    syncStopEngine();
    try {
      localStorage.removeItem(syncStateKey());
    } catch (e) {}
    // Remember the opt-out so we don't silently auto-rejoin on the next login.
    syncSetOptedOut(true);
  }

  // Subtle header status indicator (only present when sync is configured).
  function syncStatusGlyph(status) {
    switch (status) {
      case 'syncing': return '🔄';
      case 'offline': return '📴';
      case 'conflict': return '⚠️';
      case 'error': return '⚠️';
      default: return '☁️'; // idle / synced
    }
  }
  function updateSyncIndicator(status) {
    var el = document.getElementById('sync-indicator');
    if (!el) return;
    el.textContent = syncStatusGlyph(status);
    var label = t('sync.status.' + (status || 'idle')) || t('sync.title');
    el.setAttribute('title', label);
    el.setAttribute('aria-label', t('sync.a11y') + ': ' + label);
  }

  function openSyncSettings() {
    var overlay = h('div', { class: 'overlay center' });
    var prevReopen = reopenTop;
    var myReopen = function () { openSyncSettings(); };
    reopenTop = myReopen;
    function close() {
      overlay.remove();
      if (reopenTop === myReopen) reopenTop = prevReopen;
    }
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

    var body = h('div', { class: 'sync-body' });

    function note(msg, cls) {
      return h('p', { class: 'sync-note ' + (cls || ''), dir: 'auto', text: msg });
    }
    function btn(label, cls, onClick) {
      return h('button', { class: 'btn ' + (cls || 'ghost'), type: 'button', onclick: onClick }, label);
    }

    // Optional family sync code field (privacy). Empty = auto-share by name.
    function familyCodeField() {
      var wrap = h('div', { class: 'sync-family' });
      wrap.appendChild(h('label', { class: 'field-label', text: t('sync.familyCode') }));
      var input = h('input', {
        class: 'input', type: 'text', dir: 'auto',
        value: syncGetFamilyCode(), placeholder: t('sync.familyCodePlaceholder'),
      });
      wrap.appendChild(input);
      wrap.appendChild(note(t('sync.familyCodeHint')));
      wrap.appendChild(btn(t('sync.familyCodeSave'), 'save', function () {
        var v = input.value.trim();
        var changed = v !== syncGetFamilyCode();
        syncSetFamilyCode(v);
        if (!changed) { showToast(t('sync.saved')); return; }
        // Re-derive the household immediately so devices re-converge.
        input.disabled = true;
        syncAutoJoin({ force: true }).then(function () {
          showToast(t('sync.familyCodeApplied'));
          rebuild();
        });
      }));
      return wrap;
    }

    function rebuild() {
      body.innerHTML = '';
      var configured = syncConfigured();
      var linked = syncLinked();

      if (!configured) {
        body.appendChild(note(t('sync.dormantNote')));
      }

      // Schema not re-run yet: precise, non-alarming guidance (auto-join needs
      // the join_or_create_household RPC). Never surfaces as a data-sync error.
      if (configured && syncSchemaOutdated) {
        body.appendChild(note(t('sync.schemaOutdated'), 'sync-error'));
      }

      // Automatic profile-based sync explainer (the zero-friction default).
      if (configured) {
        body.appendChild(note(t('sync.autoInfo')));
      }

      // Status + last sync (when linked).
      if (linked) {
        var status = syncMgr ? syncMgr.status : 'idle';
        var lastAt = null;
        try { lastAt = localStorage.getItem('pantry.sync.lastAt'); } catch (e) {}
        body.appendChild(
          h('div', { class: 'sync-status-row' },
            h('span', { class: 'sync-status-glyph', text: syncStatusGlyph(status) }),
            h('span', { class: 'sync-status-text', text: t('sync.status.' + status) })
          )
        );
        body.appendChild(
          h('p', { class: 'sync-note', text: t('sync.lastSync') + ': ' + (lastAt ? new Date(lastAt).toLocaleString('he-IL') : t('sync.never')) })
        );
        body.appendChild(btn(t('sync.syncNow'), 'save', function () {
          if (syncMgr) syncMgr.scheduleSync(0);
        }));

        // Link another device -> reveal code + URL.
        var linkArea = h('div', { class: 'sync-link-area' });
        body.appendChild(btn(t('sync.linkAnother'), 'ghost', function () {
          linkArea.innerHTML = '';
          linkArea.appendChild(note('…'));
          syncCreateLinkCode().then(function (token) {
            linkArea.innerHTML = '';
            var base = location.origin + location.pathname;
            var url = window.HomeSync
              ? window.HomeSync.DeviceLink.buildLinkUrl(base, token)
              : base + '#link=' + encodeURIComponent(token);
            // QR of the deep link — scan on another device to auto-join.
            linkArea.appendChild(h('p', { class: 'sync-note', text: t('sync.scanToJoin') }));
            var qrWrap = h('div', { class: 'sync-qr' });
            var canvas = h('canvas', { 'aria-label': t('sync.linkUrl') });
            qrWrap.appendChild(canvas);
            linkArea.appendChild(qrWrap);
            loadQR()
              .then(function (QR) { QR.toCanvas(canvas, url, { scale: 5, border: 3 }); })
              .catch(function () { qrWrap.remove(); });
            var codeField = h('input', { class: 'input mono', type: 'text', readonly: 'readonly', value: token, dir: 'ltr' });
            var urlField = h('input', { class: 'input mono', type: 'text', readonly: 'readonly', value: url, dir: 'ltr' });
            linkArea.appendChild(h('label', { class: 'field-label', text: t('sync.linkCode') }));
            linkArea.appendChild(codeField);
            linkArea.appendChild(btn(t('sync.copy'), 'ghost', function () {
              try { navigator.clipboard.writeText(url); } catch (e) {}
            }));
            linkArea.appendChild(h('label', { class: 'field-label', text: t('sync.linkUrl') }));
            linkArea.appendChild(urlField);
          }).catch(function (err) {
            linkArea.innerHTML = '';
            // A failed link-token mint is a KNOWN pending user action (re-run
            // schema.sql for pgcrypto); it must never look like a data-sync
            // error. Show a precise, localized "linking unavailable" note.
            var msg = (err && err.message) || '';
            if ((err && err.status === 404) || /digest|42883|does not exist/i.test(msg)) {
              linkArea.appendChild(note(t('sync.linkUnavailable'), 'sync-error'));
            } else {
              linkArea.appendChild(note(t('sync.errGeneric'), 'sync-error'));
            }
          });
        }));
        body.appendChild(linkArea);

        body.appendChild(btn(t('sync.regenerate'), 'ghost', function () {
          var st = syncLoadState();
          loadHomeSync().then(function (HS) {
            var repo = new HS.CloudRepository(syncGetConfig(), st.session);
            return repo.revokeLinkTokens();
          }).then(function () {
            showToast(t('sync.regenerated'));
          }).catch(function () { showToast(t('sync.errGeneric')); });
        }));

        body.appendChild(btn(t('sync.disconnect'), 'danger', function () {
          if (window.confirm(t('sync.disconnectConfirm'))) {
            syncDisconnect();
            showToast(t('sync.disconnected'));
            close();
            renderMain();
          }
        }));
        // Optional family code (privacy) — also available before linking below.
        body.appendChild(familyCodeField());
      } else if (configured) {
        // Configured but not linked yet on this profile (fresh, or opted-out).
        // The primary path is now ONE tap "Enable" that auto-joins the shared,
        // profile-based household — no QR, no code.
        body.appendChild(btn(t('sync.enable'), 'save', function () {
          body.appendChild(note(t('sync.enabling')));
          syncAutoJoin({ force: true }).then(function (ok) {
            close();
            renderMain();
            openSyncSettings();
            if (!ok && !syncSchemaOutdated) showToast(t('sync.errGeneric'));
          });
        }));

        // Family code (optional, for privacy) applies to the auto-join above.
        body.appendChild(familyCodeField());

        // Advanced: join by a link code from another device (legacy/manual).
        var advLink = h('details', { class: 'sync-advanced' });
        advLink.appendChild(h('summary', { text: t('sync.advancedLink') }));
        var codeInput = h('input', { class: 'input', type: 'text', placeholder: t('sync.codePlaceholder'), dir: 'ltr' });
        advLink.appendChild(h('label', { class: 'field-label', text: t('sync.enterCode') }));
        advLink.appendChild(codeInput);
        advLink.appendChild(btn(t('sync.linkThisDevice'), 'ghost', function () {
          var code = codeInput.value.trim();
          if (!code) return;
          syncLinkThisDevice(code).then(function () {
            close();
            renderMain();
            openSyncSettings();
          }).catch(function () {
            advLink.appendChild(note(t('sync.errLink'), 'sync-error'));
          });
        }));
        body.appendChild(advLink);
      }

      // Backend override (URL + anon key) — ADVANCED + optional, tucked away in
      // a collapsed disclosure. Prefilled from the baked config; not needed for
      // normal use (every device ships already configured via config.js).
      var cfg = syncGetConfig();
      var urlInput = h('input', { class: 'input', type: 'url', value: cfg.url, placeholder: 'כתובת שרת הסנכרון', dir: 'ltr' });
      var anonInput = h('input', { class: 'input mono', type: 'text', value: cfg.anonKey, placeholder: 'הדביקו את מפתח הגישה הציבורי', dir: 'ltr' });
      var advanced = h('details', { class: 'sync-advanced' },
        h('summary', { text: t('sync.backendSettings') }),
        h('p', { class: 'sync-note', text: t('sync.backendSettingsSub') }),
        h('label', { class: 'field-label', text: t('sync.supabaseUrl') }),
        urlInput,
        h('label', { class: 'field-label', text: t('sync.anonKey') }),
        anonInput,
        h('p', { class: 'sync-note', text: t('sync.anonKeyHint') }),
        btn(t('sync.save'), 'save', function () {
          try {
            localStorage.setItem(SYNC_URL_KEY, urlInput.value.trim());
            localStorage.setItem(SYNC_ANON_KEY, anonInput.value.trim());
          } catch (e) {}
          showToast(t('sync.saved'));
          rebuild();
        })
      );
      body.appendChild(advanced);
    }

    var dialog = h('div', { class: 'page-content settings-page' },
      h('div', { class: 'sheet-header' },
        h('h2', { class: 'dialog-title', text: t('sync.title') }),
        h('button', { class: 'sheet-close', 'aria-label': t('a11y.close'), onclick: close }, '✕')
      ),
      h('p', { class: 'sync-subtitle', text: t('sync.subtitle') }),
      body
    );
    rebuild();
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
  }

  function clearInventoryRecords(db, remoteIds) {
    return db.getAll().then(function (rows) {
      var ids = {};
      rows.forEach(function (row) { ids[row.id] = true; });
      (remoteIds || []).forEach(function (id) { ids[id] = true; });
      return Object.keys(ids).reduce(function (chain, id) {
        return chain.then(function () { return db.remove(id); });
      }, Promise.resolve());
    });
  }

  function openClearInventory() {
    var overlay=h('div',{class:'overlay center'});
    var busy=false;
    function close(){if(!busy)overlay.remove();}
    var confirm=h('button',{class:'btn danger',type:'button',onclick:function(){
      if(busy)return;
      busy=true;confirm.disabled=true;
      clearInventoryRecords(window.PantryDB).then(function(){return load();}).then(function(){
        recomputeShortfall();overlay.remove();renderCurrentView();showToast('פריטי המלאי נמחקו. מכשירים מחוברים יתעדכנו אוטומטית.');
      }).catch(function(error){
        console.error('Local inventory reset failed',error);
        showToast('לא ניתן להשלים את המחיקה במכשיר. נסו שוב.');
      }).then(function(){busy=false;confirm.disabled=false;});
    }},'מחיקת כל המלאי');
    overlay.appendChild(h('div',{class:'dialog',role:'dialog','aria-modal':'true','aria-label':'מחיקת כל המלאי'},
      h('h2',{class:'dialog-title',text:'להתחיל עם מלאי ריק?'}),
      h('p',{text:'פריטי המלאי יימחקו מהמכשיר הזה וגם מהמכשירים המחוברים. רשימת הקניות והיסטוריית ההוצאות יישמרו. לא ניתן לבטל את המחיקה.'}),
      h('div',{class:'actions'},h('button',{class:'btn cancel',type:'button',onclick:close},'ביטול'),confirm)));
    overlay.addEventListener('click',function(event){if(event.target===overlay)close();});
    document.body.appendChild(overlay);
  }

  // GitHub is the only active cross-device adapter. The retired provider
  // stays disabled and never receives this adapter's credentials or data.
  var githubSync=null;
  var githubSyncError=false;
  function githubStatusText() {
    if(githubSyncError)return 'לא ניתן להפעיל שמירה משותפת בדפדפן הזה';
    var state=githubSync ? githubSync.status() : {phase:'local'};
    var labels={local:'נשמר במכשיר הזה · חיבור מכשיר נוסף',syncing:'מעדכן את הנתונים המשותפים…',
      pending:'השינויים נשמרו במכשיר וממתינים לשליחה',synced:'הנתונים המשותפים מעודכנים',
      offline:'אין חיבור כרגע · השינויים יישלחו אוטומטית',auth:'החיבור פג · יש לחבר את המכשיר מחדש',
      access:'אין גישה כרגע · בדקו את הרשאות החיבור',public:'השמירה נעצרה: מאגר הנתונים צריך להיות פרטי',
      storage:'אין מספיק מקום לשמירה במכשיר', 'invalid-data':'לא ניתן לקרוא את הנתונים המשותפים',
      size:'מאגר הנתונים גדול מדי · הנתונים המקומיים נשמרו',conflict:'מכשיר נוסף עדכן נתונים · מנסה שוב אוטומטית',
      missing:'לא ניתן לגשת למאגר הנתונים · בדקו הרשאות'};
    return labels[state.phase] || labels.local;
  }
  function startGitHubSync() {
    if(!window.GitHubSync)return Promise.resolve();
    var config=window.HOMESTOCK_CONFIG||{};
    githubSync=window.GitHubSync.create({db:window.PantryDB,userId:window.CurrentUser.id(),
      owner:config.GITHUB_OWNER,repo:config.GITHUB_DATA_REPO,
      getProfile:function(){return {displayName:window.CurrentUser.displayName(),avatar:window.CurrentUser.avatar()};},
      setProfile:function(value){window.Auth.updateProfile({displayName:value.displayName,avatar:value.avatar});},
      onRemote:function(){return load().then(function(){recomputeShortfall();renderCurrentView();});}});
    return githubSync.start().catch(function(){githubSyncError=true;});
  }
  function openGitHubConnection() {
    var overlay=h('div',{class:'overlay center'}),busy=false;
    var config=window.HOMESTOCK_CONFIG||{};
    var state=githubSync?githubSync.status():{connected:false};
    var status=h('p',{class:'shared-status',role:'status',text:githubStatusText()});
    var token=h('input',{class:'input',type:'password',dir:'ltr',autocomplete:'off',spellcheck:'false',
      'aria-label':'מפתח חיבור אישי',placeholder:'github_pat_…'});
    var error=h('p',{class:'editor-error',role:'alert'});
    var unsub=function(){};
    function close(){if(busy)return;unsub();token.value='';overlay.remove();}
    var closeButton=h('button',{class:'sheet-close',type:'button','aria-label':'סגירה',onclick:close},'✕');
    var connect=h('button',{class:'btn save',type:'button',onclick:function(){
      if(busy||!githubSync)return;
      busy=true;connect.disabled=true;closeButton.disabled=true;error.textContent='';
      githubSync.connect(token.value).then(function(){
        token.value='';form.remove();
        status.textContent=githubStatusText();
        showToast(githubSync.status().phase==='synced'?'המכשיר מחובר. הנתונים יתעדכנו אוטומטית.':'המכשיר חובר. העדכון יושלם כשהחיבור זמין.');
      }).catch(function(e){
        error.textContent=e.message==='token-format'?'הדביקו מפתח אישי מוגבל שמתחיל ב־github_pat_.':e.message==='public'?'מאגר הנתונים חייב להיות פרטי כדי להמשיך.':'החיבור לא הושלם. בדקו שהמפתח בתוקף ושיש לו גישה למאגר הנתונים עם הרשאת Contents לקריאה וכתיבה.';
      }).then(function(){busy=false;connect.disabled=false;closeButton.disabled=false;});
    }},'חיבור ושמירה אוטומטית');
    // GitHub requires its account owner to issue this restricted credential.
    // Never use the development CLI token or put a token in a URL/QR.
    var url='https://github.com/settings/personal-access-tokens/new?name=HomeStock&description=HomeStock+device+sync&target_name='+encodeURIComponent(config.GITHUB_OWNER)+'&contents=write&expires_in=365';
    var form=h('div',{class:'shared-connect-form'},
      h('p',{text:'מחברים פעם אחת בכל מכשיר. אחר כך המלאי, רשימת הקניות וההוצאות מתעדכנים אוטומטית כשהאפליקציה פתוחה ומחוברת לאינטרנט.'}),
      h('ol',{class:'shared-steps'},
        h('li',{},h('a',{href:url,target:'_blank',rel:'noopener noreferrer',text:'יצירת מפתח חיבור ב־GitHub'})),
        h('li',{text:'בחרו Only select repositories ואז HomeStock-data בלבד. ההרשאה הנדרשת היא Contents: Read and write.'}),
        h('li',{text:'צרו את המפתח והדביקו אותו כאן. אין לשלוח אותו בצ׳אט.'})),
      h('label',{class:'field-label'},'מפתח חיבור אישי',token),
      h('p',{class:'shared-hint',text:'המפתח נשמר בדפדפן של המכשיר הזה ונשלח רק ל־GitHub. אפשר לבטל אותו בכל רגע בהגדרות GitHub.'}),error,connect);
    var disconnect=state.connected?h('button',{class:'btn cancel',type:'button',onclick:function(){
      if(busy)return;busy=true;disconnect.disabled=true;
      githubSync.disconnect().then(function(){busy=false;close();showToast('המכשיר נותק. הנתונים המקומיים נשמרו.');}).catch(function(){busy=false;disconnect.disabled=false;error.textContent='לא ניתן לנתק כרגע. נסו שוב.';});
    }},'ניתוק המכשיר הזה'):null;
    overlay.appendChild(h('section',{class:'dialog shared-dialog',role:'dialog','aria-modal':'true','aria-label':'אותם הנתונים בכל המכשירים'},
      h('div',{class:'sheet-header'},h('h2',{class:'dialog-title',text:'הבית שלכם, בכל מכשיר'}),closeButton),
      status, state.connected && state.phase==='synced' ? h('p',{text:'הכול מחובר. אפשר להמשיך במחשב או בטלפון, והשינויים עוברים אוטומטית ביניהם.'}) : form,
      h('p',{class:'shared-hint',text:'עובדים גם בלי אינטרנט. שינויים ממתינים במכשיר ונשלחים כשחוזרים לחיבור. בשינוי מקביל של אותו פריט נשמרת גרסה אחת. פריטים שונים והוצאות מתמזגים אוטומטית.'}),disconnect));
    if(githubSync)unsub=githubSync.subscribe(function(){status.textContent=githubStatusText();});
    overlay.addEventListener('click',function(e){if(e.target===overlay)close();});
    overlay.addEventListener('keydown',function(e){
      if(e.key==='Escape'){e.preventDefault();close();}
      if(e.key==='Tab'){
        var targets=Array.prototype.filter.call(overlay.querySelectorAll('button,a,input'),function(el){return !el.disabled && el.getClientRects().length;});
        var first=targets[0],last=targets[targets.length-1];
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      }
    });
    document.body.appendChild(overlay);closeButton.focus();
  }

  function openSettings() {
    currentView='settings';pageAddress('settings');
    var cu=window.CurrentUser;
    var page=h('main',{class:'kitchen-workspace standalone-page',id:'main-content'});
    var content=h('div',{class:'page-content settings-page settings-redesign'},
      h('h1',{class:'page-title',text:'הגדרות'}),
      h('p',{class:'settings-intro',text:'הבית שלכם, בדיוק כמו שנוח לכם.'}));
    var profile=h('section',{class:'settings-section','aria-label':'הפרופיל שלי'},
      h('h2',{text:'הפרופיל שלי'}));
    var editor=h('div',{class:'settings-profile-editor'});
    var edit=h('button',{type:'button',class:'btn ghost','aria-label':'עריכת פרופיל',text:'עריכה',onclick:function(){
      if(editor.children.length){editor.replaceChildren();edit.setAttribute('aria-expanded','false');return;}
      edit.setAttribute('aria-expanded','true');openProfile({inline:editor});
    },'aria-expanded':'false'});
    profile.appendChild(h('div',{class:'settings-profile-line'},avatarEl('lg'),
      h('strong',{dir:'auto',text:cu?cu.displayName():''}),edit));profile.appendChild(editor);
    var state=githubSync?githubSync.status():{};
    var devices=h('section',{class:'settings-section','aria-label':'המכשירים שלי'},
      h('h2',{text:'המכשירים שלי'}),
      h('p',{class:'settings-sync-label',role:'status',text:githubStatusText()}),
      h('p',{class:'settings-help',text:state.lastSync?'סנכרון אחרון: '+new Date(state.lastSync).toLocaleString('he-IL'):'לאחר חיבור בכל מכשיר, הנתונים מתעדכנים אוטומטית.'}),
      h('button',{type:'button',class:'btn ghost',text:state.connected?'ניהול החיבור':'חיבור מכשיר נוסף',onclick:openGitHubConnection}));
    var exportButton=h('button',{type:'button',class:'btn ghost',text:'ייצוא הנתונים לקובץ',onclick:function(){
      exportButton.disabled=true;
      Promise.all([window.PantryDB.getAll(),window.PantryDB.getAllShopping(),window.PantryDB.getAllBarcodes()]).then(function(data){
        var backup={version:1,exportedAt:new Date().toISOString(),items:data[0],shopping:data[1],barcodes:data[2],monthly:window.PantryDB.getMonthlyLog(),profile:{displayName:cu.displayName(),avatar:cu.avatar()}};
        var url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}));
        var link=h('a',{href:url,download:'HomeStock-'+ym()+'.json'});document.body.appendChild(link);link.click();link.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);
      }).catch(function(){showToast('לא ניתן לייצא כרגע. נסו שוב.');}).then(function(){exportButton.disabled=false;});
    }});
    content.appendChild(profile);content.appendChild(devices);
    content.appendChild(h('section',{class:'settings-section','aria-label':'ניהול הנתונים'},
      h('h2',{text:'ניהול הנתונים'}),exportButton,
      h('p',{class:'settings-help',text:'הקובץ כולל מלאי, קניות, הוצאות ופרופיל. תמונות המוצרים ופרטי החיבור אינם כלולים.'}),
      h('button',{type:'button',class:'settings-delete-link',text:'מחיקת המלאי',onclick:openClearInventory})));
    content.appendChild(h('p',{class:'settings-version',id:'version',text:'גרסה '+String(window.APP_VERSION||'').replace(/^v/,'')}));
    page.appendChild(content);prepareWorkspace();root.appendChild(page);
  }

  // ---- Auth / boot ----
  function enterApp() {
    var uid = window.CurrentUser.id();
    window.PantryDB.setUser(uid); // scope all data access to this user id
    window.I18N.setUser(uid); // load this user's language preference
    window.Auth.touchSession();
    return load()
      .then(function () {
        // One-time: fold any legacy inline images into the deduped image store.
        return migrateInlineImages();
      })
      .then(function () {
        // One-time: give legacy single-name items a bilingual name pair.
        return migrateItemNames();
      })
      .then(function () { return startGitHubSync(); })
      .then(function () {
        recomputeShortfall();
        currentView=routeView();
        try{history.replaceState({view:currentView,scrollY:0},'','#/'+currentView);}catch(error){}
        try{renderCurrentView();}catch(error){console.error('Page restore failed',error);currentView='inventory';renderMain();}
        // If we arrived via a device-link URL / QR, honor that explicit action
        // first (advanced path). Otherwise auto-join the deterministic,
        // profile-based household so the SAME profile shares across devices with
        // NO manual step. Falls back to a plain boot if unconfigured/opted-out.
        if (pendingLinkToken) {
          var tk = pendingLinkToken;
          pendingLinkToken = null;
          syncAutoRedeem(tk);
        } else if (syncConfigured() && !syncOptedOut()) {
          syncAutoJoin();
        } else {
          syncBoot(); // dormant unless already linked
        }
      });
  }

  // Re-render on breakpoint crossing (space-based, via CSS matchMedia — NOT
  // user-agent). Uses in-memory data, so inventory is never reloaded and the
  // active user / current view is preserved. Fires only when the ~1024px line
  // is crossed, not on every resize.
  function watchBreakpoint() {
    if (typeof window.matchMedia !== 'function') return;
    mqWide = window.matchMedia('(min-width: ' + BREAKPOINT + 'px)');
    var onChange = function () {
      if (window.CurrentUser && window.CurrentUser.id()) renderCurrentView();
    };
    if (mqWide.addEventListener) mqWide.addEventListener('change', onChange);
    else if (mqWide.addListener) mqWide.addListener(onChange); // older Safari
  }

  function watchPageTransitions(){
    var host=document.getElementById('root');
    if(!host||typeof MutationObserver==='undefined')return;
    var lastView=null,animation=null;
    new MutationObserver(function(){
      var page=host.querySelector('#main-content');
      if(!page||lastView===currentView)return;
      var previous=lastView;lastView=currentView;
      if(animation){animation.cancel();animation=null;}
      if(previous!==null)window.scrollTo({top:history.state&&history.state.scrollY||0,behavior:'instant'});
      if(pageTransition||previous===null||!page.animate||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
      animation=page.animate([
        {opacity:.65},
        {opacity:1}
      ],{duration:140,easing:'ease-out'});
    }).observe(host,{childList:true});
  }
  function start() {
    watchPageTransitions();
    window.I18N.init(); // shared language for the picker
    watchBreakpoint();
    document.addEventListener('keydown',function(e){
      if(e.key!=='/'||e.metaKey||e.ctrlKey||e.altKey||document.querySelector('.overlay'))return;
      if(e.target.closest('input,textarea,select,[contenteditable]'))return;
      var search=document.querySelector('.inventory-search');if(search){e.preventDefault();search.focus();}
    });
    // Capture a device-link token from the URL (opened link / scanned QR) and
    // scrub it from the address bar; it is redeemed once a profile is active.
    pendingLinkToken = parseLinkToken();
    if (pendingLinkToken) cleanLinkUrl();
    window.Auth.init()
      .then(function () {
        return window.PantryDB.migrateLegacyInto(window.CurrentUser.id());
      })
      .then(function () { return enterApp(); })
      .catch(function (err) {
        console.error('HomeStock startup failed', err);
        document.getElementById('root').replaceChildren(h('p', { role: 'alert', text: 'לא ניתן לטעון את המלאי. נסו לרענן את הדף.' }));
      });
  }

  window.App = {
    start: start,
    renderMain: renderMain,
    // Pure, DOM-free helpers exposed for the automated logic harness.
    _internals: {
      locationSpace: locationSpace,
      parseStockQuantity: parseStockQuantity,
      changeQty: changeQty,
      parseUnitPrice: parseUnitPrice,
      purchaseAmount: purchaseAmount,
      expenseTotal: expenseTotal,
      recordExpense: recordExpense,
      undoExpense: undoExpense,
      filteredInventory: filteredInventory,
      clearInventoryRecords: clearInventoryRecords,
      detectLang: detectLang,
      resolveNames: resolveNames,
      localName: localName,
      // THE single shared barcode lookup used by camera + manual entry.
      lookupBarcode: lookupBarcode,
      // Sync gating (dormant-by-default) — exposed for the logic harness.
      syncGetConfig: syncGetConfig,
      syncConfigured: syncConfigured,
      cloudTableFor: cloudTableFor,
      mapItemToCloud: mapItemToCloud,
      mapShoppingToCloud: mapShoppingToCloud,
      cloudRowToShopping: cloudRowToShopping,
      isConcurrentQtyConflict: isConcurrentQtyConflict,
      parseLinkToken: parseLinkToken,
      syncAutoRedeem: syncAutoRedeem,
      // Shopping List (separate model) — exposed for the logic harness.
      addToShoppingList: addToShoppingList,
      purchaseShoppingItem: purchaseShoppingItem,
      removeShoppingItem: removeShoppingItem,
      shoppingItems: function () { return shoppingItems; },
      setShoppingItems: function (a) { shoppingItems = a || []; },
      setItems: function (a) { items = a || []; },
      getItems: function () { return items; },
      // Responsive Shopping List — one shared renderer + pure breakpoint logic.
      renderShoppingList: renderShoppingList,
      layoutModeForWidth: layoutModeForWidth,
      computeShortfall: computeShortfall,
      BREAKPOINT: BREAKPOINT,
    },
  };
})();
