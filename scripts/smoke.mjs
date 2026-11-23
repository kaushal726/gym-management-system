// End-to-end API check against `wrangler dev` with a fresh local D1 (DEV_AUTH=1).
// Usage: node scripts/smoke.mjs [baseUrl]   — exits non-zero on the first failed check.
const BASE = process.argv[2] ?? "http://localhost:8787";
const RUN = Date.now().toString(36);
let checks = 0;

function ok(condition, label, detail) {
  checks += 1;
  if (!condition) {
    console.error(`FAIL ${label}`, detail ?? "");
    process.exit(1);
  }
  console.log(`ok   ${label}`);
}

class Client {
  constructor(name) {
    this.name = name;
    this.cookie = "";
  }
  async call(method, path, body) {
    const res = await fetch(BASE + path, {
      method,
      headers: { "Content-Type": "application/json", Origin: BASE, ...(this.cookie ? { Cookie: this.cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.get("set-cookie");
    if (set) this.cookie = set.split(";")[0];
    const type = res.headers.get("content-type") ?? "";
    return { status: res.status, body: type.includes("json") ? await res.json() : await res.text() };
  }
  get(path) {
    return this.call("GET", path);
  }
  post(path, body = {}) {
    return this.call("POST", path, body);
  }
  patch(path, body) {
    return this.call("PATCH", path, body);
  }
  async login(email) {
    const r = await this.post("/api/auth/dev", { email, name: this.name });
    ok(r.status === 200, `${this.name} signs in`, r.body);
    return this;
  }
}

const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const phone = (n) => `9${RUN.replace(/\D/g, "").padEnd(5, "1").slice(0, 5)}${String(n).padStart(4, "0")}`.slice(0, 10);

const admin = await new Client("Platform Admin").login("admin@gymdesk.test");
const owner = await new Client("Owner Singh").login(`owner-${RUN}@gymdesk.test`);
const manager = await new Client("Manager Kumar").login(`manager-${RUN}@gymdesk.test`);
const ravi = await new Client("Ravi Sharma").login(`ravi-${RUN}@gymdesk.test`);
const copycat = await new Client("Copy Cat").login(`copy-${RUN}@gymdesk.test`);
const asha = await new Client("Asha Verma").login(`asha-${RUN}@gymdesk.test`);
const trainer = await new Client("Trainer Vikram").login(`trainer-${RUN}@gymdesk.test`);

// Onboarding
const slug = `iron-${RUN}`;
let r = await owner.post("/api/platform/gyms", { name: "Iron Paradise", slug, ownerEmail: `owner-${RUN}@gymdesk.test` });
ok(r.status === 403, "a gym owner cannot use the platform admin route", r);
r = await admin.post("/api/platform/gyms", { name: "Iron Paradise", slug, ownerEmail: `owner-${RUN}@gymdesk.test`, phone: "9876500000", address: "MG Road" });
ok(r.status === 201, "platform admin creates a gym", r.body);
const gymId = r.body.id;
r = await owner.get("/api/auth/session");
ok(r.body.staffOf.some((s) => s.gymId === gymId && s.role === "OWNER"), "owner sees the gym on their session", r.body);
const G = `/api/gyms/${gymId}`;

r = await owner.patch(`${G}/settings`, {
  name: "Iron Paradise",
  phone: "9876500000",
  address: "MG Road",
  timezone: "Asia/Kolkata",
  upiId: "ironparadise@okaxis",
  graceDays: 3,
  joiningFeePaise: 50000,
  checkinEnabled: true,
  checkinLat: null,
  checkinLng: null,
  checkinRadiusM: null,
  reminderHour: 9,
});
ok(r.status === 200, "owner saves settings", r.body);

const plan = async (body) => (await owner.post(`${G}/plans`, body)).body.id;
const monthly = await plan({ kind: "MEMBERSHIP", name: "Monthly", durationMonths: 1, durationDays: null, pricePaise: 150000, maxFreezeDays: 15, trainerCommissionPct: 0 });
const quarterly = await plan({ kind: "MEMBERSHIP", name: "Quarterly", durationMonths: 3, durationDays: null, pricePaise: 400000, maxFreezeDays: 30, trainerCommissionPct: 0 });
const pt = await plan({ kind: "PT", name: "PT 12 sessions", durationMonths: 1, durationDays: null, pricePaise: 300000, maxFreezeDays: 0, trainerCommissionPct: 40 });
ok(monthly && quarterly && pt, "owner creates membership and PT plans");

r = await owner.post(`${G}/staff`, { email: `partner-${RUN}@gymdesk.test`, role: "OWNER" });
ok(r.status === 400, "a gym owner cannot add a second owner", r.body);
r = await owner.post(`${G}/staff`, { email: `manager-${RUN}@gymdesk.test`, role: "MANAGER" });
ok(r.status === 201, "owner invites a manager", r.body);
r = await manager.get("/api/auth/session");
ok(r.body.staffOf.some((s) => s.gymId === gymId && s.role === "MANAGER"), "invite is accepted by the existing account", r.body);

// Self-registration from the QR
r = await ravi.get(`/api/public/gyms/${slug}`);
ok(r.status === 200 && r.body.member === null, "member opens the gym QR page");
const raviPhone = phone(1);
const reg = { name: "Ravi Sharma", phone: `+91 ${raviPhone}`, dob: "1995-04-12", gender: "MALE", emergencyName: "Sunita", emergencyPhone: phone(2), guardianName: null, guardianPhone: null, consent: true };
r = await ravi.post(`/api/public/gyms/${slug}/register`, { ...reg, consent: false });
ok(r.status === 400 && r.body.field === "consent", "registration needs consent", r.body);
r = await ravi.post(`/api/public/gyms/${slug}/register`, { ...reg, dob: "2012-01-01" });
ok(r.status === 400 && r.body.field === "guardianName", "a minor needs a guardian", r.body);
r = await ravi.post(`/api/public/gyms/${slug}/register`, reg);
ok(r.status === 201, "member registers", r.body);
const raviId = r.body.memberId;
r = await ravi.post(`/api/public/gyms/${slug}/register`, reg);
ok(r.status === 200 && r.body.memberId === raviId, "registering twice returns the same request");
r = await copycat.post(`/api/public/gyms/${slug}/register`, { ...reg, name: "Copy Cat" });
ok(r.status === 409 && r.body.field === "phone", "someone else cannot register the same phone", r.body);
r = await ravi.get(`/api/public/gyms/${slug}`);
ok(r.body.member?.status === "PENDING" && r.body.member.requestNo === 1, "member sees the pending screen with request number 1", r.body);

// Isolation
r = await ravi.get(`${G}/members`);
ok(r.status === 404, "a member cannot open the admin API", r);
r = await ravi.get(`/api/public/me/gyms/${gymId}`);
ok(r.status === 200 && r.body.membership.state === "NO_PLAN", "pending member sees no plan yet", r.body);

// Desk activation with a partial payment
r = await manager.get(`${G}/members?filter=pending`);
ok(r.body.items.some((i) => i.id === raviId) && r.body.counts.pending === 1, "manager sees the pending request", r.body.counts);
r = await manager.get(`${G}/members/${raviId}`);
ok(r.body.isFirstSubscription && r.body.nextStartDate === today, "detail says first plan starts today", r.body.nextStartDate);
r = await manager.post(`${G}/members/${raviId}/subscriptions`, { planId: monthly, startDate: addDays(today, -3), finalPricePaise: 150000, discountReason: null, joiningFeePaise: 50000, backdateReason: "Joined last week", trainerName: null, payment: null });
ok(r.status === 403, "manager cannot backdate a plan", r.body);
r = await manager.post(`${G}/members/${raviId}/subscriptions`, { planId: monthly, startDate: today, finalPricePaise: 120000, discountReason: null, joiningFeePaise: 50000, backdateReason: null, trainerName: null, payment: null });
ok(r.status === 400 && r.body.field === "discountReason", "a discount needs a reason", r.body);
r = await manager.post(`${G}/members/${raviId}/subscriptions`, { planId: monthly, startDate: today, finalPricePaise: 150000, discountReason: null, joiningFeePaise: 50000, backdateReason: null, trainerName: null, payment: { amountPaise: 300000, mode: "CASH", note: null } });
ok(r.status === 400 && r.body.field === "amountPaise", "cannot take more than the total", r.body);
r = await manager.post(`${G}/members/${raviId}/subscriptions`, { planId: monthly, startDate: today, finalPricePaise: 150000, discountReason: null, joiningFeePaise: 50000, backdateReason: null, trainerName: null, payment: { amountPaise: 100000, mode: "UPI", note: null } });
ok(r.status === 201, "manager activates with plan + partial payment in one step", r.body);
const sub1 = r.body.subscriptionId;

r = await ravi.get(`/api/public/me/gyms/${gymId}`);
ok(r.body.membership.state === "ACTIVE" && r.body.duesTotalPaise === 100000, "member sees ACTIVE with ₹1,000 due", { state: r.body.membership.state, due: r.body.duesTotalPaise });
ok(r.body.payments.length === 1 && r.body.payments[0].receiptNo === 1, "member sees receipt 1");
const firstPaymentId = r.body.payments[0].id;

// Manager limits
r = await manager.post(`${G}/payments/${firstPaymentId}/void`, { reason: "oops" });
ok(r.status === 403, "manager cannot void a payment");
r = await manager.get(`${G}/audit`);
ok(r.status === 403, "manager cannot read the audit log");
r = await manager.get(`${G}/reports/collections`);
ok(r.status === 403, "manager cannot see revenue reports");
r = await manager.get(`${G}/dashboard`);
ok(r.status === 200 && r.body.collectionToday === null && r.body.collectionMonthPaise === null, "manager dashboard hides revenue", r.body.collectionToday);

// Owner voids, audit shows it
r = await owner.post(`${G}/payments/${firstPaymentId}/void`, { reason: "Entered twice by mistake" });
ok(r.status === 200, "owner voids the payment", r.body);
r = await owner.post(`${G}/payments/${firstPaymentId}/void`, { reason: "again" });
ok(r.status === 409, "a voided payment cannot be voided again");
r = await ravi.get(`/api/public/me/gyms/${gymId}`);
ok(r.body.duesTotalPaise === 200000, "dues go back to ₹2,000 after the void", r.body.duesTotalPaise);
r = await owner.get(`${G}/audit`);
ok(r.body.items.some((a) => a.action === "PAYMENT_VOID" && a.reason === "Entered twice by mistake"), "audit log shows the void with its reason");

// Pay the rest
r = await manager.post(`${G}/subscriptions/${sub1}/payments`, { amountPaise: 250000, mode: "CASH", note: null });
ok(r.status === 400, "cannot pay more than due");
r = await manager.post(`${G}/subscriptions/${sub1}/payments`, { amountPaise: 200000, mode: "CASH", note: null });
ok(r.status === 201, "manager records the remaining dues");
r = await owner.get(`${G}/dashboard`);
ok(r.body.collectionToday.totalPaise === 200000 && r.body.counts.active === 1 && r.body.counts.withDues === 0, "owner dashboard: today's collection ₹2,000, 1 active, no dues", r.body);
ok(r.body.collectionToday.byStaff[0]?.name === "Manager Kumar", "collection is attributed to the manager");

// Renew early, then freeze the running plan
r = await manager.get(`${G}/members/${raviId}`);
const sub1End = r.body.subscriptions.find((s) => s.id === sub1).endDate;
ok(r.body.nextStartDate === addDays(sub1End, 1), "renewal starts the day after the current plan ends");
r = await manager.post(`${G}/members/${raviId}/subscriptions`, { planId: quarterly, startDate: today, finalPricePaise: 400000, discountReason: null, joiningFeePaise: 0, backdateReason: null, trainerName: null, payment: null });
ok(r.status === 409, "a renewal cannot overlap the running plan", r.body);
r = await manager.post(`${G}/members/${raviId}/subscriptions`, { planId: quarterly, startDate: addDays(sub1End, 1), finalPricePaise: 400000, discountReason: null, joiningFeePaise: 50000, backdateReason: null, trainerName: null, payment: { amountPaise: 400000, mode: "UPI", note: null } });
ok(r.status === 400 && r.body.field === "joiningFeePaise", "joining fee only on the first membership", r.body);
r = await manager.post(`${G}/members/${raviId}/subscriptions`, { planId: quarterly, startDate: addDays(sub1End, 1), finalPricePaise: 400000, discountReason: null, joiningFeePaise: 0, backdateReason: null, trainerName: null, payment: { amountPaise: 400000, mode: "UPI", note: null } });
ok(r.status === 201, "manager renews early");
const sub2 = r.body.subscriptionId;
r = await manager.post(`${G}/subscriptions/${sub1}/freezes`, { fromDate: addDays(today, 2), days: 20, reason: "Travel" });
ok(r.status === 400 && r.body.field === "days", "manager cannot freeze beyond the plan's limit", r.body);
r = await manager.post(`${G}/subscriptions/${sub1}/freezes`, { fromDate: addDays(today, 2), days: 5, reason: "Knee injury" });
ok(r.status === 201, "manager freezes the running plan for 5 days");
r = await manager.get(`${G}/members/${raviId}`);
const s1 = r.body.subscriptions.find((s) => s.id === sub1);
const s2 = r.body.subscriptions.find((s) => s.id === sub2);
ok(s1.endDate === addDays(sub1End, 5) && s2.startDate === addDays(s1.endDate, 1), "freeze moves the end date and shifts the renewal", { s1: s1.endDate, s2: s2.startDate });

// PT package with a trainer, then cancel with refund
r = await manager.post(`${G}/members/${raviId}/subscriptions`, { planId: pt, startDate: today, finalPricePaise: 300000, discountReason: null, joiningFeePaise: 0, backdateReason: null, trainerName: null, payment: null });
ok(r.status === 400 && r.body.field === "trainerName", "a PT package needs a trainer");
r = await manager.post(`${G}/members/${raviId}/subscriptions`, { planId: pt, startDate: today, finalPricePaise: 300000, discountReason: null, joiningFeePaise: 0, backdateReason: null, trainerName: "Vikram", payment: { amountPaise: 300000, mode: "CASH", note: null } });
ok(r.status === 201, "PT runs alongside the membership");
const ptSub = r.body.subscriptionId;
r = await owner.get(`${G}/reports/collections`);
ok(r.body.trainers.find((t) => t.trainerName === "Vikram")?.commissionPaise === 120000, "trainer commission is 40% of PT collection", r.body.trainers);
r = await manager.post(`${G}/subscriptions/${ptSub}/cancel`, { reason: "Changed mind", refund: null });
ok(r.status === 403, "manager cannot cancel a plan");
r = await owner.post(`${G}/subscriptions/${ptSub}/cancel`, { reason: "Trainer left", refund: { amountPaise: 400000, mode: "CASH" } });
ok(r.status === 400, "refund cannot exceed what was paid");
r = await owner.post(`${G}/subscriptions/${ptSub}/cancel`, { reason: "Trainer left", refund: { amountPaise: 150000, mode: "CASH" } });
ok(r.status === 200, "owner cancels PT with a partial refund");
r = await owner.get(`${G}/members/${raviId}`);
ok(r.body.payments.some((p) => p.amountPaise === -150000) && r.body.duesTotalPaise === 0, "refund is a negative entry and dues stay 0", r.body.duesTotalPaise);
const refundRow = r.body.payments.find((p) => p.amountPaise === -150000);
const ptPayment = r.body.payments.find((p) => p.subscriptionId === ptSub && p.amountPaise === 300000);
r = await owner.post(`${G}/payments/${refundRow.id}/void`, { reason: "x" });
ok(r.status === 409, "a refund entry cannot be voided");
r = await owner.post(`${G}/payments/${ptPayment.id}/void`, { reason: "x" });
ok(r.status === 409, "a payment whose money was refunded cannot be voided");

// Check-in
r = await ravi.post(`/api/public/gyms/${slug}/checkin`, {});
ok(r.status === 200 && r.body.result === "ACTIVE" && !r.body.alreadyToday, "member checks in and sees ACTIVE", r.body);
r = await ravi.post(`/api/public/gyms/${slug}/checkin`, {});
ok(r.body.alreadyToday, "second scan the same day does not add a visit");
r = await copycat.post(`/api/public/gyms/${slug}/checkin`, {});
ok(r.status === 403, "a non-member cannot check in");

// Desk-added member and the claim link
r = await manager.post(`${G}/members`, { name: "Asha Verma", phone: phone(3), dob: null, gender: "FEMALE", emergencyName: null, emergencyPhone: null, guardianName: null, guardianPhone: null });
ok(r.status === 201, "manager adds a walk-in at the desk");
const ashaId = r.body.id;
r = await manager.post(`${G}/members/${ashaId}/subscriptions`, { planId: monthly, startDate: today, finalPricePaise: 150000, discountReason: null, joiningFeePaise: 0, backdateReason: null, trainerName: null, payment: { amountPaise: 150000, mode: "CASH", note: null } });
ok(r.status === 201, "walk-in is activated");
r = await manager.post(`${G}/members/${ashaId}/claim-link`, {});
ok(r.status === 200 && r.body.url.includes("/claim/"), "manager creates a WhatsApp claim link", r.body.url);
const token = r.body.url.split("/claim/")[1];
r = await asha.post(`/api/public/claim/${token}`, {});
ok(r.status === 200, "member links her Google account with the link");
r = await asha.post(`/api/public/claim/${token}`, {});
ok(r.status === 410, "the link works only once");
r = await asha.get(`/api/public/me/gyms/${gymId}`);
ok(r.body.membership.state === "ACTIVE" && r.body.member.name === "Asha Verma", "linked member sees her plan");

// Cron: reminders exactly once, on the end of the renewal chain
r = await owner.get(`${G}/members/${raviId}`);
const chainEnd = r.body.subscriptions.find((s) => s.id === sub2).endDate;
const day = addDays(chainEnd, -5);
r = await admin.post(`/api/dev/cron?date=${day}`);
ok(r.status === 200, "cron runs for a chosen date", r.body);
r = await owner.get(`${G}/followups`);
const ex = r.body.items.filter((f) => f.member.id === raviId && f.type === "EXPIRY_M5");
ok(ex.length === 1 && ex[0].message.includes("ends on"), "follow-up list has the 5-day expiry reminder with its message", r.body.items);
r = await admin.post(`/api/dev/cron?date=${day}`);
ok(r.body.daily.find((d) => d.gymId === gymId)?.skipped === true, "second run the same day is skipped");
r = await owner.get(`${G}/followups`);
ok(r.body.items.filter((f) => f.member.id === raviId && f.type === "EXPIRY_M5").length === 1, "no duplicate reminder after the rerun");
const fu = r.body.items.find((f) => f.member.id === raviId);
r = await manager.post(`${G}/followups/${fu.id}/contacted`, { note: "Will renew Sunday" });
ok(r.status === 200, "manager marks a follow-up as contacted");

// Exports
r = await owner.get(`${G}/export/members.csv`);
ok(r.status === 200 && r.body.includes("Ravi Sharma"), "owner exports members as CSV");
r = await manager.get(`${G}/export/payments.csv`);
ok(r.status === 403, "manager cannot export");

// Trainer: runs the desk like a manager (members, plans, payments) but never sees sales or owner pages
r = await owner.post(`${G}/staff`, { email: `trainer-${RUN}@gymdesk.test`, role: "TRAINER" });
ok(r.status === 201, "owner invites a trainer", r.body);
r = await trainer.get(`${G}/members/${raviId}`);
ok(r.status === 200 && Array.isArray(r.body.payments) && typeof r.body.duesTotalPaise === "number", "trainer sees a member's fees and payments");
r = await trainer.get(`${G}/dashboard`);
ok(r.status === 200 && r.body.collectionToday === null && r.body.collectionMonthPaise === null, "trainer dashboard has no sales");
r = await trainer.post(`${G}/members`, { name: "Trainer Walkin", phone: phone(4), dob: null, gender: null, emergencyName: null, emergencyPhone: null, guardianName: null, guardianPhone: null });
ok(r.status === 201, "trainer adds a new member");
const walkinId = r.body.id;
r = await trainer.post(`${G}/members/${walkinId}/subscriptions`, { planId: monthly, startDate: today, finalPricePaise: 150000, discountReason: null, joiningFeePaise: 0, backdateReason: null, trainerName: null, payment: { amountPaise: 50000, mode: "CASH", note: null } });
ok(r.status === 201, "trainer starts a plan with a part payment");
r = await trainer.post(`${G}/subscriptions/${r.body.subscriptionId}/payments`, { amountPaise: 100000, mode: "UPI", note: null });
ok(r.status === 201, "trainer takes the remaining payment");
r = await trainer.post(`${G}/payments/${firstPaymentId}/void`, { reason: "x" });
ok(r.status === 403, "trainer cannot void a payment");
for (const path of ["/reports/collections", "/audit", "/staff", "/export/members.csv"]) {
  r = await trainer.get(`${G}${path}`);
  ok(r.status === 403, `trainer cannot open ${path}`);
}
r = await owner.get(`${G}/settings`);
r = await trainer.patch(`${G}/settings`, { ...r.body, upiId: "newupi@okhdfc" });
ok(r.status === 200, "trainer can change gym settings, UPI ID included");
r = await owner.get(`${G}/audit`);
ok(r.body.items.some((a) => a.action === "SETTINGS_EDIT" && a.actorName === "Trainer Vikram"), "the settings change is in the owner's audit log with who made it");
r = await trainer.post(`${G}/members/${raviId}/checkin`, {});
ok(r.status === 200, "trainer checks a member in at the desk");

r = await owner.patch(`${G}/staff/${encodeURIComponent(`owner-${RUN}@gymdesk.test`)}`, { active: false, role: "MANAGER" });
ok(r.status === 409, "the gym owner's own access cannot be changed from the staff page");

// Staff removal takes effect at once
r = await owner.patch(`${G}/staff/${encodeURIComponent(`manager-${RUN}@gymdesk.test`)}`, { active: false, role: "MANAGER" });
ok(r.status === 200, "owner removes the manager");
r = await manager.get(`${G}/dashboard`);
ok(r.status === 404, "removed manager loses access immediately");

// Platform console: one owner per gym, never the admin; pause, expiry, archive and owner change
r = await admin.post("/api/platform/gyms", { name: "Admin Gym", slug: `admin-${RUN}`, ownerEmail: "admin@gymdesk.test" });
ok(r.status === 400 && r.body.field === "ownerEmail", "the platform admin email cannot own a gym", r.body);
r = await owner.get(`/api/platform/gyms/${gymId}`);
ok(r.status === 403, "a gym owner cannot open the platform console");
r = await admin.get(`/api/platform/gyms/${gymId}`);
ok(r.status === 200 && r.body.gym.members >= 2 && r.body.gym.activeMembers >= 1 && r.body.gym.ownerEmail === `owner-${RUN}@gymdesk.test`, "platform sees the gym's health", r.body.gym);
ok(!JSON.stringify(r.body.gym).match(/due|collect|revenue/i), "platform gym summary carries no member money");
const P = `/api/platform/gyms/${gymId}`;
r = await admin.post(`${P}/pause`, { reason: "Payment pending" });
ok(r.status === 200, "platform pauses the gym");
r = await owner.get(`${G}/dashboard`);
ok(r.status === 403 && r.body.code === "GYM_PAUSED", "paused gym locks staff out", r.body);
r = await owner.get("/api/auth/session");
ok(r.body.staffOf.find((s) => s.gymId === gymId)?.access === "PAUSED", "session tells the app the gym is paused");
r = await ravi.get(`/api/public/me/gyms/${gymId}`);
ok(r.status === 200, "members still see their own page while paused");
r = await ravi.post(`/api/public/gyms/${slug}/checkin`, {});
ok(r.status === 403 && r.body.code === "GYM_PAUSED", "no check-ins while paused");
r = await (await new Client("Late Joiner").login(`late-${RUN}@gymdesk.test`)).post(`/api/public/gyms/${slug}/register`, { ...reg, name: "Late Joiner", phone: phone(5) });
ok(r.status === 403 && r.body.code === "GYM_PAUSED", "no new sign-ups while paused");
r = await admin.post(`${P}/pause`, { reason: "again" });
ok(r.status === 409, "an already paused gym cannot be paused again");
r = await admin.post(`${P}/resume`, { reason: "Paid" });
ok(r.status === 200, "platform resumes the gym");
r = await owner.get(`${G}/dashboard`);
ok(r.status === 200, "staff are back in after resume");

r = await admin.post(`${P}/billing`, { planName: "Monthly", amountPaise: 99900, mode: "UPI", paidOn: today, validTill: addDays(today, -10), note: null });
ok(r.status === 201, "platform records a payment with an old valid-till");
r = await owner.get(`${G}/dashboard`);
ok(r.status === 403, "a gym past its valid-till and grace pauses itself");
r = await admin.post(`${P}/billing`, { planName: "Yearly", amountPaise: 999900, mode: "BANK", paidOn: today, validTill: addDays(today, 365), note: "Annual" });
ok(r.status === 201, "platform records the renewal");
r = await owner.get(`${G}/dashboard`);
ok(r.status === 200, "renewal reopens the gym at once");
r = await admin.get(P);
ok(r.body.billing.length === 2 && r.body.gym.saasPlanName === "Yearly", "billing history and plan are kept");

r = await admin.post(`${P}/archive`, { reason: "Gym closed" });
ok(r.status === 200, "platform archives the gym");
r = await owner.get(`${G}/dashboard`);
ok(r.status === 403, "archived gym locks staff out");
r = await admin.post(`${P}/restore`, { reason: "Reopened" });
ok(r.status === 200, "platform restores the gym");

r = await admin.patch(P, { name: "Iron Paradise Gym", slug: `${slug}-new`, phone: null, address: "MG Road" });
ok(r.status === 200, "platform edits the gym's details");
r = await ravi.get(`/api/public/gyms/${slug}-new`);
ok(r.status === 200 && r.body.gym.name === "Iron Paradise Gym", "the new web address works");

r = await admin.post(`${P}/owner`, { email: "admin@gymdesk.test", reason: "x" });
ok(r.status === 400, "ownership cannot go to the platform admin");
const newOwner = await new Client("New Owner").login(`newowner-${RUN}@gymdesk.test`);
r = await admin.post(`${P}/owner`, { email: `newowner-${RUN}@gymdesk.test`, reason: "Gym sold" });
ok(r.status === 200, "platform changes the gym owner");
r = await owner.get(`${G}/dashboard`);
ok(r.status === 404, "the old owner loses access at once");
r = await newOwner.get(`${G}/reports/collections`);
ok(r.status === 200, "the new owner has full owner access");

console.log(`\nAll ${checks} checks passed.`);
