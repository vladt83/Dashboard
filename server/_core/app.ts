import express, { type Express } from "express";
import { type Server } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { runExtensionReminders } from "../db";

/**
 * Build the Express app. Used by:
 *   - server/_core/index.ts        (local dev / `pnpm dev`)
 *   - api/index.ts                 (Vercel serverless function)
 *
 * In production on Vercel, static asset serving is handled by Vercel itself
 * (via the build output), so this function never registers Vite or
 * static-file middleware. The dev entry still wires Vite middleware on top
 * after calling buildBaseApp().
 */
export function buildBaseApp(): Express {
  const app = express();

  // Trust the reverse proxy (Vercel) for correct req.secure / x-forwarded-proto.
  app.set("trust proxy", 1);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  // Diagnostic: report which env vars are present (NOT their values) and try
  // a 5-second-budget SELECT 1 against DATABASE_URL. Helps isolate whether
  // hangs on /api/trpc/* are due to missing/wrong DB credentials, IP
  // allowlist, or SSL handshake issues. Safe to leave deployed — only
  // returns booleans for env vars and the result of a single trivial query.
  app.get("/api/diag", async (_req, res) => {
    const env = {
      DATABASE_URL: !!process.env.DATABASE_URL,
      POSTGRES_URL: !!process.env.POSTGRES_URL,
      POSTGRES_URL_NON_POOLING: !!process.env.POSTGRES_URL_NON_POOLING,
      POSTGRES_HOST: !!process.env.POSTGRES_HOST,
      JWT_SECRET: !!process.env.JWT_SECRET,
      COOKIE_SECRET: !!process.env.COOKIE_SECRET,
      NODE_ENV: process.env.NODE_ENV ?? null,
      VERCEL_REGION: process.env.VERCEL_REGION ?? null,
    };

    const start = Date.now();
    let db: { ok: boolean; ms?: number; error?: string; rows?: number; urlSource?: string } = {
      ok: false,
      error: "not-attempted",
    };

    try {
      const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
      const urlSource = process.env.DATABASE_URL
        ? "DATABASE_URL"
        : process.env.POSTGRES_URL
          ? "POSTGRES_URL"
          : "none";

      if (!url) {
        db = { ok: false, error: "Neither DATABASE_URL nor POSTGRES_URL is set", urlSource };
      } else {
        const { Pool } = await import("pg");
        const pool = new Pool({
          connectionString: url,
          ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
          max: 1,
          connectionTimeoutMillis: 5000,
        });
        try {
          const result = (await Promise.race([
            pool.query("SELECT 1 as ok"),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("query-timeout-7s")), 7000)
            ),
          ])) as { rows: unknown[] };
          db = { ok: true, ms: Date.now() - start, rows: result.rows.length, urlSource };
        } finally {
          await pool.end().catch(() => undefined);
        }
      }
    } catch (e) {
      db = {
        ok: false,
        error: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
        ms: Date.now() - start,
      };
    }

    res.json({ env, db });
  });

  // ─── Cron: 90-day extension reminders ──────────────────────────────────
  // Designed to be hit by an external scheduler (Vercel Cron, GitHub Actions,
  // cron-job.org, etc.) once a day. Idempotent — a second call within the
  // same calendar day produces zero additional alerts.
  //
  // Auth: provide CRON_SECRET in the Authorization header as `Bearer <secret>`.
  // If CRON_SECRET is unset (e.g. local dev), the endpoint is open — handy
  // for testing but should never ship to prod without the env var.
  app.post("/api/cron/extension-reminders", async (req, res) => {
    const expected = process.env.CRON_SECRET;
    if (expected) {
      const got = req.header("authorization");
      if (got !== `Bearer ${expected}`) {
        return res.status(401).json({ error: "Unauthorized" });
      }
    }
    try {
      const result = await runExtensionReminders();
      return res.json({ ok: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      return res.status(500).json({ ok: false, error: message });
    }
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  return app;
}

export type AppHandle = { app: Express; server: Server | null };
