// Vercel serverless function entry — bundled into api/index.js by esbuild
// at build time (see package.json `build:api` script). Source lives here
// in server/ instead of api/ so Vercel's @vercel/node builder cannot
// accidentally auto-compile it (which would skip our bundling step and
// break ESM imports in production).
//
// Vercel functions take (req, res) — the same shape Express apps export.
// Do NOT wrap with serverless-http (that targets AWS Lambda's event/context
// signature); the wrapped handler will be invoked but never responds, so
// every request times out at maxDuration.

import { buildBaseApp } from "./_core/app";

console.log("[boot] commission-tracker bundled handler loaded");

const app = buildBaseApp();

export default app;
