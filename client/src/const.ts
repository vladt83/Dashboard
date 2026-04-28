export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// The Manus OAuth portal is no longer used. When an unauthenticated user hits
// a protected route the app renders the Login page in-place, so redirecting to
// "/" is enough to bring them to the email/password form.
export const getLoginUrl = () => "/";
