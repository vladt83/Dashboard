// Seed sample clients for end-to-end testing.
//
// Creates:
//   - 2 fully-onboarded clients under Elliot, each with a trading log + several trades
//     (Marcus Johnson, Sarah Williams) — log in as Elliot to see them
//   - 2 clients in Ariana's onboarding queue (DocuSigned, not yet onboarded)
//     (David Chen, Amanda Davis) — log in as Ariana to see them
//
// Idempotent — safe to run multiple times. Looks up existing rows by client
// name / email before inserting.

import pg from "pg";
import bcrypt from "bcryptjs";

const DB = "postgresql://vladtayman@127.0.0.1:54329/commission_tracker";
const PASSWORD = "Trader";

const c = new pg.Client({ connectionString: DB });
await c.connect();

const passwordHash = await bcrypt.hash(PASSWORD, 10);

// Look up the team-member ids we need
const tm = (await c.query(`SELECT id, name FROM "teamMembers"`)).rows;
const STEVE = tm.find(r => r.name === "Steve Lapa")?.id;
const JHALIL = tm.find(r => r.name === "Jhalil Timazee")?.id;
const KRESHA = tm.find(r => r.name === "Kresha Koirala")?.id;
const JAKE = tm.find(r => r.name === "Jake Glass")?.id;
if (!STEVE || !JHALIL || !KRESHA || !JAKE) {
  console.error("missing team members — run main seed first");
  process.exit(1);
}

const payeeRow = await c.query(`SELECT id FROM payees WHERE name = 'Elliot Gumbs'`);
const ELLIOT_PAYEE = payeeRow.rows[0]?.id;
if (!ELLIOT_PAYEE) {
  console.error("Elliot's payee row not found");
  process.exit(1);
}

// Vlad's user id (for createdBy stamps)
const vladRow = await c.query(`SELECT id FROM users WHERE email = 'vlad@traderfoundation.com'`);
const VLAD = vladRow.rows[0]?.id;
const arianaRow = await c.query(`SELECT id FROM users WHERE email = 'ariana@traderfoundation.com'`);
const ARIANA = arianaRow.rows[0]?.id;
if (!VLAD || !ARIANA) { console.error("Vlad or Ariana user missing"); process.exit(1); }

const today = new Date().toISOString().slice(0, 10);
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

// ─── Helpers ──────────────────────────────────────────────────────────

async function upsertDeal({ clientName, dealDate, closerId, setterId, totalDealAmount, newCashCollected, paymentType, docusignSigned }) {
  const found = await c.query(
    `SELECT id FROM deals WHERE "clientName" = $1 AND "dealDate" = $2 LIMIT 1`,
    [clientName, dealDate]
  );
  if (found.rows.length > 0) return found.rows[0].id;

  const closerRate = 0.10; // simple — full pay
  const closerCommission = docusignSigned ? newCashCollected * closerRate : 0;
  const setterRateValue = setterId === KRESHA ? 0.03 : 0.02;
  const setterCash = docusignSigned
    ? Math.min(newCashCollected, setterId === KRESHA ? 6000 : Infinity) * setterRateValue
    : 0;

  const r = await c.query(`
    INSERT INTO deals (
      "clientName", "dealDate", "closerId", "setterId",
      showed, prepared, offered, canceled, closed, "isNewClient", "fullyPaid",
      "totalDealAmount", "newCashCollected", "existingCashCollected",
      "paymentType", "docusignSigned",
      "closerCommission", "setterCashCommission", "setterShowCommission",
      "isPaymentPlan"
    ) VALUES (
      $1, $2, $3, $4,
      true, true, true, false, true, true, true,
      $5, $6, 0,
      $7, $8,
      $9, $10, 0,
      false
    )
    RETURNING id
  `, [
    clientName, dealDate, closerId, setterId,
    totalDealAmount.toFixed(2), newCashCollected.toFixed(2),
    paymentType, docusignSigned,
    closerCommission.toFixed(2), setterCash.toFixed(2),
  ]);
  return r.rows[0].id;
}

async function upsertOnboarding(dealId, { coachAssignedPayeeId, onboardedDaysAgo }) {
  const existing = await c.query(`SELECT id FROM "dealOnboardings" WHERE "dealId" = $1`, [dealId]);
  if (existing.rows.length > 0) {
    const onboardedAt = new Date();
    onboardedAt.setDate(onboardedAt.getDate() - onboardedDaysAgo);
    await c.query(`
      UPDATE "dealOnboardings" SET
        "skoolAccessGranted" = true,
        "skoolAccessAt" = NOW(),
        "paymentVerified" = true,
        "paymentVerifiedAt" = NOW(),
        "introCallBooked" = true,
        "introCallBookedAt" = NOW(),
        "coachAssignedPayeeId" = $2,
        "tradingLogAssigned" = true,
        "weeklyCheckInSent" = true,
        "onboardedAt" = $3,
        "onboardedById" = $4
      WHERE "dealId" = $1
    `, [dealId, coachAssignedPayeeId, onboardedAt, ARIANA]);
    return existing.rows[0].id;
  }
  const onboardedAt = new Date();
  onboardedAt.setDate(onboardedAt.getDate() - onboardedDaysAgo);
  const r = await c.query(`
    INSERT INTO "dealOnboardings" (
      "dealId",
      "skoolAccessGranted", "skoolAccessAt",
      "paymentVerified", "paymentVerifiedAt",
      "introCallBooked", "introCallBookedAt",
      "coachAssignedPayeeId",
      "tradingLogAssigned", "weeklyCheckInSent",
      "onboardedAt", "onboardedById"
    ) VALUES (
      $1, true, NOW(), true, NOW(), true, NOW(), $2, true, true, $3, $4
    ) RETURNING id
  `, [dealId, coachAssignedPayeeId, onboardedAt, ARIANA]);
  return r.rows[0].id;
}

async function upsertClientUser({ email, name, dealId }) {
  const found = await c.query(`SELECT id FROM users WHERE email = $1`, [email]);
  if (found.rows.length > 0) {
    await c.query(`UPDATE users SET "clientDealId" = $1 WHERE id = $2`, [dealId, found.rows[0].id]);
    return found.rows[0].id;
  }
  const r = await c.query(`
    INSERT INTO users (email, name, "passwordHash", "loginMethod", role, permissions, "clientDealId", "openId")
    VALUES ($1, $2, $3, 'email', 'client', $4, $5, $6)
    RETURNING id
  `, [
    email, name, passwordHash,
    JSON.stringify(["/", "/trading-log"]),
    dealId,
    `email-seed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  ]);
  return r.rows[0].id;
}

async function upsertTradingLog({ clientUserId, dealId, startingBalance, brokerNote }) {
  const found = await c.query(`SELECT id FROM "tradingLogs" WHERE "dealId" = $1`, [dealId]);
  if (found.rows.length > 0) return found.rows[0].id;
  const r = await c.query(`
    INSERT INTO "tradingLogs" ("clientUserId", "dealId", "startingBalance", "brokerNote", "createdById")
    VALUES ($1, $2, $3, $4, $5) RETURNING id
  `, [clientUserId, dealId, startingBalance.toFixed(2), brokerNote, ARIANA]);
  return r.rows[0].id;
}

async function addTrade(logId, t) {
  // P/L formula: (bid - ask) * 100 * contracts
  const bidAskDiff = t.bid - t.ask;
  const totalInv = t.ask * 100 * t.contracts;
  const pl = bidAskDiff * 100 * t.contracts;
  const pct = totalInv === 0 ? 0 : pl / totalInv;
  await c.query(`
    INSERT INTO "tradeEntries" (
      "tradingLogId", ticker, strategy, direction, result,
      "entryDate", "entryTime", "exitDate",
      "strikePrices", "expirationDate", "contractCount",
      "askPrice", "bidPrice",
      "bidAskDifference", "totalInvestment", "profitLoss", "profitPct",
      notes
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8,
      $9, $10, $11,
      $12, $13,
      $14, $15, $16, $17,
      $18
    )
  `, [
    logId, t.ticker.toUpperCase(), t.strategy, t.direction, t.result,
    t.entryDate, t.entryTime ?? null, t.exitDate ?? null,
    t.strikes ?? null, t.expiration ?? null, t.contracts,
    t.ask.toFixed(4), t.bid.toFixed(4),
    bidAskDiff.toFixed(4), totalInv.toFixed(2), pl.toFixed(2), pct.toFixed(4),
    t.notes ?? null,
  ]);
}

// ─── Build the data ───────────────────────────────────────────────────

console.log("→ Onboarded under Elliot…");

// Marcus Johnson — onboarded 35 days ago, $5K deal, 5 trades (3W 2L)
{
  const dealId = await upsertDeal({
    clientName: "Marcus Johnson",
    dealDate: daysAgo(40),
    closerId: STEVE,
    setterId: KRESHA,
    totalDealAmount: 5000,
    newCashCollected: 5000,
    paymentType: "full_pay",
    docusignSigned: true,
  });
  await upsertOnboarding(dealId, { coachAssignedPayeeId: ELLIOT_PAYEE, onboardedDaysAgo: 35 });
  const userId = await upsertClientUser({
    email: "marcus.johnson@example.com",
    name: "Marcus Johnson",
    dealId,
  });
  const logId = await upsertTradingLog({
    clientUserId: userId, dealId,
    startingBalance: 4000,
    brokerNote: "ThinkOrSwim · primary",
  });
  // Clear & re-add trades
  await c.query(`DELETE FROM "tradeEntries" WHERE "tradingLogId" = $1`, [logId]);
  await addTrade(logId, { ticker: "tsla", strategy: "bounce_profit", direction: "directional_bullish", result: "win",
    entryDate: daysAgo(28), entryTime: "10:32:00", exitDate: daysAgo(27), strikes: "230",
    expiration: daysAgo(-5), contracts: 3, ask: 1.20, bid: 2.10, notes: "Clean bounce off the 50EMA." });
  await addTrade(logId, { ticker: "nvda", strategy: "ready_set_explode", direction: "directional_bullish", result: "win",
    entryDate: daysAgo(22), entryTime: "09:45:00", exitDate: daysAgo(21), strikes: "880",
    expiration: daysAgo(-12), contracts: 2, ask: 4.50, bid: 7.20, notes: "Earnings runup play." });
  await addTrade(logId, { ticker: "spy", strategy: "paycheck_collector", direction: "directional_bearish", result: "loss",
    entryDate: daysAgo(15), entryTime: "14:10:00", exitDate: daysAgo(14), strikes: "545",
    expiration: daysAgo(0), contracts: 5, ask: 1.80, bid: 0.50, notes: "Chopped — should've waited for confirmation." });
  await addTrade(logId, { ticker: "aapl", strategy: "bounce_profit", direction: "directional_bullish", result: "win",
    entryDate: daysAgo(8), entryTime: "11:05:00", exitDate: daysAgo(7), strikes: "232.5",
    expiration: daysAgo(-7), contracts: 4, ask: 0.95, bid: 1.65, notes: "Textbook setup." });
  await addTrade(logId, { ticker: "amd", strategy: "ready_set_explode", direction: "directional_bullish", result: "loss",
    entryDate: daysAgo(3), entryTime: "13:25:00", exitDate: daysAgo(2), strikes: "172",
    expiration: daysAgo(-9), contracts: 3, ask: 2.40, bid: 1.20, notes: "Got fakeout-ed by the open." });
  console.log(`  ✓ Marcus Johnson — deal #${dealId}, log with 5 trades`);
}

// Sarah Williams — onboarded 12 days ago, in-house plan, 3 trades (2W 1L)
{
  const dealId = await upsertDeal({
    clientName: "Sarah Williams",
    dealDate: daysAgo(20),
    closerId: JHALIL,
    setterId: JAKE,
    totalDealAmount: 6500,
    newCashCollected: 2000,
    paymentType: "in_house_payment_plan",
    docusignSigned: true,
  });
  await upsertOnboarding(dealId, { coachAssignedPayeeId: ELLIOT_PAYEE, onboardedDaysAgo: 12 });
  const userId = await upsertClientUser({
    email: "sarah.williams@example.com",
    name: "Sarah Williams",
    dealId,
  });
  const logId = await upsertTradingLog({
    clientUserId: userId, dealId,
    startingBalance: 3000,
    brokerNote: "Webull · main account",
  });
  await c.query(`DELETE FROM "tradeEntries" WHERE "tradingLogId" = $1`, [logId]);
  await addTrade(logId, { ticker: "tsla", strategy: "paycheck_collector", direction: "directional_bullish", result: "win",
    entryDate: daysAgo(10), entryTime: "10:00:00", exitDate: daysAgo(10), strikes: "240",
    expiration: daysAgo(-2), contracts: 2, ask: 0.75, bid: 1.40 });
  await addTrade(logId, { ticker: "qqq", strategy: "bounce_profit", direction: "directional_bullish", result: "win",
    entryDate: daysAgo(6), entryTime: "11:15:00", exitDate: daysAgo(6), strikes: "510",
    expiration: daysAgo(-3), contracts: 3, ask: 1.10, bid: 1.85 });
  await addTrade(logId, { ticker: "nvda", strategy: "ready_set_explode", direction: "directional_bearish", result: "loss",
    entryDate: daysAgo(2), entryTime: "09:55:00", exitDate: daysAgo(1), strikes: "870",
    expiration: daysAgo(-10), contracts: 1, ask: 5.20, bid: 3.10 });
  console.log(`  ✓ Sarah Williams — deal #${dealId}, log with 3 trades`);
}

// Tony Ramirez — onboarded 5 days ago, full pay, EXACTLY 4 trades.
// Smaller account ($2K start) so the user can see what a fresh trader looks like.
{
  const dealId = await upsertDeal({
    clientName: "Tony Ramirez",
    dealDate: daysAgo(8),
    closerId: STEVE,
    setterId: KRESHA,
    totalDealAmount: 4000,
    newCashCollected: 4000,
    paymentType: "full_pay",
    docusignSigned: true,
  });
  await upsertOnboarding(dealId, {
    coachAssignedPayeeId: ELLIOT_PAYEE,
    onboardedDaysAgo: 5,
  });
  const userId = await upsertClientUser({
    email: "tony.ramirez@example.com",
    name: "Tony Ramirez",
    dealId,
  });
  const logId = await upsertTradingLog({
    clientUserId: userId, dealId,
    startingBalance: 2000,
    brokerNote: "Robinhood · main",
  });
  await c.query(`DELETE FROM "tradeEntries" WHERE "tradingLogId" = $1`, [logId]);
  // 4 trades — clean variety: 2 wins, 1 loss, 1 still open (no result yet)
  await addTrade(logId, { ticker: "spy", strategy: "paycheck_collector", direction: "directional_bullish", result: "win",
    entryDate: daysAgo(4), entryTime: "10:15:00", exitDate: daysAgo(4), strikes: "560",
    expiration: daysAgo(-2), contracts: 2, ask: 0.85, bid: 1.30,
    notes: "First trade out of the gate — clean entry off the 9EMA bounce." });
  await addTrade(logId, { ticker: "tsla", strategy: "ready_set_explode", direction: "directional_bullish", result: "win",
    entryDate: daysAgo(3), entryTime: "11:42:00", exitDate: daysAgo(3), strikes: "245",
    expiration: daysAgo(-9), contracts: 1, ask: 3.20, bid: 5.10,
    notes: "Caught the breakout right on the retest. Could've held longer." });
  await addTrade(logId, { ticker: "amd", strategy: "bounce_profit", direction: "directional_bearish", result: "loss",
    entryDate: daysAgo(2), entryTime: "13:30:00", exitDate: daysAgo(2), strikes: "168",
    expiration: daysAgo(-6), contracts: 2, ask: 1.40, bid: 0.80,
    notes: "Stopped out early — should've waited for confirmation." });
  await addTrade(logId, { ticker: "qqq", strategy: "paycheck_collector", direction: "directional_bullish", result: null,
    entryDate: daysAgo(1), entryTime: "09:55:00", exitDate: null, strikes: "515",
    expiration: daysAgo(-4), contracts: 1, ask: 1.10, bid: 1.10,
    notes: "Still open — watching for a move into the close." });
  console.log(`  ✓ Tony Ramirez — deal #${dealId}, log with 4 trades (2W 1L 1 open)`);
}

console.log("→ Awaiting onboarding (Ariana's queue)…");

// David Chen — closed 3 days ago, DocuSigned, NOT onboarded
{
  const dealId = await upsertDeal({
    clientName: "David Chen",
    dealDate: daysAgo(3),
    closerId: STEVE,
    setterId: KRESHA,
    totalDealAmount: 4500,
    newCashCollected: 4500,
    paymentType: "full_pay",
    docusignSigned: true,
  });
  // Make sure no onboarding row exists
  await c.query(`DELETE FROM "dealOnboardings" WHERE "dealId" = $1`, [dealId]);
  console.log(`  ✓ David Chen — deal #${dealId}, awaiting onboarding`);
}

// Amanda Davis — closed 8 days ago, DocuSigned, NOT onboarded (will appear "stale")
{
  const dealId = await upsertDeal({
    clientName: "Amanda Davis",
    dealDate: daysAgo(8),
    closerId: JHALIL,
    setterId: JAKE,
    totalDealAmount: 5000,
    newCashCollected: 5000,
    paymentType: "full_pay",
    docusignSigned: true,
  });
  await c.query(`DELETE FROM "dealOnboardings" WHERE "dealId" = $1`, [dealId]);
  console.log(`  ✓ Amanda Davis — deal #${dealId}, awaiting onboarding (8d waiting)`);
}

console.log("\nDone — sample data seeded.");
console.log("\nLogins to test with (all passwords: Trader):");
console.log("  • vlad@traderfoundation.com     (admin)");
console.log("  • ariana@traderfoundation.com   (payroll/onboarding)");
console.log("  • elliot@traderfoundation.com   (coach — sees all 3 onboarded clients)");
console.log("  • marcus.johnson@example.com    (client · 5 trades · $4K start)");
console.log("  • sarah.williams@example.com    (client · 3 trades · $3K start)");
console.log("  • tony.ramirez@example.com      (client · 4 trades · $2K start, 1 still open)");

await c.end();
