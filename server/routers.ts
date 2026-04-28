import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
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
  getDealsBySetter,
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
  createSubscription,
  getActiveSubscriptions,
  getAllSubscriptions,
  getSubscriptionsByCloser,
  cancelSubscription,
  reactivateSubscription,
  generateMonthlyVerifications,
  getVerificationsByMonth,
  verifySubscription,
  unverifySubscription,
  markSubscriptionCancelled,
  getSubscriptionCommissionsByCloser,
  getRandomSubscriptionsForAudit,
  getPayeeByUserId,
} from "./db";

// Admin-only procedure
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});

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
      }))
      .mutation(async ({ input }) => {
        // Get date parts for commission rate lookup
        const dealDate = new Date(input.dealDate);
        const year = dealDate.getFullYear();
        const month = dealDate.getMonth() + 1;
        
        // Calculate closer commission
        const closerRate = await getCommissionRate(input.closerId, year, month);
        const closerRateValue = closerRate ? parseFloat(closerRate.rate) : 0.10;
        const totalCash = input.newCashCollected + input.existingCashCollected;
        const closerCommission = input.closed ? calculateCloserCommission(totalCash, closerRateValue) : 0;

        // Setter commission: 3% of cash collected, capped at $6,000 cash per deal.
        // Only applied when this deal closed AND a setter is attributed.
        const setterCashCommission = (input.closed && input.setterId)
          ? Math.min(totalCash, SETTER_CAP) * SETTER_RATE
          : 0;

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

    // Update a deal
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
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        
        const currentDeal = await getDealById(id);
        if (!currentDeal) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Deal not found' });
        }
        
        // Determine final values
        const dealDate = updates.dealDate ?? currentDeal.dealDate;
        const date = new Date(dealDate);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        
        const showed = updates.showed ?? currentDeal.showed;
        const prepared = updates.prepared ?? currentDeal.prepared;
        const closed = updates.closed ?? currentDeal.closed;
        const newCash = updates.newCashCollected ?? parseFloat(currentDeal.newCashCollected || "0");
        const existingCash = updates.existingCashCollected ?? parseFloat(currentDeal.existingCashCollected || "0");
        const totalCash = newCash + existingCash;
        const setterId = updates.setterId !== undefined ? updates.setterId : currentDeal.setterId;
        // Recalculate closer commission
        const closerRate = await getCommissionRate(currentDeal.closerId, year, month);
        const closerRateValue = closerRate ? parseFloat(closerRate.rate) : 0.10;
        const closerCommission = closed ? calculateCloserCommission(totalCash, closerRateValue) : 0;

        // Recalculate setter commission with the $6K cap
        const setterCashCommission = (closed && setterId)
          ? Math.min(totalCash, SETTER_CAP) * SETTER_RATE
          : 0;

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
        if (updates.notes !== undefined) updateData.notes = updates.notes || null;
        
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
        
        const dealDate = new Date(deal.dealDate);
        const year = dealDate.getFullYear();
        const month = dealDate.getMonth() + 1;
        
        // Get commission rates
        const closerRate = await getCommissionRate(deal.closerId, year, month);
        const closerRateValue = closerRate ? parseFloat(closerRate.rate) : 0.10;
        
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
        const dealDate = new Date(deal.dealDate);
        const year = dealDate.getFullYear();
        const month = dealDate.getMonth() + 1;
        
        const closerRate = await getCommissionRate(deal.closerId, year, month);
        const closerRateValue = closerRate ? parseFloat(closerRate.rate) : 0.10;
        
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
        const now = new Date(input.sessionDate);
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
          month: now.getMonth() + 1,
          year: now.getFullYear(),
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

  // Subscriptions - monthly recurring with 25% closer commission
  subscriptions: router({
    create: protectedProcedure
      .input(z.object({
        clientName: z.string().min(1),
        monthlyAmount: z.number().min(0.01),
        closerId: z.number(),
        startDate: z.string(),
        startMonth: z.number().min(1).max(12),
        startYear: z.number(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return createSubscription({
          clientName: input.clientName,
          monthlyAmount: input.monthlyAmount.toFixed(2),
          closerId: input.closerId,
          startDate: input.startDate,
          startMonth: input.startMonth,
          startYear: input.startYear,
          notes: input.notes || null,
        });
      }),

    getAll: protectedProcedure.query(async () => {
      return getAllSubscriptions();
    }),

    getActive: protectedProcedure.query(async () => {
      return getActiveSubscriptions();
    }),

    getByCloser: protectedProcedure
      .input(z.object({ closerId: z.number() }))
      .query(async ({ input }) => {
        return getSubscriptionsByCloser(input.closerId);
      }),

    cancel: protectedProcedure
      .input(z.object({ id: z.number(), reason: z.string().optional() }))
      .mutation(async ({ input }) => {
        return cancelSubscription(input.id, input.reason);
      }),

    reactivate: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return reactivateSubscription(input.id);
      }),

    // Verification workflow
    generateVerifications: protectedProcedure
      .input(z.object({ year: z.number(), month: z.number().min(1).max(12) }))
      .mutation(async ({ input }) => {
        return generateMonthlyVerifications(input.year, input.month);
      }),

    getVerifications: protectedProcedure
      .input(z.object({ year: z.number(), month: z.number().min(1).max(12) }))
      .query(async ({ input }) => {
        // Generate if needed, then return
        await generateMonthlyVerifications(input.year, input.month);
        return getVerificationsByMonth(input.year, input.month);
      }),

    verify: protectedProcedure
      .input(z.object({ verificationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return verifySubscription(input.verificationId, ctx.user.id);
      }),

    unverify: protectedProcedure
      .input(z.object({ verificationId: z.number() }))
      .mutation(async ({ input }) => {
        return unverifySubscription(input.verificationId);
      }),

    markCancelled: protectedProcedure
      .input(z.object({ verificationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return markSubscriptionCancelled(input.verificationId, ctx.user.id);
      }),

    getCommissionsByCloser: protectedProcedure
      .input(z.object({ closerId: z.number(), year: z.number(), month: z.number().min(1).max(12) }))
      .query(async ({ input }) => {
        return getSubscriptionCommissionsByCloser(input.closerId, input.year, input.month);
      }),

    getRandomForAudit: protectedProcedure
      .input(z.object({ count: z.number().optional() }))
      .query(async ({ input }) => {
        return getRandomSubscriptionsForAudit(input.count || 5);
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
        // Setters can only edit their own bookings; admins can edit any.
        if (ctx.user.role !== "admin") {
          const link = await getUserTeamLink(ctx.user.id);
          if (link.teamMember?.id !== existing.setterId) {
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

  // ==================== SETTER PAYOUTS ($6K cap, 3% commission) ====================
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
          if (!link.teamMember) return { lines: [], totalCommission: 0, cap: SETTER_CAP, rate: SETTER_RATE };
          setterId = link.teamMember.id;
        } else if (ctx.user.role !== "admin" && ctx.user.role !== "payroll") {
          const link = await getUserTeamLink(ctx.user.id);
          if (link.teamMember?.id !== setterId) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Cannot view another setter's payouts." });
          }
        }
        const result = await getSetterPayouts(setterId, input.year, input.month);
        return { ...result, cap: SETTER_CAP, rate: SETTER_RATE };
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
        const deals = await getDealsBySetter(setterId, input.year, input.month);
        // Return only setter-safe fields: hide totalDealAmount, hide closer commission, etc.
        return deals
          .filter(d => d.closed)
          .map(d => {
            const cash =
              parseFloat(d.newCashCollected || "0") +
              parseFloat(d.existingCashCollected || "0");
            return {
              dealId: d.id,
              dealDate: d.dealDate,
              closerId: d.closerId,
              cappedCashCollected: Math.min(cash, SETTER_CAP),
              setterCommission: Math.min(cash, SETTER_CAP) * SETTER_RATE,
            };
          });
      }),
  }),
});

export type AppRouter = typeof appRouter;
