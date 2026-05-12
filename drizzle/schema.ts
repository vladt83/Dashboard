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
// 'client' = the trader who pays for the program. They get their own login
// (created by Ariana during onboarding) and a stripped-down dashboard with
// their trading log, assigned coach card, and Skool link.
export const userRoleEnum = pgEnum("user_role", ["closer", "payroll", "admin", "coach", "setter", "client"]);
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
// Setter "motion" — which sales lane this setter operates in. Drives the
// role-aware Setter Dashboard (Jake sees only Pre Call tabs, Kresha sees only
// Call Setting tabs) and lets us split the commission rate per lane.
export const setterMotionEnum = pgEnum("setter_motion", ["vsl", "text"]);

// Where the booked call came from. `meta` = paid Meta/Facebook ads (new
// prospect). `existing_client` = upsell / referral / renewal from someone
// already in the program. Used to split the Marketing Report so ad spend
// ROI doesn't get muddled with existing-book revenue.
export const callSourceEnum = pgEnum("call_source", ["meta", "existing_client"]);

// Extension reminder milestones — anchored to dealOnboardings.onboardedAt:
//   window_open    → onboardedAt + 69 days  (T-21 — renewal window opens)
//   one_week_left  → onboardedAt + 83 days  (T-7  — escalate)
//   program_ends   → onboardedAt + 90 days  (T-0  — final touch)
//   lapsed         → onboardedAt + 97 days  (T+7  — win-back)
// The cron fires one alert row per recipient per milestone, at most once per
// (dealId, milestone) pair (idempotent).
export const extensionMilestoneEnum = pgEnum("extension_milestone", [
  "window_open", "one_week_left", "program_ends", "lapsed",
]);

// Manual pipeline status the closer + Ariana move clients through during the
// renewal window. Auto-advanced by the cron at T-21 (→ window_open) and
// T+7 (→ lapsed if still upstream of "extended"); flipped manually otherwise.
export const extensionStatusEnum = pgEnum("extension_status", [
  "window_open", "outreach_started", "call_booked", "extended", "lapsed",
]);

// Trading-log enums — values pulled from the source-of-truth Google Sheet:
//   https://docs.google.com/spreadsheets/d/11ZIH42uN8xj2kCjXA0espO4b3W4JY_4pdlgBJs_vvjI/
export const tradeStrategyEnum = pgEnum("trade_strategy", [
  "bounce_profit", "ready_set_explode", "paycheck_collector",
]);
export const tradeDirectionEnum = pgEnum("trade_direction", [
  "directional_bullish", "directional_bearish",
]);
export const tradeResultEnum = pgEnum("trade_result", ["win", "loss"]);

// Drizzle helper that auto-bumps `updatedAt` on every UPDATE — Postgres has no
// equivalent of MySQL's ON UPDATE CURRENT_TIMESTAMP, so we do it in app land.
const onUpdateNow = () => new Date();

/**
 * Core user table backing auth flow.
 *
 * `clientDealId` is set only for users with role='client' — links them to the
 * deal they paid for (so we can pull their assigned coach, program timeline,
 * trading log, etc. on their dashboard). NULL for staff accounts.
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
  clientDealId: integer("clientDealId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(onUpdateNow),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Team members - closers, setters, and payroll admins.
 *
 * Setter-only fields (closers ignore both):
 *   `commissionCap` — per-setter cash cap on each deal:
 *     - Kresha (text setter): 6000 — commission is min(cash, $6K) × her rate
 *     - Jake (VSL setter):    null — uncapped, commission is cash × her rate
 *   `setterMotion` — which sales lane this setter operates in. Drives the
 *     role-aware Setter Dashboard (Jake = Pre Call lane, Kresha = Call Setting lane).
 *   `setterRate` — commission rate as a decimal (0.0300 = 3%). Per-lane:
 *     - VSL / Pre Call setter (Jake):       0.0200 (2%)
 *     - Text / Call Setting setter (Kresha): 0.0300 (3%)
 *     - Setters never take the in-house 9% haircut closers do — they always
 *       earn their full rate on every collected payment.
 */
export const teamMembers = pgTable("teamMembers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  role: teamMemberRoleEnum("role").notNull(),
  active: boolean("active").default(true).notNull(),
  commissionCap: decimal("commissionCap", { precision: 12, scale: 2 }),
  setterMotion: setterMotionEnum("setterMotion"),
  setterRate: decimal("setterRate", { precision: 5, scale: 4 }),
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

  // DocuSign gate: until this is true, no closer or setter commission is paid
  // out on this deal. Closer flips it from My Deals once the contract is signed.
  docusignSigned: boolean("docusignSigned").default(false).notNull(),

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
 *
 * `bookingUrl` is set for coaches — the public booking page (Calendly /
 * trader.foundation/1on1coaching-{name}) the client opens from their
 * dashboard's "Book a Session" button. Null for non-coach payees.
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
  bookingUrl: varchar("bookingUrl", { length: 500 }),
  // Path (or full URL) to a portrait photo of this payee. Used on the
  // client dashboard's coach card. Conventionally lives at
  // /onboarding-assets/<name>.png (served from client/public).
  photoUrl: varchar("photoUrl", { length: 500 }),
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
  // Source of the booking: 'meta' (paid ad) vs 'existing_client' (upsell/
  // referral). Nullable so legacy rows imported before this field don't
  // break — the Marketing Report counts unset rows as "unknown source."
  callSource: callSourceEnum("callSource"),
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

/**
 * VSL Call Preps — Jake's pre-call discovery notes.
 *
 * Workflow per the Sales Process Diagnostic (April 2026):
 *   1. Prospect books a VSL call.
 *   2. Jake calls them within minutes, runs a 5-8 minute discovery using
 *      five questions and delivers the Stock Predator show-up incentive.
 *   3. Jake captures answers in this row before the closer's call.
 *   4. The closer (Steve / Jhalil) reads this row before opening the call,
 *      so they walk in already knowing the prospect's situation.
 *
 * The five discovery questions are stored as discrete columns rather than
 * one notes blob — this lets us report on coachability rate, income
 * distribution, etc. across all prepped prospects.
 */
export const vslCallPreps = pgTable("vslCallPreps", {
  id: serial("id").primaryKey(),
  setterId: integer("setterId").notNull(),       // teamMembers.id (Jake)
  closerId: integer("closerId").notNull(),       // teamMembers.id (Steve / Jhalil)
  // Prospect identity
  clientFirstName: varchar("clientFirstName", { length: 100 }).notNull(),
  clientLastName: varchar("clientLastName", { length: 100 }).notNull(),
  phoneNumber: varchar("phoneNumber", { length: 32 }).notNull(),
  email: varchar("email", { length: 320 }),
  vslBookedAt: timestamp("vslBookedAt"),         // when the closer's call is scheduled
  vslWatched: boolean("vslWatched").default(false).notNull(),
  // ─── The 5 discovery questions Jake asks per the OCE Setter Script V1 ───
  // Stored as plain text so Jake captures answers in the prospect's own words.
  q1Motivation: text("q1Motivation"),               // "What made you interested in learning how to trade?"
  q2TradingExperience: text("q2TradingExperience"), // "Have you tried trading before, or brand new?"
  q3DayToDay: text("q3DayToDay"),                   // "Working full time, running a business, something else?"
  q4Coachability: text("q4Coachability"),           // "Are you ready to commit and do the work?" — most important pre-frame
  q5SpecificQuestions: text("q5SpecificQuestions"), // "Anything specific you want the closer to cover?"
  // Show-up incentive (Stock Predator course — delivered in step 3 of the call)
  stockPredatorDelivered: boolean("stockPredatorDelivered").default(false).notNull(),
  // Free-form red flags / context for the closer (per script: "seemed hesitant,
  // mentioned spouse needs to be involved, said they are just looking, etc.")
  redFlags: text("redFlags"),
  notes: text("notes"),
  // Closer marks this when they've actually read it pre-call (so Jake knows)
  reviewedByCloser: boolean("reviewedByCloser").default(false).notNull(),
  // Link back to the deal once it closes (so the setter gets attributed)
  dealId: integer("dealId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(onUpdateNow),
});

export type VslCallPrep = typeof vslCallPreps.$inferSelect;
export type InsertVslCallPrep = typeof vslCallPreps.$inferInsert;

/**
 * Deal Onboarding — Ariana's checklist for getting a new client up and running.
 *
 * One row per deal (lazy-created on first edit). Until Ariana finishes the
 * checklist and clicks "Mark fully onboarded," `onboardedAt` is NULL and the
 * deal sits in her queue.
 *
 * The 90-day extension clock (Phase 3) anchors to `onboardedAt` — NOT the
 * DocuSign date — because the program experience starts when the client
 * actually has Skool access and a coach booked, not when they signed.
 *
 * Checklist items:
 *   1. DocuSign verified — auto-pulled from `deals.docusignSigned`, not stored here
 *   2. Skool access set up
 *   3. Payment verified in system
 *   4. First 3-4 weekly sessions booked (or client opted out)
 *   5. Trading log assigned (manual checkbox today; in-app feature later)
 *   6. Weekly check-in form sent (manual checkbox today; in-app feature later)
 */
export const dealOnboardings = pgTable("dealOnboardings", {
  id: serial("id").primaryKey(),
  dealId: integer("dealId").notNull().unique(),

  // Skool / community access
  skoolAccessGranted: boolean("skoolAccessGranted").default(false).notNull(),
  skoolAccessAt: timestamp("skoolAccessAt"),

  // Payment confirmation (Ariana verifies the deal's payment plan/processor
  // is correctly recorded; she may attach a free-form note like "Fanbasis
  // confirmed monthly $499" or "Stripe one-time $5K cleared").
  paymentVerified: boolean("paymentVerified").default(false).notNull(),
  paymentVerifiedAt: timestamp("paymentVerifiedAt"),
  paymentNote: text("paymentNote"),

  // Sessions booked. We track a count so Ariana can mark "2 of 4 booked"
  // progressively. Default target is 4 (one per week for the first month);
  // Ariana can override on a per-deal basis.
  // Onboarding only books the intro call. The coach handles all subsequent
  // session booking inside Skool / their own calendar. Ariana ticks this
  // when the intro call is on the calendar.
  // (Legacy fields kept for migration safety — no longer surfaced in UI.)
  introCallBooked: boolean("introCallBooked").default(false).notNull(),
  introCallBookedAt: timestamp("introCallBookedAt"),
  sessionsBookedCount: integer("sessionsBookedCount").default(0).notNull(),  // legacy
  sessionsTarget: integer("sessionsTarget").default(4).notNull(),             // legacy
  sessionsBookedComplete: boolean("sessionsBookedComplete").default(false).notNull(),  // legacy
  clientOptedOutOfSessions: boolean("clientOptedOutOfSessions").default(false).notNull(),  // legacy
  // Coach Ariana picks for this client. References payees.id (Leo / Elliot / Erin).
  coachAssignedPayeeId: integer("coachAssignedPayeeId"),

  // Manual placeholders — these features (in-app trading log + weekly check-in
  // form) don't exist yet, so Ariana checks them off after doing the work
  // somewhere else. When the real features ship, these flip to auto-driven.
  tradingLogAssigned: boolean("tradingLogAssigned").default(false).notNull(),
  weeklyCheckInSent: boolean("weeklyCheckInSent").default(false).notNull(),

  // Completion stamp. NULL = still in onboarding queue. Set by Ariana clicking
  // "Mark fully onboarded" once all checklist items are green.
  // ─── Phase 3: this also anchors the 90-day extension clock. ───
  onboardedAt: timestamp("onboardedAt"),
  onboardedById: integer("onboardedById"),  // users.id who completed it

  // ─── Renewal pipeline (Phase 3) ────────────────────────────────────
  // Auto-set by the cron when alerts fire; can also be manually advanced
  // by closer / payroll / admin from the Client Profile page.
  //   window_open      — T-21 day reached, renewal window open
  //   outreach_started — closer/Ariana has reached out
  //   call_booked      — renewal call is on the calendar
  //   extended         — client renewed / upsold (success)
  //   lapsed           — program ended, no extension (auto at T+7 if no upstream change)
  extensionStatus: extensionStatusEnum("extensionStatus"),
  extensionStatusAt: timestamp("extensionStatusAt"),
  extensionStatusBy: integer("extensionStatusBy"),  // users.id who last set it
  extensionNotes: text("extensionNotes"),

  notes: text("notes"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(onUpdateNow),
});

export type DealOnboarding = typeof dealOnboardings.$inferSelect;
export type InsertDealOnboarding = typeof dealOnboardings.$inferInsert;

/**
 * Extension alerts — audit trail of every reminder the cron fires.
 *
 * One row per (deal, milestone, recipient) tuple. The cron is idempotent:
 * before firing, it checks for an existing row matching (dealId, milestone,
 * recipientUserId) and skips if found. So running the cron 100 times in a
 * day still produces at most one alert per recipient per milestone.
 *
 * `acknowledgedAt` is set when a recipient clicks "got it" in their UI
 * (future — for now alerts just sit there as a record).
 */
export const extensionAlerts = pgTable("extensionAlerts", {
  id: serial("id").primaryKey(),
  dealId: integer("dealId").notNull(),
  milestone: extensionMilestoneEnum("milestone").notNull(),
  firedAt: timestamp("firedAt").defaultNow().notNull(),
  // Recipient — one row per person notified. We denormalize the name so old
  // rows still display nicely if a user is later renamed/deleted.
  recipientUserId: integer("recipientUserId").notNull(),
  recipientName: varchar("recipientName", { length: 255 }).notNull(),
  recipientRole: varchar("recipientRole", { length: 32 }).notNull(),
  // The day-offset from onboardedAt that triggered this row. Stored so we
  // can reconstruct the timeline cleanly if program length ever changes.
  dayOffset: integer("dayOffset").notNull(),
  acknowledgedAt: timestamp("acknowledgedAt"),
});

export type ExtensionAlert = typeof extensionAlerts.$inferSelect;
export type InsertExtensionAlert = typeof extensionAlerts.$inferInsert;

/**
 * Email audit log — every email the app tries to send lands here. In dev
 * (no RESEND_API_KEY set) sending is stubbed but rows still get logged with
 * status='stubbed' so we can verify the pipeline works.
 *
 * Idempotency lookup: callers pass a `dedupeKey` (e.g. "coach_assignment:25:1")
 * to avoid sending the same email twice for the same trigger.
 */
export const emailLog = pgTable("emailLog", {
  id: serial("id").primaryKey(),
  toEmail: varchar("toEmail", { length: 320 }).notNull(),
  toName: varchar("toName", { length: 255 }),
  fromEmail: varchar("fromEmail", { length: 320 }).notNull(),
  fromName: varchar("fromName", { length: 255 }),
  replyTo: varchar("replyTo", { length: 320 }),
  subject: varchar("subject", { length: 500 }).notNull(),
  bodyHtml: text("bodyHtml"),
  bodyText: text("bodyText"),
  // 'queued' | 'sent' | 'stubbed' | 'failed'
  status: varchar("status", { length: 32 }).default("queued").notNull(),
  providerId: varchar("providerId", { length: 255 }),  // ID returned by Resend etc.
  errorMessage: text("errorMessage"),
  // Caller-supplied de-dupe key. Unique-but-nullable so legacy sends without
  // a key still work; keyed sends are protected against duplicates.
  dedupeKey: varchar("dedupeKey", { length: 255 }),
  // Link to source records for filtering / debugging.
  relatedDealId: integer("relatedDealId"),
  relatedUserId: integer("relatedUserId"),
  triggeredByUserId: integer("triggeredByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailLog = typeof emailLog.$inferSelect;
export type InsertEmailLog = typeof emailLog.$inferInsert;

/**
 * Magic-link sign-in tokens. The primary auth path for clients (they don't
 * keep a password — they already manage Skool's, and we don't want to add
 * another credential to their lives). Staff can also use this as an
 * alternative to password login.
 *
 * Flow:
 *   1. User submits email on the login page → server creates a row here +
 *      emails a one-time link `/login/magic?token=<token>`
 *   2. User clicks the link → server marks usedAt, issues a session cookie
 *   3. Tokens expire after 30 minutes; one-time-use enforced via usedAt
 */
export const loginTokens = pgTable("loginTokens", {
  id: serial("id").primaryKey(),
  // Unsalted random token (looks like an opaque string in the URL). We
  // index on this column for fast consume lookups.
  token: varchar("token", { length: 64 }).notNull().unique(),
  userId: integer("userId").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  // For audit / debugging — what triggered this link?
  // 'login_request' | 'admin_send' | 'client_invite' | 'magic_login'
  reason: varchar("reason", { length: 64 }).default("login_request").notNull(),
  triggeredByUserId: integer("triggeredByUserId"),  // NULL when self-requested
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LoginToken = typeof loginTokens.$inferSelect;
export type InsertLoginToken = typeof loginTokens.$inferInsert;

/**
 * Trading Log — one row per client. Holds the lifetime log; entries time-stamp
 * themselves and the UI filters by month/year. Modeled on the team's existing
 * Google Sheet (12 monthly tabs + SpendTracking dashboard) but consolidated
 * into a single accumulating log per client.
 *
 * Created by Ariana from the Client Profile page once the client login is set
 * up. Visible to:
 *   - The client themselves (full read/write on their own log)
 *   - Their assigned coach (read-only — drives weekly review)
 *   - Ariana / admin (read-only oversight)
 *
 * `startingBalance` is the account size the client started with. The current
 * balance is computed as startingBalance + sum(profitLoss). We don't
 * denormalize because trade rows can be edited.
 */
export const tradingLogs = pgTable("tradingLogs", {
  id: serial("id").primaryKey(),
  // The client whose log this is. Their account in users + the deal they paid for.
  clientUserId: integer("clientUserId").notNull().unique(),
  dealId: integer("dealId").notNull(),
  // Account size the client opened with. Drives the running-ROI math.
  startingBalance: decimal("startingBalance", { precision: 14, scale: 2 }).default("0").notNull(),
  // Free-form: which broker, account number reference, etc. Not required.
  brokerNote: text("brokerNote"),
  createdById: integer("createdById").notNull(),  // Ariana's user id
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(onUpdateNow),
});

export type TradingLog = typeof tradingLogs.$inferSelect;
export type InsertTradingLog = typeof tradingLogs.$inferInsert;

/**
 * Individual trade rows belonging to a tradingLog. Field set mirrors the
 * Google Sheet 1:1 so existing client habits transfer cleanly.
 *
 * Profit/Loss is calculated server-side using the same formula the Sheet uses
 * (Bid - Ask) × 100 × Contracts — the ×100 is the standard options contract
 * multiplier (100 shares per contract). For the absolute-value-needed case
 * we just trust direction + result to set the sign correctly.
 */
export const tradeEntries = pgTable("tradeEntries", {
  id: serial("id").primaryKey(),
  tradingLogId: integer("tradingLogId").notNull(),
  // Identity
  ticker: varchar("ticker", { length: 16 }).notNull(),
  strategy: tradeStrategyEnum("strategy").notNull(),
  direction: tradeDirectionEnum("direction").notNull(),
  result: tradeResultEnum("result"),  // null until trade is closed
  // Dates
  entryDate: date("entryDate", { mode: "string" }).notNull(),
  entryTime: varchar("entryTime", { length: 16 }),  // free-form HH:MM
  exitDate: date("exitDate", { mode: "string" }),
  // Options details
  strikePrices: varchar("strikePrices", { length: 64 }),  // free-form (e.g. "234" or "230/240" for spreads)
  expirationDate: date("expirationDate", { mode: "string" }),
  contractCount: integer("contractCount").default(1).notNull(),
  askPrice: decimal("askPrice", { precision: 12, scale: 4 }).default("0").notNull(),
  bidPrice: decimal("bidPrice", { precision: 12, scale: 4 }).default("0").notNull(),
  // Computed (stored at write time)
  bidAskDifference: decimal("bidAskDifference", { precision: 14, scale: 4 }).default("0").notNull(),
  totalInvestment: decimal("totalInvestment", { precision: 14, scale: 2 }).default("0").notNull(),
  profitLoss: decimal("profitLoss", { precision: 14, scale: 2 }).default("0").notNull(),
  profitPct: decimal("profitPct", { precision: 8, scale: 4 }).default("0").notNull(),  // ratio (0.10 = 10%)
  // Notes (anything the trader wants — what they were thinking, what went wrong, etc.)
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(onUpdateNow),
});

export type TradeEntry = typeof tradeEntries.$inferSelect;
export type InsertTradeEntry = typeof tradeEntries.$inferInsert;
