import { eq, and, desc, sql, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
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
  subscriptions, InsertSubscription, Subscription,
  subscriptionVerifications, InsertSubscriptionVerification, SubscriptionVerification,
  bookedCalls, InsertBookedCall, BookedCall,
  dailyStats, InsertDailyStat, DailyStat
} from "../drizzle/schema";

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
  role?: "closer" | "payroll" | "admin" | "coach" | "setter";
  permissions?: string[];
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
    openId: `email-${Date.now()}-${Math.random().toString(36).substring(7)}`, // Generate unique openId for compatibility
  }).returning({ insertId: users.id });

  return getUserById(insertId);
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
  };
  
  for (const deal of deals) {
    const dealAmount = parseFloat(deal.totalDealAmount || "0");
    const newCash = parseFloat(deal.newCashCollected || "0");
    const existingCash = parseFloat(deal.existingCashCollected || "0");
    const closerComm = parseFloat(deal.closerCommission || "0");
    
    stats.totalRevenue += dealAmount;
    stats.newCashCollected += newCash;
    stats.existingCashCollected += existingCash;
    stats.totalCashCollected += newCash + existingCash;
    stats.closerCommission += closerComm;
    stats.dealCount++;
    
    if (deal.showed) stats.showedCount++;
    if (deal.prepared) stats.preparedCount++;
    if (deal.closed) stats.closedCount++;
  }

  // Add subscription commissions
  const subCommissions = await getSubscriptionCommissionsByCloser(closerId, year, month);
  stats.closerCommission += subCommissions.totalCommission;
  
  return {
    ...stats,
    subscriptionCommission: subCommissions.totalCommission,
    subscriptionVerifiedCount: subCommissions.verifiedCount,
    totalDeals: stats.dealCount,
  };
}

// getSetterStats removed - setters no longer tracked

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
  
  return stats;
}

export async function getAvailableMonths() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // EXTRACT(... FROM date) is the SQL-standard equivalent of MySQL's YEAR()/MONTH().
  const result = await db.select({
    year: sql<number>`EXTRACT(YEAR FROM ${deals.dealDate})::int`,
    month: sql<number>`EXTRACT(MONTH FROM ${deals.dealDate})::int`,
  })
  .from(deals)
  .groupBy(
    sql`EXTRACT(YEAR FROM ${deals.dealDate})`,
    sql`EXTRACT(MONTH FROM ${deals.dealDate})`,
  )
  .orderBy(
    desc(sql`EXTRACT(YEAR FROM ${deals.dealDate})`),
    desc(sql`EXTRACT(MONTH FROM ${deals.dealDate})`),
  );
  
  return result;
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
      // Plus subscription commissions (verified rows for this closer this month)
      const verifiedSubs = await db.select({
        commissionAmount: subscriptionVerifications.commissionAmount,
      })
        .from(subscriptionVerifications)
        .innerJoin(subscriptions, eq(subscriptions.id, subscriptionVerifications.subscriptionId))
        .where(and(
          eq(subscriptions.closerId, member.id),
          eq(subscriptionVerifications.month, month),
          eq(subscriptionVerifications.year, year),
          eq(subscriptionVerifications.isVerified, true),
        ));
      for (const v of verifiedSubs) {
        totalOwed += parseFloat(v.commissionAmount?.toString() || "0");
      }
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

      // Get subscription commissions for this closer
      const subCommissions = await getSubscriptionCommissionsByCloser(closer.id, year, month);
      const subscriptionIncome = subCommissions.totalCommission;

      return {
        id: closer.id,
        name: closer.name,
        role: "closer" as const,
        closedCount,
        totalRevenue,
        totalCashCollected,
        commission: closerCommission + subscriptionIncome,
        subscriptionIncome,
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


// ==================== SUBSCRIPTION QUERIES ====================

const SUBSCRIPTION_COMMISSION_RATE = 0.25; // 25% of monthly amount

export async function createSubscription(sub: InsertSubscription): Promise<Subscription> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [newSub] = await db.insert(subscriptions).values(sub).returning();
  return newSub;
}

export async function getActiveSubscriptions(): Promise<Subscription[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(subscriptions)
    .where(eq(subscriptions.active, true))
    .orderBy(subscriptions.clientName);
}

export async function getAllSubscriptions(): Promise<Subscription[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(subscriptions)
    .orderBy(desc(subscriptions.active), subscriptions.clientName);
}

export async function getSubscriptionsByCloser(closerId: number): Promise<Subscription[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(subscriptions)
    .where(eq(subscriptions.closerId, closerId))
    .orderBy(desc(subscriptions.active), subscriptions.clientName);
}

export async function cancelSubscription(id: number, reason?: string): Promise<Subscription | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  
  await db.update(subscriptions).set({
    active: false,
    cancelledDate: dateStr,
    cancelledReason: reason || null,
  }).where(eq(subscriptions.id, id));

  const [updated] = await db.select().from(subscriptions).where(eq(subscriptions.id, id));
  return updated || null;
}

export async function reactivateSubscription(id: number): Promise<Subscription | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(subscriptions).set({
    active: true,
    cancelledDate: null,
    cancelledReason: null,
  }).where(eq(subscriptions.id, id));

  const [updated] = await db.select().from(subscriptions).where(eq(subscriptions.id, id));
  return updated || null;
}

// ==================== SUBSCRIPTION VERIFICATION QUERIES ====================

/**
 * Generate verification entries for all active subscriptions for a given month.
 * Only creates entries that don't already exist.
 */
export async function generateMonthlyVerifications(year: number, month: number): Promise<SubscriptionVerification[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const activeSubs = await getActiveSubscriptions();
  
  // Check which verifications already exist
  const existing = await db.select().from(subscriptionVerifications)
    .where(and(
      eq(subscriptionVerifications.year, year),
      eq(subscriptionVerifications.month, month)
    ));

  const existingSubIds = new Set(existing.map(v => v.subscriptionId));
  
  // Create verifications for subs that don't have one yet
  const newVerifications: InsertSubscriptionVerification[] = [];
  for (const sub of activeSubs) {
    // Only generate if subscription started on or before this month
    const subStartDate = sub.startYear * 12 + sub.startMonth;
    const checkDate = year * 12 + month;
    if (checkDate < subStartDate) continue;
    
    if (!existingSubIds.has(sub.id)) {
      const commissionAmount = parseFloat(sub.monthlyAmount?.toString() || "0") * SUBSCRIPTION_COMMISSION_RATE;
      newVerifications.push({
        subscriptionId: sub.id,
        month,
        year,
        isVerified: false,
        isCancelled: false,
        commissionAmount: commissionAmount.toFixed(2),
      });
    }
  }

  if (newVerifications.length > 0) {
    await db.insert(subscriptionVerifications).values(newVerifications);
  }

  // Return all verifications for the month
  return db.select().from(subscriptionVerifications)
    .where(and(
      eq(subscriptionVerifications.year, year),
      eq(subscriptionVerifications.month, month)
    ))
    .orderBy(subscriptionVerifications.subscriptionId);
}

export async function getVerificationsByMonth(year: number, month: number): Promise<SubscriptionVerification[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(subscriptionVerifications)
    .where(and(
      eq(subscriptionVerifications.year, year),
      eq(subscriptionVerifications.month, month)
    ))
    .orderBy(subscriptionVerifications.subscriptionId);
}

export async function verifySubscription(verificationId: number, userId: number): Promise<SubscriptionVerification | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(subscriptionVerifications).set({
    isVerified: true,
    isCancelled: false,
    verifiedBy: userId,
    verifiedAt: new Date(),
  }).where(eq(subscriptionVerifications.id, verificationId));

  const [updated] = await db.select().from(subscriptionVerifications).where(eq(subscriptionVerifications.id, verificationId));
  return updated || null;
}

export async function unverifySubscription(verificationId: number): Promise<SubscriptionVerification | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(subscriptionVerifications).set({
    isVerified: false,
    verifiedBy: null,
    verifiedAt: null,
  }).where(eq(subscriptionVerifications.id, verificationId));

  const [updated] = await db.select().from(subscriptionVerifications).where(eq(subscriptionVerifications.id, verificationId));
  return updated || null;
}

export async function markSubscriptionCancelled(verificationId: number, userId: number): Promise<{ verification: SubscriptionVerification | null; subscription: Subscription | null }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Mark verification as cancelled
  await db.update(subscriptionVerifications).set({
    isCancelled: true,
    isVerified: false,
    verifiedBy: userId,
    verifiedAt: new Date(),
    commissionAmount: "0",
  }).where(eq(subscriptionVerifications.id, verificationId));

  const [verification] = await db.select().from(subscriptionVerifications).where(eq(subscriptionVerifications.id, verificationId));
  
  // Deactivate the subscription itself
  let subscription: Subscription | null = null;
  if (verification) {
    subscription = await cancelSubscription(verification.subscriptionId, "Subscriber no longer in group");
    
    // Notify the closer
    if (subscription) {
      const closer = await getTeamMemberById(subscription.closerId);
      if (closer) {
        await db.insert(notifications).values({
          recipientMemberId: subscription.closerId,
          type: "deduction_added",
          title: "Subscription Cancelled",
          message: `${subscription.clientName}'s subscription ($${subscription.monthlyAmount}/mo) has been cancelled. They are no longer in the group.`,
          amount: "0",
        });
      }
    }
  }

  return { verification, subscription };
}

/**
 * Get subscription commission totals for a closer in a given month
 */
export async function getSubscriptionCommissionsByCloser(closerId: number, year: number, month: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get all subscriptions for this closer
  const closerSubs = await getSubscriptionsByCloser(closerId);
  const subIds = closerSubs.map(s => s.id);
  
  if (subIds.length === 0) return { totalCommission: 0, verifiedCount: 0, pendingCount: 0, cancelledCount: 0, subscriptions: [] };

  // Get verifications for the month
  const allVerifications = await getVerificationsByMonth(year, month);
  const closerVerifications = allVerifications.filter(v => subIds.includes(v.subscriptionId));

  let totalCommission = 0;
  let verifiedCount = 0;
  let pendingCount = 0;
  let cancelledCount = 0;

  const subscriptionDetails = closerVerifications.map(v => {
    const sub = closerSubs.find(s => s.id === v.subscriptionId);
    const commission = v.isVerified ? parseFloat(v.commissionAmount?.toString() || "0") : 0;
    if (v.isVerified) {
      totalCommission += commission;
      verifiedCount++;
    } else if (v.isCancelled) {
      cancelledCount++;
    } else {
      pendingCount++;
    }
    return {
      subscriptionId: v.subscriptionId,
      clientName: sub?.clientName || "Unknown",
      monthlyAmount: parseFloat(sub?.monthlyAmount?.toString() || "0"),
      commission,
      isVerified: v.isVerified,
      isCancelled: v.isCancelled,
    };
  });

  return {
    totalCommission,
    verifiedCount,
    pendingCount,
    cancelledCount,
    subscriptions: subscriptionDetails,
  };
}

/**
 * Get random subscriptions for integrity audit
 */
export async function getRandomSubscriptionsForAudit(count: number = 5): Promise<Subscription[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const activeSubs = await getActiveSubscriptions();

  // Shuffle and take `count`
  const shuffled = activeSubs.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

// ==================== BOOKED CALLS QUERIES ====================
//
// Setter payouts deliberately use min(cashCollected, $6,000) — the team
// agreed setters never see deal economics above $6K, both for display and
// for commission calc. Don't bypass this cap without explicit approval.

export const SETTER_CAP = 6000;
export const SETTER_RATE = 0.03;

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
 * Setter payouts for a given month: 3% of capped cash collected on closed
 * deals where deals.setterId matches.
 *
 * Returns the per-deal capped view (what the setter actually sees) plus the
 * monthly total commission. Deal client names and total deal amounts are
 * NOT returned — setters only see capped cash + their own commission.
 */
export type SetterPayoutLine = {
  dealId: number;
  dealDate: string;
  cappedCashCollected: number;  // min(actualCash, SETTER_CAP)
  commission: number;            // cappedCashCollected * SETTER_RATE
};

export async function getSetterPayouts(
  setterId: number,
  year: number,
  month: number
): Promise<{ lines: SetterPayoutLine[]; totalCommission: number }> {
  const dealsForMonth = await getDealsBySetter(setterId, year, month);

  const lines: SetterPayoutLine[] = dealsForMonth
    .filter(d => d.closed)
    .map(d => {
      const cash =
        parseFloat(d.newCashCollected || "0") +
        parseFloat(d.existingCashCollected || "0");
      const cappedCash = Math.min(cash, SETTER_CAP);
      return {
        dealId: d.id,
        dealDate: d.dealDate,
        cappedCashCollected: cappedCash,
        commission: cappedCash * SETTER_RATE,
      };
    });

  const totalCommission = lines.reduce((sum, l) => sum + l.commission, 0);
  return { lines, totalCommission };
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
