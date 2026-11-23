/* Who may call what. Roles are read from D1 on every request, so removing a staff member takes effect at once. */
import type { MiddlewareHandler } from "hono";
import { STAFF_ROLES, type StaffRole } from "../../../shared/constants.ts";
import type { AppEnv, Env } from "../env.ts";
import { accessOf, type GymRow } from "../db/rows.ts";
import { gymIsOpen } from "../../../shared/saas.ts";
import { ApiError, MESSAGES, forbidden, notFound } from "../lib/http.ts";

export function currentUser(c: { get: (key: "user") => AppEnv["Variables"]["user"] }) {
  const user = c.get("user");
  if (!user) throw new ApiError(401, MESSAGES.signIn);
  return user;
}

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  currentUser(c);
  await next();
};

export function isPlatformAdmin(env: Env, email: string): boolean {
  return (env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

export const requirePlatformAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = currentUser(c);
  if (!isPlatformAdmin(c.env, user.email)) throw forbidden();
  await next();
};

/** Loads the gym named by `:gymId` and the caller's role in it. `roles` limits who may continue. */
export function requireStaff(roles: readonly StaffRole[] = STAFF_ROLES): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = currentUser(c);
    const gymId = c.req.param("gymId");
    if (!gymId) throw notFound();
    const row = await c.env.DB.prepare(
      `SELECT g.*, st.role AS staff_role FROM gyms g JOIN gym_staff st ON st.gym_id = g.id
       WHERE g.id = ?1 AND st.user_id = ?2 AND st.active = 1`,
    )
      .bind(gymId, user.id)
      .first<GymRow & { staff_role: StaffRole }>();
    if (!row) throw notFound();
    if (!gymIsOpen(accessOf(row))) throw new ApiError(403, MESSAGES.gymPaused, undefined, "GYM_PAUSED");
    if (!roles.includes(row.staff_role)) throw forbidden();
    const { staff_role, ...gym } = row;
    c.set("staff", { gym, role: staff_role });
    await next();
  };
}

/** Use after requireStaff: lets only the gym's owners through. */
export const ownerOnly: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.get("staff").role !== "OWNER") throw forbidden();
  await next();
};
