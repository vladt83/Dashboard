import { describe, expect, it } from "vitest";

// Helper to calculate commission (mirrors the logic in routers.ts)
function calculateCommission(
  cashCollected: number,
  isNewClient: boolean,
  showed: boolean,
  commissionPercentage: number,
  showCommissionAmount: number
) {
  const cashCommission = cashCollected * commissionPercentage;
  // Show commission only for new clients who showed
  const showCommission = (isNewClient && showed) ? showCommissionAmount : 0;
  const totalCommission = cashCommission + showCommission;
  
  return {
    cashCommission: cashCommission.toFixed(2),
    showCommission: showCommission.toFixed(2),
    totalCommission: totalCommission.toFixed(2),
  };
}

describe("Commission Calculation", () => {
  const defaultCommissionPercentage = 0.025; // 2.5%
  const defaultShowCommissionAmount = 20; // $20

  it("calculates commission for new client who showed", () => {
    const result = calculateCommission(
      5000, // cashCollected
      true, // isNewClient
      true, // showed
      defaultCommissionPercentage,
      defaultShowCommissionAmount
    );

    expect(result.cashCommission).toBe("125.00"); // 5000 * 0.025
    expect(result.showCommission).toBe("20.00"); // $20 for showing
    expect(result.totalCommission).toBe("145.00"); // 125 + 20
  });

  it("calculates commission for new client who did not show", () => {
    const result = calculateCommission(
      5000,
      true, // isNewClient
      false, // did not show
      defaultCommissionPercentage,
      defaultShowCommissionAmount
    );

    expect(result.cashCommission).toBe("125.00");
    expect(result.showCommission).toBe("0.00"); // No show commission
    expect(result.totalCommission).toBe("125.00");
  });

  it("calculates commission for existing client (no show commission regardless)", () => {
    const result = calculateCommission(
      5000,
      false, // existing client
      true, // showed (should not matter)
      defaultCommissionPercentage,
      defaultShowCommissionAmount
    );

    expect(result.cashCommission).toBe("125.00");
    expect(result.showCommission).toBe("0.00"); // Existing clients don't get show commission
    expect(result.totalCommission).toBe("125.00");
  });

  it("calculates commission with different rates", () => {
    const result = calculateCommission(
      10000,
      true,
      true,
      0.03, // 3%
      25 // $25
    );

    expect(result.cashCommission).toBe("300.00"); // 10000 * 0.03
    expect(result.showCommission).toBe("25.00");
    expect(result.totalCommission).toBe("325.00");
  });

  it("handles zero cash collected", () => {
    const result = calculateCommission(
      0,
      true,
      true,
      defaultCommissionPercentage,
      defaultShowCommissionAmount
    );

    expect(result.cashCommission).toBe("0.00");
    expect(result.showCommission).toBe("20.00"); // Still gets show commission
    expect(result.totalCommission).toBe("20.00");
  });

  it("handles large amounts correctly", () => {
    const result = calculateCommission(
      100000,
      true,
      true,
      defaultCommissionPercentage,
      defaultShowCommissionAmount
    );

    expect(result.cashCommission).toBe("2500.00"); // 100000 * 0.025
    expect(result.showCommission).toBe("20.00");
    expect(result.totalCommission).toBe("2520.00");
  });

  it("handles decimal amounts correctly", () => {
    const result = calculateCommission(
      6543.21,
      true,
      true,
      defaultCommissionPercentage,
      defaultShowCommissionAmount
    );

    expect(result.cashCommission).toBe("163.58"); // 6543.21 * 0.025 = 163.58025
    expect(result.showCommission).toBe("20.00");
    expect(result.totalCommission).toBe("183.58");
  });
});

describe("Monthly Statistics Calculation", () => {
  // Helper to calculate monthly stats from deals
  function calculateMonthlyStats(deals: Array<{
    totalDealAmount: number;
    cashCollected: number;
    isNewClient: boolean;
    showed: boolean;
    totalCommission: number;
    showCommission: number;
    cashCommission: number;
  }>, payouts: Array<{ amount: number }>) {
    const stats = {
      totalRevenue: 0,
      newCashCollected: 0,
      existingCashCollected: 0,
      totalCashCollected: 0,
      newCommission: 0,
      existingCommission: 0,
      showCommission: 0,
      totalCommission: 0,
      commissionPaidOut: 0,
      owedCommission: 0,
      dealCount: deals.length,
      newClientCount: 0,
      existingClientCount: 0,
      showedCount: 0,
    };

    for (const deal of deals) {
      stats.totalRevenue += deal.totalDealAmount;
      stats.totalCashCollected += deal.cashCollected;
      stats.totalCommission += deal.totalCommission;
      stats.showCommission += deal.showCommission;

      if (deal.isNewClient) {
        stats.newCashCollected += deal.cashCollected;
        stats.newCommission += deal.cashCommission;
        stats.newClientCount++;
        if (deal.showed) stats.showedCount++;
      } else {
        stats.existingCashCollected += deal.cashCollected;
        stats.existingCommission += deal.cashCommission;
        stats.existingClientCount++;
      }
    }

    for (const payout of payouts) {
      stats.commissionPaidOut += payout.amount;
    }

    stats.owedCommission = stats.totalCommission - stats.commissionPaidOut;

    return stats;
  }

  it("calculates stats for multiple deals", () => {
    const deals = [
      { totalDealAmount: 5000, cashCollected: 5000, isNewClient: true, showed: true, totalCommission: 145, showCommission: 20, cashCommission: 125 },
      { totalDealAmount: 3000, cashCollected: 3000, isNewClient: true, showed: false, totalCommission: 75, showCommission: 0, cashCommission: 75 },
      { totalDealAmount: 4000, cashCollected: 4000, isNewClient: false, showed: false, totalCommission: 100, showCommission: 0, cashCommission: 100 },
    ];
    const payouts = [{ amount: 100 }];

    const stats = calculateMonthlyStats(deals, payouts);

    expect(stats.dealCount).toBe(3);
    expect(stats.totalRevenue).toBe(12000);
    expect(stats.totalCashCollected).toBe(12000);
    expect(stats.newCashCollected).toBe(8000);
    expect(stats.existingCashCollected).toBe(4000);
    expect(stats.newClientCount).toBe(2);
    expect(stats.existingClientCount).toBe(1);
    expect(stats.showedCount).toBe(1);
    expect(stats.totalCommission).toBe(320);
    expect(stats.commissionPaidOut).toBe(100);
    expect(stats.owedCommission).toBe(220);
  });

  it("handles empty deals array", () => {
    const stats = calculateMonthlyStats([], []);

    expect(stats.dealCount).toBe(0);
    expect(stats.totalRevenue).toBe(0);
    expect(stats.totalCommission).toBe(0);
    expect(stats.owedCommission).toBe(0);
  });
});
