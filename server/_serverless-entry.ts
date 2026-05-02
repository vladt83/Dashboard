// Vercel serverless function entry — bundled into api/index.js by esbuild
// at build time (see package.json `build:api` script). Source lives here
// in server/ instead of api/ so Vercel's @vercel/node builder cannot
// accidentally auto-compile it (which would skip our bundling step and
// break ESM imports in production).

import { buildBaseApp } from "./_core/app";
import serverless from "serverless-http";

// Boot-time marker — confirms the BUNDLED handler is the one Vercel runs.
// If you see this in the function logs, the build pipeline is working.
console.log("[boot] commission-tracker bundled handler loaded");

const app = buildBaseApp();
const handler = serverless(app);

export default handler;
