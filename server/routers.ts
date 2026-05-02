import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

/**
 * Parse a 'YYYY-MM-DD' date string into year + month components without
 * timezone interpretation. `new Date("2026-04-01")` parses as UTC midnight
 * and `.getMonth()` then converts to local time — so an April 1 entry in
 * any timezone west of UTC silently becomes March 31. This helper avoids
 * that whole class of bug by reading the string directly.
 */
function parseYearMonth(dateStr: string): { year: number; month: number } {
  const [y, m] = dateStr.split("-");
  return { year: parseInt(y, 10), month: parseInt(m, 10) };
}
import {
  createDeal,
  updateDeal,
  getDealById,
  getDealsByMonth,
  getDealsByCloser,

  getAllDeals,
  deleteDeal,
  getTeamMembers,
  getTeamMemberById,
  createTeamMember,
  updateTeamMember,
  getCommissionRate,
  getMemberCommissionRates,
  createCommissionRate,
  getOrCreatePayPeriod,
  getPayPeriodsByMonth,
  createPayrollEntry,
  getPayrollEntriesByPeriod,
  getPayrollEntriesByMember,
  markPayrollPaid,
  getMonthlyStats,
  getCloserStats,

  getCloserLeaderboard,

  getAvailableMonths,
  calculateCloserCommission,
  effectiveCloserRate,

  seedInitialData,
  createAdjustment,
  getAdjustmentsByMember,
  getAdjustmentsByMonth,
  deleteAdjustment,
  linkUserToTeamMember,
  getUserTeamLink,
  removeUserTeamLink,
  getMemberTotalWithAdjustments,
  getNotificationsByMember,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  notifySetterOfNotesUpdate,
  createBookedCall,
  getBookedCallById,
  getBookedCallsBySetter,
  getBookedCallsByCloser,
  getAllBookedCalls,
  updateBookedCall,
  deleteBookedCall,
  getSetterPayouts,
  SETTER_CAP,
  SETTER_RATE,
  getSetterCap,
  getSetterRate,
  applySetterCap,
  getDealsBySetter,
  createVslCallPrep,
  getVslCallPrepById,
  getVslCallPrepsBySetter,
  getVslCallPrepsByCloser,
  getAllVslCallPreps,
  updateVslCallPrep,
  deleteVslCallPrep,
  getSalesMonthlyByCloser,
  getSalesDailyByCloser,
  getUserByEmail,
  getUserById,
  createUserWithPassword,
  getAllUsers,
  updateUserPermissions,
  updateUserRole,
  deleteUser,
  notifyMemberOfPayment,
  notifyMemberOfBonus,
  notifyMemberOfDeduction,
  createPayee,
  getActivePayees,
  getPayeesByType,
  updatePayee,
  deactivatePayee,
  createPayeePayment,
  getPayeePaymentsByMonth,
  markPayeePaymentPaid,
  generatePayeePaymentsForMonth,
  getPayrollSummaryForMonth,
  createPaymentPlanEntries,
  createFirstPaymentPlanEntry,
  collectPaymentPlanPayment,
  getPendingPaymentPlanEntries,
  cancelPaymentPlanEntries,
  markPaymentPlanPaidEarly,
  togglePayeeAutopay,
  getPaymentPlanProgress,
  getPaymentPlansByMonth,
  createCoachingSession,
  updateCoachingSession,
  deleteCoachingSession,
  getCoachingSessionsByMonth,
  getAllCoachingSessionsByMonth,
  getCoachingSessionSummary,
  getMarketingCostsByMonth,
  createMarketingCost,
  updateMarketingCost,
  deleteMarketingCost,
  getCompanyPerformance,
  getSalesTeamBreakdown,
  getPayrollOverview,
  getPayeeByUserId,
  getDealOnboarding,
  upsertDealOnboarding,
  markDealOnboardingComplete,
  reopenDealOnboarding,
  getPendingOnboardings,
  getRecentlyOnboarded,
  getClientProfile,
  computeProgramTimeline,
  getExtensionAlertsForDeal,
  setExtensionStatus,
  runExtensionReminders,
  getUpcomingExtensions,
  createClientLogin,
  createTradingLog,
  getTradingLogByClientUserId,
  getTradingLogByDealId,
  getTradingLogById,
  getClientDirectory,
  createLoginToken,
  consumeLoginToken,
  addTradeEntry,
  updateTradeEntry,
  deleteTradeEntry,
  getTradeEntry,
  getTradeEntriesForLog,
  getTradingLogStats,
  getTradingLogsForCoach,
  updateTradingLog,
  getDb,
} from "./db";

// Admin-only procedure
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});

/**
 * Notify a coach (via email) that they've been assigned a new client.
 * Idempotent — only fires once per (dealId, coachPayeeId) pair thanks to
 * the dedupeKey unique index on emailLog.
 *
 * Looks up the coach's user account by matching payee.name → user.name.
 * Falls back gracefully if the coach has no user (logs to emailLog as
 * 'failed' with a clear reason).
 */
async function notifyCoachOfAssignment(input: {
  dealId: number;
  coachPayeeId: number;
  triggeredByUserId: number;
  triggeredByName?: string;
}): Promise<void> {
  const { sendEmail } = await import("./email");

  const deal = await getDealById(input.dealId);
  if (!deal) return;

  // Look up the coach payee + their user (by name match — coaches don't
  // have a direct payee→user link in the current schema).
  const db = await getDb();
  if (!db) return;
  const { payees, users } = await import("../drizzle/schema");
  const [coach] = await db.select().from(payees).where(eq(payees.id, input.coachPayeeId));
  if (!coach) return;
  const [coachUser] = await db.select({
    id: users.id, email: users.email, name: users.name,
  }).from(users).where(eq(users.name, coach.name));

  if (!coachUser?.email) {
    // No user account for this coach yet — log it via emailLog so admin can see.
    await sendEmail({
      to: { email: `unknown-coach-${input.coachPayeeId}@invalid`, name: coach.name },
      subject: `Coach assignment skipped — no user for ${coach.name}`,
      text: `Tried to email coach ${coach.name} (payee #${input.coachPayeeId}) about new client assignment for ${deal.clientName}, but no matching user account was found.`,
      dedupeKey: `coach_assignment_skip:${input.dealId}:${input.coachPayeeId}`,
      relatedDealId: input.dealId,
      triggeredByUserId: input.triggeredByUserId,
    });
    return;
  }

  const fromName = input.triggeredByName
    ? `${input.triggeredByName} via Trader Foundation`
    : "Trader Foundation";
  const profileUrl = `${process.env.APP_URL || "http://localhost:3000"}/clients/${input.dealId}`;

  const subject = `New client assigned to you: ${deal.clientName}`;
  const text = [
    `Hi ${coachUser.name?.split(" ")[0] ?? coach.name},`,
    "",
    `${input.triggeredByName ?? "Ariana"} just assigned ${deal.clientName} to you. They're ready for their first coaching session.`,
    "",
    "Everything you need is on their Client Profile in your dashboard:",
    "  • Trading log + program timeline",
    "  • Coaching session history",
    "  • Onboarding checklist (so you know what's been covered)",
    "",
    `Open profile: ${profileUrl}`,
    "",
    "Reply to this email if anything's missing.",
    "",
    "— Trader Foundation",
  ].join("\n");

  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0; padding:24px; background:#0a0a0a; color:#cfcfcf; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <div style="max-width:560px; margin:0 auto; background:#161616; border:1px solid #2a2620; border-radius:12px; padding:32px;">
    <p style="color:#c7ab77; font-size:11px; text-transform:uppercase; letter-spacing:2px; margin:0 0 8px 0;">Trader Foundation</p>
    <h1 style="color:#c7ab77; font-size:22px; margin:0 0 16px 0;">New client assigned to you</h1>
    <p style="margin:0 0 16px 0; line-height:1.6;">Hi ${coachUser.name?.split(" ")[0] ?? coach.name},</p>
    <p style="margin:0 0 16px 0; line-height:1.6;">
      <strong style="color:#fff;">${input.triggeredByName ?? "Ariana"}</strong> just assigned
      <strong style="color:#fff;">${deal.clientName}</strong> to you. They're ready for their first coaching session.
    </p>
    <p style="margin:0 0 8px 0; line-height:1.6;">Everything you need is on their Client Profile in your dashboard:</p>
    <ul style="margin:0 0 24px 0; padding-left:20px; line-height:1.8;">
      <li>Trading log + program timeline</li>
      <li>Coaching session history</li>
      <li>Onboarding checklist (so you know what's been covered)</li>
    </ul>
    <a href="${profileUrl}" style="display:inline-block; background:#c7ab77; color:#0a0a0a; text-decoration:none; font-weight:600; padding:12px 24px; border-radius:8px; margin-bottom:24px;">
      Open ${deal.clientName}'s profile →
    </a>
    <p style="margin:24px 0 0 0; padding-top:16px; border-top:1px solid #2a2620; font-size:12px; color:#8a8a8a; line-height:1.6;">
      Reply to this email if anything's missing.<br/>
      — Trader Foundation
    </p>
  </div>
</body>
</html>`.trim();

  await sendEmail({
    to: { email: coachUser.email, name: coachUser.name ?? coach.name },
    from: { email: process.env.EMAIL_FROM_ADDRESS || "noreply@traderfoundation.com",
            name: fromName },
    replyTo: "ariana@traderfoundation.com",
    subject,
    text,
    html,
    dedupeKey: `coach_assignment:${input.dealId}:${input.coachPayeeId}`,
    relatedDealId: input.dealId,
    relatedUserId: coachUser.id,
    triggeredByUserId: input.triggeredByUserId,
  });
}

/**
 * Throws FORBIDDEN unless the caller can write to the given trading log.
 * Write access:
 *   - admin / payroll: any log
 *   - client:          only their own log
 *   - everyone else:   no
 * Coaches can read a log but not write.
 */
async function assertCanWriteToLog(
  userId: number,
  role: string,
  tradingLogId: number,
): Promise<void> {
  if (role === "admin" || role === "payroll") return;
  if (role === "client") {
    const log = await getTradingLogById(tradingLogId);
    if (log?.clientUserId !== userId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Not your log." });
    }
    return;
  }
  throw new TRPCError({ code: "FORBIDDEN", message: "Read-only role." });
}

// Payroll procedure - allows admin and payroll roles
const payrollProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin' && ctx.user.role !== 'payroll') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Payroll access required' });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    
    login: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(6),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByEmail(input.email.toLowerCase());
        
        if (!user || !user.passwordHash) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password' });
        }
        
        const validPassword = await bcrypt.compare(input.password, user.passwordHash);
        if (!validPassword) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password' });
        }
        
        // Create session token (JWT cookie)
        const { createSessionToken } = await import("./_core/auth");
        const sessionToken = await createSessionToken(user.openId || `user-${user.id}`, {
          name: user.name || "",
          expiresInMs: 365 * 24 * 60 * 60 * 1000, // 1 year
        });
        
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: 365 * 24 * 60 * 60 * 1000 });
        
        return { success: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
      }),
    
    register: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(6),
        name: z.string().min(1),
        role: z.enum(['closer', 'payroll', 'admin', 'coach', 'setter']).optional(),
        permissions: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Validate email domain
        const emailDomain = input.email.split('@')[1]?.toLowerCase();
        const allowedDomains = ['traderfoundation.com', 'traderfoundation.co'];
        if (!allowedDomains.includes(emailDomain)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only @traderfoundation.com and @traderfoundation.co emails are allowed' });
        }
        
        // Check if user already exists
        const existingUser = await getUserByEmail(input.email.toLowerCase());
        if (existingUser) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Email already registered' });
        }
        
        // Hash password
        const passwordHash = await bcrypt.hash(input.password, 10);
        
        // Use the selected role directly
        const userRole = input.role || 'closer';
        
        // Set default permissions based on role
        let defaultPermissions: string[];
        switch (userRole) {
          case 'admin':
            defaultPermissions = ['/', '/new-deal', '/my-deals', '/payment-plans', '/payroll-dashboard', '/payouts', '/reports', '/settings', '/user-management'];
            break;
          case 'payroll':
            defaultPermissions = ['/', '/payment-plans', '/payroll-dashboard', '/payouts'];
            break;
          case 'coach':
            defaultPermissions = ['/', '/coaching-sessions', '/my-payouts'];
            break;
          case 'setter':
            defaultPermissions = ['/', '/setter-dashboard'];
            break;
          case 'closer':
          default:
            defaultPermissions = ['/', '/new-deal', '/my-deals', '/setter-bookings'];
            break;
        }
        
        // Create user with role-based permissions
        const user = await createUserWithPassword({
          email: input.email.toLowerCase(),
          name: input.name,
          passwordHash,
          role: userRole,
          permissions: input.permissions || defaultPermissions,
        });
        
        if (!user) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create user' });
        }
        
        // Create session token
        const { createSessionToken } = await import("./_core/auth");
        const sessionToken = await createSessionToken(user.openId || `user-${user.id}`, {
          name: user.name || "",
          expiresInMs: 365 * 24 * 60 * 60 * 1000,
        });
        
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: 365 * 24 * 60 * 60 * 1000 });
        
        return { success: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
      }),
    
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    
    changePassword: protectedProcedure
      .input(z.object({
        currentPassword: z.string().min(1, 'Current password is required'),
        newPassword: z.string().min(6, 'New password must be at least 6 characters'),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserById(ctx.user.id);
        if (!user || !user.passwordHash) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot change password for this account' });
        }
        
        const validPassword = await bcrypt.compare(input.currentPassword, user.passwordHash);
        if (!validPassword) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Current password is incorrect' });
        }
        
        const newHash = await bcrypt.hash(input.newPassword, 10);
        const { getDb } = await import("./db");
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
        
        await db.update(users).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(users.id, ctx.user.id));

        return { success: true };
      }),

    /**
     * Request a magic-link sign-in. Anyone can call this; we don't leak
     * whether an email exists by always returning success. If the email
     * resolves to a real user, we email them a one-time link that expires
     * in 30 minutes.
     *
     * Primary auth path for clients (no password required) — but staff can
     * use it too as an alternative to typing a password.
     */
    requestMagicLink: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input }) => {
        const user = await getUserByEmail(input.email.toLowerCase());
        // Always return success — don't leak account existence.
        if (!user) {
          return {
            ok: true,
            message: "If that email matches an account, a sign-in link is on the way.",
            devLink: null as string | null,
          };
        }
        const { token } = await createLoginToken({
          userId: user.id,
          reason: "login_request",
        });
        const appUrl = process.env.APP_URL || "http://localhost:3000";
        const link = `${appUrl}/login/magic?token=${token}`;
        // In dev (no email provider configured) return the link so the
        // user can click straight through without fishing tokens out of
        // the DB. In prod, RESEND_API_KEY is set and devLink stays null.
        const devLink = process.env.RESEND_API_KEY ? null : link;
        const firstName = user.name?.split(" ")[0] ?? "there";
        const { sendEmail } = await import("./email");
        await sendEmail({
          to: { email: user.email, name: user.name ?? undefined },
          subject: "Your Trader Foundation sign-in link",
          text: [
            `Hi ${firstName},`,
            "",
            "Click this link to sign in to your Trader Foundation dashboard:",
            link,
            "",
            "Link expires in 30 minutes. If you didn't request this, just ignore the email.",
            "",
            "— Trader Foundation",
          ].join("\n"),
          html: `
<!DOCTYPE html>
<html>
<body style="margin:0; padding:24px; background:#0a0a0a; color:#cfcfcf; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <div style="max-width:480px; margin:0 auto; background:#161616; border:1px solid #2a2620; border-radius:12px; padding:32px;">
    <p style="color:#c7ab77; font-size:11px; text-transform:uppercase; letter-spacing:2px; margin:0 0 8px 0;">Trader Foundation</p>
    <h1 style="color:#c7ab77; font-size:22px; margin:0 0 16px 0;">Your sign-in link</h1>
    <p style="margin:0 0 16px 0; line-height:1.6;">Hi ${firstName},</p>
    <p style="margin:0 0 24px 0; line-height:1.6;">Tap the button below to sign in to your Trader Foundation dashboard. No password needed.</p>
    <a href="${link}" style="display:inline-block; background:#c7ab77; color:#0a0a0a; text-decoration:none; font-weight:600; padding:14px 28px; border-radius:8px;">Sign in →</a>
    <p style="margin:24px 0 8px 0; font-size:12px; color:#8a8a8a; line-height:1.6;">
      Or copy this URL into your browser:<br/>
      <span style="color:#c7ab77; word-break:break-all;">${link}</span>
    </p>
    <p style="margin:24px 0 0 0; padding-top:16px; border-top:1px solid #2a2620; font-size:12px; color:#8a8a8a; line-height:1.6;">
      Link expires in 30 minutes. If you didn't request this, just ignore the email.
    </p>
  </div>
</body>
</html>`.trim(),
          relatedUserId: user.id,
        });
        return {
          ok: true,
          message: "Sign-in link sent. Check your email.",
          devLink,
        };
      }),

    /**
     * Consume a magic-link token. On success, sets the session cookie and
     * returns the signed-in user. On failure, returns ok=false with a reason
     * the UI can show (expired / already used / unknown).
     */
    consumeMagicLink: publicProcedure
      .input(z.object({ token: z.string().min(10) }))
      .mutation(async ({ input, ctx }) => {
        const user = await consumeLoginToken(input.token);
        if (!user) {
          return { ok: false as const, reason: "This sign-in link is expired or already used. Request a new one." };
        }
        const { createSessionToken } = await import("./_core/auth");
        const sessionToken = await createSessionToken(user.openId || `user-${user.id}`, {
          name: user.name || "",
          expiresInMs: 365 * 24 * 60 * 60 * 1000,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: 365 * 24 * 60 * 60 * 1000 });
        return {
          ok: true as const,
          user: { id: user.id, email: user.email, name: user.name, role: user.role },
        };
      }),
  }),
  
  // User management (admin only)
  users: router({
    getAll: adminProcedure.query(async () => {
      return getAllUsers();
    }),
    
    updatePermissions: adminProcedure
      .input(z.object({
        userId: z.number(),
        permissions: z.array(z.string()),
      }))
      .mutation(async ({ input }) => {
        return updateUserPermissions(input.userId, input.permissions);
      }),
    
    updateRole: adminProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(['closer', 'payroll', 'admin', 'coach', 'setter']),
      }))
      .mutation(async ({ input }) => {
        return updateUserRole(input.userId, input.role);
      }),
    
    delete: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input }) => {
        await deleteUser(input.userId);
        return { success: true };
      }),
    
    create: adminProcedure
      .input(z.object({
        email: z.string().email(),
        name: z.string().min(1),
        password: z.string().min(6),
        role: z.enum(['closer', 'payroll', 'admin', 'coach', 'setter']).optional(),
        permissions: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        const existingUser = await getUserByEmail(input.email.toLowerCase());
        if (existingUser) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Email already registered' });
        }
        
        const passwordHash = await bcrypt.hash(input.password, 10);
        return createUserWithPassword({
          email: input.email.toLowerCase(),
          name: input.name,
          passwordHash,
          role: input.role || 'closer',
          permissions: input.permissions || ['/'],
        });
      }),
  }),

  // Team member management
  team: router({
    getAll: protectedProcedure.query(async () => {
      return getTeamMembers();
    }),

    getByRole: protectedProcedure
      .input(z.object({ role: z.enum(["closer", "payroll", "setter"]) }))
      .query(async ({ input }) => {
        return getTeamMembers(input.role);
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getTeamMemberById(input.id);
      }),

    create: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        role: z.enum(["closer", "payroll", "setter"]),
      }))
      .mutation(async ({ input }) => {
        return createTeamMember(input);
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        active: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return updateTeamMember(id, data);
      }),

    getCommissionRates: protectedProcedure
      .input(z.object({ memberId: z.number() }))
      .query(async ({ input }) => {
        return getMemberCommissionRates(input.memberId);
      }),

    setCommissionRate: adminProcedure
      .input(z.object({
        memberId: z.number(),
        rate: z.number().min(0).max(1),
        showRate: z.number().min(0).default(0),
        startMonth: z.number().min(1).max(12),
        startYear: z.number(),
        endMonth: z.number().min(1).max(12).nullable().optional(),
        endYear: z.number().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        return createCommissionRate({
          memberId: input.memberId,
          rate: input.rate.toFixed(4),
          showRate: input.showRate.toFixed(2),
          startMonth: input.startMonth,
          startYear: input.startYear,
          endMonth: input.endMonth ?? null,
          endYear: input.endYear ?? null,
        });
      }),

    // Seed initial data
    seed: adminProcedure.mutation(async () => {
      await seedInitialData();
      return { success: true };
    }),
  }),

  // Deal management (entered by closers)
  deals: router({
    // Create a new deal entry (closer fills this out)
    create: protectedProcedure
      .input(z.object({
        clientName: z.string().min(1, "Client name is required"),
        dealDate: z.string(),
        closerId: z.number(),
        setterId: z.number().nullable().optional(), // null = self-generated lead
        showed: z.boolean(),
        prepared: z.boolean(),
        offered: z.boolean().default(false),
        canceled: z.boolean().default(false),
        closed: z.boolean().default(false),
        isNewClient: z.boolean().default(true),
        totalDealAmount: z.number().min(0).default(0),
        newCashCollected: z.number().min(0).default(0),
        existingCashCollected: z.number().min(0).default(0),
        notes: z.string().optional(),
        // Payment type fields
        paymentType: z.enum(["full_pay", "in_house_payment_plan", "bnpl"]).nullable().optional(),
        paymentProcessor: z.string().nullable().optional(),
        downPayment: z.number().nullable().optional(),
        paymentPlanMonths: z.number().nullable().optional(),
        monthlyPaymentAmount: z.number().nullable().optional(),
        bnplFee: z.number().nullable().optional(),
        docusignSigned: z.boolean().default(false),
      }))
      .mutation(async ({ input }) => {
        // Get date parts for commission rate lookup (no timezone games)
        const { year, month } = parseYearMonth(input.dealDate);

        // DocuSign gate: until the contract is signed, no commission is
        // calculated for closer or setter. Once docusignSigned flips true,
        // the next update recalculates.
        const eligibleForCommission = input.closed && input.docusignSigned;

        // Calculate closer commission. In-house payment plans get the
        // 9% fee-offset rate; other deals use the time-based rate.
        const closerRate = await getCommissionRate(input.closerId, year, month);
        const fallbackRate = closerRate ? parseFloat(closerRate.rate) : 0.10;
        const closerRateValue = effectiveCloserRate(input.paymentType, fallbackRate);
        const totalCash = input.newCashCollected + input.existingCashCollected;
        const closerCommission = eligibleForCommission ? calculateCloserCommission(totalCash, closerRateValue) : 0;

        // Setter commission: per-setter rate (Kresha 3%, Jake 2%) of cash
        // collected, with per-setter cap. Setters never take the in-house 9%
        // haircut closers do — they always earn their full rate.
        let setterCashCommission = 0;
        if (eligibleForCommission && input.setterId) {
          const setterCap = await getSetterCap(input.setterId);
          const setterRate = await getSetterRate(input.setterId);
          setterCashCommission = applySetterCap(totalCash, setterCap) * setterRate;
        }

        // Create the deal
        const deal = await createDeal({
          clientName: input.clientName,
          dealDate: input.dealDate,
          closerId: input.closerId,
          setterId: input.setterId ?? null,
          showed: input.showed,
          prepared: input.prepared,
          offered: input.offered,
          canceled: input.canceled,
          closed: input.closed,
          isNewClient: input.isNewClient,
          fullyPaid: false,
          totalDealAmount: input.totalDealAmount.toFixed(2),
          newCashCollected: input.newCashCollected.toFixed(2),
          existingCashCollected: input.existingCashCollected.toFixed(2),
          closerCommission: closerCommission.toFixed(2),
          setterCashCommission: setterCashCommission.toFixed(2),
          setterShowCommission: "0",
          notes: input.notes || null,
          paymentType: input.paymentType || null,
          paymentProcessor: input.paymentProcessor || null,
          downPayment: input.downPayment?.toFixed(2) || "0",
          isPaymentPlan: input.paymentType === "in_house_payment_plan",
          totalMonths: input.paymentPlanMonths || 0,
          monthlyAmount: input.monthlyPaymentAmount?.toFixed(2) || "0",
          bnplFee: input.bnplFee?.toFixed(2) || "0",
          docusignSigned: input.docusignSigned,
        });
        
        // If this is a payment plan, create the first monthly payment entry
        // The down payment is recorded in the deal itself, and the first monthly payment
        // is created for the next month
        if (input.paymentType === "in_house_payment_plan" && input.paymentPlanMonths && input.paymentPlanMonths > 0 && input.monthlyPaymentAmount) {
          await createFirstPaymentPlanEntry(
            deal.id,
            input.paymentPlanMonths,
            input.monthlyPaymentAmount,
            input.dealDate
          );
        }
        
        return deal;
      }),

    // Update a deal — closers can edit their own entries; admins can edit any.
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        clientName: z.string().min(1).optional(),
        dealDate: z.string().optional(),
        setterId: z.number().nullable().optional(),
        showed: z.boolean().optional(),
        prepared: z.boolean().optional(),
        offered: z.boolean().optional(),
        canceled: z.boolean().optional(),
        closed: z.boolean().optional(),
        isNewClient: z.boolean().optional(),
        fullyPaid: z.boolean().optional(),
        totalDealAmount: z.number().min(0).optional(),
        newCashCollected: z.number().min(0).optional(),
        existingCashCollected: z.number().min(0).optional(),
        bnplFee: z.number().min(0).optional(),
        downPayment: z.number().min(0).optional(),
        monthlyAmount: z.number().min(0).optional(),
        notes: z.string().optional(),
        docusignSigned: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        
        const currentDeal = await getDealById(id);
        if (!currentDeal) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Deal not found' });
        }
        
        // Determine final values
        const dealDate = updates.dealDate ?? currentDeal.dealDate;
        const { year, month } = parseYearMonth(dealDate);
        
        const showed = updates.showed ?? currentDeal.showed;
        const prepared = updates.prepared ?? currentDeal.prepared;
        const closed = updates.closed ?? currentDeal.closed;
        const docusignSigned = updates.docusignSigned ?? currentDeal.docusignSigned;
        const newCash = updates.newCashCollected ?? parseFloat(currentDeal.newCashCollected || "0");
        const existingCash = updates.existingCashCollected ?? parseFloat(currentDeal.existingCashCollected || "0");
        const totalCash = newCash + existingCash;
        const setterId = updates.setterId !== undefined ? updates.setterId : currentDeal.setterId;

        // DocuSign gate: no commission until signed.
        const eligibleForCommission = closed && docusignSigned;

        // Recalculate closer commission. Honor the in-house 9% override.
        const effectivePaymentType = currentDeal.paymentType; // payment type isn't editable post-create
        const closerRate = await getCommissionRate(currentDeal.closerId, year, month);
        const fallbackRate = closerRate ? parseFloat(closerRate.rate) : 0.10;
        const closerRateValue = effectiveCloserRate(effectivePaymentType, fallbackRate);
        const closerCommission = eligibleForCommission ? calculateCloserCommission(totalCash, closerRateValue) : 0;

        // Recalculate setter commission honoring per-setter cap and per-setter
        // rate (Kresha 3%, Jake 2%). Setters never take the in-house haircut.
        let setterCashCommission = 0;
        if (eligibleForCommission && setterId) {
          const setterCap = await getSetterCap(setterId);
          const setterRate = await getSetterRate(setterId);
          setterCashCommission = applySetterCap(totalCash, setterCap) * setterRate;
        }

        const updateData: Record<string, unknown> = {
          closerCommission: closerCommission.toFixed(2),
          setterCashCommission: setterCashCommission.toFixed(2),
          setterShowCommission: "0",
          setterId: setterId,
        };

        if (updates.clientName !== undefined) updateData.clientName = updates.clientName;
        if (updates.dealDate !== undefined) updateData.dealDate = updates.dealDate;

        if (updates.showed !== undefined) updateData.showed = updates.showed;
        if (updates.prepared !== undefined) updateData.prepared = updates.prepared;
        if (updates.offered !== undefined) updateData.offered = updates.offered;
        if (updates.canceled !== undefined) updateData.canceled = updates.canceled;
        if (updates.closed !== undefined) updateData.closed = updates.closed;
        if (updates.isNewClient !== undefined) updateData.isNewClient = updates.isNewClient;
        if (updates.fullyPaid !== undefined) updateData.fullyPaid = updates.fullyPaid;
        if (updates.totalDealAmount !== undefined) updateData.totalDealAmount = updates.totalDealAmount.toFixed(2);
        if (updates.newCashCollected !== undefined) updateData.newCashCollected = updates.newCashCollected.toFixed(2);
        if (updates.existingCashCollected !== undefined) updateData.existingCashCollected = updates.existingCashCollected.toFixed(2);
        if (updates.bnplFee !== undefined) updateData.bnplFee = updates.bnplFee.toFixed(2);
        if (updates.downPayment !== undefined) updateData.downPayment = updates.downPayment.toFixed(2);
        if (updates.monthlyAmount !== undefined) updateData.monthlyAmount = updates.monthlyAmount.toFixed(2);
        if (updates.notes !== undefined) updateData.notes = updates.notes || null;
        if (updates.docusignSigned !== undefined) updateData.docusignSigned = updates.docusignSigned;

        const updatedDeal = await updateDeal(id, updateData as any);
        
        return updatedDeal;
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const success = await deleteDeal(input.id);
        if (!success) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Deal not found' });
        }
        return { success: true };
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const deal = await getDealById(input.id);
        if (!deal) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Deal not found' });
        }
        return deal;
      }),

    getByMonth: protectedProcedure
      .input(z.object({ year: z.number(), month: z.number().min(1).max(12) }))
      .query(async ({ input }) => {
        return getDealsByMonth(input.year, input.month);
      }),

    getByCloser: protectedProcedure
      .input(z.object({ 
        closerId: z.number(),
        year: z.number(), 
        month: z.number().min(1).max(12) 
      }))
      .query(async ({ input }) => {
        return getDealsByCloser(input.closerId, input.year, input.month);
      }),


    getAll: protectedProcedure.query(async () => {
      return getAllDeals();
    }),

    // Get payment plan entries due for a specific month
    getPaymentPlans: protectedProcedure
      .input(z.object({ year: z.number(), month: z.number().min(1).max(12) }))
      .query(async ({ input }) => {
        return getPaymentPlansByMonth(input.year, input.month);
      }),

    // Get pending payment plan entries with closer info for the monthly view
    getPendingPaymentPlans: protectedProcedure
      .input(z.object({ 
        year: z.number(), 
        month: z.number().min(1).max(12),
        closerId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        const entries = await getPendingPaymentPlanEntries(input.year, input.month);
        
        // Filter by closer if specified
        let filtered = entries;
        if (input.closerId) {
          filtered = entries.filter(e => e.closerId === input.closerId);
        }
        
        // Enrich with closer names
        const enriched = await Promise.all(filtered.map(async (entry) => {
          const closer = await getTeamMemberById(entry.closerId);
          return {
            ...entry,
            closerName: closer?.name || "Unknown",
          };
        }));
        
        return enriched;
      }),

    // Mark a payment plan payment as collected with confirmation
    collectPaymentPlanPayment: protectedProcedure
      .input(z.object({ 
        dealId: z.number(),
        amountCollected: z.number(),
      }))
      .mutation(async ({ input }) => {
        // Get the deal to find commission rates
        const deal = await getDealById(input.dealId);
        if (!deal) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Deal not found' });
        }
        
        const { year, month } = parseYearMonth(deal.dealDate);

        // Get commission rate — in-house plans always pay 9% per the
        // fee-offset rule; otherwise use the closer's time-based rate.
        const closerRate = await getCommissionRate(deal.closerId, year, month);
        const fallbackRate = closerRate ? parseFloat(closerRate.rate) : 0.10;
        const closerRateValue = effectiveCloserRate(deal.paymentType, fallbackRate);

        return collectPaymentPlanPayment(input.dealId, input.amountCollected, closerRateValue, 0);
      }),

    // Legacy collect payment (kept for backward compatibility)
    collectPayment: protectedProcedure
      .input(z.object({ dealId: z.number() }))
      .mutation(async ({ input }) => {
        const deal = await getDealById(input.dealId);
        if (!deal) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Deal not found' });
        }

        const amountCollected = parseFloat(deal.monthlyAmount || "0");
        const { year, month } = parseYearMonth(deal.dealDate);

        const closerRate = await getCommissionRate(deal.closerId, year, month);
        const fallbackRate = closerRate ? parseFloat(closerRate.rate) : 0.10;
        const closerRateValue = effectiveCloserRate(deal.paymentType, fallbackRate);

        return collectPaymentPlanPayment(input.dealId, amountCollected, closerRateValue, 0);
      }),
  }),

  // Payroll management (for Ariana)
  payroll: router({
    getPayPeriods: protectedProcedure
      .input(z.object({ year: z.number(), month: z.number().min(1).max(12) }))
      .query(async ({ input }) => {
        return getPayPeriodsByMonth(input.year, input.month);
      }),

    getOrCreatePeriod: protectedProcedure
      .input(z.object({ 
        year: z.number(), 
        month: z.number().min(1).max(12),
        periodNumber: z.union([z.literal(1), z.literal(2)])
      }))
      .mutation(async ({ input }) => {
        return getOrCreatePayPeriod(input.year, input.month, input.periodNumber);
      }),

    getEntriesByPeriod: protectedProcedure
      .input(z.object({ payPeriodId: z.number() }))
      .query(async ({ input }) => {
        return getPayrollEntriesByPeriod(input.payPeriodId);
      }),

    getEntriesByMember: protectedProcedure
      .input(z.object({ 
        memberId: z.number(),
        year: z.number(), 
        month: z.number().min(1).max(12) 
      }))
      .query(async ({ input }) => {
        return getPayrollEntriesByMember(input.memberId, input.year, input.month);
      }),

     createEntry: payrollProcedure
      .input(z.object({
        memberId: z.number(),
        payPeriodId: z.number(),
        amountOwed: z.number(),
      }))
      .mutation(async ({ input }) => {
        return createPayrollEntry({
          memberId: input.memberId,
          payPeriodId: input.payPeriodId,
          amountOwed: input.amountOwed.toFixed(2),
        });
      }),
    markPaid: payrollProcedure
      .input(z.object({
        entryId: z.number(),
        amountPaid: z.number(),
        paidDate: z.string(),
        memberId: z.number(),
        breakdown: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await markPayrollPaid(
          input.entryId,
          ctx.user.id,
          input.paidDate,
          input.amountPaid
        );
        
        // Send payment notification to team member
        const breakdown = input.breakdown || `Payment of $${input.amountPaid.toFixed(2)} has been processed for ${input.paidDate}.`;
        await notifyMemberOfPayment(
          input.memberId,
          input.amountPaid,
          input.entryId,
          breakdown
        );
        
        return result;
      }),
  }),

  // Adjustments (bonuses/deductions) management
  adjustments: router({
    create: payrollProcedure
      .input(z.object({
        memberId: z.number(),
        amount: z.number(),
        type: z.enum(["bonus", "deduction"]),
        reason: z.string().min(1, "Reason is required"),
        month: z.number().min(1).max(12),
        year: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        const adjustment = await createAdjustment({
          memberId: input.memberId,
          amount: input.amount.toFixed(2),
          type: input.type,
          reason: input.reason,
          month: input.month,
          year: input.year,
          createdBy: ctx.user.id,
        });
        
        // Send notification to team member
        if (input.type === "bonus") {
          await notifyMemberOfBonus(
            input.memberId,
            input.amount,
            input.reason,
            adjustment.id
          );
        } else {
          await notifyMemberOfDeduction(
            input.memberId,
            input.amount,
            input.reason,
            adjustment.id
          );
        }
        
        return adjustment;
      }),

    getByMember: protectedProcedure
      .input(z.object({
        memberId: z.number(),
        year: z.number(),
        month: z.number().min(1).max(12),
      }))
      .query(async ({ input }) => {
        return getAdjustmentsByMember(input.memberId, input.year, input.month);
      }),

    getByMonth: protectedProcedure
      .input(z.object({
        year: z.number(),
        month: z.number().min(1).max(12),
      }))
      .query(async ({ input }) => {
        return getAdjustmentsByMonth(input.year, input.month);
      }),

    delete: payrollProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const success = await deleteAdjustment(input.id);
        if (!success) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Adjustment not found' });
        }
        return { success: true };
      }),
  }),

  // User-Team linking for role-based access
  userTeam: router({
    link: adminProcedure
      .input(z.object({
        userId: z.number(),
        teamMemberId: z.number(),
      }))
      .mutation(async ({ input }) => {
        return linkUserToTeamMember(input.userId, input.teamMemberId);
      }),

    getMyTeamMember: protectedProcedure.query(async ({ ctx }) => {
      return getUserTeamLink(ctx.user.id);
    }),

    unlink: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input }) => {
        const success = await removeUserTeamLink(input.userId);
        return { success };
      }),
  }),

  // Statistics and leaderboards
  stats: router({
    getMonthly: protectedProcedure
      .input(z.object({ year: z.number(), month: z.number().min(1).max(12) }))
      .query(async ({ input }) => {
        return getMonthlyStats(input.year, input.month);
      }),

    getCloserStats: protectedProcedure
      .input(z.object({ 
        closerId: z.number(),
        year: z.number(), 
        month: z.number().min(1).max(12) 
      }))
      .query(async ({ input }) => {
        return getCloserStats(input.closerId, input.year, input.month);
      }),


    getCloserLeaderboard: protectedProcedure
      .input(z.object({ year: z.number(), month: z.number().min(1).max(12) }))
      .query(async ({ input }) => {
        return getCloserLeaderboard(input.year, input.month);
      }),


    getAvailableMonths: protectedProcedure.query(async () => {
      return getAvailableMonths();
    }),
  }),

  // Payees (coaches, W2 employees, vendors)
  payees: router({
    create: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        type: z.enum(["coach", "on_demand_coach", "w2", "vendor", "closer"]),
        description: z.string().optional(),
        paymentAmount: z.number(),
        paymentFrequency: z.enum(["biweekly", "monthly", "autopay"]),
        isAutopay: z.boolean().default(false),
      }))
      .mutation(async ({ input }) => {
        return createPayee({
          name: input.name,
          type: input.type,
          description: input.description || null,
          paymentAmount: input.paymentAmount.toFixed(2),
          paymentFrequency: input.paymentFrequency,
          isAutopay: input.isAutopay,
        });
      }),

    getAll: protectedProcedure.query(async () => {
      return getActivePayees();
    }),

    getByType: protectedProcedure
      .input(z.object({ type: z.enum(["coach", "w2", "vendor"]) }))
      .query(async ({ input }) => {
        return getPayeesByType(input.type);
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        paymentAmount: z.number().optional(),
        paymentFrequency: z.enum(["biweekly", "monthly", "autopay"]).optional(),
        isAutopay: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        const updateData: Record<string, unknown> = {};
        if (updates.name) updateData.name = updates.name;
        if (updates.description) updateData.description = updates.description;
        if (updates.paymentAmount) updateData.paymentAmount = updates.paymentAmount.toFixed(2);
        if (updates.paymentFrequency) updateData.paymentFrequency = updates.paymentFrequency;
        if (updates.isAutopay !== undefined) updateData.isAutopay = updates.isAutopay;
        return updatePayee(id, updateData as any);
      }),

    deactivate: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deactivatePayee(input.id);
        return { success: true };
      }),
  }),

  // Payee payments
  payeePayments: router({
    getByMonth: protectedProcedure
      .input(z.object({ year: z.number(), month: z.number().min(1).max(12) }))
      .query(async ({ input }) => {
        return getPayeePaymentsByMonth(input.month, input.year);
      }),

    markPaid: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        return markPayeePaymentPaid(input.id, ctx.user.id);
      }),

    generate: adminProcedure
      .input(z.object({ year: z.number(), month: z.number().min(1).max(12) }))
      .mutation(async ({ input }) => {
        return generatePayeePaymentsForMonth(input.month, input.year);
      }),

    getSummary: protectedProcedure
      .input(z.object({ year: z.number(), month: z.number().min(1).max(12) }))
      .query(async ({ input }) => {
        return getPayrollSummaryForMonth(input.month, input.year);
      }),
  }),

  // Notifications
  notifications: router({
    getAll: protectedProcedure
      .input(z.object({ memberId: z.number(), limit: z.number().default(50) }))
      .query(async ({ input }) => {
        return getNotificationsByMember(input.memberId, input.limit);
      }),

    getUnreadCount: protectedProcedure
      .input(z.object({ memberId: z.number() }))
      .query(async ({ input }) => {
        return getUnreadNotificationCount(input.memberId);
      }),

    markRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return markNotificationRead(input.id);
      }),

    markAllRead: protectedProcedure
      .input(z.object({ memberId: z.number() }))
      .mutation(async ({ input }) => {
        return markAllNotificationsRead(input.memberId);
      }),
  }),

  // Payment plan management
  paymentPlans: router({
    // Create payment plan entries for a deal
    createEntries: protectedProcedure
      .input(z.object({
        parentDealId: z.number(),
        totalMonths: z.number().min(1),
        monthlyAmount: z.number().min(0),
        startDate: z.string(),
      }))
      .mutation(async ({ input }) => {
        return createPaymentPlanEntries(
          input.parentDealId,
          input.totalMonths,
          input.monthlyAmount,
          input.startDate
        );
      }),

    // Collect a payment plan payment
    collectPayment: protectedProcedure
      .input(z.object({
        dealId: z.number(),
        amountCollected: z.number(),
        closerRate: z.number(),
        setterRate: z.number(),
      }))
      .mutation(async ({ input }) => {
        return collectPaymentPlanPayment(
          input.dealId,
          input.amountCollected,
          input.closerRate,
          input.setterRate
        );
      }),

    // Get pending payment plan entries for a month
    getPending: protectedProcedure
      .input(z.object({ year: z.number(), month: z.number().min(1).max(12) }))
      .query(async ({ input }) => {
        return getPendingPaymentPlanEntries(input.year, input.month);
      }),

    // Cancel remaining payments (client stopped paying)
    cancelRemaining: protectedProcedure
      .input(z.object({ parentDealId: z.number() }))
      .mutation(async ({ input }) => {
        const cancelled = await cancelPaymentPlanEntries(input.parentDealId);
        return { cancelled };
      }),

    // Mark as paid early
    markPaidEarly: protectedProcedure
      .input(z.object({ parentDealId: z.number() }))
      .mutation(async ({ input }) => {
        await markPaymentPlanPaidEarly(input.parentDealId);
        return { success: true };
      }),

    // Get payment plan progress
    getProgress: protectedProcedure
      .input(z.object({ parentDealId: z.number() }))
      .query(async ({ input }) => {
        return getPaymentPlanProgress(input.parentDealId);
      }),

    // Toggle autopay for a payee
    toggleAutopay: adminProcedure
      .input(z.object({ payeeId: z.number() }))
      .mutation(async ({ input }) => {
        return togglePayeeAutopay(input.payeeId);
      }),
  }),

  // Coaching Sessions (on-demand coach)
  coachingSessions: router({
    create: protectedProcedure
      .input(z.object({
        coachPayeeId: z.number(),
        sessionDate: z.string(),
        clientName: z.string().min(1),
        minutes: z.number().min(1),
        tradingLog: z.enum(["yes", "no", "too_new"]),
        fuSession: z.boolean(),
        fuAssignments: z.string().optional(),
        notes: z.string().optional(),
        recordingLink: z.string().optional(),
        isNoShow: z.boolean().default(false),
        month: z.number().min(1).max(12),
        year: z.number(),
      }))
      .mutation(async ({ input }) => {
        // Recording link is optional - no penalty for not having one
        return createCoachingSession({
          coachPayeeId: input.coachPayeeId,
          sessionDate: input.sessionDate,
          clientName: input.clientName,
          minutes: input.minutes,
          tradingLog: input.tradingLog,
          fuSession: input.fuSession,
          fuAssignments: input.fuAssignments || null,
          notes: input.notes || null,
          recordingLink: input.recordingLink || null,
          isNoShow: input.isNoShow,
          month: input.month,
          year: input.year,
        });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        clientName: z.string().optional(),
        minutes: z.number().min(1).optional(),
        tradingLog: z.enum(["yes", "no", "too_new"]).optional(),
        fuSession: z.boolean().optional(),
        fuAssignments: z.string().optional(),
        notes: z.string().optional(),
        recordingLink: z.string().optional(),
        isNoShow: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        return updateCoachingSession(id, updates as any);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteCoachingSession(input.id);
        return { success: true };
      }),

    getByMonth: protectedProcedure
      .input(z.object({
        coachPayeeId: z.number(),
        year: z.number(),
        month: z.number().min(1).max(12),
      }))
      .query(async ({ input }) => {
        return getCoachingSessionsByMonth(input.coachPayeeId, input.year, input.month);
      }),

    // For coaches - auto-resolve their sessions by looking up their payee.
    getMyMonth: protectedProcedure
      .input(z.object({
        year: z.number(),
        month: z.number().min(1).max(12),
      }))
      .query(async ({ input, ctx }) => {
        const payee = await getPayeeByUserId(ctx.user!.id);
        if (!payee) return [];
        return getCoachingSessionsByMonth(payee.id, input.year, input.month);
      }),

    // Get the coach's payee type (salaried vs on-demand)
    getMyCoachType: protectedProcedure
      .query(async ({ ctx }) => {
        const userId = ctx.user!.id;
        // Find the payee linked to this user
        const payee = await getPayeeByUserId(userId);
        if (payee) {
          return { type: payee.type as string, name: payee.name as string };
        }
        // Default to coach (salaried) if no payee found
        return { type: 'coach', name: ctx.user!.name };
      }),

    createMy: protectedProcedure
      .input(z.object({
        sessionDate: z.string(),
        clientName: z.string().min(1),
        minutes: z.number().min(0),
        tradingLog: z.enum(["yes", "no", "too_new"]).optional(),
        fuSession: z.boolean().optional(),
        fuAssignments: z.string().optional(),
        notes: z.string().optional(),
        recordingLink: z.string().optional(),
        isNoShow: z.boolean().default(false),
      }))
      .mutation(async ({ input, ctx }) => {
        // Resolve the coach's payee row. Without it we can't attribute the
        // session — and pay calculation depends on the payee's type.
        const payee = await getPayeeByUserId(ctx.user!.id);
        if (!payee) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Your coach account isn't linked to a payee. Ask admin to set this up in Settings → Payees.",
          });
        }
        const { year, month } = parseYearMonth(input.sessionDate);
        return createCoachingSession({
          coachPayeeId: payee.id,
          sessionDate: input.sessionDate,
          clientName: input.clientName,
          minutes: input.minutes || 0,
          tradingLog: input.tradingLog || 'yes',
          fuSession: input.fuSession ?? false,
          fuAssignments: input.fuAssignments || null,
          notes: input.notes || null,
          recordingLink: input.recordingLink || null,
          isNoShow: input.isNoShow,
          month,
          year,
        });
      }),

    getAllByMonth: protectedProcedure
      .input(z.object({
        year: z.number(),
        month: z.number().min(1).max(12),
      }))
      .query(async ({ input }) => {
        return getAllCoachingSessionsByMonth(input.year, input.month);
      }),

    getSummary: protectedProcedure
      .input(z.object({
        coachPayeeId: z.number(),
        year: z.number(),
        month: z.number().min(1).max(12),
      }))
      .query(async ({ input }) => {
        return getCoachingSessionSummary(input.coachPayeeId, input.year, input.month);
      }),
  }),

  // Dashboard - Enhanced views
  dashboard: router({
    companyPerformance: protectedProcedure
      .input(z.object({ year: z.number(), month: z.number().min(1).max(12) }))
      .query(async ({ input }) => {
        return getCompanyPerformance(input.year, input.month);
      }),

    salesBreakdown: protectedProcedure
      .input(z.object({ year: z.number(), month: z.number().min(1).max(12) }))
      .query(async ({ input }) => {
        return getSalesTeamBreakdown(input.year, input.month);
      }),

    payrollOverview: protectedProcedure
      .input(z.object({ year: z.number(), month: z.number().min(1).max(12) }))
      .query(async ({ input }) => {
        return getPayrollOverview(input.year, input.month);
      }),
  }),

  // Marketing Costs
  marketingCosts: router({
    getByMonth: protectedProcedure
      .input(z.object({ year: z.number(), month: z.number().min(1).max(12) }))
      .query(async ({ input }) => {
        return getMarketingCostsByMonth(input.year, input.month);
      }),

    create: adminProcedure
      .input(z.object({
        month: z.number().min(1).max(12),
        year: z.number(),
        platform: z.string().min(1),
        amount: z.number().min(0),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return createMarketingCost({
          month: input.month,
          year: input.year,
          platform: input.platform,
          amount: input.amount.toFixed(2),
          notes: input.notes || null,
          createdBy: ctx.user.id,
        });
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        amount: z.number().min(0).optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        const data: any = {};
        if (updates.amount !== undefined) data.amount = updates.amount.toFixed(2);
        if (updates.notes !== undefined) data.notes = updates.notes;
        return updateMarketingCost(id, data);
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteMarketingCost(input.id);
        return { success: true };
      }),
  }),


  // ==================== BOOKED CALLS (setter workflow) ====================
  bookedCalls: router({
    // Setter creates a booking. Admin can also create on her behalf.
    create: protectedProcedure
      .input(z.object({
        clientFirstName: z.string().min(1),
        clientLastName: z.string().min(1),
        phoneNumber: z.string().min(7),
        closerId: z.number().int().positive(),
        bookedDate: z.string().optional(),     // defaults to today
        notes: z.string().optional(),
        setterId: z.number().int().positive().optional(), // admin override
      }))
      .mutation(async ({ input, ctx }) => {
        // Resolve setterId. Setters auto-attribute to themselves; admin can pass any.
        let setterId = input.setterId;
        if (!setterId) {
          const link = await getUserTeamLink(ctx.user.id);
          if (!link.teamMember || link.teamMember.role !== "setter") {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Only setters can book calls without specifying a setterId.",
            });
          }
          setterId = link.teamMember.id;
        } else if (ctx.user.role !== "admin") {
          // Non-admins can only book under their own setter id
          const link = await getUserTeamLink(ctx.user.id);
          if (link.teamMember?.id !== setterId) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Cannot book under a different setter.",
            });
          }
        }

        const today = new Date().toISOString().slice(0, 10);
        return createBookedCall({
          setterId,
          closerId: input.closerId,
          clientFirstName: input.clientFirstName,
          clientLastName: input.clientLastName,
          phoneNumber: input.phoneNumber,
          bookedDate: input.bookedDate ?? today,
          notes: input.notes ?? null,
        });
      }),

    // Setter views her own bookings. Admin can pass setterId.
    listMine: protectedProcedure
      .input(z.object({ setterId: z.number().optional() }).optional())
      .query(async ({ input, ctx }) => {
        let setterId = input?.setterId;
        if (!setterId) {
          const link = await getUserTeamLink(ctx.user.id);
          if (!link.teamMember) return [];
          setterId = link.teamMember.id;
        }
        return getBookedCallsBySetter(setterId);
      }),

    // Closer views bookings assigned to them. Admin can pass closerId.
    listAssignedToMe: protectedProcedure
      .input(z.object({ closerId: z.number().optional() }).optional())
      .query(async ({ input, ctx }) => {
        let closerId = input?.closerId;
        if (!closerId) {
          const link = await getUserTeamLink(ctx.user.id);
          if (!link.teamMember) return [];
          closerId = link.teamMember.id;
        }
        return getBookedCallsByCloser(closerId);
      }),

    listAll: adminProcedure.query(async () => {
      return getAllBookedCalls();
    }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        clientFirstName: z.string().min(1).optional(),
        clientLastName: z.string().min(1).optional(),
        phoneNumber: z.string().min(7).optional(),
        closerId: z.number().int().positive().optional(),
        notes: z.string().optional(),
        dealId: z.number().int().positive().nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const existing = await getBookedCallById(input.id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found." });
        }
        // Setters can edit their own bookings; admins can edit any.
        // Closers can ONLY update `dealId` on a booking assigned to them
        // (the link step after creating a deal from that booking).
        if (ctx.user.role !== "admin") {
          const link = await getUserTeamLink(ctx.user.id);
          const myTeamId = link.teamMember?.id;
          const isAssignedSetter = myTeamId === existing.setterId;
          const isAssignedCloser = myTeamId === existing.closerId;
          if (isAssignedCloser && !isAssignedSetter) {
            // Closer can only touch dealId — anything else and they're
            // editing the setter's data.
            const otherKeys = Object.keys(input).filter(
              k => k !== "id" && k !== "dealId" && (input as Record<string, unknown>)[k] !== undefined,
            );
            if (otherKeys.length > 0) {
              throw new TRPCError({
                code: "FORBIDDEN",
                message: "Closers can only link a booking to a deal — not edit setter fields.",
              });
            }
          } else if (!isAssignedSetter) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Cannot edit another setter's booking.",
            });
          }
        }
        const { id, ...patch } = input;
        return updateBookedCall(id, patch);
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const ok = await deleteBookedCall(input.id);
        if (!ok) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found." });
        return { success: true };
      }),
  }),

  // ==================== SALES TRACKER (spreadsheet-style metrics view) ====================
  salesTracker: router({
    /**
     * 12 monthly rows for a closer. Quarter rollups are computed client-side
     * (months 1-3, 4-6, 7-9, 10-12) since they're trivial sums.
     */
    monthly: protectedProcedure
      .input(z.object({
        closerId: z.number().int().positive(),
        year: z.number().int().min(2020).max(2100),
      }))
      .query(async ({ input, ctx }) => {
        // Closers can only request their own data; admin/payroll can request anyone's.
        if (ctx.user.role !== "admin" && ctx.user.role !== "payroll") {
          const link = await getUserTeamLink(ctx.user.id);
          if (link.teamMember?.id !== input.closerId) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Cannot view another closer's sales tracker.",
            });
          }
        }
        return getSalesMonthlyByCloser(input.closerId, input.year);
      }),

    /**
     * Daily breakdown for the drill-down view (click a month → see days).
     */
    daily: protectedProcedure
      .input(z.object({
        closerId: z.number().int().positive(),
        year: z.number().int().min(2020).max(2100),
        month: z.number().int().min(1).max(12),
      }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "payroll") {
          const link = await getUserTeamLink(ctx.user.id);
          if (link.teamMember?.id !== input.closerId) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Cannot view another closer's sales tracker.",
            });
          }
        }
        return getSalesDailyByCloser(input.closerId, input.year, input.month);
      }),
  }),

  // ==================== VSL CALL PREPS (Jake's discovery notes) ====================
  // The OCE Setter Script V1 specifies that Jake records: motivation, trading
  // experience, day-to-day, coachability, specific questions — plus red flags
  // and stock-predator delivery confirmation. These routes mirror that.
  vslPreps: router({
    create: protectedProcedure
      .input(z.object({
        clientFirstName: z.string().min(1),
        clientLastName: z.string().min(1),
        phoneNumber: z.string().min(7),
        email: z.string().email().optional().or(z.literal("")),
        closerId: z.number().int().positive(),
        vslBookedAt: z.string().optional(),       // ISO datetime, optional
        vslWatched: z.boolean().default(false),
        q1Motivation: z.string().optional(),
        q2TradingExperience: z.string().optional(),
        q3DayToDay: z.string().optional(),
        q4Coachability: z.string().optional(),
        q5SpecificQuestions: z.string().optional(),
        stockPredatorDelivered: z.boolean().default(false),
        redFlags: z.string().optional(),
        notes: z.string().optional(),
        setterId: z.number().int().positive().optional(), // admin override
      }))
      .mutation(async ({ input, ctx }) => {
        let setterId = input.setterId;
        if (!setterId) {
          const link = await getUserTeamLink(ctx.user.id);
          if (!link.teamMember || link.teamMember.role !== "setter") {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Only setters can create a VSL prep without specifying a setterId.",
            });
          }
          setterId = link.teamMember.id;
        } else if (ctx.user.role !== "admin") {
          const link = await getUserTeamLink(ctx.user.id);
          if (link.teamMember?.id !== setterId) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Cannot file a prep under a different setter.",
            });
          }
        }

        return createVslCallPrep({
          setterId,
          closerId: input.closerId,
          clientFirstName: input.clientFirstName,
          clientLastName: input.clientLastName,
          phoneNumber: input.phoneNumber,
          email: input.email || null,
          vslBookedAt: input.vslBookedAt ? new Date(input.vslBookedAt) : null,
          vslWatched: input.vslWatched,
          q1Motivation: input.q1Motivation ?? null,
          q2TradingExperience: input.q2TradingExperience ?? null,
          q3DayToDay: input.q3DayToDay ?? null,
          q4Coachability: input.q4Coachability ?? null,
          q5SpecificQuestions: input.q5SpecificQuestions ?? null,
          stockPredatorDelivered: input.stockPredatorDelivered,
          redFlags: input.redFlags ?? null,
          notes: input.notes ?? null,
        });
      }),

    // Setter views her/his own preps. Admin can pass setterId.
    listMine: protectedProcedure
      .input(z.object({ setterId: z.number().optional() }).optional())
      .query(async ({ input, ctx }) => {
        let setterId = input?.setterId;
        if (!setterId) {
          const link = await getUserTeamLink(ctx.user.id);
          if (!link.teamMember) return [];
          setterId = link.teamMember.id;
        }
        return getVslCallPrepsBySetter(setterId);
      }),

    // Closer views preps Jake filed for them.
    listAssignedToMe: protectedProcedure
      .input(z.object({ closerId: z.number().optional() }).optional())
      .query(async ({ input, ctx }) => {
        let closerId = input?.closerId;
        if (!closerId) {
          const link = await getUserTeamLink(ctx.user.id);
          if (!link.teamMember) return [];
          closerId = link.teamMember.id;
        }
        return getVslCallPrepsByCloser(closerId);
      }),

    listAll: adminProcedure.query(async () => {
      return getAllVslCallPreps();
    }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        clientFirstName: z.string().min(1).optional(),
        clientLastName: z.string().min(1).optional(),
        phoneNumber: z.string().min(7).optional(),
        email: z.string().email().nullable().optional().or(z.literal("")),
        closerId: z.number().int().positive().optional(),
        vslBookedAt: z.string().nullable().optional(),
        vslWatched: z.boolean().optional(),
        q1Motivation: z.string().optional(),
        q2TradingExperience: z.string().optional(),
        q3DayToDay: z.string().optional(),
        q4Coachability: z.string().optional(),
        q5SpecificQuestions: z.string().optional(),
        stockPredatorDelivered: z.boolean().optional(),
        redFlags: z.string().optional(),
        notes: z.string().optional(),
        reviewedByCloser: z.boolean().optional(),
        dealId: z.number().nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const existing = await getVslCallPrepById(input.id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "VSL prep not found." });
        }
        // Authorization: setter can edit own preps; closer can mark reviewed
        // on theirs; admin can edit anything.
        if (ctx.user.role !== "admin") {
          const link = await getUserTeamLink(ctx.user.id);
          const isOwnerSetter = link.teamMember?.id === existing.setterId;
          const isAssignedCloser = link.teamMember?.id === existing.closerId;
          if (!isOwnerSetter && !isAssignedCloser) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "You don't have access to this prep.",
            });
          }
          // Closers can ONLY toggle "reviewedByCloser" or set "dealId"
          // (the link step when they create a deal from this prep) — not
          // edit any of the setter's content.
          if (isAssignedCloser && !isOwnerSetter) {
            const allowed = ["reviewedByCloser", "dealId"];
            const tried = Object.keys(input).filter(k => k !== "id" && (input as any)[k] !== undefined);
            if (tried.some(k => !allowed.includes(k))) {
              throw new TRPCError({
                code: "FORBIDDEN",
                message: "Closers can only mark a prep as reviewed or link it to a deal.",
              });
            }
          }
        }
        const { id, vslBookedAt, ...rest } = input;
        const patch: any = { ...rest };
        if (vslBookedAt !== undefined) {
          patch.vslBookedAt = vslBookedAt ? new Date(vslBookedAt) : null;
        }
        return updateVslCallPrep(id, patch);
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const ok = await deleteVslCallPrep(input.id);
        if (!ok) throw new TRPCError({ code: "NOT_FOUND", message: "VSL prep not found." });
        return { success: true };
      }),
  }),

  // ==================== SETTER PAYOUTS (3% — per-setter cap) ====================
  // ─────────── Unified Client Profile ───────────
  // The /clients/:dealId page reads from here. Access is gated:
  //   - admin / payroll: any deal
  //   - closer:          their own deals only
  //   - setter:          deals attributed to them only
  //   - coach:           clients matching by name (loose match) — we restrict
  //                      access here too since coaches see this from their
  //                      session list.
  clients: router({
    getProfile: protectedProcedure
      .input(z.object({ dealId: z.number() }))
      .query(async ({ input, ctx }) => {
        const profile = await getClientProfile(input.dealId);
        if (!profile) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });
        }

        // Access policy: staff (admin, payroll, closer, setter, coach) ALL
        // see every client. The team needs to be on the same page about
        // each client across the funnel — setter who set the call, closer
        // who closed the deal, Ariana who onboarded, coach who's reviewing
        // trading log. The only redaction is for setters (closer commission
        // hidden — setters shouldn't see what the closer earns).
        //
        // Clients (logged in as themselves) only see their own profile via
        // clients.getMyProfile, not this endpoint.
        const role = ctx.user.role;
        if (role === "client") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Use getMyProfile." });
        }
        const redactCloserCommission = role === "setter";

        // Phase 3 — pull the program timeline + alert history. The timeline
        // is null until Ariana marks onboarded (clock not started yet). Alerts
        // are an empty array until the first cron run after T-21 hits.
        const timeline = profile.onboarding?.onboardedAt
          ? computeProgramTimeline(profile.onboarding.onboardedAt)
          : null;
        const extensionAlertsList = await getExtensionAlertsForDeal(input.dealId);

        // Single return shape — redaction happens in-place on a copy.
        return {
          ...profile,
          deal: redactCloserCommission
            ? { ...profile.deal, closerCommission: "0" }
            : profile.deal,
          timeline,
          extensionAlerts: extensionAlertsList,
        };
      }),

    // Directory of all clients in the system. Surfaces enough for staff
    // to find someone fast — name, date, closer, setter, coach, status.
    // Click any row → unified Client Profile.
    listAll: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role === "client") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Use getMyProfile." });
      }
      return getClientDirectory();
    }),

    // Ariana / admin creates a login for a client. Idempotent — re-running
    // with the same email + dealId returns the existing user. Clients don't
    // get a real password (they sign in via magic link); we set a random
    // unguessable hash so the row is valid but unusable for password login.
    createLogin: payrollProcedure
      .input(z.object({
        dealId: z.number(),
        email: z.string().email(),
        name: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        // Random 32-byte password the client never sees. Their auth path is
        // magic links — the password column just needs to be non-null/valid.
        const { randomBytes } = await import("node:crypto");
        const noisePassword = randomBytes(32).toString("base64url");
        const result = await createClientLogin({
          dealId: input.dealId,
          email: input.email,
          name: input.name,
          plainPassword: noisePassword,
          createdByUserId: ctx.user.id,
        });
        return {
          created: result.created,
          user: {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            role: result.user.role,
          },
        };
      }),

    /**
     * Send a magic-link sign-in email to the client of a deal. Used by
     * Ariana on the Client Profile page during onboarding to give the
     * client one-click access to their dashboard. Idempotent on reason
     * + dealId — clicking the button twice in a row will fire two emails
     * (each with a different valid token), so the client sees the latest.
     */
    sendSignInLink: payrollProcedure
      .input(z.object({ dealId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const profile = await getClientProfile(input.dealId);
        if (!profile?.clientUser) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Create the client login first.",
          });
        }
        const { token } = await createLoginToken({
          userId: profile.clientUser.id,
          reason: "client_invite",
          triggeredByUserId: ctx.user.id,
          ttlMs: 30 * 24 * 60 * 60 * 1000,  // 30 days for invites — Ariana sends, client clicks later
        });
        const appUrl = process.env.APP_URL || "http://localhost:3000";
        const link = `${appUrl}/login/magic?token=${token}`;
        const firstName = profile.clientUser.name?.split(" ")[0] ?? "there";
        const { sendEmail } = await import("./email");
        await sendEmail({
          to: {
            email: profile.clientUser.email,
            name: profile.clientUser.name ?? undefined,
          },
          subject: "Welcome — your Trader Foundation dashboard",
          text: [
            `Hi ${firstName},`,
            "",
            "Welcome to Trader Foundation! Your dashboard is ready — trading log, your assigned coach, and program timeline all in one place.",
            "",
            `Sign in here: ${link}`,
            "",
            "No password needed — this link signs you in. It works for 30 days; bookmark the dashboard once you're in.",
            "",
            "Any questions? Just reply to this email.",
            "",
            "— Ariana",
            "Trader Foundation Onboarding",
          ].join("\n"),
          html: `
<!DOCTYPE html>
<html>
<body style="margin:0; padding:24px; background:#0a0a0a; color:#cfcfcf; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <div style="max-width:520px; margin:0 auto; background:#161616; border:1px solid #2a2620; border-radius:12px; padding:32px;">
    <p style="color:#c7ab77; font-size:11px; text-transform:uppercase; letter-spacing:2px; margin:0 0 8px 0;">Trader Foundation</p>
    <h1 style="color:#c7ab77; font-size:24px; margin:0 0 16px 0;">Welcome to the family</h1>
    <p style="margin:0 0 16px 0; line-height:1.6;">Hi ${firstName},</p>
    <p style="margin:0 0 16px 0; line-height:1.6;">
      Your dashboard is ready — <strong style="color:#fff;">trading log</strong>,
      your assigned coach, and program timeline all in one place.
    </p>
    <a href="${link}" style="display:inline-block; background:#c7ab77; color:#0a0a0a; text-decoration:none; font-weight:600; padding:14px 28px; border-radius:8px; margin:8px 0 24px 0;">
      Open my dashboard →
    </a>
    <p style="margin:0 0 16px 0; line-height:1.6; font-size:13px; color:#a0a0a0;">
      No password needed — this link signs you in. It works for 30 days;
      bookmark the dashboard once you're in.
    </p>
    <p style="margin:24px 0 0 0; padding-top:16px; border-top:1px solid #2a2620; font-size:12px; color:#8a8a8a; line-height:1.6;">
      Any questions? Just reply to this email.<br/>
      — Ariana<br/>
      <em>Trader Foundation Onboarding</em>
    </p>
  </div>
</body>
</html>`.trim(),
          relatedDealId: input.dealId,
          relatedUserId: profile.clientUser.id,
          triggeredByUserId: ctx.user.id,
          replyTo: ctx.user.email,
        });
        return { ok: true };
      }),

    // Client fetches their own profile + trading-log-relevant context. Mirrors
    // getProfile but skips the auth check (a client always sees their own
    // deal) and never returns staff-private fields.
    //
    // Also returns ALL active coaches (with their photos + booking URLs) so
    // the dashboard can list "or book another coach" alongside the assigned
    // one. The assigned coach is the primary card; the rest are alternates.
    getMyProfile: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "client") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Client account required." });
      }
      const me = await getUserById(ctx.user.id);
      if (!me?.clientDealId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No deal linked to this account yet." });
      }
      const profile = await getClientProfile(me.clientDealId);
      if (!profile) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Client profile not found." });
      }
      const timeline = profile.onboarding?.onboardedAt
        ? computeProgramTimeline(profile.onboarding.onboardedAt)
        : null;

      // Pull all active coaches with the booking + photo fields (the
      // existing coachOptions only carries id+name).
      const db = await getDb();
      let allCoaches: Array<{
        id: number;
        name: string;
        bookingUrl: string | null;
        photoUrl: string | null;
      }> = [];
      if (db) {
        const { payees } = await import("../drizzle/schema");
        const { and: dAnd, eq: dEq, sql: dSql } = await import("drizzle-orm");
        // "Bookable" = active + has a bookingUrl. This sweeps up Erin
        // (typed `w2` in the payees table because she's salaried-W2 for
        // payroll, but she's still a bookable coach for clients).
        const rows = await db.select({
          id: payees.id,
          name: payees.name,
          bookingUrl: payees.bookingUrl,
          photoUrl: payees.photoUrl,
        }).from(payees).where(dAnd(
          dEq(payees.active, true),
          dSql`${payees.bookingUrl} IS NOT NULL`,
        ));
        allCoaches = rows;
      }

      // Strip everything sales/commission-related — clients never see this.
      const { closerCommission, setterCashCommission, setterShowCommission, ...safeDeal } = profile.deal;
      return {
        deal: safeDeal,
        onboarding: profile.onboarding,
        assignedCoach: profile.assignedCoach,
        allCoaches,
        coachingSessions: profile.coachingSessions,
        timeline,
      };
    }),
  }),

  // ─────────── Extensions (90-day renewal pipeline) ───────────
  extensions: router({
    // Closer's own upcoming clients (program ending soon). Ariana / admin
    // can override by passing closerTeamMemberId, or omit it to get all.
    listUpcoming: protectedProcedure
      .input(z.object({ closerTeamMemberId: z.number().optional() }).optional())
      .query(async ({ input, ctx }) => {
        const role = ctx.user.role;
        if (role === "admin" || role === "payroll") {
          return getUpcomingExtensions(
            input?.closerTeamMemberId ? { closerTeamMemberId: input.closerTeamMemberId } : {},
          );
        }
        if (role === "closer") {
          // Force-filter to the closer's own clients, regardless of input.
          const link = await getUserTeamLink(ctx.user.id);
          if (!link.teamMember) return [];
          return getUpcomingExtensions({ closerTeamMemberId: link.teamMember.id });
        }
        // Setters and coaches don't see this widget.
        return [];
      }),

    // Move a client through the renewal pipeline. Closers can update their
    // own clients; payroll/admin can update any.
    setStatus: protectedProcedure
      .input(z.object({
        dealId: z.number(),
        status: z.enum(["window_open", "outreach_started", "call_booked", "extended", "lapsed"]),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const role = ctx.user.role;
        if (role !== "admin" && role !== "payroll") {
          // Closer access: must own the deal
          const deal = await getDealById(input.dealId);
          if (!deal) throw new TRPCError({ code: "NOT_FOUND" });
          if (role === "closer") {
            const link = await getUserTeamLink(ctx.user.id);
            if (link.teamMember?.id !== deal.closerId) {
              throw new TRPCError({ code: "FORBIDDEN", message: "Not your client." });
            }
          } else {
            throw new TRPCError({ code: "FORBIDDEN" });
          }
        }
        return setExtensionStatus(input.dealId, input.status, ctx.user.id, input.notes);
      }),

    // Manual trigger — admin clicks "Run now" in the UI to fire any due
    // alerts immediately. Idempotent: running it twice in a row produces
    // zero new alerts on the second call.
    runRemindersNow: adminProcedure.mutation(async () => {
      return runExtensionReminders();
    }),
  }),

  // ─────────── Trading Log ───────────
  // One log per client (lifetime). Created by Ariana from the Client Profile;
  // the client edits their own; coach reviews read-only; admin/payroll see all.
  tradingLog: router({
    // Ariana / admin creates the log for a client. Idempotent — re-running
    // returns the existing log.
    create: payrollProcedure
      .input(z.object({
        dealId: z.number(),
        startingBalance: z.number().min(0).default(0),
        brokerNote: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Anchor: the client login linked to this deal.
        const existingByDeal = await getTradingLogByDealId(input.dealId);
        if (existingByDeal) return { log: existingByDeal, created: false };

        // Find the client user for this deal — must already exist.
        const deal = await getDealById(input.dealId);
        if (!deal) throw new TRPCError({ code: "NOT_FOUND", message: "Deal not found" });

        const profile = await getClientProfile(input.dealId);
        if (!profile?.clientUser) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Create the client login first — the trading log is bound to their account.",
          });
        }

        const log = await createTradingLog({
          clientUserId: profile.clientUser.id,
          dealId: input.dealId,
          startingBalance: input.startingBalance,
          brokerNote: input.brokerNote ?? null,
          createdById: ctx.user.id,
        });
        return { log, created: true };
      }),

    // Client fetches their own log + entries + stats. The client dashboard's
    // primary call.
    getMine: protectedProcedure
      .input(z.object({
        year: z.number().optional(),
        month: z.number().min(1).max(12).optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== "client") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Client account required." });
        }
        const log = await getTradingLogByClientUserId(ctx.user.id);
        if (!log) return { log: null, entries: [], stats: null };
        const entries = await getTradeEntriesForLog(log.id, input);
        const stats = await getTradingLogStats(log.id);
        return { log, entries, stats };
      }),

    // Coach / payroll / admin / closer view of a specific client's log.
    getForDeal: protectedProcedure
      .input(z.object({
        dealId: z.number(),
        year: z.number().optional(),
        month: z.number().min(1).max(12).optional(),
      }))
      .query(async ({ input, ctx }) => {
        // Staff all see every client's log (one-team principle). Clients see
        // only their own — they have getMine; this path requires verifying
        // they own this specific log.
        const role = ctx.user.role;
        if (role === "client") {
          const log = await getTradingLogByDealId(input.dealId);
          if (log?.clientUserId !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Not your log." });
          }
        }

        const log = await getTradingLogByDealId(input.dealId);
        if (!log) return { log: null, entries: [], stats: null };
        const entries = await getTradeEntriesForLog(log.id, {
          year: input.year, month: input.month,
        });
        const stats = await getTradingLogStats(log.id);
        return { log, entries, stats };
      }),

    // Coach's "all my clients' logs" view for the Coach Dashboard.
    listForMyCoach: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "coach") return [];
      const myPayee = await getPayeeByUserId(ctx.user.id);
      if (!myPayee) return [];
      return getTradingLogsForCoach(myPayee.id);
    }),

    // Add a trade row. Client owns their log; admin/payroll can also write.
    addEntry: protectedProcedure
      .input(z.object({
        tradingLogId: z.number(),
        ticker: z.string().min(1).max(16),
        strategy: z.enum(["bounce_profit", "ready_set_explode", "paycheck_collector"]),
        direction: z.enum(["directional_bullish", "directional_bearish"]),
        result: z.enum(["win", "loss"]).nullable().optional(),
        entryDate: z.string(),
        entryTime: z.string().optional(),
        exitDate: z.string().optional(),
        strikePrices: z.string().optional(),
        expirationDate: z.string().optional(),
        contractCount: z.number().int().min(1).default(1),
        askPrice: z.number().min(0),
        bidPrice: z.number().min(0),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await assertCanWriteToLog(ctx.user.id, ctx.user.role, input.tradingLogId);
        return addTradeEntry(input);
      }),

    updateEntry: protectedProcedure
      .input(z.object({
        entryId: z.number(),
        patch: z.object({
          ticker: z.string().min(1).max(16).optional(),
          strategy: z.enum(["bounce_profit", "ready_set_explode", "paycheck_collector"]).optional(),
          direction: z.enum(["directional_bullish", "directional_bearish"]).optional(),
          result: z.enum(["win", "loss"]).nullable().optional(),
          entryDate: z.string().optional(),
          entryTime: z.string().nullable().optional(),
          exitDate: z.string().nullable().optional(),
          strikePrices: z.string().nullable().optional(),
          expirationDate: z.string().nullable().optional(),
          contractCount: z.number().int().min(1).optional(),
          askPrice: z.number().min(0).optional(),
          bidPrice: z.number().min(0).optional(),
          notes: z.string().nullable().optional(),
        }),
      }))
      .mutation(async ({ input, ctx }) => {
        const entry = await getTradeEntry(input.entryId);
        if (!entry) throw new TRPCError({ code: "NOT_FOUND" });
        await assertCanWriteToLog(ctx.user.id, ctx.user.role, entry.tradingLogId);
        return updateTradeEntry(input.entryId, input.patch);
      }),

    deleteEntry: protectedProcedure
      .input(z.object({ entryId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const entry = await getTradeEntry(input.entryId);
        if (!entry) throw new TRPCError({ code: "NOT_FOUND" });
        await assertCanWriteToLog(ctx.user.id, ctx.user.role, entry.tradingLogId);
        return { ok: await deleteTradeEntry(input.entryId) };
      }),

    // Update the log itself (starting balance, broker note). Allowed for:
    //   - admin / payroll (any log)
    //   - the client who owns the log (their own only)
    // Coaches and closers are read-only on this.
    updateLog: protectedProcedure
      .input(z.object({
        tradingLogId: z.number(),
        startingBalance: z.number().min(0).optional(),
        brokerNote: z.string().nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const role = ctx.user.role;
        if (role !== "admin" && role !== "payroll") {
          if (role !== "client") {
            throw new TRPCError({ code: "FORBIDDEN", message: "Read-only role." });
          }
          const log = await getTradingLogById(input.tradingLogId);
          if (log?.clientUserId !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Not your log." });
          }
        }
        return updateTradingLog(input.tradingLogId, {
          startingBalance: input.startingBalance,
          brokerNote: input.brokerNote ?? undefined,
        });
      }),
  }),

  // ─────────── Onboarding (Ariana's queue) ───────────
  // Read access: any authenticated user (closers see their own clients on
  // the unified profile page). Mutations: payroll/admin only.
  onboarding: router({
    // The pending queue — every DocuSigned, closed deal that hasn't been
    // marked fully onboarded yet. Sorted oldest first so nothing rots.
    listPending: payrollProcedure.query(async () => {
      return getPendingOnboardings();
    }),

    // Last 30 days of completed onboardings — Ariana's "recent" tab.
    listRecent: payrollProcedure.query(async () => {
      return getRecentlyOnboarded();
    }),

    // Get the onboarding row for a specific deal. Returns null if Ariana
    // hasn't started it yet. Read-allowed for any authenticated user so the
    // unified Client Profile can show the checklist state to the closer.
    getByDealId: protectedProcedure
      .input(z.object({ dealId: z.number() }))
      .query(async ({ input }) => {
        return getDealOnboarding(input.dealId);
      }),

    // Patch any subset of the checklist. Auto-stamps the *At fields when
    // their boolean flips true (so we capture when each step happened).
    // Side-effect: if the coach assignment changes to a non-null value, fire
    // a one-time email to the coach (idempotent on dealId+coachPayeeId).
    update: payrollProcedure
      .input(z.object({
        dealId: z.number(),
        skoolAccessGranted: z.boolean().optional(),
        paymentVerified: z.boolean().optional(),
        paymentNote: z.string().optional(),
        introCallBooked: z.boolean().optional(),
        coachAssignedPayeeId: z.number().nullable().optional(),
        tradingLogAssigned: z.boolean().optional(),
        weeklyCheckInSent: z.boolean().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { dealId, ...patch } = input;

        // Auto-stamp timestamps when a flag flips true. We pull the current
        // row first so we only stamp on the rising edge — flipping back to
        // false won't clear the timestamp (kept for audit), but flipping
        // true→false→true won't double-stamp either.
        const current = await getDealOnboarding(dealId);
        const stamped: Record<string, unknown> = { ...patch };
        if (patch.skoolAccessGranted === true && !current?.skoolAccessGranted) {
          stamped.skoolAccessAt = new Date();
        }
        if (patch.paymentVerified === true && !current?.paymentVerified) {
          stamped.paymentVerifiedAt = new Date();
        }
        if (patch.introCallBooked === true && !current?.introCallBooked) {
          stamped.introCallBookedAt = new Date();
        }

        const updated = await upsertDealOnboarding(dealId, stamped);

        // Email the coach if a NEW coach was assigned (rising edge or change).
        const coachChanged =
          patch.coachAssignedPayeeId !== undefined &&
          patch.coachAssignedPayeeId !== null &&
          patch.coachAssignedPayeeId !== current?.coachAssignedPayeeId;
        if (coachChanged && patch.coachAssignedPayeeId) {
          // Fire-and-log; failures don't break the mutation.
          await notifyCoachOfAssignment({
            dealId,
            coachPayeeId: patch.coachAssignedPayeeId,
            triggeredByUserId: ctx.user.id,
            triggeredByName: ctx.user.name ?? undefined,
          });
        }

        return updated;
      }),

    // Mark the whole thing complete. Stamps onboardedAt + onboardedById.
    // This is the moment the 90-day program clock starts ticking (Phase 3).
    complete: payrollProcedure
      .input(z.object({ dealId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        return markDealOnboardingComplete(input.dealId, ctx.user.id);
      }),

    // Reopen a completed onboarding (un-stamp). Useful for "marked early
    // by mistake" or "client paused, restart later." Doesn't touch the
    // individual checkbox state.
    reopen: payrollProcedure
      .input(z.object({ dealId: z.number() }))
      .mutation(async ({ input }) => {
        return reopenDealOnboarding(input.dealId);
      }),
  }),

  setter: router({
    // Setter sees her own payouts. Admin/payroll can pass setterId.
    payouts: protectedProcedure
      .input(z.object({
        year: z.number(),
        month: z.number().min(1).max(12),
        setterId: z.number().optional(),
      }))
      .query(async ({ input, ctx }) => {
        let setterId = input.setterId;
        if (!setterId) {
          const link = await getUserTeamLink(ctx.user.id);
          if (!link.teamMember) {
            return { lines: [], totalCommission: 0, cap: null, rate: SETTER_RATE };
          }
          setterId = link.teamMember.id;
        } else if (ctx.user.role !== "admin" && ctx.user.role !== "payroll") {
          const link = await getUserTeamLink(ctx.user.id);
          if (link.teamMember?.id !== setterId) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Cannot view another setter's payouts." });
          }
        }
        // getSetterPayouts returns the per-setter cap + per-setter rate
        // (Kresha 3%, Jake 2%). UI reads `rate` for the % column header.
        return getSetterPayouts(setterId, input.year, input.month);
      }),

    // Returns the deal-level rows the setter is allowed to see (capped cash).
    // Used by the setter's "My Closed Deals" view; useful for explaining her pay.
    closedDealsForMonth: protectedProcedure
      .input(z.object({
        year: z.number(),
        month: z.number().min(1).max(12),
        setterId: z.number().optional(),
      }))
      .query(async ({ input, ctx }) => {
        let setterId = input.setterId;
        if (!setterId) {
          const link = await getUserTeamLink(ctx.user.id);
          if (!link.teamMember) return [];
          setterId = link.teamMember.id;
        }
        const cap = await getSetterCap(setterId);
        const rate = await getSetterRate(setterId);
        const deals = await getDealsBySetter(setterId, input.year, input.month);
        // Return only setter-safe fields. Cash is capped per the setter's
        // own cap (Kresha=$6K, Jake=uncapped) and rate (Kresha=3%, Jake=2%).
        return deals
          .filter(d => d.closed)
          .map(d => {
            const cash =
              parseFloat(d.newCashCollected || "0") +
              parseFloat(d.existingCashCollected || "0");
            const eligible = applySetterCap(cash, cap);
            return {
              dealId: d.id,
              dealDate: d.dealDate,
              closerId: d.closerId,
              cappedCashCollected: eligible,
              setterCommission: eligible * rate,
            };
          });
      }),
  }),
});

export type AppRouter = typeof appRouter;
