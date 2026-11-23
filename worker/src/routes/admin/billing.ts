/* Money and plan dates: activate/renew (subscription + first payment in one step), payments, voids,
 * cancellations with refunds, and freezes. Every write goes in one batch with its audit row. */
import { Hono } from "hono";
import { PAYMENT_MODES, MAX_FREEZE_DAYS, type StaffRole } from "../../../../shared/constants.ts";
import { addDays, daysBetween, planEndDate, todayIn } from "../../../../shared/dates.ts";
import { canVoid, dueOf, formatRupees, maxRefund, totalCharge } from "../../../../shared/money.ts";
import { overlapsLive } from "../../../../shared/membership.ts";
import { EDIT_PROBLEM_MESSAGE, planEdit } from "../../../../shared/subscriptionEdit.ts";
import type { AppEnv, Env } from "../../env.ts";
import { currentStaff, currentUser, ownerOnly } from "../../auth/guards.ts";
import { auditStatement } from "../../lib/audit.ts";
import { ApiError, badInput, conflict, notFound } from "../../lib/http.ts";
import { newId, nowIso } from "../../lib/ids.ts";
import { asBody, date, int, nested, oneOf, optionalText, paise, text, type Body } from "../../lib/validate.ts";
import { getMember, getSubscription, paymentRowsOfSubscription, subscriptionsOfMember } from "../../db/queries.ts";
import type { PlanRow } from "../../db/rows.ts";
import { notifyUsers, ownerUserIds } from "../../push/notify.ts";

export const billingRoutes = new Hono<AppEnv>();

/** How far ahead a plan may be set to start. */
const MAX_FUTURE_START_DAYS = 60;

function paymentStatement(db: D1Database, p: { id: string; gymId: string; subscriptionId: string; memberId: string; amountPaise: number; mode: string; paidOn: string; collectedBy: string; note: string | null }) {
  return db
    .prepare(
      `INSERT INTO payments (id, gym_id, subscription_id, member_id, amount_paise, mode, paid_on, receipt_no, collected_by, note, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, (SELECT next_receipt_no FROM gyms WHERE id = ?2), ?8, ?9, ?10)`,
    )
    .bind(p.id, p.gymId, p.subscriptionId, p.memberId, p.amountPaise, p.mode, p.paidOn, p.collectedBy, p.note, nowIso());
}

function bumpReceipt(db: D1Database, gymId: string) {
  return db.prepare("UPDATE gyms SET next_receipt_no = next_receipt_no + 1 WHERE id = ?1").bind(gymId);
}

/** Tells the owners about money the moment it is recorded, unless an owner recorded it themselves. */
function alertOwners(env: Env, ctx: { waitUntil(promise: Promise<unknown>): void }, gymId: string, actor: { id: string; name: string }, role: StaffRole, title: string, body: string, memberId: string) {
  if (role === "OWNER") return;
  ctx.waitUntil(
    ownerUserIds(env.DB, gymId).then((ids) =>
      notifyUsers(
        env,
        ids.filter((id) => id !== actor.id),
        { title, body: `${body} · by ${actor.name}`, url: `/admin/${gymId}/members/${memberId}`, tag: `pay-${newId()}` },
      ),
    ),
  );
}

function readPayment(body: Body | null, maxPaise: number) {
  if (!body) return null;
  const amountPaise = paise(body, "amountPaise", 1);
  if (amountPaise > maxPaise) throw badInput("amountPaise", "The amount is more than what is due.");
  return { amountPaise, mode: oneOf(body, "mode", PAYMENT_MODES), note: optionalText(body, "note", { max: 200 }) };
}

billingRoutes.post("/members/:memberId/subscriptions", async (c) => {
  const { gym, role } = currentStaff(c);
  const user = currentUser(c);
  const member = await getMember(c.env.DB, gym.id, c.req.param("memberId"));
  if (!member || member.anonymised_at) throw notFound();
  if (member.status === "REJECTED") throw conflict("This request was rejected. Add the person again to start a plan.");
  if (member.archived_at) throw conflict("Restore this member before starting a plan.");

  const body = asBody(await c.req.json());
  const today = todayIn(gym.timezone);
  const plan = await c.env.DB.prepare("SELECT * FROM plans WHERE gym_id = ?1 AND id = ?2 AND active = 1").bind(gym.id, text(body, "planId", { max: 40 })).first<PlanRow>();
  if (!plan) throw badInput("planId");

  const startDate = date(body, "startDate");
  const backdateReason = optionalText(body, "backdateReason", { max: 200 });
  if (startDate < today) {
    if (role !== "OWNER") throw new ApiError(403, "Only the owner can start a plan on a past date.", "startDate");
    if (!backdateReason) throw badInput("backdateReason", "Please give a reason for the past start date.");
  }
  if (daysBetween(today, startDate) > MAX_FUTURE_START_DAYS) throw badInput("startDate");
  const endDate = planEndDate(startDate, { durationMonths: plan.duration_months, durationDays: plan.duration_days });

  const subs = await subscriptionsOfMember(c.env.DB, member.id, today);
  const sameKind = subs.filter((s) => s.kind === plan.kind);
  if (overlapsLive(sameKind, startDate, endDate)) throw new ApiError(409, "This plan overlaps the current one. Start it after the current plan ends.", "startDate");

  const finalPricePaise = paise(body, "finalPricePaise");
  const discountReason = optionalText(body, "discountReason", { max: 200 });
  if (finalPricePaise !== plan.price_paise && !discountReason) throw badInput("discountReason", "Please give a reason for the changed price.");

  const isFirst = plan.kind === "MEMBERSHIP" && sameKind.length === 0;
  const joiningFeePaise = paise(body, "joiningFeePaise");
  if (joiningFeePaise > 0 && !isFirst) throw badInput("joiningFeePaise", "The joining fee applies only to the first membership.");

  const trainerName = optionalText(body, "trainerName", { max: 80 });
  if (plan.kind === "PT" && !trainerName) throw badInput("trainerName", "Please enter the trainer's name.");

  const total = finalPricePaise + joiningFeePaise;
  const payment = readPayment(nested(body, "payment"), total);

  const subscriptionId = newId();
  const statements: D1PreparedStatement[] = [
    c.env.DB.prepare(
      `INSERT INTO subscriptions (id, gym_id, member_id, plan_id, kind, plan_name, duration_months, duration_days, max_freeze_days, trainer_name, trainer_commission_pct,
         start_date, end_date, list_price_paise, final_price_paise, discount_reason, joining_fee_paise, backdate_reason, created_by, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)`,
    ).bind(
      subscriptionId,
      gym.id,
      member.id,
      plan.id,
      plan.kind,
      plan.name,
      plan.duration_months,
      plan.duration_days,
      plan.max_freeze_days,
      trainerName,
      plan.trainer_commission_pct,
      startDate,
      endDate,
      plan.price_paise,
      finalPricePaise,
      discountReason,
      joiningFeePaise,
      backdateReason,
      user.id,
      nowIso(),
    ),
    c.env.DB.prepare("UPDATE members SET status = 'JOINED' WHERE id = ?1").bind(member.id),
    auditStatement(c.env.DB, {
      gymId: gym.id,
      actorId: user.id,
      action: sameKind.length === 0 ? "SUB_CREATE" : "SUB_RENEW",
      entity: "subscription",
      entityId: subscriptionId,
      after: { memberId: member.id, plan: plan.name, startDate, endDate, listPricePaise: plan.price_paise, finalPricePaise, joiningFeePaise, trainerName },
      reason: [discountReason, backdateReason].filter(Boolean).join(" · ") || null,
    }),
  ];
  if (payment) {
    const paymentId = newId();
    statements.push(
      paymentStatement(c.env.DB, { id: paymentId, gymId: gym.id, subscriptionId, memberId: member.id, amountPaise: payment.amountPaise, mode: payment.mode, paidOn: today, collectedBy: user.id, note: payment.note }),
      bumpReceipt(c.env.DB, gym.id),
      auditStatement(c.env.DB, { gymId: gym.id, actorId: user.id, action: "PAYMENT_ADD", entity: "payment", entityId: paymentId, after: { subscriptionId, ...payment } }),
    );
  }
  await c.env.DB.batch(statements);
  if (payment) {
    alertOwners(c.env, c.executionCtx, gym.id, user, role, "Payment recorded", `${formatRupees(payment.amountPaise)} ${payment.mode} from ${member.name} for ${plan.name}`, member.id);
  }
  return c.json({ subscriptionId }, 201);
});

billingRoutes.post("/subscriptions/:subscriptionId/payments", async (c) => {
  const { gym, role } = currentStaff(c);
  const user = currentUser(c);
  const today = todayIn(gym.timezone);
  const sub = await getSubscription(c.env.DB, gym.id, c.req.param("subscriptionId"), today);
  if (!sub) throw notFound();
  if (sub.cancelled) throw conflict("This plan was cancelled.");
  const payments = await paymentRowsOfSubscription(c.env.DB, sub.id);
  const due = dueOf({ ...sub, cancelled: false }, payments.map((p) => ({ amountPaise: p.amountPaise, voided: p.voidedAt != null })));
  if (due <= 0) throw conflict("Nothing is due on this plan.");
  const payment = readPayment(asBody(await c.req.json()), due);
  if (!payment) throw badInput("amountPaise");
  const memberId = sub.memberId;
  const paymentId = newId();
  await c.env.DB.batch([
    paymentStatement(c.env.DB, { id: paymentId, gymId: gym.id, subscriptionId: sub.id, memberId, amountPaise: payment.amountPaise, mode: payment.mode, paidOn: today, collectedBy: user.id, note: payment.note }),
    bumpReceipt(c.env.DB, gym.id),
    auditStatement(c.env.DB, { gymId: gym.id, actorId: user.id, action: "PAYMENT_ADD", entity: "payment", entityId: paymentId, after: { subscriptionId: sub.id, ...payment } }),
  ]);
  const member = await getMember(c.env.DB, gym.id, memberId);
  alertOwners(c.env, c.executionCtx, gym.id, user, role, "Payment recorded", `${formatRupees(payment.amountPaise)} ${payment.mode} from ${member?.name ?? "a member"} for ${sub.planName}`, memberId);
  return c.json({ paymentId }, 201);
});

billingRoutes.post("/payments/:paymentId/void", ownerOnly, async (c) => {
  const { gym } = currentStaff(c);
  const user = currentUser(c);
  const target = await c.env.DB.prepare("SELECT * FROM payments WHERE gym_id = ?1 AND id = ?2").bind(gym.id, c.req.param("paymentId")).first<{
    id: string;
    subscription_id: string;
    amount_paise: number;
    mode: string;
    receipt_no: number;
    voided_at: string | null;
  }>();
  if (!target) throw notFound();
  const reason = text(asBody(await c.req.json()), "reason", { max: 200 });
  const payments = (await paymentRowsOfSubscription(c.env.DB, target.subscription_id)).map((p) => ({ amountPaise: p.amountPaise, voided: p.voidedAt != null }));
  if (!canVoid(payments, { amountPaise: target.amount_paise, voided: target.voided_at != null })) {
    throw conflict("This entry can't be voided: it is already voided, is a refund, or its money was refunded.");
  }
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE payments SET voided_at = ?1, voided_by = ?2, void_reason = ?3 WHERE id = ?4").bind(nowIso(), user.id, reason, target.id),
    auditStatement(c.env.DB, {
      gymId: gym.id,
      actorId: user.id,
      action: "PAYMENT_VOID",
      entity: "payment",
      entityId: target.id,
      before: { amountPaise: target.amount_paise, mode: target.mode, receiptNo: target.receipt_no },
      after: { voided: true },
      reason,
    }),
  ]);
  return c.json({ ok: true });
});

billingRoutes.post("/subscriptions/:subscriptionId/cancel", ownerOnly, async (c) => {
  const { gym } = currentStaff(c);
  const user = currentUser(c);
  const today = todayIn(gym.timezone);
  const sub = await getSubscription(c.env.DB, gym.id, c.req.param("subscriptionId"), today);
  if (!sub) throw notFound();
  if (sub.cancelled) throw conflict("This plan is already cancelled.");
  const body = asBody(await c.req.json());
  const reason = text(body, "reason", { max: 200 });
  const payments = await paymentRowsOfSubscription(c.env.DB, sub.id);
  const refundable = maxRefund(payments.map((p) => ({ amountPaise: p.amountPaise, voided: p.voidedAt != null })));
  const refundBody = nested(body, "refund");
  const refund = refundBody ? { amountPaise: paise(refundBody, "amountPaise", 1), mode: oneOf(refundBody, "mode", PAYMENT_MODES) } : null;
  if (refund && refund.amountPaise > refundable) throw badInput("amountPaise", "The refund is more than what was paid.");
  const memberId = sub.memberId;

  const statements: D1PreparedStatement[] = [
    c.env.DB.prepare("UPDATE subscriptions SET cancelled_at = ?1, cancelled_by = ?2, cancelled_reason = ?3 WHERE id = ?4").bind(nowIso(), user.id, reason, sub.id),
    auditStatement(c.env.DB, {
      gymId: gym.id,
      actorId: user.id,
      action: "SUB_CANCEL",
      entity: "subscription",
      entityId: sub.id,
      before: { plan: sub.planName, startDate: sub.startDate, endDate: sub.endDate, totalPaise: totalCharge(sub), paidPaise: sub.paidPaise },
      after: { cancelled: true, refundPaise: refund?.amountPaise ?? 0 },
      reason,
    }),
  ];
  if (refund) {
    const paymentId = newId();
    statements.push(
      paymentStatement(c.env.DB, { id: paymentId, gymId: gym.id, subscriptionId: sub.id, memberId, amountPaise: -refund.amountPaise, mode: refund.mode, paidOn: today, collectedBy: user.id, note: `Refund: ${reason}` }),
      bumpReceipt(c.env.DB, gym.id),
      auditStatement(c.env.DB, { gymId: gym.id, actorId: user.id, action: "PAYMENT_REFUND", entity: "payment", entityId: paymentId, after: { subscriptionId: sub.id, ...refund }, reason }),
    );
  }
  await c.env.DB.batch(statements);
  return c.json({ ok: true });
});

/** Owner fixes a plan a member already took: another plan, another start date or another price. Payments stay as they are. */
billingRoutes.patch("/subscriptions/:subscriptionId", ownerOnly, async (c) => {
  const { gym } = currentStaff(c);
  const user = currentUser(c);
  const today = todayIn(gym.timezone);
  const sub = await getSubscription(c.env.DB, gym.id, c.req.param("subscriptionId"), today);
  if (!sub) throw notFound();
  if (sub.cancelled) throw conflict("This plan was cancelled.");
  const body = asBody(await c.req.json());
  const reason = text(body, "reason", { max: 200 });
  const startDate = date(body, "startDate");
  if (daysBetween(today, startDate) > MAX_FUTURE_START_DAYS) throw badInput("startDate");
  const finalPricePaise = paise(body, "finalPricePaise");

  const planId = optionalText(body, "planId", { max: 40 }) ?? sub.planId;
  const plan =
    planId === sub.planId
      ? null
      : await c.env.DB.prepare("SELECT * FROM plans WHERE gym_id = ?1 AND id = ?2 AND active = 1 AND kind = ?3").bind(gym.id, planId, sub.kind).first<PlanRow>();
  if (planId !== sub.planId && !plan) throw badInput("planId");
  const snapshot = plan
    ? { planId: plan.id, planName: plan.name, durationMonths: plan.duration_months, durationDays: plan.duration_days, maxFreezeDays: plan.max_freeze_days, commissionPct: plan.trainer_commission_pct, listPricePaise: plan.price_paise }
    : null;
  const length = snapshot ?? { durationMonths: sub.durationMonths, durationDays: sub.durationDays };
  const listPricePaise = snapshot?.listPricePaise ?? sub.listPricePaise;

  const result = planEdit(sub, { startDate, durationMonths: length.durationMonths, durationDays: length.durationDays, finalPricePaise });
  if ("problem" in result) throw badInput(result.problem === "DATES_LOCKED_BY_FREEZE" ? "startDate" : "finalPricePaise", EDIT_PROBLEM_MESSAGE[result.problem]);
  const { endDate } = result;
  const siblings = (await subscriptionsOfMember(c.env.DB, sub.memberId, today)).filter((s) => s.kind === sub.kind);
  if (overlapsLive(siblings, startDate, endDate, sub.id)) throw new ApiError(409, "These dates overlap another plan of this member.", "startDate");

  const statements: D1PreparedStatement[] = [
    c.env.DB.prepare(
      `UPDATE subscriptions SET start_date = ?1, end_date = ?2, final_price_paise = ?3, list_price_paise = ?4, discount_reason = ?5 WHERE id = ?6`,
    ).bind(startDate, endDate, finalPricePaise, listPricePaise, finalPricePaise === listPricePaise ? null : reason, sub.id),
  ];
  if (snapshot) {
    statements.push(
      c.env.DB.prepare(
        "UPDATE subscriptions SET plan_id = ?1, plan_name = ?2, duration_months = ?3, duration_days = ?4, max_freeze_days = ?5, trainer_commission_pct = ?6 WHERE id = ?7",
      ).bind(snapshot.planId, snapshot.planName, snapshot.durationMonths, snapshot.durationDays, snapshot.maxFreezeDays, snapshot.commissionPct, sub.id),
    );
  }
  statements.push(
    auditStatement(c.env.DB, {
      gymId: gym.id,
      actorId: user.id,
      action: "SUB_EDIT",
      entity: "subscription",
      entityId: sub.id,
      before: { plan: sub.planName, startDate: sub.startDate, endDate: sub.endDate, finalPricePaise: sub.finalPricePaise },
      after: { plan: snapshot?.planName ?? sub.planName, startDate, endDate, finalPricePaise },
      reason,
    }),
  );
  await c.env.DB.batch(statements);
  return c.json({ ok: true, endDate });
});

billingRoutes.post("/subscriptions/:subscriptionId/freezes", async (c) => {
  const { gym, role } = currentStaff(c);
  const user = currentUser(c);
  const today = todayIn(gym.timezone);
  const sub = await getSubscription(c.env.DB, gym.id, c.req.param("subscriptionId"), today);
  if (!sub) throw notFound();
  if (sub.cancelled) throw conflict("This plan was cancelled.");
  const body = asBody(await c.req.json());
  const fromDate = date(body, "fromDate");
  const days = int(body, "days", 1, MAX_FREEZE_DAYS);
  const reason = text(body, "reason", { max: 200 });
  if (fromDate < sub.startDate || fromDate > sub.endDate) throw badInput("fromDate", "The freeze must start while this plan is running.");
  if (fromDate < today && role !== "OWNER") throw new ApiError(403, "Only the owner can start a freeze on a past date.", "fromDate");
  if (sub.freezeDaysUsed + days > sub.maxFreezeDays && role !== "OWNER") {
    throw badInput("days", `This plan allows ${sub.maxFreezeDays} freeze days and ${sub.freezeDaysUsed} are used.`);
  }
  const toDate = addDays(fromDate, days - 1);
  const clash = await c.env.DB.prepare("SELECT 1 FROM freezes WHERE subscription_id = ?1 AND from_date <= ?2 AND ?3 <= to_date").bind(sub.id, toDate, fromDate).first();
  if (clash) throw badInput("fromDate", "These dates overlap an existing freeze.");
  const memberId = sub.memberId;

  const freezeId = newId();
  const shift = `+${days} days`;
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO freezes (id, gym_id, subscription_id, from_date, to_date, reason, created_by, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)").bind(
      freezeId,
      gym.id,
      sub.id,
      fromDate,
      toDate,
      reason,
      user.id,
      nowIso(),
    ),
    // Later plans in the same chain move too, so a renewal never overlaps the extended plan.
    c.env.DB.prepare(
      `UPDATE subscriptions SET start_date = date(start_date, ?1), end_date = date(end_date, ?1)
       WHERE member_id = ?2 AND kind = ?3 AND cancelled_at IS NULL AND start_date > ?4`,
    ).bind(shift, memberId, sub.kind, sub.endDate),
    c.env.DB.prepare("UPDATE subscriptions SET end_date = date(end_date, ?1) WHERE id = ?2").bind(shift, sub.id),
    auditStatement(c.env.DB, {
      gymId: gym.id,
      actorId: user.id,
      action: "SUB_FREEZE",
      entity: "subscription",
      entityId: sub.id,
      before: { endDate: sub.endDate },
      after: { fromDate, toDate, endDate: addDays(sub.endDate, days) },
      reason,
    }),
  ]);
  return c.json({ freezeId }, 201);
});

