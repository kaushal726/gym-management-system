// Fills a local dev database with a realistic demo gym through the API (needs `wrangler dev` with DEV_AUTH=1).
// Usage: node scripts/demo-seed.mjs [baseUrl]
// Sign in on the dev site as owner@gymdesk.test (owner), desk@gymdesk.test (manager) or trainer@gymdesk.test (trainer).
const BASE = process.argv[2] ?? "http://localhost:8787";

async function client(email, name) {
  let cookie = "";
  const call = async (method, path, body) => {
    const res = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json", Origin: BASE, ...(cookie ? { Cookie: cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(data)}`);
    return data;
  };
  await call("POST", "/api/auth/dev", { email, name });
  return { get: (p) => call("GET", p), post: (p, b = {}) => call("POST", p, b), patch: (p, b) => call("PATCH", p, b) };
}

const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const admin = await client("admin@gymdesk.test", "Platform Admin");
const owner = await client("owner@gymdesk.test", "Rohit Malhotra");
const desk = await client("desk@gymdesk.test", "Pooja Desk");

const existing = (await admin.get("/api/platform/gyms")).items.find((g) => g.slug === "iron-paradise");
if (existing) {
  console.log("Demo gym already exists:", existing.id);
  process.exit(0);
}
const { id: gymId } = await admin.post("/api/platform/gyms", { name: "Iron Paradise Fitness", slug: "iron-paradise", ownerEmail: "owner@gymdesk.test", phone: "9876500011", address: "Sector 18, Noida" });
const G = `/api/gyms/${gymId}`;
await owner.patch(`${G}/settings`, { name: "Iron Paradise Fitness", phone: "9876500011", address: "Sector 18, Noida", timezone: "Asia/Kolkata", upiId: "ironparadise@okaxis", graceDays: 3, joiningFeePaise: 50000, checkinEnabled: true, checkinLat: null, checkinLng: null, checkinRadiusM: null, reminderHour: 9 });
const plan = async (b) => (await owner.post(`${G}/plans`, { maxFreezeDays: 0, trainerCommissionPct: 0, durationDays: null, ...b })).id;
const monthly = await plan({ kind: "MEMBERSHIP", name: "Monthly", durationMonths: 1, pricePaise: 150000, maxFreezeDays: 7 });
const quarterly = await plan({ kind: "MEMBERSHIP", name: "Quarterly", durationMonths: 3, pricePaise: 400000, maxFreezeDays: 15 });
await plan({ kind: "MEMBERSHIP", name: "Yearly", durationMonths: 12, pricePaise: 1200000, maxFreezeDays: 30 });
const pt = await plan({ kind: "PT", name: "PT 12 sessions", durationMonths: 1, pricePaise: 300000, trainerCommissionPct: 40 });
await owner.post(`${G}/staff`, { email: "desk@gymdesk.test", role: "MANAGER" });
await owner.post(`${G}/staff`, { email: "trainer@gymdesk.test", role: "TRAINER" });

const people = [
  // name, phone, plan, start offset (days from today), paid share, pt
  ["Aarav Sharma", "9810000001", quarterly, -40, 1],
  ["Priya Singh", "9810000002", monthly, -26, 1],
  ["Rahul Verma", "9810000003", monthly, -28, 0.5],
  ["Sneha Gupta", "9810000004", monthly, -31, 1],
  ["Vikram Rao", "9810000005", monthly, -45, 1],
  ["Ananya Iyer", "9810000006", quarterly, -10, 1, true],
  ["Karan Mehta", "9810000007", monthly, -5, 0.6],
  ["Neha Kapoor", "9810000008", quarterly, -80, 1],
  ["Arjun Nair", "9810000009", monthly, -2, 1],
];
for (const [name, phone, planId, offset, share, withPt] of people) {
  const { id } = await owner.post(`${G}/members`, { name, phone, dob: null, gender: null, emergencyName: null, emergencyPhone: null, guardianName: null, guardianPhone: null });
  const price = planId === quarterly ? 400000 : 150000;
  const total = price + 50000;
  const startDate = addDays(today, offset);
  await owner.post(`${G}/members/${id}/subscriptions`, {
    planId,
    startDate,
    finalPricePaise: price,
    discountReason: null,
    joiningFeePaise: 50000,
    backdateReason: offset < 0 ? "Entered from the register" : null,
    trainerName: null,
    payment: { amountPaise: Math.round(total * share), mode: share === 1 ? "UPI" : "CASH", note: null },
  });
  if (withPt) await owner.post(`${G}/members/${id}/subscriptions`, { planId: pt, startDate: today, finalPricePaise: 300000, discountReason: null, joiningFeePaise: 0, backdateReason: null, trainerName: "Vikram Coach", payment: { amountPaise: 300000, mode: "UPI", note: null } });
  if (name === "Arjun Nair") await desk.post(`${G}/members/${id}/checkin`, {});
}

// Two people who signed up from the QR and are waiting at the desk.
for (const [email, name, phone] of [
  ["meera.joshi@gymdesk.test", "Meera Joshi", "9810000010"],
  ["dev.patel@gymdesk.test", "Dev Patel", "9810000011"],
]) {
  const m = await client(email, name);
  await m.post("/api/public/gyms/iron-paradise/register", { name, phone, dob: "1998-06-15", gender: null, emergencyName: null, emergencyPhone: null, guardianName: null, guardianPhone: null, consent: true });
}

await admin.post(`/api/dev/cron?date=${today}`);
console.log(`Demo gym ready: ${gymId}\nOwner: owner@gymdesk.test · Manager: desk@gymdesk.test · Trainer: trainer@gymdesk.test · Member: meera.joshi@gymdesk.test`);
