import express, { type Express } from "express";
import { type Server } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";

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
