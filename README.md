# HomeStock 🏠✅ — Smart Home Inventory

An **offline-first Progressive Web App** for tracking the food you keep at home —
organized into **Kitchen / Bathroom / House** spaces, with kitchen and bathroom subspaces, with barcode
scanning, a separate shopping list, a **Hebrew interface** with full RTL,
one household profile, and **automatic on-device saving**.

Built with **plain HTML/CSS/JS** — no framework, no build step, no CDNs. It works
100% offline and **auto-updates** whenever a new version is deployed.

**Live app:** <https://amordechai-dn.github.io/HomeStock/>

**Current version:** `v3.3.1`

**Repository:** <https://github.com/amordechai-dn/HomeStock>

---

## Features

### Inventory
- Spaces: **מטבח** (מקפיא, מקרר, מזווה), **חדר רחצה** (שירותים, מקלחת), and **בית** (items stored directly).
- Pick a space and subspace when adding or moving items. Existing kitchen locations keep their stable IDs.
- Add / edit / delete items with **name, location, category, quantity + unit, note**.
- Cards grouped by **Fridge / Freezer / Pantry** with per-section counts.
- **+/- quantity steppers** and an **"Out"** badge at zero.
- **Category emoji** icons (item-specific emoji falls back to its category).
- **Desired amounts (par levels)** per item and **monthly restock tracking**.

### Product editor
- Product identity first, with catalog suggestions and a compact category selector.
- Direct quantity entry, unit selection, price and storage location in focused sections.
- Monthly targets and notes are expandable. A persistent save tray previews any new expense.
- Keyboard focus stays within the dialog; the editor adapts to the visible phone viewport.

### Dropdowns
- Hebrew, RTL menus for month and unit selection, with explicit selected states.
- Keyboard support: arrows, Home/End, Enter, Escape, Tab and Hebrew type-ahead.
- Menus adapt to available screen space, remain outside scrolling dialogs, and release listeners when closed.

### Prices and expenses
- Optional unit prices in ILS, stored as integer agorot; blank is unknown, zero is free.
- Priced additions/restocks record immutable purchase snapshots (quantity × unit price).
- Consuming/deleting stock or changing its price does not rewrite past spending.
- Monthly expense totals and purchase history appear in **הוצאות חודשיות**; mistaken entries can be removed without changing stock.
- Shopping-list entries count as spending only when marked purchased; undo reverses that purchase entry.
- Prices travel with inventory/shopping record data. Expense history uses the existing per-device monthly log and is currently **local to each device**; cloud backend setup remains pending.

### Product images (on-device)
- Photos are **compressed on-device** (WebP when supported), stored as a small
  **thumbnail + full** variant, and **de-duplicated by content hash** — identical
  photos are stored once and referenced by `imageHash`.

### Smart naming
- **Autocomplete catalog** from a local **bilingual food database** (EN/HE names
  + aliases) that also suggests the right **emoji** and category/unit.
- Items carry **bilingual names** (`nameEn` / `nameHe`); display picks the side
  matching the current language and falls back gracefully.

### Barcode scanning 📷
- **Camera scanning** with a resilient **continuous decode loop** (rear camera,
  formats **EAN-13 / UPC-A / UPC-E / EAN-8**, `TRY_HARDER`), plus **manual
  barcode entry**.
- **Continuous-scan session:** toggle ON to batch many products (with a short
  duplicate cooldown) and commit them all with one tap; OFF scans a single item
  then stops.
- Detection feedback (frame flash, beep, vibrate, detected-number badge) and a
  **dev debug overlay** (`?debug=1`) showing decoder-running / frames-processed.
- Barcodes are resolved to a product **name/image** via the free **Open Food
  Facts** API (the only online-dependent step) and **cached per-user** so repeat
  scans work offline.

### Shopping list (separate feature)
- A **standalone model** — *not* derived from inventory.
- **Add to list**, mark **purchased → add straight into inventory**, and
  **low-stock suggestions** based on desired amounts.
- Responsive: a **sticky side panel** on desktop, a full page on mobile.

### Single household profile
- Opens straight into inventory, with no user picker or language selector.
- Uses Hebrew regardless of browser language or previously saved preferences.
- All interface text and the visible app name (**הום סטוק**) are Hebrew; no English UI dictionary or fallback is shipped. Saved user content and technical connection values are preserved.
- Reuses the active legacy profile (then Aviraz or the oldest available profile)
  and pins its stable ID, preserving its inventory and sync identity.
- Other legacy profiles remain stored; no profile data is deleted.

### Automatic saving and cloud status
- Inventory, shopping lists and expenses save automatically on the current device.
- Clearing inventory works offline without cloud setup; shopping lists and expense history are preserved.
- The retired Supabase provider is disabled, ships no backend credentials and ignores old saved overrides.
- Cross-device synchronization is **not active** until a replacement shared-storage service is connected.
- Legacy sync code and schema files remain for reference, but are not loaded by the app.

### Platform
- **Hebrew interface** with full **RTL** layout (CSS logical properties).
- **Installable PWA** with **offline support** and **automatic updates**.
- **Responsive kitchen workspace:** cobalt navigation rail on desktop, thumb-friendly dock on mobile.
- **Fast inventory search and storage filters**, locally bundled Hebrew Rubik typography, and a shopping-list receipt.

---

## Tech stack

- **Frontend:** vanilla **HTML / CSS / JavaScript** — no framework, no bundler,
  no CDNs. CSS uses logical properties for RTL safety.
- **Local storage:** **IndexedDB** (per-user database), with a **localStorage
  fallback**; monthly log and settings in per-user localStorage keys.
- **Service worker:** precache + cache-first, offline navigation, self-updating.
- **Backend:** no active cloud backend. The retired provider is disabled.
- **Vendored libraries (local, no CDN):** [`@zxing/library`](https://github.com/zxing-js/library)
  for barcode decoding. The legacy QR generator is not loaded by the current app.
- **Hosting:** **GitHub Pages** (static).

---

## Run locally

From the repository root, serve the app (no build step):

```bash
python3 -m http.server 8080
# open http://localhost:8080/
```

Run the logic test harness (Node, no browser):

```bash
node tools/auth-test.js   # exit 0 = all pass
```

---

## Deploy / update workflow

Deployment is just a git push to the Pages repo:

1. Edit file(s).
2. **Bump `VERSION`** in `sw.js` (and the `FALLBACK_VERSION` in `pwa.js`) —
   *only when app assets change*; docs-only changes need no bump.
3. `git add -A && git commit -m "..." && git push`.
4. **GitHub Pages** rebuilds (~1 minute).
5. Installed PWAs detect the new service worker on next focus/open, activate it,
   and reload **once** automatically. The header version label reflects the new
   `VERSION`.

---

## Cross-device sync status

Cloud synchronization is not currently active. The old provider has been
retired; no manual sync setup or backend settings are exposed in the app.
A replacement requires an authenticated shared-storage service and a new
adapter before computer/phone synchronization can be offered.

The files under `sync/` are legacy reference material, not current setup instructions.

---

## Project layout

```
index.html            App shell + script order
design.css            Kitchen-shelf visual design, responsive navigation and typography
fonts/                Locally bundled Rubik variable font (OFL)
styles.css            Base components (logical properties → RTL-safe), responsive
config.js             Runtime flags; retired cloud provider disabled
i18n.js               English + Hebrew strings + RTL handling
data/foods.js         Local bilingual food database (autocomplete + emoji)
db.js                 Per-user IndexedDB persistence (localStorage fallback)
auth.js               Passwordless profiles (repository / active user / migration)
app.js                UI, CRUD, modals, scanner, shopping list, sync glue
pwa.js                Service-worker registration + auto-update + version label
sw.js                 Service worker (precache, cache-first, VERSION)
manifest.webmanifest  PWA manifest (icons + maskable, relative paths)
sync/homesync.js      Cross-device sync engine (lazy-loaded, dormant by default)
sync/schema.sql       Supabase schema + indexes + RLS + device-link RPCs
sync/SYNC_SETUP.md    Supabase setup walkthrough
vendor/zxing.min.js   Vendored barcode scanner (@zxing/library UMD)
vendor/qrcode.js      Vendored QR generator (device linking)
tools/auth-test.js    Node logic harness (profiles, storage, i18n, decode proof)
tools/generate-*.js   Regenerate icons / food database (pure Node)
icons/                16–512 PNG icons + maskable + Apple touch icon
docs/HOW_IT_WORKS.md  Architecture & how-it-works reference
```

For a deeper dive into architecture, data model, and the sync engine, see
**[`docs/HOW_IT_WORKS.md`](./docs/HOW_IT_WORKS.md)**.

---

## Install on your phone

- **iPhone (Safari):** open the link → Share → **Add to Home Screen**.
- **Android (Chrome):** open the link → menu (⋮) → **Install app**.

Launch it from the home-screen icon for a full-screen, offline app.

---

## Version history (highlights)

| Version | Highlights |
| --- | --- |
| **v3.1.0** | Kitchen, Bathroom and House spaces with nested storage locations |
| **v3.0.0** | Kitchen-shelf redesign, search, storage filters, mobile dock, new icons and offline Hebrew font |
| **v2.2.0** | One household profile, direct startup, Hebrew-only interface |
| **v2.0.1** | Barcode scanner fix: resilient own decode loop, detection feedback, timeout tips, debug overlay |
| **v2.0.0** | Polished responsive header/toolbar + app-wide responsive layout (cloud-sync milestone) |
| **v1.15.0** | Shopping List as a separate, independent feature/model |
| **v1.14.0** | Fixed stale-JWT sync error + full auto-sync |
| **v1.13.0** | Responsive Shopping List (desktop side panel / mobile page) |
| **v1.12.0** | Zero-config baked backend + QR/URL device linking |
| **v1.11.0** | Dormant-by-default Supabase cross-device sync |
| **v1.10.0** | Switch User vs Manage Users separation |
| **v1.9.0** | Scanner fixes + manual barcode entry |
