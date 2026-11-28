/* Who may call what. Roles are read from D1 on every request, so removing a staff member takes effect at once. */
import type { MiddlewareHandler } from "hono";
import { STAFF_ROLES, type StaffRole } from "../../../shared/constants.ts";
import type { AppEnv, Env, StaffContext } from "../env.ts";
import { accessOf, type GymRow } from "../db/rows.ts";
import { gymIsOpen } from "../../../shared/saas.ts";
import { ApiError, MESSAGES, forbidden, notFound } from "../lib/http.ts";

export function currentUser(c: { get: (key: "user") => AppEnv["Variables"]["user"] }) {
  const user = c.get("user");
  if (!user) throw new ApiError(401, MESSAGES.signIn);
  return user;
}

/**
 * The caller's gym and role, set by requireStaff. Every gym route reads it through here, so a route that ever
 * ends up outside the requireStaff middleware fails closed (403) instead of running without a staff check.
 */
export function currentStaff(c: { get: (key: "staff") => AppEnv["Variables"]["staff"] | undefined }): StaffContext {
  const staff = c.get("staff");
  if (!staff) throw forbidden();
  return staff;
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

const READ_METHODS = new Set(["GET", "HEAD"]);

/** The platform admin may open any gym as its owner would see it, for reading only, even while it is paused. */
async function viewerContext(c: Parameters<MiddlewareHandler<AppEnv>>[0], gymId: string): Promise<StaffContext | null> {
  if (!isPlatformAdmin(c.env, currentUser(c).email)) return null;
  const gym = await c.env.DB.prepare("SELECT * FROM gyms WHERE id = ?1").bind(gymId).first<GymRow>();
  if (!gym) return null;
  if (!READ_METHODS.has(c.req.method)) throw new ApiError(403, MESSAGES.viewOnly, undefined, "VIEW_ONLY");
  return { gym, role: "OWNER", viewOnly: true };
}

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
    if (row) {
      if (!gymIsOpen(accessOf(row))) throw new ApiError(403, MESSAGES.gymPaused, undefined, "GYM_PAUSED");
      const { staff_role, ...gym } = row;
      c.set("staff", { gym, role: staff_role, viewOnly: false });
    } else {
      const viewer = await viewerContext(c, gymId);
      if (!viewer) throw notFound();
      c.set("staff", viewer);
    }
    if (!roles.includes(currentStaff(c).role)) throw forbidden();
    await next();
  };
}

/** Use after requireStaff: lets only the gym's owners through. */
export const ownerOnly: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (currentStaff(c).role !== "OWNER") throw forbidden();
  await next();
};
