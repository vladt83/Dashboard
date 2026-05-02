import { eq, and, desc, sql, isNull, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { 
  InsertUser, users, 
  deals, InsertDeal, Deal,
  teamMembers, InsertTeamMember, TeamMember,
  commissionRates, InsertCommissionRate, CommissionRate,
  payPeriods, InsertPayPeriod, PayPeriod,
  payrollEntries, InsertPayrollEntry, PayrollEntry,
  adjustments, InsertAdjustment, Adjustment,
  userTeamLinks, InsertUserTeamLink, UserTeamLink,
  notifications, InsertNotification, Notification,
  payees, InsertPayee, Payee,
  payeePayments, InsertPayeePayment, PayeePayment,
  marketingCosts, InsertMarketingCost, MarketingCost,


  bookedCalls, InsertBookedCall, BookedCall,
  dailyStats, InsertDailyStat, DailyStat,
  vslCallPreps, InsertVslCallPrep, VslCallPrep,
  dealOnboardings, InsertDealOnboarding, DealOnboarding,
  extensionAlerts, InsertExtensionAlert, ExtensionAlert,
  tradingLogs, InsertTradingLog, TradingLog,
  tradeEntries, InsertTradeEntry, TradeEntry,
  loginTokens, InsertLoginToken, LoginToken,
} from "../drizzle/schema";

// crypto for generating opaque magic-link tokens
import { randomBytes } from "node:crypto";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      // node-postgres pool is the right primitive for serverless: connections
      // are short-lived per request but the pool is reused across warm invokes.
      _pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        // Vercel Postgres / Neon / Supabase all require SSL in production.
        ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
        max: 5,
      });
      _db = drizzle(_pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ==================== USER QUERIES ====================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId || null,
      email: user.email || `${user.openId}@oauth.local`, // Fallback email for OAuth users
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);
    
    // Handle email separately since it's required
    if (user.email) {
      values.email = user.email;
      updateSet.email = user.email;
    }

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createUserWithPassword(data: {
  email: string;
  name: string;
  passwordHash: string;
  role?: "closer" | "payroll" | "admin" | "coach" | "setter" | "client";
  permissions?: string[];
  clientDealId?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [{ insertId }] = await db.insert(users).values({
    email: data.email,
    name: data.name,
    passwordHash: data.passwordHash,
    loginMethod: "email",
    role: data.role || "closer",
    permissions: data.permissions ? JSON.stringify(data.permissions) : null,
    clientDealId: data.clientDealId ?? null,
    openId: `email-${Date.now()}-${Math.random().toString(36).substring(7)}`, // Generate unique openId for compatibility
  }).returning({ insertId: users.id });

  return getUserById(insertId);
}

/**
 * Create a client login. Called from the Client Profile page by Ariana / admin
 * when onboarding a new client. The client gets their own /dashboard with the
 * trading log, assigned coach card, and Skool link.
 *
 * Idempotency: if a user with this email already exists, returns it as-is.
 * Caller should detect that case via the `created: false` flag.
 */
export async function createClientLogin(input: {
  dealId: number;
  email: string;
  name: string;
  plainPassword: string;
  createdByUserId: number;
}): Promise<{ user: NonNullable<Awaited<ReturnType<typeof getUserById>>>; created: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Confirm the deal exists — we don't want orphan client accounts.
  const deal = await getDealById(input.dealId);
  if (!deal) throw new Error(`Deal #${input.dealId} not found`);

  const email = input.email.toLowerCase().trim();

  // Idempotent: if the email is already in users, just attach to the deal
  // (if not already attached) and return.
  const existing = await getUserByEmail(email);
  if (existing) {
    if (existing.role !== "client") {
      throw new Error(`Email ${email} is already in use by a non-client account.`);
    }
    if (existing.clientDealId !== input.dealId) {
      await db.update(users)
        .set({ clientDealId: input.dealId })
        .where(eq(users.id, existing.id));
    }
    const refreshed = await getUserById(existing.id);
    if (!refreshed) throw new Error("User vanished after update");
    return { user: refreshed, created: false };
  }

  const passwordHash = await bcrypt.hash(input.plainPassword, 10);
  const created = await createUserWithPassword({
    email,
    name: input.name,
    passwordHash,
    role: "client",
    permissions: ["/", "/trading-log"],
    clientDealId: input.dealId,
  });
  if (!created) throw new Error("User creation failed");
  return { user: created, created: true };
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select({
    id: users.id,
    email: users.email,
    name: users.name,
    role: users.role,
    permissions: users.permissions,
    createdAt: users.createdAt,
    lastSignedIn: users.lastSignedIn,
  }).from(users).orderBy(users.name);
}

export async function updateUserPermissions(userId: number, permissions: string[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users)
    .set({ permissions: JSON.stringify(permissions) })
    .where(eq(users.id, userId));

  return getUserById(userId);
}

export async function updateUserRole(userId: number, role: "closer" | "payroll" | "admin" | "coach" | "setter") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users)
    .set({ role })
    .where(eq(users.id, userId));

  return getUserById(userId);
}

export async function deleteUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(users).where(eq(users.id, userId));
}

// ==================== TEAM MEMBER QUERIES ====================

export async function createTeamMember(member: InsertTeamMember): Promise<TeamMember> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [newMember] = await db.insert(teamMembers).values(member).returning();
  return newMember;
}

export async function getTeamMembers(role?: "closer" | "payroll" | "setter"): Promise<TeamMember[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  if (role) {
    return db.select().from(teamMembers)
      .where(and(eq(teamMembers.role, role), eq(teamMembers.active, true)))
      .orderBy(teamMembers.name);
  }
  
  return db.select().from(teamMembers)
    .where(eq(teamMembers.active, true))
    .orderBy(teamMembers.name);
}

export async function getTeamMemberById(id: number): Promise<TeamMember | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [member] = await db.select().from(teamMembers).where(eq(teamMembers.id, id));
  return member || null;
}

export async function updateTeamMember(id: number, data: Partial<InsertTeamMember>): Promise<TeamMember | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(teamMembers).set(data).where(eq(teamMembers.id, id));
  
  const [updated] = await db.select().from(teamMembers).where(eq(teamMembers.id, id));
  return updated || null;
}

// ==================== COMMISSION RATE QUERIES ====================

export async function createCommissionRate(rate: InsertCommissionRate): Promise<CommissionRate> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [newRate] = await db.insert(commissionRates).values(rate).returning();
  return newRate;
}

export async function getCommissionRate(memberId: number, year: number, month: number): Promise<CommissionRate | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Find rate where the date falls within the range
  const rates = await db.select().from(commissionRates)
    .where(eq(commissionRates.memberId, memberId))
    .orderBy(desc(commissionRates.startYear), desc(commissionRates.startMonth));
  
  for (const rate of rates) {
    const startDate = rate.startYear * 12 + rate.startMonth;
    const checkDate = year * 12 + month;
    const endDate = rate.endYear && rate.endMonth 
      ? rate.endYear * 12 + rate.endMonth 
      : Infinity;
    
    if (checkDate >= startDate && checkDate <= endDate) {
      return rate;
    }
  }
  
  return null;
}

export async function getMemberCommissionRates(memberId: number): Promise<CommissionRate[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select().from(commissionRates)
    .where(eq(commissionRates.memberId, memberId))
    .orderBy(desc(commissionRates.startYear), desc(commissionRates.startMonth));
}

// ==================== DEAL QUERIES ====================

export async function createDeal(deal: InsertDeal): Promise<Deal> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [newDeal] = await db.insert(deals).values(deal).returning();
  return newDeal;
}

export async function updateDeal(id: number, deal: Partial<InsertDeal>): Promise<Deal | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(deals).set(deal).where(eq(deals.id, id));
  
  const [updated] = await db.select().from(deals).where(eq(deals.id, id));
  return updated || null;
}

export async function getDealById(id: number): Promise<Deal | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [deal] = await db.select().from(deals).where(eq(deals.id, id));
  return deal || null;
}

export async function getDealsByMonth(year: number, month: number): Promise<Deal[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  const startStr = startDate.toISOString().split('T')[0]!;
  const endStr = endDate.toISOString().split('T')[0]!;
  
  return db.select().from(deals)
    .where(sql`${deals.dealDate} >= ${startStr} AND ${deals.dealDate} <= ${endStr}`)
    .orderBy(desc(deals.dealDate));
}

export async function getDealsByCloser(closerId: number, year: number, month: number): Promise<Deal[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  const startStr = startDate.toISOString().split('T')[0]!;
  const endStr = endDate.toISOString().split('T')[0]!;
  
  return db.select().from(deals)
    .where(and(
      eq(deals.closerId, closerId),
      sql`${deals.dealDate} >= ${startStr} AND ${deals.dealDate} <= ${endStr}`
    ))
    .orderBy(desc(deals.dealDate));
}

export async function getDealsBySetter(setterId: number, year: number, month: number): Promise<Deal[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  const startStr = startDate.toISOString().split('T')[0]!;
  const endStr = endDate.toISOString().split('T')[0]!;
  
  return db.select().from(deals)
    .where(and(
      eq(deals.setterId, setterId),
      sql`${deals.dealDate} >= ${startStr} AND ${deals.dealDate} <= ${endStr}`
    ))
    .orderBy(desc(deals.dealDate));
}

export async function getAllDeals(): Promise<Deal[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select().from(deals).orderBy(desc(deals.dealDate));
}

export async function deleteDeal(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.delete(deals).where(eq(deals.id, id));
  return (result.rowCount ?? 0) > 0;
}

// ==================== COMMISSION CALCULATION ====================

/**
 * Calculate closer commission
 * - 15% of cash collected (Jan-Feb 2026)
 * - 10% of cash collected (March 2026+)
 */
export function calculateCloserCommission(
  cashCollected: number,
  commissionRate: number
): number {
  return cashCollected * commissionRate;
}

/**
 * In-house payment plan deals (Fanbasis / Denefits / Client Financing) pay
 * the closer 9% — slightly below the standard rate to offset the financing
 * fees TF absorbs on these deals. Use this rate any time we calculate a
 * closer commission against a deal whose paymentType === "in_house_payment_plan".
 */
export const IN_HOUSE_PAYMENT_PLAN_CLOSER_RATE = 0.09;

/**
 * Pick the right closer commission rate for a deal. Returns the in-house
 * 9% override when applicable, else falls back to the time-based rate
 * (15% Jan-Feb 2026, 10% from March 2026 onward) read from commissionRates.
 */
export function effectiveCloserRate(
  paymentType: string | null | undefined,
  fallbackRate: number
): number {
  if (paymentType === "in_house_payment_plan") {
    return IN_HOUSE_PAYMENT_PLAN_CLOSER_RATE;
  }
  return fallbackRate;
}

/**
 * Calculate setter commission
 * - $20 if showed AND prepared (regardless of close)
 * - 3% of cash collected if closed
 */
export function calculateSetterCommission(
  showed: boolean,
  prepared: boolean,
  closed: boolean,
  cashCollected: number,
  cashRate: number,
  showRate: number
): { cashCommission: number; showCommission: number; totalCommission: number } {
  let cashCommission = 0;
  let showCommission = 0;
  
  // $20 if showed AND prepared (for new clients)
  if (showed && prepared) {
    showCommission = showRate;
  }
  
  // 3% of cash collected if closed
  if (closed && cashCollected > 0) {
    cashCommission = cashCollected * cashRate;
  }
  
  const totalCommission = cashCommission + showCommission;
  
  return { cashCommission, showCommission, totalCommission };
}

// ==================== PAY PERIOD QUERIES ====================

export async function getOrCreatePayPeriod(year: number, month: number, periodNumber: 1 | 2): Promise<PayPeriod> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if period exists
  const [existing] = await db.select().from(payPeriods)
    .where(and(
      eq(payPeriods.year, year),
      eq(payPeriods.month, month),
      eq(payPeriods.periodNumber, periodNumber)
    ));
  
  if (existing) return existing;
  
  // Create new period
  const startDay = periodNumber === 1 ? 1 : 16;
  const endDay = periodNumber === 1 ? 15 : new Date(year, month, 0).getDate();
  
  const startDate = `${year}-${String(month).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
  
  const [newPeriod] = await db.insert(payPeriods).values({
    year,
    month,
    periodNumber,
    startDate,
    endDate
  }).returning();
  return newPeriod;
}

export async function getPayPeriodsByMonth(year: number, month: number): Promise<PayPeriod[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select().from(payPeriods)
    .where(and(eq(payPeriods.year, year), eq(payPeriods.month, month)))
    .orderBy(payPeriods.periodNumber);
}

// ==================== PAYROLL ENTRY QUERIES ====================

export async function createPayrollEntry(entry: InsertPayrollEntry): Promise<PayrollEntry> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [newEntry] = await db.insert(payrollEntries).values(entry).returning();
  return newEntry;
}

export async function getPayrollEntriesByPeriod(payPeriodId: number): Promise<PayrollEntry[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select().from(payrollEntries)
    .where(eq(payrollEntries.payPeriodId, payPeriodId));
}

export async function getPayrollEntriesByMember(memberId: number, year: number, month: number): Promise<PayrollEntry[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const periods = await getPayPeriodsByMonth(year, month);
  const periodIds = periods.map(p => p.id);
  
  if (periodIds.length === 0) return [];
  
  return db.select().from(payrollEntries)
    .where(and(
      eq(payrollEntries.memberId, memberId),
      sql`${payrollEntries.payPeriodId} IN (${sql.join(periodIds.map(id => sql`${id}`), sql`, `)})`
    ));
}

export async function markPayrollPaid(
  entryId: number, 
  paidBy: number, 
  paidDate: string,
  amountPaid: number
): Promise<PayrollEntry | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(payrollEntries)
    .set({
      isPaid: true,
      paidBy,
      paidDate,
      amountPaid: amountPaid.toFixed(2)
    })
    .where(eq(payrollEntries.id, entryId));
  
  const [updated] = await db.select().from(payrollEntries).where(eq(payrollEntries.id, entryId));
  return updated || null;
}

// ==================== STATISTICS QUERIES ====================

export async function getCloserStats(closerId: number, year: number, month: number) {
  const deals = await getDealsByCloser(closerId, year, month);
  
  const stats = {
    totalRevenue: 0,
    newCashCollected: 0,
    existingCashCollected: 0,
    totalCashCollected: 0,
    closerCommission: 0,
    dealCount: 0,
    showedCount: 0,
    preparedCount: 0,
    closedCount: 0,
    // Three buckets for the dashboard chart:
    //   - financedFuture: outstanding balance on in-house payment plans
    //     (Fanbasis / Denefits) — money the company will collect later.
    //   - bnplFees: total fees absorbed across closed BNPL deals.
    //   - bnplGross: total deal value financed via BNPL (the closer was
    //     paid net upfront; client owes the BNPL provider over time).
    financedFuture: 0,
    bnplFees: 0,
    bnplGross: 0,
  };

  for (const deal of deals) {
    const dealAmount = parseFloat(deal.totalDealAmount || "0");
    const newCash = parseFloat(deal.newCashCollected || "0");
    const existingCash = parseFloat(deal.existingCashCollected || "0");
    const closerComm = parseFloat(deal.closerCommission || "0");
    const downPayment = parseFloat(deal.downPayment || "0");
    const bnplFee = parseFloat(deal.bnplFee || "0");

    stats.totalRevenue += dealAmount;
    stats.newCashCollected += newCash;
    stats.existingCashCollected += existingCash;
    stats.totalCashCollected += newCash + existingCash;
    stats.closerCommission += closerComm;
    stats.dealCount++;

    if (deal.showed) stats.showedCount++;
    if (deal.prepared) stats.preparedCount++;
    if (deal.closed) stats.closedCount++;

    // Financed-future + BNPL splits only count for closed deals
    if (deal.closed) {
      if (deal.paymentType === "in_house_payment_plan") {
        // What the client still owes us on the in-house plan
        stats.financedFuture += Math.max(0, dealAmount - downPayment);
      } else if (deal.paymentType === "bnpl") {
        stats.bnplFees += bnplFee;
        stats.bnplGross += dealAmount;
      }
    }
  }

  // Fold in imported historical data from `dailyStats` (the spreadsheet import).
  // This is what makes Jan–Apr 2026 actuals visible on the dashboard.
  const imported = await aggregateImportedStatsForCloser(closerId, year, month);
  stats.totalRevenue += imported.totalRevenue;
  stats.newCashCollected += imported.newCashCollected;
  stats.existingCashCollected += imported.existingCashCollected;
  stats.totalCashCollected += imported.totalCashCollected;
  stats.closerCommission += imported.closerCommission;
  stats.dealCount += imported.dealCount;
  stats.showedCount += imported.showedCount;
  stats.preparedCount += imported.preparedCount;
  stats.closedCount += imported.closedCount;

  return {
    ...stats,
    totalDeals: stats.dealCount,
  };
}

// getSetterStats removed - setters no longer tracked

/**
 * Sum imported `dailyStats` rows for a given closer + month, and compute
 * the commission those rows would have generated using the closer's
 * commission rate at the time. This lets the dashboard and leaderboard
 * unify imported historical data with live per-deal data without either
 * source double-counting.
 */
async function aggregateImportedStatsForCloser(
  closerId: number,
  year: number,
  month: number
): Promise<{
  totalCashCollected: number;
  newCashCollected: number;
  existingCashCollected: number;
  totalRevenue: number;
  dealCount: number;          // bookings count
  showedCount: number;
  closedCount: number;
  preparedCount: number;
  closerCommission: number;
}> {
  const db = await getDb();
  const empty = {
    totalCashCollected: 0, newCashCollected: 0, existingCashCollected: 0,
    totalRevenue: 0, dealCount: 0, showedCount: 0, closedCount: 0,
    preparedCount: 0, closerCommission: 0,
  };
  if (!db) return empty;

  const { start, end } = dateRangeForMonth(year, month);
  const rows = await db.select().from(dailyStats).where(and(
    eq(dailyStats.closerId, closerId),
    sql`${dailyStats.statDate} >= ${start}`,
    sql`${dailyStats.statDate} <= ${end}`,
  ));

  // Apply the closer's per-day commission rate (15% Jan-Feb 2026, 10% from
  // March 2026). Looking up rate row-by-row keeps the math correct if
  // anyone changes a rate retroactively.
  const acc = { ...empty };
  for (const r of rows) {
    const cash = parseFloat(r.cashCollected?.toString() || "0");
    const rev = parseFloat(r.revGenerated?.toString() || "0");
    acc.totalCashCollected += cash;
    acc.newCashCollected += cash;  // imported sheet doesn't split new vs existing
    acc.totalRevenue += rev;
    acc.dealCount += r.booked;
    acc.showedCount += r.showed;
    acc.closedCount += r.closed;
    acc.preparedCount += r.showed; // sheet didn't track preparedness; treat showed as prepared

    // Pull the closer's rate for this exact date and apply.
    // Parse the stored YYYY-MM-DD without TZ — see parseYearMonth in routers.ts.
    const [yStr, mStr] = String(r.statDate).split("-");
    const rate = await getCommissionRate(closerId, parseInt(yStr, 10), parseInt(mStr, 10));
    const rateValue = rate ? parseFloat(rate.rate) : 0.10;
    acc.closerCommission += cash * rateValue;
  }
  return acc;
}

export async function getMonthlyStats(year: number, month: number) {
  const monthDeals = await getDealsByMonth(year, month);
  
  const stats = {
    totalRevenue: 0,
    newCashCollected: 0,
    existingCashCollected: 0,
    totalCashCollected: 0,
    totalCloserCommission: 0,
    dealCount: 0,
    showedCount: 0,
    preparedCount: 0,
    closedCount: 0,
  };
  
  for (const deal of monthDeals) {
    const dealAmount = parseFloat(deal.totalDealAmount || "0");
    const newCash = parseFloat(deal.newCashCollected || "0");
    const existingCash = parseFloat(deal.existingCashCollected || "0");
    const closerComm = parseFloat(deal.closerCommission || "0");

    stats.totalRevenue += dealAmount;
    stats.newCashCollected += newCash;
    stats.existingCashCollected += existingCash;
    stats.totalCashCollected += newCash + existingCash;
    stats.totalCloserCommission += closerComm;
    stats.dealCount++;

    if (deal.showed) stats.showedCount++;
    if (deal.prepared) stats.preparedCount++;
    if (deal.closed) stats.closedCount++;
  }

  // Fold in imported historical data: sum each closer's imported numbers.
  const closers = await getTeamMembers("closer");
  for (const closer of closers) {
    const imported = await aggregateImportedStatsForCloser(closer.id, year, month);
    stats.totalRevenue += imported.totalRevenue;
    stats.newCashCollected += imported.newCashCollected;
    stats.existingCashCollected += imported.existingCashCollected;
    stats.totalCashCollected += imported.totalCashCollected;
    stats.totalCloserCommission += imported.closerCommission;
    stats.dealCount += imported.dealCount;
    stats.showedCount += imported.showedCount;
    stats.preparedCount += imported.preparedCount;
    stats.closedCount += imported.closedCount;
  }

  return stats;
}

export async function getAvailableMonths() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // EXTRACT(... FROM date) is the SQL-standard equivalent of MySQL's YEAR()/MONTH().
  const fromDeals = await db.select({
    year: sql<number>`EXTRACT(YEAR FROM ${deals.dealDate})::int`,
    month: sql<number>`EXTRACT(MONTH FROM ${deals.dealDate})::int`,
  })
  .from(deals)
  .groupBy(
    sql`EXTRACT(YEAR FROM ${deals.dealDate})`,
    sql`EXTRACT(MONTH FROM ${deals.dealDate})`,
  );

  // Also include months that exist only in imported `dailyStats` data.
  const fromStats = await db.select({
    year: sql<number>`EXTRACT(YEAR FROM ${dailyStats.statDate})::int`,
    month: sql<number>`EXTRACT(MONTH FROM ${dailyStats.statDate})::int`,
  })
  .from(dailyStats)
  .groupBy(
    sql`EXTRACT(YEAR FROM ${dailyStats.statDate})`,
    sql`EXTRACT(MONTH FROM ${dailyStats.statDate})`,
  );

  // Merge + dedupe (year, month) and sort newest first.
  const seen = new Set<string>();
  const merged: { year: number; month: number }[] = [];
  for (const row of [...fromDeals, ...fromStats]) {
    const key = `${row.year}-${row.month}`;
    if (!seen.has(key)) { seen.add(key); merged.push(row); }
  }
  merged.sort((a, b) => (b.year - a.year) || (b.month - a.month));
  return merged;
}

// ==================== LEADERBOARD QUERIES ====================

export async function getCloserLeaderboard(year: number, month: number) {
  const closers = await getTeamMembers("closer");
  
  const leaderboard = await Promise.all(
    closers.map(async (closer) => {
      const stats = await getCloserStats(closer.id, year, month);
      return {
        id: closer.id,
        name: closer.name,
        ...stats,
        totalDeals: stats.totalDeals || stats.dealCount,
      };
    })
  );
  
  // Sort by total cash collected (descending)
  return leaderboard.sort((a, b) => b.totalCashCollected - a.totalCashCollected);
}

// Setter leaderboard removed - setters no longer tracked

// ==================== SEED DATA ====================

export async function seedInitialData() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if team members already exist
  const existingMembers = await db.select().from(teamMembers);
  if (existingMembers.length > 0) {
    console.log("Team members already exist, skipping seed");
    return;
  }
  
  // Create closers
  const steve = await createTeamMember({ name: "Steve Lapa", role: "closer" });
  const jhalil = await createTeamMember({ name: "Jhalil Timazee", role: "closer" });
  
  // Create setter
  const jake = await createTeamMember({ name: "Jake Glass", role: "setter" });
  
  // Create payroll admin
  await createTeamMember({ name: "Ariana", role: "payroll" });
  
  // Create commission rates for closers (15% Jan-Feb 2026, 10% March+)
  await createCommissionRate({
    memberId: steve.id,
    rate: "0.15",
    showRate: "0",
    startMonth: 1,
    startYear: 2026,
    endMonth: 2,
    endYear: 2026
  });
  await createCommissionRate({
    memberId: steve.id,
    rate: "0.10",
    showRate: "0",
    startMonth: 3,
    startYear: 2026,
    endMonth: null,
    endYear: null
  });
  
  await createCommissionRate({
    memberId: jhalil.id,
    rate: "0.15",
    showRate: "0",
    startMonth: 1,
    startYear: 2026,
    endMonth: 2,
    endYear: 2026
  });
  await createCommissionRate({
    memberId: jhalil.id,
    rate: "0.10",
    showRate: "0",
    startMonth: 3,
    startYear: 2026,
    endMonth: null,
    endYear: null
  });
  
  // Create commission rate for setter (3% + $20 show)
  await createCommissionRate({
    memberId: jake.id,
    rate: "0.03",
    showRate: "20",
    startMonth: 1,
    startYear: 2026,
    endMonth: null,
    endYear: null
  });
  
  console.log("Seed data created successfully");
}


// ==================== ADJUSTMENT QUERIES ====================

export async function createAdjustment(adjustment: InsertAdjustment): Promise<Adjustment> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [newAdjustment] = await db.insert(adjustments).values(adjustment).returning();
  return newAdjustment;
}

export async function getAdjustmentsByMember(memberId: number, year: number, month: number): Promise<Adjustment[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select().from(adjustments)
    .where(and(
      eq(adjustments.memberId, memberId),
      eq(adjustments.year, year),
      eq(adjustments.month, month)
    ))
    .orderBy(desc(adjustments.createdAt));
}

export async function getAdjustmentsByMonth(year: number, month: number): Promise<Adjustment[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select().from(adjustments)
    .where(and(
      eq(adjustments.year, year),
      eq(adjustments.month, month)
    ))
    .orderBy(desc(adjustments.createdAt));
}

export async function deleteAdjustment(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.delete(adjustments).where(eq(adjustments.id, id));
  return (result.rowCount ?? 0) > 0;
}

// ==================== USER-TEAM LINK QUERIES ====================

export async function linkUserToTeamMember(userId: number, teamMemberId: number): Promise<UserTeamLink> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if link already exists
  const [existing] = await db.select().from(userTeamLinks).where(eq(userTeamLinks.userId, userId));
  
  if (existing) {
    // Update existing link
    await db.update(userTeamLinks)
      .set({ teamMemberId })
      .where(eq(userTeamLinks.userId, userId));
    
    const [updated] = await db.select().from(userTeamLinks).where(eq(userTeamLinks.userId, userId));
    return updated;
  }
  
  const [newLink] = await db.insert(userTeamLinks).values({ userId, teamMemberId }).returning();
  return newLink;
}

export async function getUserTeamLink(userId: number): Promise<{ link: UserTeamLink | null; teamMember: TeamMember | null }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [link] = await db.select().from(userTeamLinks).where(eq(userTeamLinks.userId, userId));
  
  if (!link) {
    return { link: null, teamMember: null };
  }
  
  const [teamMember] = await db.select().from(teamMembers).where(eq(teamMembers.id, link.teamMemberId));
  
  return { link, teamMember: teamMember || null };
}

export async function removeUserTeamLink(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.delete(userTeamLinks).where(eq(userTeamLinks.userId, userId));
  return (result.rowCount ?? 0) > 0;
}

// ==================== STATS WITH ADJUSTMENTS ====================

export async function getMemberTotalWithAdjustments(memberId: number, year: number, month: number, baseCommission: number) {
  const memberAdjustments = await getAdjustmentsByMember(memberId, year, month);
  
  let bonusTotal = 0;
  let deductionTotal = 0;
  
  for (const adj of memberAdjustments) {
    const amount = parseFloat(adj.amount || "0");
    if (adj.type === "bonus") {
      bonusTotal += amount;
    } else {
      deductionTotal += amount;
    }
  }
  
  return {
    baseCommission,
    bonusTotal,
    deductionTotal,
    totalCommission: baseCommission + bonusTotal - deductionTotal,
    adjustments: memberAdjustments
  };
}


// ==================== NOTIFICATION QUERIES ====================

export async function createNotification(notification: InsertNotification): Promise<Notification> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [newNotification] = await db.insert(notifications).values(notification).returning();
  return newNotification;
}

export async function getNotificationsByMember(memberId: number, limit: number = 50): Promise<Notification[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select().from(notifications)
    .where(eq(notifications.recipientMemberId, memberId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function getUnreadNotificationCount(memberId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select({ count: sql<number>`COUNT(*)` })
    .from(notifications)
    .where(and(
      eq(notifications.recipientMemberId, memberId),
      eq(notifications.isRead, false)
    ));
  
  return result[0]?.count || 0;
}

export async function markNotificationRead(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.id, id));

  return (result.rowCount ?? 0) > 0;
}

export async function markAllNotificationsRead(memberId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.recipientMemberId, memberId));

  return (result.rowCount ?? 0) > 0;
}

// Helper function to create notes update notification
export async function notifySetterOfNotesUpdate(
  setterId: number,
  dealId: number,
  clientName: string,
  closerName: string,
  notes: string
): Promise<Notification> {
  return createNotification({
    recipientMemberId: setterId,
    type: "notes_updated",
    title: `Notes Updated: ${clientName}`,
    message: `${closerName} updated the notes for ${clientName}: "${notes.substring(0, 100)}${notes.length > 100 ? '...' : ''}"`,
    relatedDealId: dealId,
  });
}

// Helper function to create payment notification
export async function notifyMemberOfPayment(
  memberId: number,
  amount: number,
  payrollId: number,
  breakdown: string
): Promise<Notification> {
  return createNotification({
    recipientMemberId: memberId,
    type: "payment_received",
    title: `Payment Received: $${amount.toFixed(2)}`,
    message: breakdown,
    relatedPayrollId: payrollId,
    amount: amount.toFixed(2),
  });
}

// Helper function to create bonus notification
export async function notifyMemberOfBonus(
  memberId: number,
  amount: number,
  reason: string,
  adjustmentId: number
): Promise<Notification> {
  return createNotification({
    recipientMemberId: memberId,
    type: "bonus_added",
    title: `Bonus Added: $${amount.toFixed(2)}`,
    message: `You received a bonus: ${reason}`,
    relatedAdjustmentId: adjustmentId,
    amount: amount.toFixed(2),
  });
}

// Helper function to create deduction notification
export async function notifyMemberOfDeduction(
  memberId: number,
  amount: number,
  reason: string,
  adjustmentId: number
): Promise<Notification> {
  return createNotification({
    recipientMemberId: memberId,
    type: "deduction_added",
    title: `Deduction Applied: $${amount.toFixed(2)}`,
    message: `A deduction was applied: ${reason}`,
    relatedAdjustmentId: adjustmentId,
    amount: amount.toFixed(2),
  });
}


// ==================== PAYEE QUERIES ====================

// Create a new payee (coach, W2 employee, or vendor)
export async function createPayee(payee: InsertPayee): Promise<Payee> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [created] = await db.insert(payees).values(payee).returning();
  return created;
}

// Get all active payees
export async function getActivePayees(): Promise<Payee[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(payees).where(eq(payees.active, true)).orderBy(payees.name);
}

// Get payees by type
export async function getPayeesByType(type: "coach" | "w2" | "vendor"): Promise<Payee[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(payees)
    .where(and(eq(payees.type, type), eq(payees.active, true)))
    .orderBy(payees.name);
}

// Update a payee
export async function updatePayee(id: number, updates: Partial<InsertPayee>): Promise<Payee | null> {
  const db = await getDb();
  if (!db) return null;
  
  await db.update(payees).set(updates).where(eq(payees.id, id));
  const [updated] = await db.select().from(payees).where(eq(payees.id, id));
  return updated || null;
}

// Get payee by user ID (match by name)
export async function getPayeeByUserId(userId: number): Promise<Payee | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Get user name first
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return null;
  
  // Find payee with matching name
  if (!user.name) return null;
  const userName: string = user.name;
  const [payee] = await db.select().from(payees)
    .where(and(eq(payees.name, userName), eq(payees.active, true)));
  return payee || null;
}

// Deactivate a payee
export async function deactivatePayee(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(payees).set({ active: false }).where(eq(payees.id, id));
}

// ==================== PAYEE PAYMENT QUERIES ====================

// Create a payee payment entry
export async function createPayeePayment(payment: InsertPayeePayment): Promise<PayeePayment> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [created] = await db.insert(payeePayments).values(payment).returning();
  return created;
}

// Get payee payments for a specific month
export async function getPayeePaymentsByMonth(month: number, year: number): Promise<(PayeePayment & { payee: Payee })[]> {
  const db = await getDb();
  if (!db) return [];
  
  const payments = await db.select().from(payeePayments)
    .where(and(
      eq(payeePayments.month, month),
      eq(payeePayments.year, year)
    ))
    .orderBy(payeePayments.dueDate);
  
  // Join with payee data
  const result: (PayeePayment & { payee: Payee })[] = [];
  for (const payment of payments) {
    const [payee] = await db.select().from(payees).where(eq(payees.id, payment.payeeId));
    if (payee) {
      result.push({ ...payment, payee });
    }
  }
  
  return result;
}

// Mark a payee payment as paid
export async function markPayeePaymentPaid(id: number, paidBy: number): Promise<PayeePayment | null> {
  const db = await getDb();
  if (!db) return null;
  
  const today = new Date().toISOString().split('T')[0];
  await db.update(payeePayments).set({
    isPaid: true,
    paidDate: today,
    paidBy
  }).where(eq(payeePayments.id, id));
  
  const [updated] = await db.select().from(payeePayments).where(eq(payeePayments.id, id));
  return updated || null;
}

// Generate payee payments for a month (creates entries for all active payees)
export async function generatePayeePaymentsForMonth(month: number, year: number): Promise<PayeePayment[]> {
  const db = await getDb();
  if (!db) return [];
  
  const activePayees = await getActivePayees();
  const created: PayeePayment[] = [];
  
  // Calculate due dates for the month
  const firstHalfDue = `${year}-${String(month).padStart(2, '0')}-15`;
  const lastDay = new Date(year, month, 0).getDate();
  const secondHalfDue = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
  
  for (const payee of activePayees) {
    // Check if payments already exist for this payee this month
    const existing = await db.select().from(payeePayments)
      .where(and(
        eq(payeePayments.payeeId, payee.id),
        eq(payeePayments.month, month),
        eq(payeePayments.year, year)
      ));
    
    if (existing.length > 0) continue; // Skip if already generated
    
    if (payee.paymentFrequency === "biweekly") {
      // Create two payments for bi-weekly
      const payment1 = await createPayeePayment({
        payeeId: payee.id,
        amount: payee.paymentAmount,
        dueDate: firstHalfDue,
        month,
        year,
        periodNumber: 1
      });
      created.push(payment1);
      
      const payment2 = await createPayeePayment({
        payeeId: payee.id,
        amount: payee.paymentAmount,
        dueDate: secondHalfDue,
        month,
        year,
        periodNumber: 2
      });
      created.push(payment2);
    } else if (payee.paymentFrequency === "monthly" || payee.paymentFrequency === "autopay") {
      // Create one payment for monthly/autopay
      const payment = await createPayeePayment({
        payeeId: payee.id,
        amount: payee.paymentAmount,
        dueDate: secondHalfDue,
        month,
        year,
        periodNumber: 1
      });
      
      // If autopay, mark as paid automatically
      if (payee.isAutopay) {
        await markPayeePaymentPaid(payment.id, 0); // 0 = system
      }
      
      created.push(payment);
    }
  }
  
  return created;
}

// Get payroll summary for a month (combines commission-based and fixed payments)
export async function getPayrollSummaryForMonth(month: number, year: number): Promise<{
  commissionBased: {
    memberId: number;
    name: string;
    role: string;
    totalOwed: number;
    totalPaid: number;
    isPaid: boolean;
  }[];
  fixedPayments: (PayeePayment & { payee: Payee })[];
  totalOwed: number;
  totalPaid: number;
}> {
  const db = await getDb();
  if (!db) return { commissionBased: [], fixedPayments: [], totalOwed: 0, totalPaid: 0 };
  
  // Get commission-based team members
  const members = await db.select().from(teamMembers).where(eq(teamMembers.active, true));
  const commissionBased: {
    memberId: number;
    name: string;
    role: string;
    totalOwed: number;
    totalPaid: number;
    isPaid: boolean;
  }[] = [];
  
  for (const member of members) {
    if (member.role === "payroll") continue; // Skip payroll admins
    
    // Calculate commission owed
    const memberDeals = await db.select().from(deals)
      .where(and(
        sql`EXTRACT(MONTH FROM ${deals.dealDate}) = ${month}`,
        sql`EXTRACT(YEAR FROM ${deals.dealDate}) = ${year}`
      ));
    
    let totalOwed = 0;
    
    if (member.role === "closer") {
      // Sum closer commissions on deals
      for (const deal of memberDeals) {
        if (deal.closerId === member.id) {
          totalOwed += parseFloat(deal.closerCommission?.toString() || "0");
        }
      }
      // Plus imported historical commission (Steve / Jhalil 2026 spreadsheet).
      const imported = await aggregateImportedStatsForCloser(member.id, year, month);
      totalOwed += imported.closerCommission;
    } else if (member.role === "setter") {
      // Sum setter commissions on deals (already capped at $6K when stored)
      for (const deal of memberDeals) {
        if (deal.setterId === member.id) {
          totalOwed += parseFloat(deal.setterCashCommission?.toString() || "0");
        }
      }
    }
    
    // Get adjustments
    const memberAdjustments = await db.select().from(adjustments)
      .where(and(
        eq(adjustments.memberId, member.id),
        eq(adjustments.month, month),
        eq(adjustments.year, year)
      ));
    
    for (const adj of memberAdjustments) {
      const amount = parseFloat(adj.amount?.toString() || "0");
      if (adj.type === "bonus") {
        totalOwed += amount;
      } else {
        totalOwed -= amount;
      }
    }
    
    // Get paid amount from payroll entries
    // (Reference the Drizzle table so identifiers are quoted correctly for PG.)
    const payrollEntry = await db.select().from(payrollEntries)
      .where(and(
        eq(payrollEntries.memberId, member.id),
        sql`${payrollEntries.payPeriodId} IN (SELECT ${payPeriods.id} FROM ${payPeriods} WHERE ${payPeriods.month} = ${month} AND ${payPeriods.year} = ${year})`
      ));
    
    const totalPaid = payrollEntry.reduce((sum, entry) => 
      sum + parseFloat(entry.amountPaid?.toString() || "0"), 0);
    
    if (totalOwed > 0 || totalPaid > 0) {
      commissionBased.push({
        memberId: member.id,
        name: member.name,
        role: member.role,
        totalOwed,
        totalPaid,
        isPaid: totalPaid >= totalOwed
      });
    }
  }
  
  // Get fixed payments
  const fixedPayments = await getPayeePaymentsByMonth(month, year);
  
  // Calculate totals
  const totalOwed = commissionBased.reduce((sum, m) => sum + m.totalOwed, 0) +
    fixedPayments.reduce((sum, p) => sum + parseFloat(p.amount?.toString() || "0"), 0);
  
  const totalPaid = commissionBased.reduce((sum, m) => sum + m.totalPaid, 0) +
    fixedPayments.filter(p => p.isPaid).reduce((sum, p) => sum + parseFloat(p.amount?.toString() || "0"), 0);
  
  return { commissionBased, fixedPayments, totalOwed, totalPaid };
}


// ==================== PAYMENT PLAN TRACKING ====================

/**
 * Create the first payment entry for a payment plan
 * Only creates the first month's entry - subsequent entries are created when each payment is collected
 */
export async function createFirstPaymentPlanEntry(
  parentDealId: number,
  totalMonths: number,
  monthlyAmount: number,
  startDate: string // YYYY-MM-DD format
): Promise<Deal | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const parentDeal = await getDealById(parentDealId);
  if (!parentDeal) throw new Error("Parent deal not found");
  
  const startDateObj = new Date(startDate);
  
  // Create only the first payment entry (month 1)
  const paymentDate = new Date(startDateObj);
  paymentDate.setMonth(paymentDate.getMonth() + 1);
  const paymentDateStr = paymentDate.toISOString().split('T')[0]!;
  
  const paymentEntry = await createDeal({
    clientName: parentDeal.clientName,
    dealDate: paymentDateStr,
    showed: true,
    prepared: true,
    closed: true,
    isNewClient: false, // Payment plan entries are always existing
    fullyPaid: false,
    totalDealAmount: "0", // No new deal amount
    newCashCollected: "0",
    existingCashCollected: "0", // Will be updated when payment is collected
    closerId: parentDeal.closerId,
    setterId: parentDeal.setterId,
    paymentType: "in_house_payment_plan",
    paymentProcessor: parentDeal.paymentProcessor,
    isPaymentPlan: true,
    downPayment: "0",
    totalMonths: totalMonths,
    monthlyAmount: monthlyAmount.toFixed(2),
    paymentMonth: 1,
    paymentsCompleted: 0,
    parentDealId: parentDealId,
    paymentCollected: false,
    paymentStatus: "active",
    notes: `Payment 1 of ${totalMonths} - $${monthlyAmount.toFixed(2)}`,
    closerCommission: "0", // Commission calculated when payment is collected
    setterCashCommission: "0",
    setterShowCommission: "0",
  });
  
  return paymentEntry;
}

/**
 * Legacy function - kept for backward compatibility but now only creates first entry
 * @deprecated Use createFirstPaymentPlanEntry instead
 */
export async function createPaymentPlanEntries(
  parentDealId: number,
  totalMonths: number,
  monthlyAmount: number,
  startDate: string
): Promise<Deal[]> {
  const firstEntry = await createFirstPaymentPlanEntry(parentDealId, totalMonths, monthlyAmount, startDate);
  return firstEntry ? [firstEntry] : [];
}

/**
 * Mark a payment plan entry as collected
 * This updates the commission and creates the next month's entry if applicable
 */
export async function collectPaymentPlanPayment(
  dealId: number,
  amountCollected: number,
  closerRate: number,
  setterRate: number
): Promise<Deal | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const deal = await getDealById(dealId);
  if (!deal) return null;
  if (!deal.parentDealId) return null; // Not a payment plan entry
  
  // Calculate commissions
  const closerCommission = amountCollected * closerRate;
  const setterCashCommission = deal.setterId ? amountCollected * setterRate : 0;
  
  // Update the deal
  const updated = await updateDeal(dealId, {
    existingCashCollected: amountCollected.toFixed(2),
    paymentCollected: true,
    paymentStatus: "collected",
    closerCommission: closerCommission.toFixed(2),
    setterCashCommission: setterCashCommission.toFixed(2),
  });
  
  // Update parent deal's payments completed count and create next month's entry
  if (deal.parentDealId) {
    const parentDeal = await getDealById(deal.parentDealId);
    if (parentDeal) {
      const currentPaymentMonth = deal.paymentMonth || 1;
      const newCompletedCount = (parentDeal.paymentsCompleted || 0) + 1;
      const totalMonths = parentDeal.totalMonths || 0;
      const isFullyPaid = newCompletedCount >= totalMonths;
      
      await updateDeal(deal.parentDealId, {
        paymentsCompleted: newCompletedCount,
        fullyPaid: isFullyPaid
      });
      
      // Create next month's entry if there are more payments remaining
      if (currentPaymentMonth < totalMonths) {
        const nextPaymentMonth = currentPaymentMonth + 1;
        const monthlyAmount = parseFloat(parentDeal.monthlyAmount || "0");
        
        // Calculate the date for the next payment
        const parentDealDate = new Date(parentDeal.dealDate);
        const nextPaymentDate = new Date(parentDealDate);
        nextPaymentDate.setMonth(nextPaymentDate.getMonth() + nextPaymentMonth);
        const nextPaymentDateStr = nextPaymentDate.toISOString().split('T')[0]!;
        
        // Create the next payment entry
        await createDeal({
          clientName: parentDeal.clientName,
          dealDate: nextPaymentDateStr,
          showed: true,
          prepared: true,
          closed: true,
          isNewClient: false,
          fullyPaid: false,
          totalDealAmount: "0",
          newCashCollected: "0",
          existingCashCollected: "0",
          closerId: parentDeal.closerId,
          setterId: parentDeal.setterId,
          paymentType: "in_house_payment_plan",
          paymentProcessor: parentDeal.paymentProcessor,
          isPaymentPlan: true,
          downPayment: "0",
          totalMonths: totalMonths,
          monthlyAmount: monthlyAmount.toFixed(2),
          paymentMonth: nextPaymentMonth,
          paymentsCompleted: 0,
          parentDealId: deal.parentDealId,
          paymentCollected: false,
          paymentStatus: "active",
          notes: `Payment ${nextPaymentMonth} of ${totalMonths} - $${monthlyAmount.toFixed(2)}`,
          closerCommission: "0",
          setterCashCommission: "0",
          setterShowCommission: "0",
        });
      }
    }
  }
  
  return updated;
}

/**
 * Get pending payment plan entries for a month
 * These are entries where payment has not been collected yet
 */
export async function getPendingPaymentPlanEntries(year: number, month: number): Promise<Deal[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  const startStr = startDate.toISOString().split('T')[0]!;
  const endStr = endDate.toISOString().split('T')[0]!;
  
  return db.select().from(deals)
    .where(and(
      sql`${deals.dealDate} >= ${startStr} AND ${deals.dealDate} <= ${endStr}`,
      eq(deals.isPaymentPlan, true),
      eq(deals.paymentCollected, false),
      eq(deals.paymentStatus, "active")
    ))
    .orderBy(deals.dealDate);
}

/**
 * Cancel remaining payment plan entries (client stopped paying)
 */
export async function cancelPaymentPlanEntries(parentDealId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.update(deals)
    .set({ paymentStatus: "cancelled" })
    .where(and(
      eq(deals.parentDealId, parentDealId),
      eq(deals.paymentCollected, false),
      eq(deals.paymentStatus, "active")
    ));

  return result.rowCount ?? 0;
}

/**
 * Mark payment plan as paid early (remove remaining entries)
 */
export async function markPaymentPlanPaidEarly(parentDealId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Update remaining entries to paid_early status
  await db.update(deals)
    .set({ paymentStatus: "paid_early" })
    .where(and(
      eq(deals.parentDealId, parentDealId),
      eq(deals.paymentCollected, false),
      eq(deals.paymentStatus, "active")
    ));
  
  // Mark parent deal as fully paid
  await updateDeal(parentDealId, { fullyPaid: true });
}

/**
 * Toggle autopay status for a payee
 */
export async function togglePayeeAutopay(payeeId: number): Promise<Payee | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [payee] = await db.select().from(payees).where(eq(payees.id, payeeId));
  if (!payee) return null;
  
  const newAutopayStatus = !payee.isAutopay;
  
  await db.update(payees)
    .set({ isAutopay: newAutopayStatus })
    .where(eq(payees.id, payeeId));
  
  const [updated] = await db.select().from(payees).where(eq(payees.id, payeeId));
  return updated || null;
}

/**
 * Get payment plan progress for a parent deal
 */
export async function getPaymentPlanProgress(parentDealId: number): Promise<{
  totalMonths: number;
  paymentsCompleted: number;
  paymentsRemaining: number;
  totalCollected: number;
  totalRemaining: number;
  isFullyPaid: boolean;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const parentDeal = await getDealById(parentDealId);
  if (!parentDeal) {
    return { totalMonths: 0, paymentsCompleted: 0, paymentsRemaining: 0, totalCollected: 0, totalRemaining: 0, isFullyPaid: false };
  }
  
  const totalMonths = parentDeal.totalMonths || 0;
  const monthlyAmount = parseFloat(parentDeal.monthlyAmount?.toString() || "0");
  
  // Get all payment entries for this plan
  const paymentEntries = await db.select().from(deals)
    .where(eq(deals.parentDealId, parentDealId));
  
  const paymentsCompleted = paymentEntries.filter(e => e.paymentCollected).length;
  const paymentsRemaining = paymentEntries.filter(e => !e.paymentCollected && e.paymentStatus === "active").length;
  
  const totalCollected = paymentEntries
    .filter(e => e.paymentCollected)
    .reduce((sum, e) => sum + parseFloat(e.existingCashCollected?.toString() || "0"), 0);
  
  const totalRemaining = paymentsRemaining * monthlyAmount;
  
  return {
    totalMonths,
    paymentsCompleted,
    paymentsRemaining,
    totalCollected,
    totalRemaining,
    isFullyPaid: parentDeal.fullyPaid || false
  };
}


/**
 * Get all payment plan entries for a specific month
 * Returns both collected and uncollected payment plan entries
 */
export async function getPaymentPlansByMonth(year: number, month: number): Promise<Deal[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  const startStr = startDate.toISOString().split('T')[0]!;
  const endStr = endDate.toISOString().split('T')[0]!;
  
  return db.select().from(deals)
    .where(and(
      sql`${deals.dealDate} >= ${startStr} AND ${deals.dealDate} <= ${endStr}`,
      eq(deals.isPaymentPlan, true),
      sql`${deals.parentDealId} IS NOT NULL`
    ))
    .orderBy(deals.dealDate);
}

// ==================== COACHING SESSION QUERIES ====================

import { coachingSessions, InsertCoachingSession, CoachingSession } from "../drizzle/schema";

const COACHING_RATE_PER_MINUTE = 0.90;
const NO_SHOW_RATE = 15.00;

/**
 * Compute per-session pay. Only on-demand coaches get $0.90/min + $15/no-show.
 * Salaried + W2 coaches always get $0 — their pay is the fixed bi-weekly amount
 * tracked through payeePayments, NOT per-session.
 */
async function computeSessionPay(
  coachPayeeId: number,
  isNoShow: boolean,
  minutes: number
): Promise<string> {
  const db = await getDb();
  if (!db) return "0";
  const [payee] = await db.select().from(payees).where(eq(payees.id, coachPayeeId));
  if (!payee || payee.type !== "on_demand_coach") {
    return "0";
  }
  if (isNoShow) return NO_SHOW_RATE.toFixed(2);
  return (minutes * COACHING_RATE_PER_MINUTE).toFixed(2);
}

export async function createCoachingSession(session: Omit<InsertCoachingSession, "sessionPay">): Promise<CoachingSession> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const sessionPay = await computeSessionPay(session.coachPayeeId, session.isNoShow ?? false, session.minutes);

  const [newSession] = await db.insert(coachingSessions).values({
    ...session,
    sessionPay,
  }).returning();
  return newSession;
}

export async function updateCoachingSession(id: number, data: Partial<InsertCoachingSession>): Promise<CoachingSession | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Recalculate pay if minutes or isNoShow changed
  const updateData: any = { ...data };
  if (data.minutes !== undefined || data.isNoShow !== undefined) {
    const [existing] = await db.select().from(coachingSessions).where(eq(coachingSessions.id, id));
    if (existing) {
      const isNoShow = data.isNoShow !== undefined ? data.isNoShow : existing.isNoShow;
      const minutes = data.minutes !== undefined ? data.minutes : existing.minutes;
      updateData.sessionPay = await computeSessionPay(existing.coachPayeeId, isNoShow, minutes);
    }
  }

  await db.update(coachingSessions).set(updateData).where(eq(coachingSessions.id, id));

  const [updated] = await db.select().from(coachingSessions).where(eq(coachingSessions.id, id));
  return updated || null;
}

export async function deleteCoachingSession(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(coachingSessions).where(eq(coachingSessions.id, id));
}

export async function getCoachingSessionsByMonth(coachPayeeId: number, year: number, month: number): Promise<CoachingSession[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(coachingSessions)
    .where(and(
      eq(coachingSessions.coachPayeeId, coachPayeeId),
      eq(coachingSessions.year, year),
      eq(coachingSessions.month, month)
    ))
    .orderBy(coachingSessions.sessionDate);
}

export async function getAllCoachingSessionsByMonth(year: number, month: number): Promise<CoachingSession[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(coachingSessions)
    .where(and(
      eq(coachingSessions.year, year),
      eq(coachingSessions.month, month)
    ))
    .orderBy(coachingSessions.sessionDate);
}

export async function getCoachingSessionSummary(coachPayeeId: number, year: number, month: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const sessions = await getCoachingSessionsByMonth(coachPayeeId, year, month);

  const completedSessions = sessions.filter(s => !s.isNoShow);
  const noShowSessions = sessions.filter(s => s.isNoShow);

  const totalMinutes = completedSessions.reduce((sum, s) => sum + s.minutes, 0);
  const sessionPay = totalMinutes * COACHING_RATE_PER_MINUTE;
  const noShowPay = noShowSessions.length * NO_SHOW_RATE;
  const totalPay = sessionPay + noShowPay;

  return {
    totalSessions: sessions.length,
    completedSessions: completedSessions.length,
    noShowCount: noShowSessions.length,
    totalMinutes,
    sessionPay,
    noShowPay,
    totalPay,
  };
}


// ==================== MARKETING COSTS QUERIES ====================

export async function getMarketingCostsByMonth(year: number, month: number): Promise<MarketingCost[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(marketingCosts)
    .where(and(
      eq(marketingCosts.year, year),
      eq(marketingCosts.month, month)
    ))
    .orderBy(marketingCosts.platform);
}

export async function createMarketingCost(cost: InsertMarketingCost): Promise<MarketingCost> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [newCost] = await db.insert(marketingCosts).values(cost).returning();
  return newCost;
}

export async function updateMarketingCost(id: number, data: Partial<InsertMarketingCost>): Promise<MarketingCost | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(marketingCosts).set(data).where(eq(marketingCosts.id, id));
  const [updated] = await db.select().from(marketingCosts).where(eq(marketingCosts.id, id));
  return updated || null;
}

export async function deleteMarketingCost(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(marketingCosts).where(eq(marketingCosts.id, id));
}

// ==================== ENHANCED DASHBOARD STATS ====================

export async function getCompanyPerformance(year: number, month: number) {
  const monthDeals = await getDealsByMonth(year, month);
  const mktgCosts = await getMarketingCostsByMonth(year, month);
  
  let totalRevenue = 0;
  let newCashCollected = 0;
  let existingCashCollected = 0;
  let totalCashCollected = 0;
  let dealCount = 0;
  let closedCount = 0;
  let showedCount = 0;
  let totalEntries = monthDeals.length; // Every entry is a call
  let newMonthlyRevenue = 0; // Sum of monthly payment amounts from payment plans + BNPL

  for (const deal of monthDeals) {
    const dealAmount = parseFloat(deal.totalDealAmount || "0");
    const newCash = parseFloat(deal.newCashCollected || "0");
    const existingCash = parseFloat(deal.existingCashCollected || "0");
    const monthlyAmt = parseFloat(deal.monthlyAmount || "0");

    totalRevenue += dealAmount;
    newCashCollected += newCash;
    existingCashCollected += existingCash;
    totalCashCollected += newCash + existingCash;
    dealCount++;

    if (deal.showed) showedCount++;
    if (deal.closed) closedCount++;

    // New monthly revenue: if payment plan or BNPL, add the monthly payment amount
    if (deal.closed && (deal.paymentType === "in_house_payment_plan" || deal.paymentType === "bnpl") && monthlyAmt > 0) {
      newMonthlyRevenue += monthlyAmt;
    }
  }

  // Fold in imported historical data (Steve + Jhalil 2026 spreadsheet).
  // The dashboard shows the union of live + imported.
  const closers = await getTeamMembers("closer");
  for (const closer of closers) {
    const imported = await aggregateImportedStatsForCloser(closer.id, year, month);
    totalRevenue += imported.totalRevenue;
    newCashCollected += imported.newCashCollected;
    existingCashCollected += imported.existingCashCollected;
    totalCashCollected += imported.totalCashCollected;
    dealCount += imported.dealCount;
    closedCount += imported.closedCount;
    showedCount += imported.showedCount;
    totalEntries += imported.dealCount;
  }

  const totalMarketingCost = mktgCosts.reduce((sum, c) => sum + parseFloat(c.amount?.toString() || "0"), 0);
  const roas = totalMarketingCost > 0 ? totalCashCollected / totalMarketingCost : 0;

  return {
    totalRevenue,
    newCashCollected,
    existingCashCollected,
    totalCashCollected,
    totalMarketingCost,
    roas,
    newMonthlyRevenue,
    dealCount,
    closedCount,
    showedCount,
    totalEntries,
    marketingBreakdown: mktgCosts.map(c => ({
      id: c.id,
      platform: c.platform,
      amount: parseFloat(c.amount?.toString() || "0"),
      notes: c.notes,
    })),
  };
}

export async function getSalesTeamBreakdown(year: number, month: number) {
  const closers = await getTeamMembers("closer");
  
  const closerBreakdown = await Promise.all(
    closers.map(async (closer) => {
      const closerDeals = await getDealsByCloser(closer.id, year, month);
      
      let totalRevenue = 0;
      let totalCashCollected = 0;
      let closerCommission = 0;
      let closedCount = 0;

      for (const deal of closerDeals) {
        if (deal.closed) {
          closedCount++;
          totalRevenue += parseFloat(deal.totalDealAmount || "0");
        }
        totalCashCollected += parseFloat(deal.newCashCollected || "0") + parseFloat(deal.existingCashCollected || "0");
        closerCommission += parseFloat(deal.closerCommission || "0");
      }

      return {
        id: closer.id,
        name: closer.name,
        role: "closer" as const,
        closedCount,
        totalRevenue,
        totalCashCollected,
        commission: closerCommission,
      };
    })
  );

  return {
    closers: closerBreakdown.sort((a, b) => b.totalCashCollected - a.totalCashCollected),
  };
}

export async function getPayrollOverview(year: number, month: number) {
  const members = await getTeamMembers();
  const mktgCosts = await getMarketingCostsByMonth(year, month);
  
  // Sales commissions: closers (full deal) + setters (3% on capped cash).
  const closerPayroll = await Promise.all(
    members.filter(m => m.role === "closer").map(async (member) => {
      const stats = await getCloserStats(member.id, year, month);
      return {
        id: member.id,
        name: member.name,
        role: member.role,
        category: "Sales Commission" as const,
        owed: stats.closerCommission,
        paid: 0, // Will be filled from payroll entries
      };
    })
  );

  const setterPayroll = await Promise.all(
    members.filter(m => m.role === "setter").map(async (member) => {
      const { totalCommission } = await getSetterPayouts(member.id, year, month);
      return {
        id: member.id,
        name: member.name,
        role: member.role,
        category: "Sales Commission" as const,
        owed: totalCommission,
        paid: 0,
      };
    })
  );

  const salesPayroll = [...closerPayroll, ...setterPayroll];

  // Get payee payments for the month
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const pPayments = await db.select({
    id: payeePayments.id,
    payeeId: payeePayments.payeeId,
    amount: payeePayments.amount,
    isPaid: payeePayments.isPaid,
    dueDate: payeePayments.dueDate,
  }).from(payeePayments)
    .where(and(
      eq(payeePayments.year, year),
      eq(payeePayments.month, month)
    ));

  const allPayees = await db.select().from(payees).where(eq(payees.active, true));

  // Group payee payments by category
  const coachingPayroll = pPayments
    .filter(p => {
      const payee = allPayees.find(pp => pp.id === p.payeeId);
      return payee && (payee.type === "coach" || payee.type === "on_demand_coach");
    })
    .map(p => {
      const payee = allPayees.find(pp => pp.id === p.payeeId)!;
      return {
        id: p.id,
        name: payee.name,
        role: payee.type,
        category: "Coaching" as const,
        owed: parseFloat(p.amount?.toString() || "0"),
        paid: p.isPaid ? parseFloat(p.amount?.toString() || "0") : 0,
      };
    });

  const vendorPayroll = pPayments
    .filter(p => {
      const payee = allPayees.find(pp => pp.id === p.payeeId);
      return payee && payee.type === "vendor";
    })
    .map(p => {
      const payee = allPayees.find(pp => pp.id === p.payeeId)!;
      return {
        id: p.id,
        name: payee.name,
        role: payee.type,
        category: "Marketing" as const,
        owed: parseFloat(p.amount?.toString() || "0"),
        paid: p.isPaid ? parseFloat(p.amount?.toString() || "0") : 0,
      };
    });

  const operationsPayroll = pPayments
    .filter(p => {
      const payee = allPayees.find(pp => pp.id === p.payeeId);
      return payee && payee.type === "w2";
    })
    .map(p => {
      const payee = allPayees.find(pp => pp.id === p.payeeId)!;
      return {
        id: p.id,
        name: payee.name,
        role: payee.type,
        category: "Operations" as const,
        owed: parseFloat(p.amount?.toString() || "0"),
        paid: p.isPaid ? parseFloat(p.amount?.toString() || "0") : 0,
      };
    });

  const totalOwed = [...salesPayroll, ...coachingPayroll, ...vendorPayroll, ...operationsPayroll]
    .reduce((sum, p) => sum + p.owed, 0);
  const totalPaid = [...salesPayroll, ...coachingPayroll, ...vendorPayroll, ...operationsPayroll]
    .reduce((sum, p) => sum + p.paid, 0);

  return {
    salesPayroll,
    coachingPayroll,
    vendorPayroll,
    operationsPayroll,
    totalOwed,
    totalPaid,
    outstanding: totalOwed - totalPaid,
  };
}



// ==================== BOOKED CALLS QUERIES ====================
//
// Setter payouts deliberately use min(cashCollected, $6,000) — the team
// agreed setters never see deal economics above $6K, both for display and
// for commission calc. Don't bypass this cap without explicit approval.

// Default cap for backward compatibility / unknown setters. Per-setter caps
// live on `teamMembers.commissionCap` (NULL = uncapped, e.g. Jake the VSL setter).
export const SETTER_CAP = 6000;
// Default fallback rate when a setter has no `setterRate` set on their team
// member row. Real rates are per-setter:
//   - Text setter (Kresha / Call Setting motion): 0.03 (3%)
//   - VSL setter (Jake / Pre Call motion):        0.02 (2%)
// Setters NEVER take the in-house 9% haircut closers do — they always earn
// their full rate on every collected payment.
export const SETTER_RATE = 0.03;

/**
 * Resolve the commission cap to apply for a specific setter. Returns null
 * if the setter is uncapped (e.g. Jake), or a positive number for a capped
 * setter (e.g. Kresha at 6000). Falls back to the default SETTER_CAP if the
 * teamMember row can't be found — defensive only.
 */
export async function getSetterCap(setterId: number): Promise<number | null> {
  const db = await getDb();
  if (!db) return SETTER_CAP;
  const [row] = await db.select({ cap: teamMembers.commissionCap })
    .from(teamMembers)
    .where(eq(teamMembers.id, setterId));
  if (!row) return SETTER_CAP;
  if (row.cap === null || row.cap === undefined) return null; // explicitly uncapped
  return parseFloat(row.cap.toString());
}

/**
 * Resolve the commission rate (decimal: 0.03 = 3%) for a specific setter.
 * Reads `teamMembers.setterRate`. Falls back to `SETTER_RATE` (3%) if the
 * row exists but has no rate set (legacy data) or can't be found.
 */
export async function getSetterRate(setterId: number): Promise<number> {
  const db = await getDb();
  if (!db) return SETTER_RATE;
  const [row] = await db.select({ rate: teamMembers.setterRate })
    .from(teamMembers)
    .where(eq(teamMembers.id, setterId));
  if (!row || row.rate === null || row.rate === undefined) return SETTER_RATE;
  return parseFloat(row.rate.toString());
}

/** Apply the per-setter cap to a cash amount. Pass cap=null for uncapped. */
export function applySetterCap(cash: number, cap: number | null): number {
  if (cap === null) return cash;
  return Math.min(cash, cap);
}

export async function createBookedCall(input: InsertBookedCall): Promise<BookedCall> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.insert(bookedCalls).values(input).returning();
  return row;
}

export async function getBookedCallById(id: number): Promise<BookedCall | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.select().from(bookedCalls).where(eq(bookedCalls.id, id));
  return row ?? null;
}

export async function getBookedCallsBySetter(setterId: number): Promise<BookedCall[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(bookedCalls)
    .where(eq(bookedCalls.setterId, setterId))
    .orderBy(desc(bookedCalls.bookedDate), desc(bookedCalls.id));
}

export async function getBookedCallsByCloser(closerId: number): Promise<BookedCall[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(bookedCalls)
    .where(eq(bookedCalls.closerId, closerId))
    .orderBy(desc(bookedCalls.bookedDate), desc(bookedCalls.id));
}

export async function getAllBookedCalls(): Promise<BookedCall[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(bookedCalls)
    .orderBy(desc(bookedCalls.bookedDate), desc(bookedCalls.id));
}

export async function updateBookedCall(
  id: number,
  patch: Partial<InsertBookedCall>
): Promise<BookedCall | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(bookedCalls).set(patch).where(eq(bookedCalls.id, id));
  return getBookedCallById(id);
}

export async function deleteBookedCall(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.delete(bookedCalls).where(eq(bookedCalls.id, id));
  return (result.rowCount ?? 0) > 0;
}

/**
 * Setter payouts for a given month: capped cash collected × the setter's
 * own rate (Kresha 3%, Jake 2%) on closed deals where deals.setterId matches.
 *
 * Returns the per-deal capped view (what the setter actually sees) plus the
 * monthly total commission and the rate used. Deal client names and total
 * deal amounts are NOT returned — setters only see capped cash + their own
 * commission.
 */
export type SetterPayoutLine = {
  dealId: number;
  dealDate: string;
  cappedCashCollected: number;  // min(actualCash, SETTER_CAP)
  commission: number;            // cappedCashCollected * setter's rate
};

export async function getSetterPayouts(
  setterId: number,
  year: number,
  month: number
): Promise<{ lines: SetterPayoutLine[]; totalCommission: number; cap: number | null; rate: number }> {
  const dealsForMonth = await getDealsBySetter(setterId, year, month);
  const cap = await getSetterCap(setterId);   // Kresha=6000, Jake=null
  const rate = await getSetterRate(setterId); // Kresha=0.03, Jake=0.02

  const lines: SetterPayoutLine[] = dealsForMonth
    .filter(d => d.closed)
    .map(d => {
      const cash =
        parseFloat(d.newCashCollected || "0") +
        parseFloat(d.existingCashCollected || "0");
      const eligibleCash = applySetterCap(cash, cap);
      return {
        dealId: d.id,
        dealDate: d.dealDate,
        cappedCashCollected: eligibleCash,
        commission: eligibleCash * rate,
      };
    });

  const totalCommission = lines.reduce((sum, l) => sum + l.commission, 0);
  return { lines, totalCommission, cap, rate };
}

// ==================== SALES TRACKER ====================
//
// The Sales Tracker page mirrors the spreadsheet your team has been using
// (see Steve2026 / Jhalil 2026 in the Google Sheet). It exposes the same
// monthly/quarterly metrics: Booked, Showed, Canceled, No Show, Offer,
// Closed, Cash Collected, Rev Generated, plus auto-computed Show %, Offer %,
// Close %, Collection %, Cash/Booking, Rev/Booking, Cash/Show, Rev/Show.
//
// Two data sources are unified at query time:
//   1) Per-deal rows from `deals` (post-cutover, normal flow)
//   2) Daily aggregates from `dailyStats` (historical import from the sheet)
// They are SUMMED — historical months should only have rows in one source,
// not both. The import script enforces that.

export type SalesMetrics = {
  booked: number;
  showed: number;
  canceled: number;
  noShow: number;
  offered: number;
  closed: number;
  cashCollected: number;
  revGenerated: number;
};

const ZERO_METRICS: SalesMetrics = {
  booked: 0, showed: 0, canceled: 0, noShow: 0,
  offered: 0, closed: 0, cashCollected: 0, revGenerated: 0,
};

/**
 * Compute metrics from per-deal rows for a closer between two dates.
 * Date range is inclusive. Dates are 'YYYY-MM-DD' strings.
 */
async function dealMetrics(closerId: number, startDate: string, endDate: string): Promise<SalesMetrics> {
  const db = await getDb();
  if (!db) return { ...ZERO_METRICS };

  const rows = await db.select().from(deals).where(and(
    eq(deals.closerId, closerId),
    sql`${deals.dealDate} >= ${startDate}`,
    sql`${deals.dealDate} <= ${endDate}`,
  ));

  const m: SalesMetrics = { ...ZERO_METRICS };
  for (const d of rows) {
    m.booked++;
    if (d.showed) m.showed++;
    if (d.canceled) m.canceled++;
    // No-show = was booked, didn't show, didn't cancel
    if (!d.showed && !d.canceled) m.noShow++;
    if (d.offered) m.offered++;
    if (d.closed) {
      m.closed++;
      m.cashCollected += parseFloat(d.newCashCollected || "0") + parseFloat(d.existingCashCollected || "0");
      m.revGenerated += parseFloat(d.totalDealAmount || "0");
    }
  }
  return m;
}

/**
 * Same shape, sourced from imported `dailyStats` rows for the same closer/date range.
 */
async function dailyStatsMetrics(closerId: number, startDate: string, endDate: string): Promise<SalesMetrics> {
  const db = await getDb();
  if (!db) return { ...ZERO_METRICS };

  const rows = await db.select().from(dailyStats).where(and(
    eq(dailyStats.closerId, closerId),
    sql`${dailyStats.statDate} >= ${startDate}`,
    sql`${dailyStats.statDate} <= ${endDate}`,
  ));

  const m: SalesMetrics = { ...ZERO_METRICS };
  for (const r of rows) {
    m.booked += r.booked;
    m.showed += r.showed;
    m.canceled += r.canceled;
    m.noShow += r.noShow;
    m.offered += r.offered;
    m.closed += r.closed;
    m.cashCollected += parseFloat(r.cashCollected?.toString() || "0");
    m.revGenerated += parseFloat(r.revGenerated?.toString() || "0");
  }
  return m;
}

function combine(a: SalesMetrics, b: SalesMetrics): SalesMetrics {
  return {
    booked: a.booked + b.booked,
    showed: a.showed + b.showed,
    canceled: a.canceled + b.canceled,
    noShow: a.noShow + b.noShow,
    offered: a.offered + b.offered,
    closed: a.closed + b.closed,
    cashCollected: a.cashCollected + b.cashCollected,
    revGenerated: a.revGenerated + b.revGenerated,
  };
}

function dateRangeForMonth(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

/**
 * Return all 12 monthly metric rows for a closer in a given year. Each row is
 * the unified (deals + dailyStats) totals for that month.
 */
export async function getSalesMonthlyByCloser(closerId: number, year: number): Promise<SalesMetrics[]> {
  const out: SalesMetrics[] = [];
  for (let m = 1; m <= 12; m++) {
    const { start, end } = dateRangeForMonth(year, m);
    const fromDeals = await dealMetrics(closerId, start, end);
    const fromStats = await dailyStatsMetrics(closerId, start, end);
    out.push(combine(fromDeals, fromStats));
  }
  return out;
}

/**
 * Daily breakdown for one closer / one month. Used for the drill-down view.
 * Date is 'YYYY-MM-DD'.
 */
export async function getSalesDailyByCloser(
  closerId: number,
  year: number,
  month: number,
): Promise<Array<SalesMetrics & { date: string }>> {
  const { start, end } = dateRangeForMonth(year, month);
  // Query deals + dailyStats once each, group by date.
  const db = await getDb();
  if (!db) return [];

  const dealRows = await db.select().from(deals).where(and(
    eq(deals.closerId, closerId),
    sql`${deals.dealDate} >= ${start}`,
    sql`${deals.dealDate} <= ${end}`,
  ));
  const statRows = await db.select().from(dailyStats).where(and(
    eq(dailyStats.closerId, closerId),
    sql`${dailyStats.statDate} >= ${start}`,
    sql`${dailyStats.statDate} <= ${end}`,
  ));

  const byDate = new Map<string, SalesMetrics>();
  const ensure = (d: string) => {
    if (!byDate.has(d)) byDate.set(d, { ...ZERO_METRICS });
    return byDate.get(d)!;
  };

  for (const d of dealRows) {
    const day = d.dealDate;
    const m = ensure(day);
    m.booked++;
    if (d.showed) m.showed++;
    if (d.canceled) m.canceled++;
    if (!d.showed && !d.canceled) m.noShow++;
    if (d.offered) m.offered++;
    if (d.closed) {
      m.closed++;
      m.cashCollected += parseFloat(d.newCashCollected || "0") + parseFloat(d.existingCashCollected || "0");
      m.revGenerated += parseFloat(d.totalDealAmount || "0");
    }
  }
  for (const r of statRows) {
    const day = r.statDate;
    const m = ensure(day);
    m.booked += r.booked;
    m.showed += r.showed;
    m.canceled += r.canceled;
    m.noShow += r.noShow;
    m.offered += r.offered;
    m.closed += r.closed;
    m.cashCollected += parseFloat(r.cashCollected?.toString() || "0");
    m.revGenerated += parseFloat(r.revGenerated?.toString() || "0");
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, m]) => ({ date, ...m }));
}

// ==================== DAILY STATS IMPORT ====================
//
// Used once to bring in 2026 history from the Steve2026 / Jhalil 2026
// spreadsheet. Called by scripts/import-sales-history.mjs.

export async function upsertDailyStat(input: InsertDailyStat): Promise<DailyStat> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Look for an existing row for the same closer + date
  const [existing] = await db.select().from(dailyStats).where(and(
    eq(dailyStats.closerId, input.closerId),
    eq(dailyStats.statDate, input.statDate),
  ));
  if (existing) {
    await db.update(dailyStats).set(input).where(eq(dailyStats.id, existing.id));
    const [updated] = await db.select().from(dailyStats).where(eq(dailyStats.id, existing.id));
    return updated;
  }
  const [row] = await db.insert(dailyStats).values(input).returning();
  return row;
}

// ==================== VSL CALL PREPS ====================
// Jake's pre-call discovery notes per the OCE Setter Script V1.

export async function createVslCallPrep(input: InsertVslCallPrep): Promise<VslCallPrep> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.insert(vslCallPreps).values(input).returning();
  return row;
}

export async function getVslCallPrepById(id: number): Promise<VslCallPrep | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.select().from(vslCallPreps).where(eq(vslCallPreps.id, id));
  return row ?? null;
}

export async function getVslCallPrepsBySetter(setterId: number): Promise<VslCallPrep[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(vslCallPreps)
    .where(eq(vslCallPreps.setterId, setterId))
    .orderBy(desc(vslCallPreps.createdAt));
}

export async function getVslCallPrepsByCloser(closerId: number): Promise<VslCallPrep[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(vslCallPreps)
    .where(eq(vslCallPreps.closerId, closerId))
    .orderBy(desc(vslCallPreps.createdAt));
}

export async function getAllVslCallPreps(): Promise<VslCallPrep[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(vslCallPreps)
    .orderBy(desc(vslCallPreps.createdAt));
}

export async function updateVslCallPrep(
  id: number,
  patch: Partial<InsertVslCallPrep>,
): Promise<VslCallPrep | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(vslCallPreps).set(patch).where(eq(vslCallPreps.id, id));
  return getVslCallPrepById(id);
}

export async function deleteVslCallPrep(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.delete(vslCallPreps).where(eq(vslCallPreps.id, id));
  return (result.rowCount ?? 0) > 0;
}

// ==================== DEAL ONBOARDING ====================
//
// One row per deal, lazy-created on first edit. The 90-day extension clock
// (Phase 3) anchors to `onboardedAt` — once Ariana clicks "Mark fully
// onboarded," the program timer starts.

/** Fetch the onboarding row for a deal, or null if Ariana hasn't started it. */
export async function getDealOnboarding(dealId: number): Promise<DealOnboarding | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.select().from(dealOnboardings).where(eq(dealOnboardings.dealId, dealId));
  return row ?? null;
}

/**
 * Upsert a partial patch into the onboarding row for a deal. Lazy-creates the
 * row on first call so callers don't need to seed it. Returns the full row.
 */
export async function upsertDealOnboarding(
  dealId: number,
  patch: Partial<Omit<InsertDealOnboarding, "id" | "dealId" | "createdAt" | "updatedAt">>
): Promise<DealOnboarding> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getDealOnboarding(dealId);
  if (!existing) {
    const [row] = await db.insert(dealOnboardings)
      .values({ dealId, ...patch })
      .returning();
    return row;
  }

  await db.update(dealOnboardings)
    .set(patch)
    .where(eq(dealOnboardings.id, existing.id));
  const refreshed = await getDealOnboarding(dealId);
  if (!refreshed) throw new Error("Onboarding row vanished after update");
  return refreshed;
}

/**
 * Mark a deal's onboarding complete. Stamps onboardedAt + onboardedById.
 * Returns the updated row. If onboarding hasn't been touched yet, this
 * lazy-creates it so the timestamp still lands cleanly.
 */
export async function markDealOnboardingComplete(
  dealId: number,
  userId: number
): Promise<DealOnboarding> {
  return upsertDealOnboarding(dealId, {
    onboardedAt: new Date(),
    onboardedById: userId,
  });
}

/**
 * Reopen onboarding (un-stamp completion). Useful if Ariana marked complete
 * by accident or the client paused. Doesn't touch the individual checkboxes.
 */
export async function reopenDealOnboarding(dealId: number): Promise<DealOnboarding | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getDealOnboarding(dealId);
  if (!existing) return null;
  await db.update(dealOnboardings)
    .set({ onboardedAt: null, onboardedById: null })
    .where(eq(dealOnboardings.id, existing.id));
  return getDealOnboarding(dealId);
}

/**
 * Onboarding queue row — what Ariana sees in her list. We join deals (for
 * client name + closer + DocuSign date) with the onboarding row (which may
 * not exist yet for fresh DocuSign-signed deals).
 */
export type OnboardingQueueRow = {
  dealId: number;
  clientName: string;
  dealDate: string;
  totalDealAmount: number;
  closerId: number;
  closerName: string | null;
  setterId: number | null;
  docusignSigned: boolean;
  // onboarding fields (null if no row yet)
  onboardingId: number | null;
  skoolAccessGranted: boolean;
  paymentVerified: boolean;
  introCallBooked: boolean;
  coachAssignedPayeeId: number | null;
  tradingLogAssigned: boolean;
  weeklyCheckInSent: boolean;
  onboardedAt: Date | null;
  // computed: how many of the 6 checklist items are done
  itemsDone: number;
  itemsTotal: number;
};

const ONBOARDING_TOTAL_ITEMS = 6; // DocuSign + Skool + Payment + Sessions + TradingLog + CheckIn

/** Compute how many checklist items are green. */
function computeItemsDone(deal: { docusignSigned: boolean }, ob: DealOnboarding | null): number {
  let done = 0;
  if (deal.docusignSigned) done++;                                  // 1. DocuSign
  if (ob?.skoolAccessGranted) done++;                               // 2. Skool
  if (ob?.paymentVerified) done++;                                  // 3. Payment
  if (ob?.introCallBooked) done++;                                  // 4. Intro call booked
  if (ob?.tradingLogAssigned) done++;                               // 5. Trading log
  if (ob?.weeklyCheckInSent) done++;                                // 6. Weekly check-in
  return done;
}

/**
 * The "pending" queue: every deal that's been DocuSigned but not yet fully
 * onboarded. Sorted oldest-first so nothing rots at the back.
 */
export async function getPendingOnboardings(): Promise<OnboardingQueueRow[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Pull all DocuSign-signed deals + their onboarding row (LEFT JOIN since
  // the onboarding row may not exist yet).
  const rows = await db.select({
    dealId: deals.id,
    clientName: deals.clientName,
    dealDate: deals.dealDate,
    totalDealAmount: deals.totalDealAmount,
    closerId: deals.closerId,
    closerName: teamMembers.name,
    setterId: deals.setterId,
    docusignSigned: deals.docusignSigned,
    ob: dealOnboardings,
  })
    .from(deals)
    .leftJoin(teamMembers, eq(teamMembers.id, deals.closerId))
    .leftJoin(dealOnboardings, eq(dealOnboardings.dealId, deals.id))
    .where(and(eq(deals.docusignSigned, true), eq(deals.closed, true)));

  return rows
    .filter(r => !r.ob?.onboardedAt)  // pending = not yet completed
    .map(r => {
      const ob = r.ob;
      return {
        dealId: r.dealId,
        clientName: r.clientName,
        dealDate: r.dealDate,
        totalDealAmount: parseFloat(r.totalDealAmount || "0"),
        closerId: r.closerId,
        closerName: r.closerName ?? null,
        setterId: r.setterId,
        docusignSigned: r.docusignSigned,
        onboardingId: ob?.id ?? null,
        skoolAccessGranted: ob?.skoolAccessGranted ?? false,
        paymentVerified: ob?.paymentVerified ?? false,
        introCallBooked: ob?.introCallBooked ?? false,
        coachAssignedPayeeId: ob?.coachAssignedPayeeId ?? null,
        tradingLogAssigned: ob?.tradingLogAssigned ?? false,
        weeklyCheckInSent: ob?.weeklyCheckInSent ?? false,
        onboardedAt: ob?.onboardedAt ?? null,
        itemsDone: computeItemsDone(r, ob ?? null),
        itemsTotal: ONBOARDING_TOTAL_ITEMS,
      };
    })
    .sort((a, b) => a.dealDate.localeCompare(b.dealDate));  // oldest first
}

// ==================== UNIFIED CLIENT PROFILE ====================
//
// One fetch returns everything the /clients/:dealId page needs:
//   - the deal itself (with closer + setter team rows resolved)
//   - the onboarding row (may be null if Ariana hasn't started)
//   - the assigned coach (payee row, if any)
//   - all coaching sessions matched by clientName
//   - payment plan progress (if applicable)
//   - active coach options for Ariana's "assign coach" dropdown
//
// Any expensive sub-query is acceptable here — this page is read once per
// client view, not in a tight loop.

export type ClientProfile = {
  deal: Deal;
  closer: TeamMember | null;
  setter: TeamMember | null;
  onboarding: DealOnboarding | null;
  assignedCoach: Payee | null;
  coachOptions: Array<{ id: number; name: string }>;
  coachingSessions: CoachingSession[];
  paymentPlanProgress: {
    totalMonths: number;
    paymentsCompleted: number;
    paymentsRemaining: number;
    totalCollected: number;
    totalRemaining: number;
    isFullyPaid: boolean;
  } | null;
  // The login (if any) Ariana created for this client. Null until she clicks
  // "Create Login" on the Client Profile.
  clientUser: {
    id: number;
    email: string;
    name: string | null;
    lastSignedIn: Date | null;
  } | null;
};

export async function getClientProfile(dealId: number): Promise<ClientProfile | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const deal = await getDealById(dealId);
  if (!deal) return null;

  // Resolve team rows in parallel
  const [closer, setter, onboarding] = await Promise.all([
    db.select().from(teamMembers).where(eq(teamMembers.id, deal.closerId)).then(rows => rows[0] ?? null),
    deal.setterId
      ? db.select().from(teamMembers).where(eq(teamMembers.id, deal.setterId)).then(rows => rows[0] ?? null)
      : Promise.resolve(null),
    getDealOnboarding(dealId),
  ]);

  // Coach options: any active payee of type "coach" or "on_demand_coach"
  const coachPayees = await db.select().from(payees)
    .where(and(eq(payees.active, true), sql`${payees.type} IN ('coach', 'on_demand_coach')`));
  const coachOptions = coachPayees.map(p => ({ id: p.id, name: p.name }));

  // Resolve assigned coach if onboarding has one set
  const assignedCoach = onboarding?.coachAssignedPayeeId
    ? coachPayees.find(p => p.id === onboarding.coachAssignedPayeeId) ?? null
    : null;

  // Coaching sessions for this client — matched by clientName (no FK link
  // exists today; close enough until we normalize). Newest first.
  const coachingSessionsList = await db.select().from(coachingSessions)
    .where(eq(coachingSessions.clientName, deal.clientName))
    .orderBy(desc(coachingSessions.sessionDate), desc(coachingSessions.id));

  // Payment plan progress (if this is the parent of a plan, or a plan entry)
  let paymentPlanProgress: ClientProfile["paymentPlanProgress"] = null;
  if (deal.isPaymentPlan && !deal.parentDealId) {
    paymentPlanProgress = await getPaymentPlanProgress(deal.id);
  } else if (deal.parentDealId) {
    paymentPlanProgress = await getPaymentPlanProgress(deal.parentDealId);
  }

  // Linked client login (if Ariana has created one)
  const [clientRow] = await db.select({
    id: users.id,
    email: users.email,
    name: users.name,
    lastSignedIn: users.lastSignedIn,
  })
    .from(users)
    .where(and(eq(users.clientDealId, deal.id), eq(users.role, "client")));

  return {
    deal,
    closer,
    setter,
    onboarding,
    assignedCoach,
    coachOptions,
    coachingSessions: coachingSessionsList,
    paymentPlanProgress,
    clientUser: clientRow ?? null,
  };
}

/**
 * Recently onboarded — last 30 days. Read-only reference for Ariana so she
 * can find someone she just finished. Returns newest first.
 */
export async function getRecentlyOnboarded(): Promise<OnboardingQueueRow[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const rows = await db.select({
    dealId: deals.id,
    clientName: deals.clientName,
    dealDate: deals.dealDate,
    totalDealAmount: deals.totalDealAmount,
    closerId: deals.closerId,
    closerName: teamMembers.name,
    setterId: deals.setterId,
    docusignSigned: deals.docusignSigned,
    ob: dealOnboardings,
  })
    .from(dealOnboardings)
    .innerJoin(deals, eq(deals.id, dealOnboardings.dealId))
    .leftJoin(teamMembers, eq(teamMembers.id, deals.closerId))
    .where(sql`${dealOnboardings.onboardedAt} IS NOT NULL AND ${dealOnboardings.onboardedAt} > ${thirtyDaysAgo}`);

  return rows
    .map(r => {
      const ob = r.ob!;
      return {
        dealId: r.dealId,
        clientName: r.clientName,
        dealDate: r.dealDate,
        totalDealAmount: parseFloat(r.totalDealAmount || "0"),
        closerId: r.closerId,
        closerName: r.closerName ?? null,
        setterId: r.setterId,
        docusignSigned: r.docusignSigned,
        onboardingId: ob.id,
        skoolAccessGranted: ob.skoolAccessGranted,
        paymentVerified: ob.paymentVerified,
        introCallBooked: ob.introCallBooked,
        coachAssignedPayeeId: ob.coachAssignedPayeeId,
        tradingLogAssigned: ob.tradingLogAssigned,
        weeklyCheckInSent: ob.weeklyCheckInSent,
        onboardedAt: ob.onboardedAt,
        itemsDone: computeItemsDone(r, ob),
        itemsTotal: ONBOARDING_TOTAL_ITEMS,
      };
    })
    .sort((a, b) => (b.onboardedAt?.getTime() ?? 0) - (a.onboardedAt?.getTime() ?? 0));
}

// ==================== EXTENSION REMINDERS (90-day) ====================
//
// Anchor: dealOnboardings.onboardedAt. Each milestone fires once per
// (dealId, milestone, recipient). The cron is idempotent — running it 100
// times in a day produces at most one row per recipient per milestone.
//
// Time math: we use calendar-day offsets, not exact 24×N hours, so a deal
// onboarded at 11:30am on April 1 hits T-21 on the same wall-clock date in
// June regardless of DST.

export const PROGRAM_LENGTH_DAYS = 90;

// Day-offset (relative to onboardedAt) at which each milestone fires.
export const EXTENSION_MILESTONE_OFFSETS = {
  window_open:    PROGRAM_LENGTH_DAYS - 21,  // 69
  one_week_left:  PROGRAM_LENGTH_DAYS - 7,   // 83
  program_ends:   PROGRAM_LENGTH_DAYS,       // 90
  lapsed:         PROGRAM_LENGTH_DAYS + 7,   // 97
} as const;

export type ExtensionMilestone = keyof typeof EXTENSION_MILESTONE_OFFSETS;

export const EXTENSION_MILESTONES: ExtensionMilestone[] = [
  "window_open", "one_week_left", "program_ends", "lapsed",
];

/** Add `days` calendar days to a Date and return a fresh Date. */
function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

/** Calendar-day diff (today - then), positive when today is after. */
export function daysSince(then: Date, now: Date = new Date()): number {
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const b = new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime();
  return Math.round((a - b) / (1000 * 60 * 60 * 24));
}

/**
 * Compute the 90-day program timeline for a deal:
 *   - daysSinceOnboarded: how many days have elapsed since the clock started
 *   - daysRemaining:      90 - daysSince (negative when program is over)
 *   - phase:              'pre_window' (T < -21), 'renewal_window' (T-21..T-7),
 *                         'final_week' (T-7..T-0), 'ended_grace' (T-0..T+7),
 *                         'lapsed' (T+7+)
 * Returns null if the deal hasn't been onboarded yet.
 */
export type ProgramTimeline = {
  onboardedAt: Date;
  programEndsAt: Date;
  daysSinceOnboarded: number;
  daysRemaining: number;
  phase: "pre_window" | "renewal_window" | "final_week" | "ended_grace" | "lapsed";
};

export function computeProgramTimeline(onboardedAt: Date | null): ProgramTimeline | null {
  if (!onboardedAt) return null;
  const programEndsAt = addDays(onboardedAt, PROGRAM_LENGTH_DAYS);
  const days = daysSince(onboardedAt);
  const remaining = PROGRAM_LENGTH_DAYS - days;
  let phase: ProgramTimeline["phase"];
  if (days < EXTENSION_MILESTONE_OFFSETS.window_open) phase = "pre_window";
  else if (days < EXTENSION_MILESTONE_OFFSETS.one_week_left) phase = "renewal_window";
  else if (days < EXTENSION_MILESTONE_OFFSETS.program_ends) phase = "final_week";
  else if (days < EXTENSION_MILESTONE_OFFSETS.lapsed) phase = "ended_grace";
  else phase = "lapsed";
  return { onboardedAt, programEndsAt, daysSinceOnboarded: days, daysRemaining: remaining, phase };
}

/** All extension alerts ever fired for a deal, newest first. */
export async function getExtensionAlertsForDeal(dealId: number): Promise<ExtensionAlert[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(extensionAlerts)
    .where(eq(extensionAlerts.dealId, dealId))
    .orderBy(desc(extensionAlerts.firedAt));
}

/**
 * Set the renewal pipeline status for a deal. Returns the updated row.
 * Lazy-creates the onboarding row if missing (defensive — should already
 * exist if there's a 90-day clock, but be safe).
 */
export async function setExtensionStatus(
  dealId: number,
  status: "window_open" | "outreach_started" | "call_booked" | "extended" | "lapsed",
  userId: number,
  notesPatch?: string,
): Promise<DealOnboarding> {
  const patch: Partial<InsertDealOnboarding> = {
    extensionStatus: status,
    extensionStatusAt: new Date(),
    extensionStatusBy: userId,
  };
  if (notesPatch !== undefined) patch.extensionNotes = notesPatch;
  return upsertDealOnboarding(dealId, patch);
}

/**
 * Recipients for a deal's extension alerts:
 *   - The closer (linked user, if any)
 *   - All payroll users (Ariana et al.)
 *   - All admin users (Vlad et al.)
 * Deduplicated by user id.
 */
async function getExtensionRecipients(dealId: number): Promise<Array<{
  userId: number; name: string; role: string;
}>> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const deal = await getDealById(dealId);
  if (!deal) return [];

  // Closer's linked user
  const closerLink = await db.select({ userId: userTeamLinks.userId })
    .from(userTeamLinks)
    .where(eq(userTeamLinks.teamMemberId, deal.closerId));
  const closerUserIds = closerLink.map(r => r.userId);

  // All payroll + admin users
  const staff = await db.select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(sql`${users.role} IN ('payroll', 'admin')`);

  const result = new Map<number, { userId: number; name: string; role: string }>();

  // Add closer
  if (closerUserIds.length > 0) {
    const closerUsers = await db.select({ id: users.id, name: users.name, role: users.role })
      .from(users)
      .where(inArray(users.id, closerUserIds));
    for (const u of closerUsers) {
      result.set(u.id, { userId: u.id, name: u.name ?? "Closer", role: u.role });
    }
  }

  // Add staff
  for (const u of staff) {
    if (!result.has(u.id)) {
      result.set(u.id, { userId: u.id, name: u.name ?? "Staff", role: u.role });
    }
  }

  return Array.from(result.values());
}

/**
 * Scan all onboarded deals; for each, check whether today's calendar date
 * has crossed any milestone. Fire one alert row per recipient per milestone
 * IF a row doesn't already exist (idempotent).
 *
 * Also auto-advances the renewal pipeline status:
 *   - On window_open milestone:  status null → 'window_open'
 *   - On lapsed milestone:       status in {window_open, outreach_started, call_booked} → 'lapsed'
 *
 * Returns a summary of what fired.
 */
export type ExtensionRunResult = {
  scannedDeals: number;
  newAlerts: number;
  byMilestone: Record<ExtensionMilestone, number>;
  fired: Array<{ dealId: number; clientName: string; milestone: ExtensionMilestone; recipients: number }>;
};

export async function runExtensionReminders(): Promise<ExtensionRunResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // All deals with completed onboarding (program clock running)
  const onboardedRows = await db.select({
    dealId: dealOnboardings.dealId,
    onboardedAt: dealOnboardings.onboardedAt,
    extensionStatus: dealOnboardings.extensionStatus,
  })
    .from(dealOnboardings)
    .where(sql`${dealOnboardings.onboardedAt} IS NOT NULL`);

  const result: ExtensionRunResult = {
    scannedDeals: onboardedRows.length,
    newAlerts: 0,
    byMilestone: { window_open: 0, one_week_left: 0, program_ends: 0, lapsed: 0 },
    fired: [],
  };

  for (const row of onboardedRows) {
    if (!row.onboardedAt) continue;
    const days = daysSince(row.onboardedAt);

    // Determine which (if any) milestones are due as of today. We fire ALL
    // milestones whose offset has been passed but which haven't been fired
    // yet — so a deal that's been ignored for two weeks doesn't skip its
    // window_open alert.
    const dueMilestones: ExtensionMilestone[] = EXTENSION_MILESTONES.filter(
      m => days >= EXTENSION_MILESTONE_OFFSETS[m]
    );
    if (dueMilestones.length === 0) continue;

    // Existing alerts for this deal — used to skip already-fired pairs.
    const existing = await db.select({
      milestone: extensionAlerts.milestone,
      recipientUserId: extensionAlerts.recipientUserId,
    })
      .from(extensionAlerts)
      .where(eq(extensionAlerts.dealId, row.dealId));
    const seen = new Set(existing.map(e => `${e.milestone}:${e.recipientUserId}`));

    const recipients = await getExtensionRecipients(row.dealId);
    if (recipients.length === 0) continue;

    const deal = await getDealById(row.dealId);
    if (!deal) continue;

    for (const milestone of dueMilestones) {
      const offset = EXTENSION_MILESTONE_OFFSETS[milestone];
      const newRows: InsertExtensionAlert[] = [];
      for (const r of recipients) {
        if (seen.has(`${milestone}:${r.userId}`)) continue;
        newRows.push({
          dealId: row.dealId,
          milestone,
          recipientUserId: r.userId,
          recipientName: r.name,
          recipientRole: r.role,
          dayOffset: offset,
        });
      }
      if (newRows.length === 0) continue;

      await db.insert(extensionAlerts).values(newRows);
      result.newAlerts += newRows.length;
      result.byMilestone[milestone] += newRows.length;
      result.fired.push({
        dealId: row.dealId,
        clientName: deal.clientName,
        milestone,
        recipients: newRows.length,
      });

      // Auto-advance pipeline status on certain milestones
      if (milestone === "window_open" && !row.extensionStatus) {
        await db.update(dealOnboardings)
          .set({ extensionStatus: "window_open", extensionStatusAt: new Date() })
          .where(eq(dealOnboardings.dealId, row.dealId));
      } else if (
        milestone === "lapsed" &&
        row.extensionStatus !== "extended" &&
        row.extensionStatus !== "lapsed"
      ) {
        await db.update(dealOnboardings)
          .set({ extensionStatus: "lapsed", extensionStatusAt: new Date() })
          .where(eq(dealOnboardings.dealId, row.dealId));
      }
    }
  }

  return result;
}

/**
 * "Coming up for 90 days" — what the closer dashboard surfaces. Returns
 * deals onboarded by this closer that are within 30 days of their program
 * ending OR up to 7 days past, sorted soonest-first.
 *
 * If `closerTeamMemberId` is null, returns nothing (we can't filter).
 */
export type ExtensionUpcomingRow = {
  dealId: number;
  clientName: string;
  onboardedAt: Date;
  daysSinceOnboarded: number;
  daysRemaining: number;
  phase: ProgramTimeline["phase"];
  extensionStatus: "window_open" | "outreach_started" | "call_booked" | "extended" | "lapsed" | null;
};

export async function getUpcomingExtensions(
  filter: { closerTeamMemberId?: number } = {}
): Promise<ExtensionUpcomingRow[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conds = [sql`${dealOnboardings.onboardedAt} IS NOT NULL`];
  if (filter.closerTeamMemberId !== undefined) {
    conds.push(eq(deals.closerId, filter.closerTeamMemberId));
  }

  const rows = await db.select({
    dealId: dealOnboardings.dealId,
    onboardedAt: dealOnboardings.onboardedAt,
    extensionStatus: dealOnboardings.extensionStatus,
    clientName: deals.clientName,
  })
    .from(dealOnboardings)
    .innerJoin(deals, eq(deals.id, dealOnboardings.dealId))
    .where(and(...conds));

  const out: ExtensionUpcomingRow[] = [];
  for (const r of rows) {
    if (!r.onboardedAt) continue;
    const t = computeProgramTimeline(r.onboardedAt);
    if (!t) continue;
    // Show window-open (T-21+) through grace (T+7). Already-extended clients
    // drop off automatically. Lapsed status hangs around for visibility.
    if (t.daysSinceOnboarded < EXTENSION_MILESTONE_OFFSETS.window_open) continue;
    if (r.extensionStatus === "extended") continue;
    out.push({
      dealId: r.dealId,
      clientName: r.clientName,
      onboardedAt: r.onboardedAt,
      daysSinceOnboarded: t.daysSinceOnboarded,
      daysRemaining: t.daysRemaining,
      phase: t.phase,
      extensionStatus: r.extensionStatus,
    });
  }
  // Soonest-ending first (smallest daysRemaining, then most-elapsed)
  out.sort((a, b) => a.daysRemaining - b.daysRemaining);
  return out;
}

// ==================== TRADING LOG ====================
//
// One log per client (lifetime). Mirrors the team's Google Sheet structure
// but consolidated — clients add a row for every trade and the UI filters by
// month/year. Ariana creates the log from the Client Profile; coaches view
// read-only; the client edits their own.

/**
 * Compute the derived P/L fields for a trade row from raw inputs. Mirrors
 * the Sheet formula 1:1 so existing client habits transfer cleanly:
 *   bidAskDifference = bidPrice - askPrice
 *   totalInvestment  = askPrice × 100 × contracts          (cost basis)
 *   profitLoss       = bidAskDifference × 100 × contracts   (signed)
 *   profitPct        = profitLoss / totalInvestment         (0.10 = 10%)
 *
 * The ×100 is the standard options multiplier (one contract = 100 shares).
 */
export function computeTradePL(input: {
  askPrice: number;
  bidPrice: number;
  contractCount: number;
}): {
  bidAskDifference: number;
  totalInvestment: number;
  profitLoss: number;
  profitPct: number;
} {
  const diff = input.bidPrice - input.askPrice;
  const totalInvestment = input.askPrice * 100 * input.contractCount;
  const profitLoss = diff * 100 * input.contractCount;
  const profitPct = totalInvestment === 0 ? 0 : profitLoss / totalInvestment;
  return {
    bidAskDifference: diff,
    totalInvestment,
    profitLoss,
    profitPct,
  };
}

/** Create the trading log for a client (called by Ariana from Client Profile). */
export async function createTradingLog(input: {
  clientUserId: number;
  dealId: number;
  startingBalance: number;
  brokerNote?: string | null;
  createdById: number;
}): Promise<TradingLog> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.insert(tradingLogs).values({
    clientUserId: input.clientUserId,
    dealId: input.dealId,
    startingBalance: input.startingBalance.toFixed(2),
    brokerNote: input.brokerNote ?? null,
    createdById: input.createdById,
  }).returning();
  return row;
}

export async function getTradingLogByClientUserId(clientUserId: number): Promise<TradingLog | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.select().from(tradingLogs)
    .where(eq(tradingLogs.clientUserId, clientUserId));
  return row ?? null;
}

export async function getTradingLogByDealId(dealId: number): Promise<TradingLog | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.select().from(tradingLogs)
    .where(eq(tradingLogs.dealId, dealId));
  return row ?? null;
}

export async function getTradingLogById(id: number): Promise<TradingLog | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.select().from(tradingLogs).where(eq(tradingLogs.id, id));
  return row ?? null;
}

/** Add a trade entry to a log. Computes P/L fields server-side. */
export async function addTradeEntry(input: {
  tradingLogId: number;
  ticker: string;
  strategy: "bounce_profit" | "ready_set_explode" | "paycheck_collector";
  direction: "directional_bullish" | "directional_bearish";
  result?: "win" | "loss" | null;
  entryDate: string;
  entryTime?: string | null;
  exitDate?: string | null;
  strikePrices?: string | null;
  expirationDate?: string | null;
  contractCount: number;
  askPrice: number;
  bidPrice: number;
  notes?: string | null;
}): Promise<TradeEntry> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const pl = computeTradePL({
    askPrice: input.askPrice,
    bidPrice: input.bidPrice,
    contractCount: input.contractCount,
  });
  const [row] = await db.insert(tradeEntries).values({
    tradingLogId: input.tradingLogId,
    ticker: input.ticker.toUpperCase().trim(),
    strategy: input.strategy,
    direction: input.direction,
    result: input.result ?? null,
    entryDate: input.entryDate,
    entryTime: input.entryTime ?? null,
    exitDate: input.exitDate ?? null,
    strikePrices: input.strikePrices ?? null,
    expirationDate: input.expirationDate ?? null,
    contractCount: input.contractCount,
    askPrice: input.askPrice.toFixed(4),
    bidPrice: input.bidPrice.toFixed(4),
    bidAskDifference: pl.bidAskDifference.toFixed(4),
    totalInvestment: pl.totalInvestment.toFixed(2),
    profitLoss: pl.profitLoss.toFixed(2),
    profitPct: pl.profitPct.toFixed(4),
    notes: input.notes ?? null,
  }).returning();
  return row;
}

/** Patch a trade entry. Recomputes P/L if any of the price/contract fields change. */
export async function updateTradeEntry(
  entryId: number,
  patch: Partial<{
    ticker: string;
    strategy: "bounce_profit" | "ready_set_explode" | "paycheck_collector";
    direction: "directional_bullish" | "directional_bearish";
    result: "win" | "loss" | null;
    entryDate: string;
    entryTime: string | null;
    exitDate: string | null;
    strikePrices: string | null;
    expirationDate: string | null;
    contractCount: number;
    askPrice: number;
    bidPrice: number;
    notes: string | null;
  }>
): Promise<TradeEntry | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [existing] = await db.select().from(tradeEntries).where(eq(tradeEntries.id, entryId));
  if (!existing) return null;

  // Stitch existing + patch for the P/L recompute
  const ask = patch.askPrice ?? parseFloat(existing.askPrice);
  const bid = patch.bidPrice ?? parseFloat(existing.bidPrice);
  const contracts = patch.contractCount ?? existing.contractCount;
  const pl = computeTradePL({ askPrice: ask, bidPrice: bid, contractCount: contracts });

  const updateData: Record<string, unknown> = {
    bidAskDifference: pl.bidAskDifference.toFixed(4),
    totalInvestment: pl.totalInvestment.toFixed(2),
    profitLoss: pl.profitLoss.toFixed(2),
    profitPct: pl.profitPct.toFixed(4),
  };

  if (patch.ticker !== undefined) updateData.ticker = patch.ticker.toUpperCase().trim();
  if (patch.strategy !== undefined) updateData.strategy = patch.strategy;
  if (patch.direction !== undefined) updateData.direction = patch.direction;
  if (patch.result !== undefined) updateData.result = patch.result;
  if (patch.entryDate !== undefined) updateData.entryDate = patch.entryDate;
  if (patch.entryTime !== undefined) updateData.entryTime = patch.entryTime;
  if (patch.exitDate !== undefined) updateData.exitDate = patch.exitDate;
  if (patch.strikePrices !== undefined) updateData.strikePrices = patch.strikePrices;
  if (patch.expirationDate !== undefined) updateData.expirationDate = patch.expirationDate;
  if (patch.contractCount !== undefined) updateData.contractCount = patch.contractCount;
  if (patch.askPrice !== undefined) updateData.askPrice = patch.askPrice.toFixed(4);
  if (patch.bidPrice !== undefined) updateData.bidPrice = patch.bidPrice.toFixed(4);
  if (patch.notes !== undefined) updateData.notes = patch.notes;

  await db.update(tradeEntries).set(updateData).where(eq(tradeEntries.id, entryId));
  const [refreshed] = await db.select().from(tradeEntries).where(eq(tradeEntries.id, entryId));
  return refreshed ?? null;
}

export async function deleteTradeEntry(entryId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.delete(tradeEntries).where(eq(tradeEntries.id, entryId));
  return (result.rowCount ?? 0) > 0;
}

/** Fetch a single trade entry by id (used for auth checks before mutating). */
export async function getTradeEntry(entryId: number): Promise<TradeEntry | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.select().from(tradeEntries).where(eq(tradeEntries.id, entryId));
  return row ?? null;
}

/** Update the log row itself (starting balance, broker note). Ariana / admin. */
export async function updateTradingLog(
  logId: number,
  patch: { startingBalance?: number; brokerNote?: string | null }
): Promise<TradingLog | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateData: Record<string, unknown> = {};
  if (patch.startingBalance !== undefined) updateData.startingBalance = patch.startingBalance.toFixed(2);
  if (patch.brokerNote !== undefined) updateData.brokerNote = patch.brokerNote;
  if (Object.keys(updateData).length > 0) {
    await db.update(tradingLogs).set(updateData).where(eq(tradingLogs.id, logId));
  }
  return getTradingLogById(logId);
}

/**
 * List all entries for a log, optionally filtered to a single month. Newest
 * first (entryDate desc, then id desc as tiebreaker).
 */
export async function getTradeEntriesForLog(
  tradingLogId: number,
  filter?: { year?: number; month?: number }
): Promise<TradeEntry[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conds = [eq(tradeEntries.tradingLogId, tradingLogId)];
  if (filter?.year !== undefined && filter?.month !== undefined) {
    const start = `${filter.year}-${String(filter.month).padStart(2, "0")}-01`;
    // First day of next month
    const nextYear = filter.month === 12 ? filter.year + 1 : filter.year;
    const nextMonth = filter.month === 12 ? 1 : filter.month + 1;
    const end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
    conds.push(sql`${tradeEntries.entryDate} >= ${start}`);
    conds.push(sql`${tradeEntries.entryDate} < ${end}`);
  }
  return db.select().from(tradeEntries)
    .where(and(...conds))
    .orderBy(desc(tradeEntries.entryDate), desc(tradeEntries.id));
}

/**
 * Headline stats for a trading log. Computed on the fly from the entries
 * table — keeps the log row free of denormalized values that drift.
 *
 * Includes per-strategy breakdown so the dashboard can show which strategies
 * are winning. Total P/L, win rate, current account balance, ROI.
 */
export type TradingLogStats = {
  totalTrades: number;
  closedTrades: number;     // result is set (win/loss)
  wins: number;
  losses: number;
  winRatePct: number;       // 0..100
  totalProfitLoss: number;
  startingBalance: number;
  currentBalance: number;
  totalROI: number;         // ratio: 0.10 = 10%
  byStrategy: Array<{
    strategy: "bounce_profit" | "ready_set_explode" | "paycheck_collector";
    trades: number;
    wins: number;
    losses: number;
    winRatePct: number;
    totalProfitLoss: number;
  }>;
};

export async function getTradingLogStats(tradingLogId: number): Promise<TradingLogStats> {
  const log = await getTradingLogById(tradingLogId);
  if (!log) {
    return {
      totalTrades: 0, closedTrades: 0, wins: 0, losses: 0, winRatePct: 0,
      totalProfitLoss: 0, startingBalance: 0, currentBalance: 0, totalROI: 0,
      byStrategy: [],
    };
  }
  const entries = await getTradeEntriesForLog(tradingLogId);
  const startingBalance = parseFloat(log.startingBalance);

  let wins = 0, losses = 0, totalPL = 0;
  const byStrat = new Map<string, { trades: number; wins: number; losses: number; pl: number }>();
  for (const e of entries) {
    const pl = parseFloat(e.profitLoss);
    totalPL += pl;
    if (e.result === "win") wins++;
    else if (e.result === "loss") losses++;

    const k = e.strategy;
    const prev = byStrat.get(k) ?? { trades: 0, wins: 0, losses: 0, pl: 0 };
    prev.trades++;
    prev.pl += pl;
    if (e.result === "win") prev.wins++;
    else if (e.result === "loss") prev.losses++;
    byStrat.set(k, prev);
  }
  const closed = wins + losses;
  return {
    totalTrades: entries.length,
    closedTrades: closed,
    wins,
    losses,
    winRatePct: closed === 0 ? 0 : (wins / closed) * 100,
    totalProfitLoss: totalPL,
    startingBalance,
    currentBalance: startingBalance + totalPL,
    totalROI: startingBalance === 0 ? 0 : totalPL / startingBalance,
    byStrategy: Array.from(byStrat.entries()).map(([strategy, v]) => ({
      strategy: strategy as "bounce_profit" | "ready_set_explode" | "paycheck_collector",
      trades: v.trades,
      wins: v.wins,
      losses: v.losses,
      winRatePct: (v.wins + v.losses) === 0 ? 0 : (v.wins / (v.wins + v.losses)) * 100,
      totalProfitLoss: v.pl,
    })),
  };
}

/** All trading logs whose deals have a coachAssignedPayeeId matching the given coach. */
export async function getTradingLogsForCoach(coachPayeeId: number): Promise<Array<{
  log: TradingLog;
  clientName: string;
  clientUserName: string | null;
  stats: TradingLogStats;
}>> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db.select({
    log: tradingLogs,
    clientName: deals.clientName,
    clientUserName: users.name,
  })
    .from(tradingLogs)
    .innerJoin(deals, eq(deals.id, tradingLogs.dealId))
    .innerJoin(dealOnboardings, eq(dealOnboardings.dealId, tradingLogs.dealId))
    .leftJoin(users, eq(users.id, tradingLogs.clientUserId))
    .where(eq(dealOnboardings.coachAssignedPayeeId, coachPayeeId));

  const out = [];
  for (const r of rows) {
    out.push({
      log: r.log,
      clientName: r.clientName,
      clientUserName: r.clientUserName,
      stats: await getTradingLogStats(r.log.id),
    });
  }
  return out;
}

// ==================== CLIENT DIRECTORY ====================
//
// Lightweight summary of every client in the system, for the /clients
// directory page. One row per deal (NOT per client name — a client with two
// deals appears twice, which is correct: each deal is a distinct program).

export type ClientDirectoryRow = {
  dealId: number;
  clientName: string;
  dealDate: string;
  totalDealAmount: number;
  closerName: string | null;
  setterName: string | null;
  docusignSigned: boolean;
  onboardedAt: Date | null;
  coachAssignedPayeeId: number | null;
  coachName: string | null;
  hasTradingLog: boolean;
  tradeCount: number;
  hasClientLogin: boolean;
  lastSignedIn: Date | null;
};

export async function getClientDirectory(): Promise<ClientDirectoryRow[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db.execute<{
    dealId: number;
    clientName: string;
    dealDate: string;
    totalDealAmount: string | null;
    closerName: string | null;
    setterName: string | null;
    docusignSigned: boolean;
    onboardedAt: Date | null;
    coachAssignedPayeeId: number | null;
    coachName: string | null;
    hasTradingLog: boolean;
    tradeCount: number;
    hasClientLogin: boolean;
    lastSignedIn: Date | null;
  }>(sql`
    SELECT
      d.id                          AS "dealId",
      d."clientName"                AS "clientName",
      d."dealDate"::text            AS "dealDate",
      d."totalDealAmount"           AS "totalDealAmount",
      closer.name                   AS "closerName",
      setter.name                   AS "setterName",
      d."docusignSigned"            AS "docusignSigned",
      ob."onboardedAt"              AS "onboardedAt",
      ob."coachAssignedPayeeId"     AS "coachAssignedPayeeId",
      coach.name                    AS "coachName",
      (tl.id IS NOT NULL)           AS "hasTradingLog",
      COALESCE(te_count.cnt, 0)::int AS "tradeCount",
      (cu.id IS NOT NULL)           AS "hasClientLogin",
      cu."lastSignedIn"             AS "lastSignedIn"
    FROM deals d
    LEFT JOIN "teamMembers" closer ON closer.id = d."closerId"
    LEFT JOIN "teamMembers" setter ON setter.id = d."setterId"
    LEFT JOIN "dealOnboardings" ob ON ob."dealId" = d.id
    LEFT JOIN payees coach          ON coach.id = ob."coachAssignedPayeeId"
    LEFT JOIN "tradingLogs" tl      ON tl."dealId" = d.id
    LEFT JOIN (
      SELECT "tradingLogId", COUNT(*)::int AS cnt FROM "tradeEntries" GROUP BY "tradingLogId"
    ) te_count ON te_count."tradingLogId" = tl.id
    LEFT JOIN users cu ON cu."clientDealId" = d.id AND cu.role = 'client'
    WHERE d."closed" = true
      AND (d."parentDealId" IS NULL)  -- exclude payment-plan child rows
    ORDER BY d."dealDate" DESC, d.id DESC
  `);

  // drizzle-orm/node-postgres returns either an array OR an object with .rows.
  // Normalize to the array shape so the rest of the app doesn't care.
  const rowsArr = Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows ?? [];
  return (rowsArr as ClientDirectoryRow[]).map(r => ({
    dealId: r.dealId,
    clientName: r.clientName,
    dealDate: r.dealDate,
    totalDealAmount: parseFloat((r.totalDealAmount as unknown as string) ?? "0") || 0,
    closerName: r.closerName,
    setterName: r.setterName,
    docusignSigned: r.docusignSigned,
    onboardedAt: r.onboardedAt,
    coachAssignedPayeeId: r.coachAssignedPayeeId,
    coachName: r.coachName,
    hasTradingLog: r.hasTradingLog,
    tradeCount: r.tradeCount,
    hasClientLogin: r.hasClientLogin,
    lastSignedIn: r.lastSignedIn,
  }));
}

// ==================== MAGIC-LINK LOGIN TOKENS ====================

const MAGIC_LINK_TTL_MS = 30 * 60 * 1000; // 30 minutes

/** Create a new magic-link token row for a user. Returns the raw token. */
export async function createLoginToken(input: {
  userId: number;
  reason?: string;
  triggeredByUserId?: number | null;
  ttlMs?: number;
}): Promise<{ token: string; expiresAt: Date }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + (input.ttlMs ?? MAGIC_LINK_TTL_MS));
  await db.insert(loginTokens).values({
    token,
    userId: input.userId,
    expiresAt,
    reason: input.reason ?? "login_request",
    triggeredByUserId: input.triggeredByUserId ?? null,
  });
  return { token, expiresAt };
}

/**
 * Look up a token, verify it's still usable, and mark it consumed. Returns
 * the user record on success or null on any failure (expired / used /
 * unknown token / user gone).
 */
export async function consumeLoginToken(
  token: string,
): Promise<NonNullable<Awaited<ReturnType<typeof getUserById>>> | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.select().from(loginTokens).where(eq(loginTokens.token, token));
  if (!row) return null;
  if (row.usedAt) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;

  // Mark consumed first so a concurrent click doesn't double-issue.
  await db.update(loginTokens)
    .set({ usedAt: new Date() })
    .where(eq(loginTokens.id, row.id));

  const user = await getUserById(row.userId);
  return user ?? null;
}
