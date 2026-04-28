import {
  boolean,
  decimal,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
  date,
} from "drizzle-orm/pg-core";

// Enum types (must be top-level in Postgres).
export const userRoleEnum = pgEnum("user_role", ["closer", "payroll", "admin", "coach", "setter"]);
export const teamMemberRoleEnum = pgEnum("team_member_role", ["closer", "setter", "payroll"]);
export const paymentTypeEnum = pgEnum("payment_type", ["full_pay", "in_house_payment_plan", "bnpl"]);
export const paymentStatusEnum = pgEnum("payment_status", ["active", "paid_early", "cancelled", "collected"]);
export const adjustmentTypeEnum = pgEnum("adjustment_type", ["bonus", "deduction"]);
export const notificationTypeEnum = pgEnum("notification_type", [
  "notes_updated",
  "payment_received",
  "bonus_added",
  "deduction_added",
]);
export const payeeTypeEnum = pgEnum("payee_type", [
  "coach",
  "on_demand_coach",
  "w2",
  "vendor",
  "closer",
  "setter",
]);
export const paymentFrequencyEnum = pgEnum("payment_frequency", ["biweekly", "monthly", "autopay"]);
export const tradingLogEnum = pgEnum("trading_log", ["yes", "no", "too_new"]);

// Drizzle helper that auto-bumps `updatedAt` on every UPDATE — Postgres has no
// equivalent of MySQL's ON UPDATE CURRENT_TIMESTAMP, so we do it in app land.
const onUpdateNow = () => new Date();

/**
 * Core user table backing auth flow.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }).default("email"),
  role: userRoleEnum("role").default("closer").notNull(),
  permissions: text("permissions"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(onUpdateNow),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Team members - closers, setters, and payroll admins
 */
export const teamMembers = pgTable("teamMembers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  role: teamMemberRoleEnum("role").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(onUpdateNow),
});

export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = typeof teamMembers.$inferInsert;

/**
 * Commission rates - time-based rates for team members.
 */
export const commissionRates = pgTable("commissionRates", {
  id: serial("id").primaryKey(),
  memberId: integer("memberId").notNull(),
  rate: decimal("rate", { precision: 5, scale: 4 }).notNull(),
  showRate: decimal("showRate", { precision: 8, scale: 2 }).default("0"),
  startMonth: integer("startMonth").notNull(),
  startYear: integer("startYear").notNull(),
  endMonth: integer("endMonth"),
  endYear: integer("endYear"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CommissionRate = typeof commissionRates.$inferSelect;
export type InsertCommissionRate = typeof commissionRates.$inferInsert;

/**
 * Deals table.
 */
export const deals = pgTable("deals", {
  id: serial("id").primaryKey(),
  clientName: varchar("clientName", { length: 255 }).notNull(),
  dealDate: date("dealDate", { mode: "string" }).notNull(),

  showed: boolean("showed").default(false).notNull(),
  prepared: boolean("prepared").default(false).notNull(),
  // The Trader Foundation sales funnel: a call may show, get an offer, take a
  // deposit, and then close — or be canceled by the client before the call
  // (distinct from "no-show" which means showed=false but they were booked).
  offered: boolean("offered").default(false).notNull(),
  canceled: boolean("canceled").default(false).notNull(),
  closed: boolean("closed").default(false).notNull(),
  isNewClient: boolean("isNewClient").default(true).notNull(),
  fullyPaid: boolean("fullyPaid").default(false).notNull(),

  totalDealAmount: decimal("totalDealAmount", { precision: 12, scale: 2 }).default("0"),
  newCashCollected: decimal("newCashCollected", { precision: 12, scale: 2 }).default("0"),
  existingCashCollected: decimal("existingCashCollected", { precision: 12, scale: 2 }).default("0"),

  closerId: integer("closerId").notNull(),
  setterId: integer("setterId"),

  paymentType: paymentTypeEnum("paymentType").default("full_pay"),
  paymentProcessor: varchar("paymentProcessor", { length: 100 }),
  paymentProcessorOther: varchar("paymentProcessorOther", { length: 255 }),
  bnplFee: decimal("bnplFee", { precision: 12, scale: 2 }).default("0"),

  isPaymentPlan: boolean("isPaymentPlan").default(false).notNull(),
  downPayment: decimal("downPayment", { precision: 12, scale: 2 }).default("0"),
  totalMonths: integer("totalMonths").default(0),
  monthlyAmount: decimal("monthlyAmount", { precision: 12, scale: 2 }).default("0"),
  paymentMonth: integer("paymentMonth").default(0),
  paymentsCompleted: integer("paymentsCompleted").default(0),
  parentDealId: integer("parentDealId"),
  paymentCollected: boolean("paymentCollected").default(false).notNull(),
  paymentStatus: paymentStatusEnum("paymentStatus").default("active"),

  notes: text("notes"),

  closerCommission: decimal("closerCommission", { precision: 12, scale: 2 }).default("0"),
  setterCashCommission: decimal("setterCashCommission", { precision: 12, scale: 2 }).default("0"),
  setterShowCommission: decimal("setterShowCommission", { precision: 12, scale: 2 }).default("0"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(onUpdateNow),
});

export type Deal = typeof deals.$inferSelect;
export type InsertDeal = typeof deals.$inferInsert;

/**
 * Pay periods - twice monthly pay periods.
 */
export const payPeriods = pgTable("payPeriods", {
  id: serial("id").primaryKey(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  periodNumber: integer("periodNumber").notNull(),
  startDate: date("startDate", { mode: "string" }).notNull(),
  endDate: date("endDate", { mode: "string" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PayPeriod = typeof payPeriods.$inferSelect;
export type InsertPayPeriod = typeof payPeriods.$inferInsert;

/**
 * Payroll entries.
 */
export const payrollEntries = pgTable("payrollEntries", {
  id: serial("id").primaryKey(),
  memberId: integer("memberId").notNull(),
  payPeriodId: integer("payPeriodId").notNull(),
  amountOwed: decimal("amountOwed", { precision: 12, scale: 2 }).notNull(),
  amountPaid: decimal("amountPaid", { precision: 12, scale: 2 }).default("0"),
  isPaid: boolean("isPaid").default(false).notNull(),
  paidDate: date("paidDate", { mode: "string" }),
  paidBy: integer("paidBy"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(onUpdateNow),
});

export type PayrollEntry = typeof payrollEntries.$inferSelect;
export type InsertPayrollEntry = typeof payrollEntries.$inferInsert;

/**
 * Legacy commission settings.
 */
export const commissionSettings = pgTable("commissionSettings", {
  id: serial("id").primaryKey(),
  commissionPercentage: decimal("commissionPercentage", { precision: 5, scale: 4 }).notNull(),
  showCommissionAmount: decimal("showCommissionAmount", { precision: 8, scale: 2 }).notNull(),
  effectiveFrom: timestamp("effectiveFrom").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedBy: integer("updatedBy"),
});

export type CommissionSetting = typeof commissionSettings.$inferSelect;
export type InsertCommissionSetting = typeof commissionSettings.$inferInsert;

/**
 * Legacy payouts table.
 */
export const payouts = pgTable("payouts", {
  id: serial("id").primaryKey(),
  payoutDate: date("payoutDate", { mode: "string" }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: integer("createdBy"),
});

export type Payout = typeof payouts.$inferSelect;
export type InsertPayout = typeof payouts.$inferInsert;

/**
 * Adjustments - bonuses/deductions.
 */
export const adjustments = pgTable("adjustments", {
  id: serial("id").primaryKey(),
  memberId: integer("memberId").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  type: adjustmentTypeEnum("type").notNull(),
  reason: text("reason").notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  createdBy: integer("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Adjustment = typeof adjustments.$inferSelect;
export type InsertAdjustment = typeof adjustments.$inferInsert;

/**
 * User-TeamMember link.
 */
export const userTeamLinks = pgTable("userTeamLinks", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  teamMemberId: integer("teamMemberId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserTeamLink = typeof userTeamLinks.$inferSelect;
export type InsertUserTeamLink = typeof userTeamLinks.$inferInsert;

/**
 * Notifications.
 */
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  recipientMemberId: integer("recipientMemberId").notNull(),
  type: notificationTypeEnum("type").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  relatedDealId: integer("relatedDealId"),
  relatedPayrollId: integer("relatedPayrollId"),
  relatedAdjustmentId: integer("relatedAdjustmentId"),
  amount: decimal("amount", { precision: 12, scale: 2 }),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

/**
 * Payees.
 */
export const payees = pgTable("payees", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: payeeTypeEnum("type").notNull(),
  description: text("description"),
  paymentAmount: decimal("paymentAmount", { precision: 12, scale: 2 }).notNull(),
  paymentFrequency: paymentFrequencyEnum("paymentFrequency").notNull(),
  isAutopay: boolean("isAutopay").default(false).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(onUpdateNow),
});

export type Payee = typeof payees.$inferSelect;
export type InsertPayee = typeof payees.$inferInsert;

/**
 * Payee payments.
 */
export const payeePayments = pgTable("payeePayments", {
  id: serial("id").primaryKey(),
  payeeId: integer("payeeId").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  dueDate: date("dueDate", { mode: "string" }).notNull(),
  isPaid: boolean("isPaid").default(false).notNull(),
  paidDate: date("paidDate", { mode: "string" }),
  paidBy: integer("paidBy"),
  notes: text("notes"),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  periodNumber: integer("periodNumber").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(onUpdateNow),
});

export type PayeePayment = typeof payeePayments.$inferSelect;
export type InsertPayeePayment = typeof payeePayments.$inferInsert;

/**
 * Coaching Sessions.
 */
export const coachingSessions = pgTable("coachingSessions", {
  id: serial("id").primaryKey(),
  coachPayeeId: integer("coachPayeeId").notNull(),
  sessionDate: date("sessionDate", { mode: "string" }).notNull(),
  clientName: varchar("clientName", { length: 255 }).notNull(),
  minutes: integer("minutes").notNull(),
  tradingLog: tradingLogEnum("tradingLog").default("yes").notNull(),
  fuSession: boolean("fuSession").default(false).notNull(),
  fuAssignments: text("fuAssignments"),
  notes: text("notes"),
  recordingLink: varchar("recordingLink", { length: 1000 }),
  isNoShow: boolean("isNoShow").default(false).notNull(),
  sessionPay: decimal("sessionPay", { precision: 12, scale: 2 }).default("0"),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(onUpdateNow),
});

export type CoachingSession = typeof coachingSessions.$inferSelect;
export type InsertCoachingSession = typeof coachingSessions.$inferInsert;

/**
 * Marketing Costs.
 */
export const marketingCosts = pgTable("marketingCosts", {
  id: serial("id").primaryKey(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  platform: varchar("platform", { length: 100 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  notes: text("notes"),
  createdBy: integer("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(onUpdateNow),
});

export type MarketingCost = typeof marketingCosts.$inferSelect;
export type InsertMarketingCost = typeof marketingCosts.$inferInsert;

/**
 * Subscriptions.
 */
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  clientName: varchar("clientName", { length: 255 }).notNull(),
  monthlyAmount: decimal("monthlyAmount", { precision: 12, scale: 2 }).notNull(),
  closerId: integer("closerId").notNull(),
  startDate: date("startDate", { mode: "string" }).notNull(),
  startMonth: integer("startMonth").notNull(),
  startYear: integer("startYear").notNull(),
  active: boolean("active").default(true).notNull(),
  cancelledDate: date("cancelledDate", { mode: "string" }),
  cancelledReason: text("cancelledReason"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(onUpdateNow),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

/**
 * Subscription Verifications.
 */
export const subscriptionVerifications = pgTable("subscriptionVerifications", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscriptionId").notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  isVerified: boolean("isVerified").default(false).notNull(),
  isCancelled: boolean("isCancelled").default(false).notNull(),
  verifiedBy: integer("verifiedBy"),
  verifiedAt: timestamp("verifiedAt"),
  commissionAmount: decimal("commissionAmount", { precision: 12, scale: 2 }).default("0"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(onUpdateNow),
});

export type SubscriptionVerification = typeof subscriptionVerifications.$inferSelect;
export type InsertSubscriptionVerification = typeof subscriptionVerifications.$inferInsert;

/**
 * Booked Calls - calls booked by setters from text/SMS outreach.
 *
 * Workflow:
 *  1. Setter opens "Book Call" form, enters client first/last name, phone,
 *     and selects which closer the call is assigned to.
 *  2. Booking shows up in:
 *       - Setter's "My Bookings" list
 *       - Closer's "Setter Bookings" tab (only their own assigned bookings)
 *       - Admin's full list
 *  3. When the closer creates a deal, they pick the setter (and optionally
 *     link the booking) so commission attributes correctly.
 *
 * Pay model:
 *  - Setter earns 3% of cash collected on closed deals where deals.setterId
 *    matches her teamMember row.
 *  - Cap: setters never see/earn against more than $6,000 cash per deal —
 *    deal amounts are obfuscated to protect deal economics.
 */
export const bookedCalls = pgTable("bookedCalls", {
  id: serial("id").primaryKey(),
  setterId: integer("setterId").notNull(),       // teamMembers.id (role=setter)
  closerId: integer("closerId").notNull(),       // teamMembers.id (role=closer)
  clientFirstName: varchar("clientFirstName", { length: 100 }).notNull(),
  clientLastName: varchar("clientLastName", { length: 100 }).notNull(),
  phoneNumber: varchar("phoneNumber", { length: 32 }).notNull(),
  bookedDate: date("bookedDate", { mode: "string" }).notNull(),
  notes: text("notes"),
  // Set when the closer links a deal back to this booking. Nullable.
  dealId: integer("dealId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(onUpdateNow),
});

export type BookedCall = typeof bookedCalls.$inferSelect;
export type InsertBookedCall = typeof bookedCalls.$inferInsert;

/**
 * Daily aggregate stats per closer. Used for two things:
 *   1) Holding HISTORICAL data imported from the Steve2026 / Jhalil 2026
 *      Google Sheet — which captured daily counts, not per-deal rows.
 *   2) Driving the Sales Tracker page (spreadsheet-style monthly grid)
 *      for any period where per-deal data isn't available.
 *
 * For the period after we cut over to in-app entry, this table is empty and
 * the Sales Tracker derives all numbers directly from the deals table.
 */
export const dailyStats = pgTable("dailyStats", {
  id: serial("id").primaryKey(),
  closerId: integer("closerId").notNull(),    // teamMembers.id
  statDate: date("statDate", { mode: "string" }).notNull(),
  booked: integer("booked").default(0).notNull(),
  showed: integer("showed").default(0).notNull(),
  canceled: integer("canceled").default(0).notNull(),
  noShow: integer("noShow").default(0).notNull(),
  offered: integer("offered").default(0).notNull(),
  closed: integer("closed").default(0).notNull(),
  cashCollected: decimal("cashCollected", { precision: 12, scale: 2 }).default("0").notNull(),
  revGenerated: decimal("revGenerated", { precision: 12, scale: 2 }).default("0").notNull(),
  source: varchar("source", { length: 32 }).default("import").notNull(), // 'import' | 'manual'
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(onUpdateNow),
});

export type DailyStat = typeof dailyStats.$inferSelect;
export type InsertDailyStat = typeof dailyStats.$inferInsert;
