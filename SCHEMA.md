# GymDesk data model (Cloudflare D1)

The source of truth is the migration: [worker/migrations/0001_init.sql](worker/migrations/0001_init.sql). This page explains the rules behind it. Never edit a migration that has run. Add a new numbered file instead.

## Conventions
- Ids are ULIDs: sortable by creation time and safe in URLs.
- Money is integer **paise**. Dates are `YYYY-MM-DD` in the gym's time zone. Timestamps are ISO-8601 UTC.
- Every gym-owned table has `gym_id`, and every query filters by it (SaaS).
- Financial rows are never deleted. Payments are **voided**, subscriptions **cancelled**, refunds are **negative payments**.
- There are no file or blob columns. The only picture is `users.picture_url` from Google.

## Tables
| Table | Holds |
|---|---|
| `gyms` | One row per gym: slug for `/g/:slug`, UPI ID, grace days, joining fee, reminder hour, check-in switch and optional location, receipt and request counters |
| `users`, `sessions` | One user per Google account (global across gyms). Sessions store only a hash of the cookie |
| `gym_staff` | Invites by email with role OWNER, MANAGER or TRAINER (added in `0002`). One active OWNER per gym (`0003`), set by the platform admin; the owner adds managers and trainers. The first Google sign-in with that email accepts the invite. `active = 0` removes access at once |
| `members` | A person at a gym. `status`: PENDING (signed up or added, no plan yet), JOINED (has had a plan), LEAD (pending for more than 7 days), REJECTED. `archived_at` stops reminders. `anonymised_at` marks a data-deletion request. `user_id` is NULL for people who never sign in |
| `member_phone_history` | Old and new number, who changed it and when |
| `plans` | What the gym sells: MEMBERSHIP or PT, length in months or days, price, freeze allowance, trainer commission |
| `subscriptions` | One plan bought by one member. It keeps a **snapshot** of the plan name, length, price and freeze allowance. Stores the list price, final price, discount reason, joining fee, backdate reason, trainer and `cancelled_at` |
| `payments` | Money in (positive) or refunded (negative), with mode, `collected_by` (always the signed-in staff member), a receipt number per gym, and void fields |
| `freezes` | A date range on a subscription. Freezing moves the end date, and any renewal after it, by the same number of days |
| `attendance` | One visit per member per day, with the membership state at that moment. Method is QR, DESK or OFFLINE (synced later) |
| `claim_tokens` | One-time links (hash only, 7 days) that join a desk-added member to a Google account |
| `push_subscriptions`, `push_queue` | Browser push endpoints, and pushes waiting to go out |
| `reminders_sent` | Primary key `(subscription_id, type, for_date)`: a reminder can never go out twice |
| `followups` | The owner's call list, one row per reminder, with "push failed, call instead" and "contacted by, note" |
| `gym_billing` | What each gym paid the platform for GymDesk, and the valid-till date before and after (`0004`). `gyms.status` (ACTIVE / PAUSED / ARCHIVED) and `gyms.valid_till` drive access: see `shared/saas.ts` |
| `gym_daily_runs` | Marks that a gym's daily job ran for a date |
| `audit_log` | Every change with actor, before and after JSON, and reason |

## Worked out every time, never stored
- **Dues** on a subscription = `final_price + joining_fee − sum(non-voided payments)`, or 0 if it was cancelled.
- **A member's state today** comes only from their subscription dates, so a missed cron can't leave it wrong (`shared/membership.ts`):
  - ACTIVE, or FROZEN when a freeze covers today
  - UPCOMING, when the next plan starts later
  - GRACE, up to `grace_days` after the end
  - EXPIRED after that
  - NO_PLAN if there has never been a plan
- **End date**: the day before the same date n months later. When that date doesn't exist, the plan ends on the last day of the target month. So 1 Mar ends 31 Mar, 31 Jan ends 28/29 Feb, and a renewal always starts the day after (`shared/dates.ts`).
- **A void is refused** when it would leave the money kept below what was refunded (`canVoid` in `shared/money.ts`).
