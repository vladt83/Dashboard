export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
};

if (!ENV.cookieSecret) {
  throw new Error("JWT_SECRET is required. Set it in .env or your hosting provider's env vars.");
}
if (!ENV.databaseUrl) {
  throw new Error("DATABASE_URL is required. Set it in .env or your hosting provider's env vars.");
}
