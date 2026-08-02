# TourHome AI

Real estate virtual tour SaaS — agents upload apartment photos, 360° panoramas and video from their phone, and get a shareable, luxury-styled public tour page with a QR code.

Stack: **Next.js 15.5.22 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Supabase (Auth + Postgres + Storage) · Pannellum.js · Three.js**
UI language: **Mongolian**.

---

## 1. Architecture

```
tourhome-ai/
├── middleware.ts                  # session refresh + /dashboard route guard
├── next.config.ts                 # remote image patterns (Supabase Storage)
├── tailwind.config.ts             # monochrome Apple-style design tokens
├── components.json                # shadcn/ui config
├── supabase/
│   ├── schema.sql                 # tables, triggers, RLS, storage buckets  ← run this first
│   └── seed.sql                   # optional demo data
└── src/
    ├── app/
    │   ├── layout.tsx  globals.css  page.tsx (landing)  not-found.tsx
    │   ├── login/  register/                    # auth screens
    │   ├── auth/callback/route.ts               # email confirmation exchange
    │   ├── auth/signout/route.ts
    │   ├── actions/                             # server actions (mutations)
    │   │   ├── auth.ts        signIn / signUp / signOut / updateProfile
    │   │   ├── properties.ts  property CRUD, media registration, publish toggle
    │   │   └── leads.ts       public lead capture + agent pipeline updates
    │   ├── api/
    │   │   ├── qr/route.ts      GET  /api/qr?slug=…&format=png|svg&size=512
    │   │   ├── track/route.ts   POST /api/track   (analytics beacon)
    │   │   └── leads/route.ts   POST /api/leads   (REST alternative)
    │   ├── dashboard/
    │   │   ├── layout.tsx  page.tsx             # overview + stats
    │   │   ├── properties/  new/  [id]/edit/    # list, create, edit
    │   │   ├── leads/  analytics/  settings/
    │   └── tour/[slug]/                         # PUBLIC page — no login required
    ├── components/
    │   ├── ui/          # shadcn primitives (button, card, dialog, select, tabs…)
    │   ├── dashboard/   # nav, user menu, stat card, lead row, views chart, profile form
    │   ├── property/    # property form, image uploader, tour manager, share panel
    │   ├── tour/        # panorama viewer, three viewer, hero, gallery, contact card
    │   └── shared/      # submit button, empty state, auth forms
    ├── lib/
    │   ├── supabase/{client,server,admin,middleware}.ts
    │   ├── auth.ts  utils.ts  constants.ts  validations.ts  upload.ts
    └── types/database.types.ts  pannellum.d.ts
```

**Data flow.** Browser → Server Action / Route Handler → Supabase (RLS enforced by the user's JWT). Files go straight from the browser to Supabase Storage; only the resulting URL + path is written to Postgres. Anonymous writes (analytics, leads) go through the service-role client in server-only code, which validates that the target property is `published` before inserting.

---

## 2. Database

Six tables: `users`, `properties`, `property_images`, `property_tours`, `leads`, `analytics`, plus a `property_stats` view.

Key mechanics in `supabase/schema.sql`:

| Piece | Purpose |
|---|---|
| `handle_new_user()` trigger | creates a `public.users` profile row on signup |
| `fill_agent_id()` trigger | stamps `agent_id` on anonymous `leads` / `analytics` inserts |
| `increment_property_view(slug)` | `security definer` counter callable by anonymous visitors |
| `set_updated_at()` | maintains `updated_at` |

**Row Level Security** (enabled on every table):

- `properties` — public `SELECT` only when `status = 'published'`; insert/update/delete restricted to `auth.uid() = agent_id`.
- `property_images` / `property_tours` — readable if the parent property is published (or owned); writable only by the owner via an `EXISTS` sub-query.
- `leads` / `analytics` — `INSERT` allowed to `anon` only for published properties; `SELECT` restricted to the owning agent.
- `storage.objects` — path convention is `{bucket}/{auth.uid()}/{property_id}/{file}`, and the write policies assert `(storage.foldername(name))[1] = auth.uid()::text`, so an agent physically cannot write into another agent's folder.

Buckets created automatically: `property-images` (25 MB), `property-panoramas` (50 MB), `property-videos` (200 MB), `avatars` (5 MB).

---

## 3. Setup

```bash
# 1. install
npm install

# 2. environment
cp .env.example .env.local
```

Fill `.env.local` from **Supabase → Project Settings → API**:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=…
SUPABASE_SERVICE_ROLE_KEY=…          # server-only, never expose
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

```bash
# 3. database — paste supabase/schema.sql into Supabase Studio → SQL Editor → Run
#    (idempotent, safe to re-run)

# 4. auth redirect — Supabase → Authentication → URL Configuration
#    Site URL:      http://localhost:3000
#    Redirect URLs: http://localhost:3000/auth/callback

# 5. run
npm run dev          # http://localhost:3000
npm run typecheck    # tsc --noEmit
npm run build
```

Deploy to Vercel: add the same four env vars, set `NEXT_PUBLIC_SITE_URL` to the production domain, and add `https://<domain>/auth/callback` to the Supabase redirect list. The QR codes encode `NEXT_PUBLIC_SITE_URL`, so it must be correct in production.

---

## 4. Workflow

**Agent**

1. Register → a profile row is created by the DB trigger.
2. `/dashboard/properties/new` → fill title, price, location, area, rooms, description → saved as a draft, then redirected to the editor.
3. Editor tabs: **Мэдээлэл** (details) · **Зураг** (photos, first upload becomes cover) · **360°** (one equirectangular panorama per room) · **План** (floor plans).
4. Share panel → publish, copy link, preview QR, download QR at 1024 px.

**Customer** — opens `/tour/{slug}` with no login: full-screen 360° tour with room switcher, zoom, auto-rotate and fullscreen; gallery lightbox; specs grid; amenities; floor plans; video; sticky price card with call button and a lead form.

---

## 5. The 360° viewer

`src/components/tour/panorama-viewer.tsx` loads Pannellum 2.5.6 from CDN at runtime (no bundle cost), builds a multi-scene config from `property_tours`, and auto-links each room to the next so visitors can walk through. Custom glass controls replace the default chrome; every scene change fires an analytics event.

`src/components/tour/three-viewer.tsx` is a self-contained Three.js equirectangular renderer (inverted sphere + drag-look + wheel zoom) available as an alternative renderer for single-panorama previews.

Panoramas must be **equirectangular 2:1**. The uploader checks the aspect ratio client-side and warns before upload.

---

## 5.5 In-browser 360° capture

`src/lib/pano-stitch.ts` + `src/components/property/panorama-capture.tsx` let an agent shoot a panorama with the phone, inside the app — no external app, no manual stitching.

The gyroscope supplies the camera pose for every frame (`DeviceOrientationEvent` → quaternion → rotation matrix, three.js `DeviceOrientationControls` convention). Each frame is inverse-projected onto a 2048×1024 equirectangular buffer: for every sphere pixel in the frame's footprint, the direction is rotated into camera space, projected through a pinhole model, and sampled. Overlaps are feathered by distance-to-frame-edge, with the highest-weight sample winning, which avoids ghosting from gyro drift.

18 aim targets (a full ring, two tilted rings, zenith, nadir) guide the user; frames are captured automatically when the phone is aimed and steady. Camera FOV is user-adjustable (45–90°, default 65°).

Quality work happens in three places:

- **Capture** — the camera is requested at up to 2560×1440 and frames are used at native size (capped at 1600 px); the sphere is built at 4096×2048 when the device can hold it, which is what makes zooming in the viewer worthwhile. Exposure, white balance and focus are locked once the stream settles; frames are only taken after two consecutive steady readings and must pass a variance-of-Laplacian sharpness gate, so motion blur never reaches the stitcher.
- **Stitch** — every frame after the first is re-aligned against what is already on the sphere by maximising normalised cross-correlation over a three-stage yaw/pitch search (±3° → 0.07°), which cancels gyroscope drift; a per-channel gain then matches its exposure to the overlap. Sampling is bilinear and the poles are capped from the nearest captured colour.
- **Finish** — an edge-aware denoise plus mild unsharp mask (`src/lib/enhance.ts`), plus zero-config on-device 2× super-resolution: ESRGAN-slim (MIT, 900 KB of weights) is pulled from jsDelivr and run with TensorFlow.js in overlapping tiles, so nothing is uploaded and no API key exists. It only fires when the sphere is ≤2048 wide — a 4096 capture is already sharper than the model could make it.

**Verified offline:**

- Clean replay of 18 synthetic frames reconstructs the source panorama at **0.94/255** mean error, 98.5 % coverage — the projection math is exact.
- With ±2.5° gyro noise and ±15 % per-channel exposure swings injected, drift and exposure correction cut the error from **12.79 → 7.06/255 (45 % better)** in 809 ms for 18 frames; visually it is the difference between doubled window frames with colour blotches and a clean room.
- The clean-up pass recovers **32 %** of the error on a blurred, noisy panorama; after switching the bilateral weight to a lookup table and the unsharp blur to a separable pass it runs **2.6× faster** — 0.5 s at 2048×1024, 1.7 s at 4096×2048. Denoise/sharpen/levels settings were chosen by sweeping 32 combinations against ground truth — auto-levels measurably hurt and is off by default.

Real-world quality still depends on gyroscope accuracy and on the user rotating around the camera rather than around their body; neither can be measured without a device.

Stitching 18 frames costs ~0.8 s at 2048 and ~2.5 s at 4096 (≈40 MB peak). The viewer allows 28–120° field of view, so a 4096-wide panorama supports roughly 4× zoom before softening.

Requires a secure context (https or localhost) and a device with motion sensors.

## 5.6 Plans & free trial

Free trial = **one published listing** for 7 days. Paid plans: Starter ₮69,999 / 1 month / 5 tours, Professional ₮159,999 / 3 months / 20 tours, Business ₮499,999 / 12 months / unlimited (`PLANS` in `src/lib/constants.ts`, mirrored by `public.plan_tour_limit()`).

Enforcement lives in Postgres, not the UI:

- `enforce_publish_quota` — a BEFORE INSERT/UPDATE trigger on `properties` that rejects a transition to `published` when the trial is spent (`TOURHOME_TRIAL_USED`) or the plan's concurrent-tour limit is reached (`TOURHOME_PLAN_LIMIT`). `readableDbError` turns both into Mongolian copy. Unpublishing frees a slot.
- `protect_billing_columns` — a BEFORE UPDATE trigger on `users` that reverts `plan`, `plan_expires_at`, `trial_used` and `trial_property_id` for anyone but `service_role`, so an agent cannot self-grant a subscription through the RLS-permitted profile update.
- `activate_plan(email, plan)` — service-role helper for the rare manual case (contract customers); extends an existing subscription rather than overwriting it. All normal payments go through wire.mn.

The trial listing itself can be unpublished and republished freely (`trial_property_id`).

Existing databases: apply `supabase/migrations/002_billing.sql`.

## 5.7 Payments — wire.mn only

There is no bank-transfer path in the product: the billing page offers the three plans and sends the agent to the hosted checkout.

`src/lib/wire.ts` is a dependency-free client for the [wire.mn](https://docs.wire.mn) Merchant API: `POST /v1/payment_intents` → `POST /v1/checkout/sessions` → redirect to `pay.wire.mn`, then a signed webhook.

Flow: `startCheckout` (server action) creates the intent with `metadata.user_id`/`metadata.plan`, records a `pending` row in `payments`, and redirects. `POST /api/wire/webhook` is the only path that grants a subscription — it verifies `WirePayment-Signature` (HMAC-SHA256 over `${t}.${rawBody}`, 300 s tolerance, constant-time compare), de-duplicates on `webhook_events.id`, **re-reads the PaymentIntent from the API**, then calls `apply_payment()`, which extends `plan_expires_at` from the later of now and the current expiry. Amounts are minor units (₮49,999 → `4999900`).

Returning to `success_url` grants nothing.

**Expiry:** by default an expired plan only blocks new listings — published tours stay online so shared links and QR codes keep working. `deactivate_expired(grace_days)` archives them instead, ready for pg_cron.

**Verified offline:** 17 assertions over signature validation (valid / tampered body / wrong secret / stale / future / missing / malformed / short-hex), payment-intent extraction across four event shapes, and minor-unit conversion. Live API calls need real keys and were not executed.

## 5.8 Access window & theming

An agent's tours are public only while their access window is open: `plan_expires_at` for a paid plan, or 7 days from the moment the free trial listing was first published (`trial_started_at`, `public.trial_window()`).

When it closes, nothing is deleted or unpublished — `has_access()` is wired into the RLS `SELECT` policies for `properties`, `property_images` and `property_tours`, plus the lead/analytics `INSERT` policies and the view counter. The public route renders a "on hold" page with `noindex` instead of a 404, so the shared URL and printed QR code resume working the moment the plan is renewed.

`ThemeProvider` (no dependency) supports light / dark / system with a pre-paint inline script to avoid FOUC; the choice persists in `localStorage` and the toaster follows it.

**Verified offline:** 14 assertions across the trial/paid/expired matrix, including the boundary at 6.9 vs 7.1 days and a lapsed plan overlapping an open trial window.

## 5.9 Launch hardening

- **Password recovery** — `/forgot-password` → Supabase recovery link → `/auth/callback?next=/reset-password` → `/reset-password` sets the new password. The request form always reports success so the endpoint cannot be used to enumerate accounts.
- **Spam control** — a honeypot field on the lead form plus a Postgres rate limiter (`check_rate_limit`): 5 leads per IP per hour, 120 analytics beacons per 10 minutes. Counters self-expire; the limiter fails open so a database blip never costs a lead.
- **Lead notifications** — `src/lib/mail.ts` posts to Resend when `RESEND_API_KEY` and `MAIL_FROM` are set, with `reply_to` pointing at the visitor. Silent no-op otherwise.
- **Legal** — `/terms` and `/privacy` in Mongolian, linked from the footer and the signup consent line. Templates, explicitly marked as needing legal review.
- **SEO** — `robots.ts` blocks the dashboard and API, `sitemap.ts` lists published tours.

## 5.10 Admin panel

`/admin` is guarded by `requireAdmin()` on the server and redirects non-admins to their dashboard instead of returning 403, so the section leaves no trace for ordinary users.

- **Overview** — accounts, listings, views, leads, revenue this month and lifetime, active subscriptions per plan, latest payments.
- **Users** — search, grant or revoke a plan (wraps `activate_plan` / `revoke_plan`), change role.
- **Payments** — the last 200 wire.mn transactions with intent ids and live/test flag.
- **Properties** — every listing with a moderation toggle.
- **Landing** — swap the 360° sample shown to visitors: upload panoramas to the `site-assets` bucket (public read, `is_admin()` write), rename and reorder rooms, or restore the bundled default. The landing page reads `site_settings.landing_demo` with ISR every 5 minutes and revalidates immediately on save; if the table is missing it silently falls back to the shipped sample.

Reads are additionally allowed by `is_admin()` RLS policies; all writes go through the service-role client on the server, so a stolen browser token cannot mutate other tenants' rows.

**Security fix in 007:** `users` RLS permits an agent to update their own profile, and `role` was in scope — any account could have promoted itself to admin. `role` is now frozen by the same trigger that protects the billing columns.

## 5.11 Dependency security

Pinned to **Next.js 15.5.22**. The earlier 15.2.4 pin was affected by the May and July 2026 advisories (middleware authorisation bypass, SSRF, DoS, cache poisoning). The bypass matters here because `middleware.ts` gates `/dashboard` and `/admin` — though every page also calls `requireUser()` / `requireAdmin()` server-side, so the guard was never the only line of defence.

`sharp` is forced to ^0.35.3 through `overrides` to clear the libvips CVEs. The remaining `postcss` advisory comes from the copy Next vendors internally; it runs at build time over this project's own CSS and is not reachable from user input.

**Never run `npm audit fix --force` here** — npm's proposed "fix" downgrades Next.js to 9.3.3.

## 6. Verification performed

- `tsc --noEmit` → **0 errors**
- `next build` → **32 routes compiled**, ESLint and type validation passed
- Panorama stitcher round-trip test → **0.94/255 mean error**, 98.5 % coverage over 18 frames
- wire.mn webhook signature + parsing suite → **17/17 assertions passed**
- Stitcher under gyro + exposure noise → **45 % error reduction**; clean-up pass → **32 % error reduction**
- Access-window matrix → **14/14 assertions passed**
- Plan limits and trial window cross-checked between SQL and TypeScript → **5/5 agree**
- `supabase/schema.sql` parsed with libpg_query (pglast) → **181 statements, valid PostgreSQL**

Note: the build machine used for verification had no access to Google Fonts, so `next/font` was stubbed there only. The shipped `layout.tsx` uses `Inter` with `latin` + `cyrillic` subsets and will fetch normally on your machine.

---

## 7. PWA

`public/manifest.webmanifest` + `public/sw.js` make the dashboard installable on phones (standalone display, app shortcuts, offline shell). `ServiceWorkerRegistrar` registers the worker in production only; `InstallPWA` surfaces the native install prompt on Chrome/Android and Add-to-Home-Screen instructions on iOS Safari. Panoramas served from Supabase Storage are cached with a 60-entry cap.

Step-by-step launch instructions in Mongolian: **`DEPLOY-MN.md`**.

## 8. Roadmap

Hotspot editor (place scene links visually), watermarking, custom domains per agency, team seats, PDF brochure export, AI room labelling and auto-description from photos.
