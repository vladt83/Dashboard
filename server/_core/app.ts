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
