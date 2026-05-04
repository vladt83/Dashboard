// Placeholder. The real handler is built from server/_serverless-entry.ts
// by `pnpm build:api` during `vercel build` and overwrites this file.
// Committed (despite being a build artifact) because Vercel validates the
// `functions` pattern in vercel.json against the repo at clone time,
// before the build script runs.
module.exports = (_req, res) => {
  res.statusCode = 500;
  res.end("Build did not run — placeholder handler is still in place.");
};
