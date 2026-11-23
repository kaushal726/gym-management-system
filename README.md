# gym-management-system

GymDesk: gym membership management for Indian gyms. Members register by scanning the gym's QR
and signing in with Google; the desk activates them with a plan and a payment; the owner gets
renewal and dues reminders, a follow-up list and an audit log. Runs entirely on free tiers.

- [REQUIREMENTS.md](REQUIREMENTS.md): flows, roles, business rules, reminders
- [SCHEMA.md](SCHEMA.md): Cloudflare D1 tables

Stack: React + Vite + TypeScript PWA · Cloudflare Workers (Hono) + D1 + cron · Cloudflare Pages.
