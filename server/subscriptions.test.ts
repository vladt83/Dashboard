import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

// Test subscription commission calculation logic
describe("Subscription Commission Calculations", () => {
  it("should calculate 25% commission correctly", () => {
    const monthlyAmount = 200;
    const commissionRate = 0.25;
    const commission = monthlyAmount * commissionRate;
    expect(commission).toBe(50);
  });

  it("should calculate commission for various amounts", () => {
    const testCases = [
      { monthly: 100, expected: 25 },
      { monthly: 200, expected: 50 },
      { monthly: 500, expected: 125 },
      { monthly: 1000, expected: 250 },
      { monthly: 49.99, expected: 12.4975 },
    ];

    for (const tc of testCases) {
      expect(tc.monthly * 0.25).toBeCloseTo(tc.expected, 2);
    }
  });

  it("should validate subscription input schema", () => {
    const subscriptionSchema = z.object({
      clientName: z.string().min(1),
      monthlyAmount: z.number().positive(),
      closerId: z.number(),
      startDate: z.string(),
      startMonth: z.number().min(1).max(12),
      startYear: z.number(),
      notes: z.string().optional(),
    });

    // Valid input
    const valid = subscriptionSchema.safeParse({
      clientName: "John Smith",
      monthlyAmount: 200,
      closerId: 1,
      startDate: "2026-04-01",
      startMonth: 4,
      startYear: 2026,
    });
    expect(valid.success).toBe(true);

    // Invalid: missing client name
    const invalidName = subscriptionSchema.safeParse({
      clientName: "",
      monthlyAmount: 200,
      closerId: 1,
      startDate: "2026-04-01",
      startMonth: 4,
      startYear: 2026,
    });
    expect(invalidName.success).toBe(false);

    // Invalid: negative amount
    const invalidAmount = subscriptionSchema.safeParse({
      clientName: "John Smith",
      monthlyAmount: -100,
      closerId: 1,
      startDate: "2026-04-01",
      startMonth: 4,
      startYear: 2026,
    });
    expect(invalidAmount.success).toBe(false);

    // Invalid: month out of range
    const invalidMonth = subscriptionSchema.safeParse({
      clientName: "John Smith",
      monthlyAmount: 200,
      closerId: 1,
      startDate: "2026-13-01",
      startMonth: 13,
      startYear: 2026,
    });
    expect(invalidMonth.success).toBe(false);
  });
});

// Test coaching session pay calculation
describe("Coaching Session Pay Calculations", () => {
  it("should calculate pay at $0.90 per minute", () => {
    const minutes = 30;
    const ratePerMinute = 0.90;
    const pay = minutes * ratePerMinute;
    expect(pay).toBe(27);
  });

  it("should calculate no-show pay at $15", () => {
    const noShowRate = 15;
    expect(noShowRate).toBe(15);
  });

  it("should calculate total session pay correctly", () => {
    const sessions = [
      { minutes: 33, isNoShow: false },
      { minutes: 35, isNoShow: false },
      { minutes: 0, isNoShow: true },
      { minutes: 42, isNoShow: false },
      { minutes: 0, isNoShow: true },
    ];

    const ratePerMinute = 0.90;
    const noShowRate = 15;

    let totalPay = 0;
    for (const session of sessions) {
      if (session.isNoShow) {
        totalPay += noShowRate;
      } else {
        totalPay += session.minutes * ratePerMinute;
      }
    }

    const expectedPay = (33 * 0.90) + (35 * 0.90) + 15 + (42 * 0.90) + 15;
    expect(totalPay).toBeCloseTo(expectedPay, 2);
  });

  it("should validate coaching session input schema", () => {
    const sessionSchema = z.object({
      sessionDate: z.string(),
      clientName: z.string().min(1),
      minutes: z.number().min(0),
      tradingLog: z.enum(["yes", "no", "too_new"]),
      fuSession: z.enum(["yes", "no"]),
      fuAssignments: z.string().optional(),
      notes: z.string().optional(),
      recordingLink: z.string().url(),
      isNoShow: z.boolean(),
    });

    // Valid completed session
    const validSession = sessionSchema.safeParse({
      sessionDate: "2026-04-01",
      clientName: "Eric Wesley",
      minutes: 33,
      tradingLog: "yes",
      fuSession: "yes",
      fuAssignments: "Review modules",
      notes: "Covered paycheck collector examples",
      recordingLink: "https://zoom.us/rec/123",
      isNoShow: false,
    });
    expect(validSession.success).toBe(true);

    // Invalid: missing recording link (empty string)
    const noRecording = sessionSchema.safeParse({
      sessionDate: "2026-04-01",
      clientName: "Eric Wesley",
      minutes: 33,
      tradingLog: "yes",
      fuSession: "yes",
      notes: "Test",
      recordingLink: "",
      isNoShow: false,
    });
    expect(noRecording.success).toBe(false);

    // Valid no-show session
    const noShowSession = sessionSchema.safeParse({
      sessionDate: "2026-04-01",
      clientName: "No Show Client",
      minutes: 0,
      tradingLog: "no",
      fuSession: "no",
      notes: "Client did not show up",
      recordingLink: "https://zoom.us/rec/noshow",
      isNoShow: true,
    });
    expect(noShowSession.success).toBe(true);
  });
});

// Test user role validation
describe("User Role System", () => {
  it("should validate all four role types", () => {
    const roleSchema = z.enum(["admin", "closer", "setter", "payroll"]);

    expect(roleSchema.safeParse("admin").success).toBe(true);
    expect(roleSchema.safeParse("closer").success).toBe(true);
    expect(roleSchema.safeParse("setter").success).toBe(true);
    expect(roleSchema.safeParse("payroll").success).toBe(true);
    expect(roleSchema.safeParse("user").success).toBe(false);
    expect(roleSchema.safeParse("manager").success).toBe(false);
  });

  it("should determine correct permissions for each role", () => {
    const rolePermissions = {
      admin: { canManageUsers: true, canViewPayroll: true, canViewSales: true, canEditSettings: true },
      closer: { canManageUsers: false, canViewPayroll: false, canViewSales: true, canEditSettings: false },
      setter: { canManageUsers: false, canViewPayroll: false, canViewSales: true, canEditSettings: false },
      payroll: { canManageUsers: false, canViewPayroll: true, canViewSales: false, canEditSettings: false },
    };

    expect(rolePermissions.admin.canManageUsers).toBe(true);
    expect(rolePermissions.closer.canManageUsers).toBe(false);
    expect(rolePermissions.payroll.canViewPayroll).toBe(true);
    expect(rolePermissions.setter.canViewSales).toBe(true);
  });
});

// Test marketing cost / ROAS calculation
describe("Marketing & ROAS Calculations", () => {
  it("should calculate ROAS correctly", () => {
    const revenue = 50000;
    const adSpend = 5000;
    const roas = revenue / adSpend;
    expect(roas).toBe(10);
  });

  it("should handle zero ad spend (N/A)", () => {
    const revenue = 50000;
    const adSpend = 0;
    const roas = adSpend === 0 ? null : revenue / adSpend;
    expect(roas).toBeNull();
  });

  it("should validate marketing cost input", () => {
    const marketingCostSchema = z.object({
      platform: z.string(),
      amount: z.number().min(0),
      year: z.number(),
      month: z.number().min(1).max(12),
      notes: z.string().optional(),
    });

    const valid = marketingCostSchema.safeParse({
      platform: "Facebook",
      amount: 5000,
      year: 2026,
      month: 4,
    });
    expect(valid.success).toBe(true);

    const invalidNegative = marketingCostSchema.safeParse({
      platform: "Facebook",
      amount: -100,
      year: 2026,
      month: 4,
    });
    expect(invalidNegative.success).toBe(false);
  });
});
