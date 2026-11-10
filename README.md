# HomeStock 🏠✅ — Smart Home Inventory

An **offline-first Progressive Web App** for tracking the food you keep at home —
organized into **Kitchen / Bathroom / House** spaces, with kitchen and bathroom subspaces, with barcode
scanning, a separate shopping list, a **Hebrew interface** with full RTL,
one household profile, **automatic on-device saving**, and optional **automatic GitHub device sync**.

Built with **plain HTML/CSS/JS** — no framework, no build step, no CDNs. Saved inventory and cached product lookup work
offline and **auto-updates** whenever a new version is deployed.

**Live app:** <https://amordechai-dn.github.io/HomeStock/>

**Current version:** `v4.5.15`

**Repository:** <https://github.com/amordechai-dn/HomeStock>

---

## Features

### Inventory
- Spaces: **מטבח** (מקפיא, מקרר, מזווה), **חדר רחצה** (שירותים, מקלחת), and **כללי** (items stored directly), all under **בית**.
- Pick a space and subspace when adding or moving items. Existing kitchen locations keep their stable IDs.
- Add / edit / delete items with **name, location, category, quantity + unit, note**.
- Products grouped by storage place across all three rooms, with shortages first.
- Global Hebrew search (including unpointed Hebrew, name aliases and notes), stock-status filters and sorting.
- One action tops up missing shopping quantities; repeating it does not duplicate the same need.
- **+/- quantity steppers** and an **"Out"** badge at zero.
- **Category emoji** icons (item-specific emoji falls back to its category).
- **Desired package amounts** per item and separate dated package batches.

### Product editor
- Product identity first, with catalog suggestions and a compact category selector.
- Direct quantity entry, unit selection, price and storage location in focused sections.
- Desired stock and notes are always visible as a regular form section. A persistent save tray previews any new expense.
- Keyboard focus stays within the dialog; the editor adapts to the visible phone viewport.

### Dropdowns
- Hebrew, RTL menus for month and unit selection, with explicit selected states.
- Keyboard support: arrows, Home/End, Enter, Escape, Tab and Hebrew type-ahead.
- Menus adapt to available screen space, remain outside scrolling dialogs, and release listeners when closed.

### Prices and expenses
- Optional unit prices in ILS, stored as integer agorot; blank is unknown, zero is free.
- Explicit new purchases record immutable purchase snapshots (package count × package price). Existing-stock entry and quantity corrections do not create expenses.
- Consuming/deleting stock or changing its price does not rewrite past spending.
- Monthly expense totals and purchase history appear in **הוצאות חודשיות**; mistaken entries can be removed without changing stock.
- Shopping-list entries count as spending only when marked purchased; undo reverses that purchase entry.
- Prices travel with inventory/shopping record data. Expense history uses the monthly log and participates in connected GitHub sync.

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
- Rear-camera video frames are decoded locally with the bundled ZXing decoder (EAN-13, EAN-8, UPC-A and UPC-E). Manual entry remains available if permission is denied.
- Single scans open a review with quantity, price and storage location. Repeating a barcode restocks its existing item; continuous mode groups products before saving.
- Lookup checks inventory and the learned barcode catalog first, then the Open Food Facts universal API (`product_type=all`) for food, beauty, pet food and general products. Coverage varies; unknown products require a name before saving.
- Successful matches are cached for offline reuse. Barcode metadata joins automatic GitHub sync when each device is connected; cached photos remain local.
- The bundled autocomplete catalog contains **309 food and household names** with Hebrew names, aliases, categories and units. These are generic suggestions, not 309 preloaded barcode identities.
- Network requests have an eight-second timeout, shared in-flight lookups, request limits and rate-limit backoff. Canceling a lookup prevents a late result from reopening its dialog.
- Tests cover real decoder images, simulated camera video, permission denial, scan-to-save/restock, cancellation, live API lookup and browser IndexedDB catalog transfer. **Physical phone-camera focus and permissions still require a device check.**

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
- Cross-device synchronization requires the one-time GitHub connection on each device.
- The GitHub adapter is active; retired provider files remain for reference only.

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
- **Shared storage:** optional authenticated GitHub repository adapter; retired provider disabled.
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

Automatic GitHub synchronization uses a separate private data repository. Each device needs its one-time connection in settings before household data can transfer. Inventory, shopping lists, expenses and learned barcode metadata sync; changes made offline are merged after reconnection. Never put access tokens in public source code.

The retired Supabase files are historical reference only. A successful simulated two-device test does not mean a user's devices have completed their connection.

---

## Project layout

```
index.html            App shell + script order
design.css            Kitchen-shelf visual design, responsive navigation and typography
fonts/                Locally bundled Rubik variable font (OFL)
styles.css            Base components (logical properties → RTL-safe), responsive
config.js             Runtime flags; retired cloud provider disabled
i18n.js               Hebrew strings + RTL handling
data/foods.js         309 bilingual food/household suggestions
barcode.js            Local-first product lookup, caching and API limits
db.js                 Per-user IndexedDB persistence (localStorage fallback)
auth.js               Passwordless profiles (repository / active user / migration)
app.js                UI, CRUD, modals, scanner, shopping list, sync glue
pwa.js                Service-worker registration + auto-update + version label
sw.js                 Service worker (precache, cache-first, VERSION)
manifest.webmanifest  PWA manifest (icons + maskable, relative paths)
sync/github-sync.js   Automatic GitHub household-data adapter
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


### Automatic device synchronization

HomeStock uses GitHub's API and the separate **private** `amordechai-dn/HomeStock-data`
repository. The public Pages repository contains only code and repository coordinates.
The retired Supabase adapter remains disabled.

Connect each browser once in Settings → אותם הנתונים בכל המכשירים. Create a
fine-grained GitHub personal access token for **HomeStock-data only**, with
Contents read/write and an expiration date. Paste it directly into the app,
never into chat or source files. Tokens are stored only in the device's IndexedDB
and sent only to `api.github.com`. Disconnect removes the local credential;
revoke the token in GitHub to remove access everywhere. Browser storage is not a
hardware credential vault: trusted app code on this origin can access it.

Changes are queued locally, sent after a short debounce, and checked every 20
seconds while the app is visible, on focus, and after reconnecting. iOS/background
apps resume synchronization when reopened. Offline use remains available. The
app shows connection errors in Settings; an expired token needs reconnecting.

`household.json` contains revisioned inventory and shopping records, expense
snapshots, per-device monthly counters, and permanent deletion tombstones.
Different records and expense entries merge; concurrent changes to the same
record use a deterministic logical revision (counter then device ID), so one
version wins. Counter totals merge across devices. SHA-conditional GitHub writes
retry conflicts without overwriting an unseen remote update. Data imported
locally preserves timestamps and conditionally checks for in-flight local edits.
Photos are separate content-addressed files under `images/`. The app refuses to
send household data if the data repository has become public. Git history retains
previous data, including deleted records/photos; this is not secure erasure.
Local profile names/avatars, UI preferences, and lookup caches stay device-local.

Verification: `node tools/github-sync-test.js` exercises two independent device
stores, offline changes, merged expenses/counters, deletions, racing edits, SHA
conflicts, photos, restart, token removal, and private-only writes.


### HomeStock 4 workspace

The home screen is a room overview and inventory workbench. A green/slate palette,
compact room summaries, explicit stock states and one stable creation action serve
both phone and desktop. Search spans every room; room-only storage filters hide
while searching. Status filters and group ordering stay consistent after updates.
The dedicated shopping page works at every viewport size and shows a partial
estimate when prices are missing. Expenses show room totals from immutable
purchase locations. Empty households expose the first-product action immediately.

`home-model.js` contains side-effect-free selection, shortage planning, room
summaries and exact agorot arithmetic. `workspace.css` contains the new workspace
layout; `design.css` retains editor/scanner/dropdown component styling. Quantity
taps are serialized per product and use an IndexedDB key lookup, so rapid taps
cannot race or count failed writes as purchases. A purchase guard prevents double
activation. Semantic product buttons, named quantities, keyboard search (`/`),
focus restoration, a skip link, and reduced-motion support improve accessibility.

Additional checks: `node tools/home-model-test.js` and `node tools/auth-test.js`.
The latter exercises rapid quantity taps, write failure/recovery and double
purchase activation. Sample household records used for screenshots live only in
local preview databases and are never seeded into the deployed app.


### Appearance

The original workspace palette is used throughout the app. The sage/forest theme overrides and appearance selector have been removed. Previously saved appearance preferences are ignored.


### Logo and app icons

The HomeStock mark is a house outline with two shelves: three storage spaces
inside one home. `brand.js` defines the canonical geometry used by the interface
and `tools/generate-icons.js`. The navigation wordmark stays Hebrew (הום סטוק),
and the small-screen home heading includes the standalone mark. Interface marks
use the original workspace colors. `icons/logo-mark.svg` and
`icons/logo-mark-light.svg` are transparent vector variants; `icons/icon.svg` and
all PNG sizes use a forest/sage tile. Maskable icons keep the mark inside their
safe zone. Regenerate every format with `node tools/generate-icons.js`.


## Household workflow — v4.5.15

- Phone-first list default, optional remembered card layout; finished stock offers adding to shopping.
- Legacy items are normalized lazily into one batch using their recorded quantity/date. No fabricated dates or automatic conversion of legacy kilograms/liters into packages. Updates persist batches; existing financial history stays intact.
- New products default to packages. A new-purchase checkbox is required for editor spending. Manual and barcode entry use one linear form: name, photo, quantity, price, expiry, location, desired stock, category and note. Voice entry has been removed.
- Shopping purchase opens quantity/price/expiry review; archive failures roll back inventory and financial records.
- Earliest-expiring batches are consumed first. Individual batch dates can be edited inside the product editor.
- Updates wait until active editors/camera flows finish before reloading.
- Opt-in background expiry-day push is delivered by the private HomeStock-data repository's `Expiry notifications` workflow. It checks twice daily; GitHub scheduling may be delayed. VAPID private key is held only in private repository Actions secrets. Public key is in config.js.
- Each phone must connect sync and enable notifications in Settings. Registration stores only that device's web-push subscription in the private repository. User can disable notifications in Settings. No phone subscription or delivery is assumed to exist until enabled and tested on-device.
- Seven-day warnings remain inside the app. Physical camera/microphone/notification delivery and layout need device verification.

Additional tests: `node tools/packages-test.js`, `node tools/pwa-idle-test.js`, and with jsdom available `node tools/household-v4-test.cjs`. The full isolated 90-product QA matrix is still available in `tools/full-qa.cjs`.


## Separate profiles — v4.5.15

First opening offers אבירז / סיגל, with no authentication. The selection is remembered and can be changed in Settings. Local inventory, shopping, expenses, profile and layout preferences are scoped independently. The original household identifier and data repository remain unchanged. Sigal starts empty and uses HomeStock-data-sigal if connected later. Sync credentials are scoped to repository and profile; legacy credentials are migrated only to the original household. Switching stores the next selection and reloads before changing the database scope, keeping in-flight work bound to its previous household.

This picker is a convenience boundary, not access control. Anyone on a connected device may choose either profile. A new phone has local storage immediately but needs a one-time repository connection for online backup/sync and push registration; the picker itself does not grant GitHub access. Sigal's separate private repository and scheduled notification workflow are prepared, with independent push keys.

Regression test: `NODE_PATH=/path/to/jsdom/node_modules node tools/profiles-test.cjs`.


## Single-product scanner — v4.5.15

Navigation has four pages: inventory, shopping, expenses and settings. Barcode scanning opens only through Add product → Scan barcode, as a camera overlay without changing pages. One detected code stops the camera and opens the shared product editor. Multi-product scanning and manual barcode entry were removed. Camera-unavailable states offer ordinary manual product entry.


Shopping photos (v4.5.15): shopping rows display a saved photo or a matching inventory photo; the compact shopping editor supports capture/gallery/removal. Purchased new inventory inherits the shopping photo. Shared image sync/GC includes both inventory and shopping, and upload receipts are scoped to repository to avoid skipping a photo in another household.
