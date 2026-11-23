/* GymDesk Worker: serves the web app's files and the JSON API on one origin, and runs the hourly cron. */
import { Hono } from "hono";
import { todayIn, isIsoDate } from "../../shared/dates.ts";
import type { AppEnv, Env } from "./env.ts";
import { readSession } from "./auth/session.ts";
import { requireStaff, requireUser } from "./auth/guards.ts";
import { ApiError, MESSAGES, notFound } from "./lib/http.ts";
import { authRoutes } from "./routes/auth.ts";
import { publicRoutes } from "./routes/public.ts";
import { platformRoutes } from "./routes/platform.ts";
import { memberRoutes } from "./routes/admin/members.ts";
import { billingRoutes } from "./routes/admin/billing.ts";
import { gymRoutes } from "./routes/admin/gym.ts";
import { runDueGyms } from "./cron/daily.ts";
import { drainPushQueue } from "./cron/drain.ts";

const app = new Hono<AppEnv>().basePath("/api");

/** Writes must be JSON from this same site: a form on another site can't send JSON, so this blocks CSRF. */
app.use("*", async (c, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
    const origin = c.req.header("Origin");
    if (origin && origin !== new URL(c.req.url).origin) throw new ApiError(403, MESSAGES.forbidden);
    if (!c.req.header("Content-Type")?.startsWith("application/json")) throw new ApiError(415, MESSAGES.badInput);
  }
  c.set("user", await readSession(c));
  await next();
  c.header("Cache-Control", "no-store");
});

app.route("/auth", authRoutes);
app.route("/public", publicRoutes);
app.route("/platform", platformRoutes);

app.use("/gyms/:gymId/*", requireUser, requireStaff());
app.route("/gyms/:gymId", memberRoutes);
app.route("/gyms/:gymId", billingRoutes);
app.route("/gyms/:gymId", gymRoutes);

/** Development only: run the daily job as if it were a given date, then send queued pushes. */
app.post("/dev/cron", async (c) => {
  if (c.env.DEV_AUTH !== "1" || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(c.req.url).hostname)) throw notFound();
  const date = c.req.query("date");
  const forced = date && isIsoDate(date) ? date : todayIn("Asia/Kolkata");
  const daily = await runDueGyms(c.env, new Date(), forced);
  const pushes = await drainPushQueue(c.env);
  return c.json({ date: forced, daily, pushes });
});

app.notFound(() => {
  throw notFound();
});

app.onError((err, c) => {
  if (err instanceof ApiError) return c.json({ error: err.message, ...(err.field ? { field: err.field } : {}), ...(err.code ? { code: err.code } : {}) }, err.status);
  if (err instanceof SyntaxError) return c.json({ error: MESSAGES.badInput }, 400);
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("UNIQUE constraint failed")) return c.json({ error: MESSAGES.conflict }, 409);
  console.error("Unhandled API error", err);
  return c.json({ error: MESSAGES.server }, 500);
});

/**
 * One entry for both homes of the app. On Cloudflare Pages (the public site) it serves the API and hands every
 * other path to the static files. The old Worker address sends everyone to PUBLIC_URL, so there is one site only.
 */
async function handle(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  if (env.PUBLIC_URL) {
    const publicUrl = new URL(env.PUBLIC_URL);
    if (url.host !== publicUrl.host && !url.hostname.endsWith(`.${publicUrl.host}`)) {
      return Response.redirect(`${publicUrl.origin}${url.pathname}${url.search}`, 301);
    }
  }
  if (url.pathname.startsWith("/api/")) return app.fetch(request, env, ctx);
  return env.ASSETS.fetch(request);
}

export default {
  fetch: handle,
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        await runDueGyms(env, new Date());
        await drainPushQueue(env);
      })(),
    );
  },
} satisfies ExportedHandler<Env>;
