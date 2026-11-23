# gym-management-system

GymDesk: membership management for Indian gyms, running entirely on free tiers.

- Members scan the gym's QR, sign in with Google and fill a short form. They show up as **pending** at the desk.
- The desk activates them in one step: plan + payment (partial payments become dues).
- Every morning a cron prepares expiry, dues, lead and "not coming" reminders. It sends them as web push and puts them on the owner's **follow-up list** with one-tap WhatsApp.
- The owner gets a push for every payment a manager records. Voids, refunds and cancellations need the owner and a reason, and everything is in the audit log.
- Members get a view-only page: days left, dues with a UPI QR, receipts and plan history.
- The platform admin onboards each gym with **one main owner** email. Three staff roles. **Owner**: everything, and adds the team. **Manager** and **Trainer**: run the desk (members, plans, payments, check-ins) but never see sales, reports or the audit log.
- Built for phones first (about 80% of use). Phones get an install card, either Android's install prompt or the iPhone "Add to Home Screen" steps.

See [REQUIREMENTS.md](REQUIREMENTS.md) for the rules and [SCHEMA.md](SCHEMA.md) for the data model.

## Stack

| Piece | What |
|---|---|
| Web | React + Vite + TypeScript PWA in `web/` (no UI library; tokens in `web/src/styles/tokens.css`) |
| API + cron | One Cloudflare Worker (Hono) in `worker/`. It serves the built web app as static assets on the same origin |
| DB | Cloudflare D1 (`gym-management-system`), migrations in `worker/migrations/` |
| Auth | Google Identity Services ID token, verified in the Worker, then our own HttpOnly session cookie. No Firebase |
| Push | Web Push with VAPID and encrypted payloads, written with WebCrypto (`worker/src/push/webpush.ts`) |
| Shared | Date, money, membership and reminder rules plus API types in `shared/`, used by both sides |

No file uploads anywhere. The only picture is the Google profile picture.

## Run locally

```bash
npm install
```

```bash
npm run db:migrate:local
```

`.dev.vars` (gitignored) holds the local settings: `DEV_AUTH=1` (sign in with any email, no Google), `ALLOW_GYM_SIGNUP=1`, `PLATFORM_ADMIN_EMAILS`, and the VAPID keys. Make the keys with `node scripts/gen-vapid.mjs <file>`.

Start the API (port 8787) and the web app (port 5190, which forwards `/api` to the API):

```bash
npm run dev:api
```

```bash
npm run dev:web
```

Fill a demo gym (owner `owner@gymdesk.test`, manager `desk@gymdesk.test`, member `meera.joshi@gymdesk.test`):

```bash
node scripts/demo-seed.mjs
```

## Checks

```bash
npm run typecheck && npm test
```

```bash
npm run smoke
```

`npm run smoke` runs 95 end-to-end API checks against the running `wrangler dev`. They cover registration, activation, dues, voids, refunds, freezes, renewals, PT, check-in, claim links, the cron (no duplicates), owner/manager/trainer permissions and staff removal.

To run the daily job for any date locally (DEV_AUTH only), POST to `/api/dev/cron?date=YYYY-MM-DD`.

## Deploy (Cloudflare free plan)

1. **Google sign-in.** In Google Cloud Console, go to APIs & Services, then Credentials. Create an OAuth client ID of type **Web application**. Add the site's URL (and `http://localhost:5190` for testing) under *Authorized JavaScript origins*. Put the client ID in `GOOGLE_CLIENT_ID` in `wrangler.toml`. It is public.
2. **Secrets** (never committed):

   ```bash
   npx wrangler secret put VAPID_PRIVATE_JWK
   ```

   ```bash
   npx wrangler secret put PLATFORM_ADMIN_EMAILS
   ```

3. **Schema:**

   ```bash
   npm run db:migrate:remote
   ```

4. **Build and deploy, from `master` only.** Merge the feature PR first, then `git checkout master && git pull`. The deploy script refuses any other branch and any uncommitted changes:

   ```bash
   npm run deploy
   ```

5. Sign in as the platform admin, open `/platform`, create the gym with the owner's Gmail, and print the QR poster from Settings.

Free-plan limits that shaped the design:
- Workers allow 50 outgoing requests per run. Pushes wait in `push_queue`, and the hourly cron sends 40 at a time.
- D1 allows 500 MB per database and 5M row reads a day.
- The cron runs at :30 past every hour UTC (on the hour in India). Each gym runs once a day at its reminder hour.

On iPhone, web push only works after the member adds the site to the Home Screen (iOS 16.4+). Reminders that can't reach anyone show "call instead" on the follow-up list.
