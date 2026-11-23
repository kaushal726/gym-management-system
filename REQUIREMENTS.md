# GymDesk — Requirements

Status: **built** (Phase 1 + 1.5 + the free parts of Phase 2, see section 9). The open questions
in section 11 are for the pilot gym's owner. Their answers may change plans, fees or grace rules,
but not the design.

## 1. Problem
Indian gyms lose money in four places:
1. Renewals nobody follows up on.
2. Dues ("aadha abhi, aadha agle hafte") that get forgotten.
3. Cash taken by staff without an entry.
4. Expired members who keep coming.

GymDesk fixes those four. Everything else is secondary.

## 2. Fixed decisions
| Decision | Value |
|---|---|
| Scale | SaaS shape (`gym_id` on every table, one QR/URL per gym), piloted on one gym |
| Cost | Free tier only. No SMS, no WhatsApp Business API, no payment gateway |
| Uploads | **None.** No photo upload, no CSV import, no file storage |
| Picture | The Google profile picture from sign-in (members who never sign in have none) |
| Login | Google sign-in for everyone (scopes `openid email profile` only; Gmail is never read) |
| Identity | Phone number per gym. Verified in person at the desk, not by OTP |
| Notifications | Web push from a service worker + owner's one-tap WhatsApp follow-up list |
| QR | Registration mandatory; daily check-in is a per-gym setting (default off) |
| Payments | Recorded by hand by staff (cash / UPI / card) |
| Stack | React + Vite + TS PWA · Cloudflare Workers (Hono) + D1 + cron · Cloudflare Pages |

## 3. Users and roles
| Role | Can | Cannot |
|---|---|---|
| Platform admin (Kaushal) | Onboard a gym with its one main owner email | See inside a gym unless invited |
| Owner (one per gym) | Everything in their gym; add managers and trainers; edit/void payments (reason required); revenue; audit log; export | Add a second owner |
| Manager | Add members, activate, renew, record payments, freeze, follow-up list, gym settings (UPI ID included; the owner gets a push for every change), QR poster | Edit/void payments, see revenue totals, audit log, export, staff |
| Trainer | Same as Manager: members, plans, payments, freezes, check-ins, follow-ups | Same limits as Manager: no sales or collection figures, reports, audit, staff, voids, exports |
| Member | View own data; turn push on/off; message the gym; sign out | Change any data |

- `collected_by` on a payment is always the signed-in staff user.
- Removing a staff member ends their sessions immediately.

## 4. Flows

### 4.1 Self-registration (QR) — mandatory
1. Member scans the gym's QR → `/g/:gymSlug`.
2. Not signed in → Google sign-in screen with the line "We only see your name, email and profile picture. We never read your Gmail."
3. Signed in, already linked to a member in this gym → member page.
4. Not a member → form: name (prefilled from Google), phone, date of birth, gender, emergency contact name + phone, guardian name + phone if under 18, consent checkbox (DPDP).
5. Submit → member `PENDING`. Screen shows "Show this screen at the desk" with name, Google picture and request number.
6. Phone already exists in this gym → "Already registered — please see the desk." No new row.
7. `PENDING` older than 7 days → `LEAD` (kept for follow-up, never deleted).

### 4.2 Desk activation (approval = subscription + payment, one step)
Manager opens the pending request (or adds a walk-in directly) → Activate sheet:
plan, start date (default today), list price (from plan), discount + reason, final price,
joining fee (first subscription only), amount paid now, mode.
Save → subscription created, payment recorded, member `ACTIVE`, receipt number issued,
owner gets an instant push.

### 4.3 Members without an account
- Manager adds a member at the desk by typing their details (source `DESK`). The gym's existing
  members are entered this way once.
- Gym operations never need the member to log in.
- Linking later: manager taps "Send link" → WhatsApp opens on the manager's phone with a
  one-time claim link to the member's number → member opens it signed in with Google → linked.
  The token is single-use and expires in 7 days. Also used to re-link a changed Google account.

### 4.4 Member page (`/me`, view-only)
Current plan, days left, start/end, status (active / grace / expired / frozen / upcoming),
dues with the gym's UPI ID (shown as text and a QR drawn in the browser from the UPI ID),
receipts, freeze history, attendance (if on), gym contact.
Gym switcher if the person is a member of more than one gym.
Only actions: push on/off, "Message the gym" (WhatsApp link), sign out.

### 4.5 Renewal
- Renewed before expiry → new subscription starts `old_end + 1`, status `UPCOMING`.
- Renewed after expiry → starts today; owner may backdate with a reason.

### 4.6 Freeze
Owner/manager freezes for N days with a reason → end date moves N days later.
Total freeze per subscription capped by the plan's `max_freeze_days`.

### 4.7 Upgrade mid-plan
Old subscription `CANCELLED`; unused value shown as a suggested credit; staff types the final
price of the new plan; new plan starts today.

### 4.8 Refund / cancel
Subscription `CANCELLED` + a negative payment row with a reason (owner only). Nothing is deleted.

### 4.9 Check-in (only if the gym turns it on)
Member scans the same QR while signed in → attendance row → full-screen result on the phone:
green (active), amber (in grace), red ("Membership expired on 12 Nov"), with their Google picture
so the desk can match the face. Desk sees a live feed.
Numbers are a hint, not proof (a photo of the QR works from anywhere).

## 5. Business rules
- Money: integer paise. Dues are computed, never stored:
  `due = final_price + joining_fee − sum(non-voided payments)`.
- Dates: `YYYY-MM-DD` in the gym's timezone (default `Asia/Kolkata`).
  A month plan ends the day before the same date n months later. If that date doesn't exist, it ends
  on the last day of the target month: 1 Mar → 31 Mar, 31 Mar → 30 Apr, 31 Jan → 28/29 Feb.
  Day-based plans: `end = start + n − 1`.
- Member status: `PENDING` (no plan yet), `JOINED` (has had a plan), `LEAD`, `REJECTED`. Whether they
  are active, in grace or expired today is worked out from their plan dates, never stored.
- Grace period: per gym, default 3 days after `end`. Member counted as "in grace".
- Phone: unique per gym, stored as 10-digit Indian mobile (`+91` assumed). Changes go to history.
- Plan price changes never touch existing subscriptions (they keep a snapshot).
- Discount requires a reason. Backdated start requires a reason.
- Every create/edit/void of a member, subscription, payment, freeze, plan, staff or setting writes an audit row with before/after.

## 6. Reminders (daily cron, 09:00 IST)
| Trigger | To | Channel |
|---|---|---|
| Expiry −5, −1, 0 days | Member | Push + follow-up row |
| Expired +3 days | Member | Push + follow-up row |
| Renewal nudge +7, +15 days after expiry | Member | Push + follow-up row |
| Dues > 0, every 3 days after the plan started | Member | Push + follow-up row |
| Active plan but no check-in for 10 days (check-in on) | Member | Push + follow-up row |
| Pending for 7 days → lead | Member | Push + follow-up row |
| Morning digest (pending, expiring, in grace, dues) | Owner | Push |
| Any payment recorded / edited / voided | Owner | Push, instant |

- Each reminder is sent at most once: unique `(subscription_id, type, for_date)`.
- A follow-up row is written whether or not push reached the member; dead endpoints (404/410) are removed and the row is marked "push failed — call".
- Queries are batched per gym, never one per member.

## 7. Owner dashboard ("Today")
Active · expiring in 7 days · in grace · total dues · pending requests ·
today's collection by staff and mode (owner only) · follow-up list with one-tap WhatsApp / call and a "contacted" mark.

## 8. Non-functional
- Mobile-first: works at 375 / 768 / 1280; ≥44px touch targets; modals are bottom sheets on mobile.
- Every data view has loading (skeleton), empty, error and success states.
- No emoji in UI; icons only. Accent `#1985D3`.
- Push works only on the deployed build; on iPhone only after "Add to Home Screen" (iOS 16.4+).
- Privacy: consent stored with timestamp; a deletion request anonymises personal fields and keeps payment rows.

## 9. What is built, and what is not
Built:
- **Phase 1:** everything above.
- **Phase 1.5:** check-in feed, WhatsApp claim link, CSV export (download only).
- **Phase 2:**
  - PT packages with trainer commission in Reports
  - offline desk check-in that syncs later
  - a gym switcher for owners of several gyms (branches)
  - self-serve gym signup (`ALLOW_GYM_SIGNUP=1`)
  - "not coming for 10 days" alerts
  - location check on check-in
  - data deletion (DPDP)

Not built, on purpose:
- **SaaS billing:** it needs a payment gateway, which goes against "free only".
- **Email reminders:** they need an outside email account.
- **Staff PIN on a shared desk phone:** each staff member signs in with their own Google account, so `collected_by` stays honest.
- **Ending a freeze early:** for now the owner cancels and re-adds the plan.

## 10. Known trade-off
With no photo upload, a member who never signs in has no picture, so "two people on one
membership" can only be caught by staff who know the face. Members who sign in show their
Google picture at check-in.

## 11. Open questions for the pilot gym owner
1. Which plans do you sell (months, prices)? Couple / student / morning-only batches?
2. Is there a joining/admission fee? Charged again if someone comes back after a long gap?
3. How many grace days do you really allow after expiry?
4. Do you allow freezes? Maximum days per plan?
5. How many staff take payments? Do they share one desk phone?
6. How do you handle cash handover from staff to you today (daily, weekly)?
7. How many members right now? (They will be typed in at the desk, one time.)
8. Personal training: sold separately? Trainer commission?
9. What time should the daily reminders go out?
