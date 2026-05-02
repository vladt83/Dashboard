// Vercel serverless function entry. The whole Express app is wrapped and
// exposed as a single handler — Vercel's rewrite rule (see vercel.json)
// routes every /api/* request to this file.
//
// Why one big function instead of one-per-route? tRPC v11 expects a single
// Express middleware mount so all procedures share state, error handling,
// and the shared `createContext` factory. Splitting per-procedure would
// require a manual fetch adapter and lose that.

import { buildBaseApp } from "../server/_core/app";
import serverless from "serverless-http";

const app = buildBaseApp();
const handler = serverless(app);

export default handler;
