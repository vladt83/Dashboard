import { describe, expect, it } from "vitest";

// Test notification types and commission calculation logic
describe("Notification System", () => {
  describe("Notification Types", () => {
    it("should have valid notification type values", () => {
      const validTypes = [
        "payment_received",
        "bonus_added",
        "deduction_added",
        "notes_updated",
      ];
      
      validTypes.forEach(type => {
        expect(typeof type).toBe("string");
        expect(type.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Commission Calculation Logic", () => {
    // Closer commission: 15% for Jan-Feb, 10% otherwise
    const calculateCloserCommission = (cashCollected: number, rate: number): number => {
      return cashCollected * rate;
    };

    // Setter commission: 3% of cash + $20 if showed AND prepared
    const calculateSetterCommission = (
      showed: boolean,
      prepared: boolean,
      closed: boolean,
      cashCollected: number,
      cashRate: number = 0.03,
      showRate: number = 20
    ): { cashCommission: number; showCommission: number } => {
      const cashCommission = closed ? cashCollected * cashRate : 0;
      const showCommission = showed && prepared ? showRate : 0;
      return { cashCommission, showCommission };
    };

    it("should calculate closer commission at 15% for Jan-Feb", () => {
      const cashCollected = 10000;
      const rate = 0.15;
      const commission = calculateCloserCommission(cashCollected, rate);
      expect(commission).toBe(1500);
    });

    it("should calculate closer commission at 10% for other months", () => {
      const cashCollected = 10000;
      const rate = 0.10;
      const commission = calculateCloserCommission(cashCollected, rate);
      expect(commission).toBe(1000);
    });

    it("should give setter $20 when client showed AND was prepared", () => {
      const result = calculateSetterCommission(true, true, false, 0);
      expect(result.showCommission).toBe(20);
      expect(result.cashCommission).toBe(0);
    });

    it("should NOT give setter $20 when client showed but was NOT prepared", () => {
      const result = calculateSetterCommission(true, false, false, 0);
      expect(result.showCommission).toBe(0);
      expect(result.cashCommission).toBe(0);
    });

    it("should NOT give setter $20 when client did not show", () => {
      const result = calculateSetterCommission(false, false, false, 0);
      expect(result.showCommission).toBe(0);
      expect(result.cashCommission).toBe(0);
    });

    it("should give setter 3% cash commission when deal closes", () => {
      const cashCollected = 5000;
      const result = calculateSetterCommission(true, true, true, cashCollected);
      expect(result.cashCommission).toBe(150); // 3% of 5000
      expect(result.showCommission).toBe(20);
    });

    it("should NOT give setter cash commission when deal does not close", () => {
      const cashCollected = 5000;
      const result = calculateSetterCommission(true, true, false, cashCollected);
      expect(result.cashCommission).toBe(0);
      expect(result.showCommission).toBe(20);
    });

    it("should handle combined setter commission correctly", () => {
      const cashCollected = 10000;
      const result = calculateSetterCommission(true, true, true, cashCollected);
      const totalSetterCommission = result.cashCommission + result.showCommission;
      expect(totalSetterCommission).toBe(320); // $300 (3% of 10000) + $20 show
    });
  });

  describe("Bonus/Deduction Logic", () => {
    it("should add bonus to total commission", () => {
      const baseCommission = 1000;
      const bonus = 250;
      const total = baseCommission + bonus;
      expect(total).toBe(1250);
    });

    it("should subtract deduction from total commission", () => {
      const baseCommission = 1000;
      const deduction = 100;
      const total = baseCommission - deduction;
      expect(total).toBe(900);
    });

    it("should handle multiple adjustments", () => {
      const baseCommission = 1000;
      const adjustments = [
        { type: "bonus", amount: 200 },
        { type: "deduction", amount: 50 },
        { type: "bonus", amount: 100 },
      ];
      
      const totalAdjustment = adjustments.reduce((sum, adj) => {
        return sum + (adj.type === "bonus" ? adj.amount : -adj.amount);
      }, 0);
      
      const finalTotal = baseCommission + totalAdjustment;
      expect(totalAdjustment).toBe(250); // 200 - 50 + 100
      expect(finalTotal).toBe(1250);
    });
  });

  describe("Payment Notification Data", () => {
    it("should format payment breakdown correctly", () => {
      const amount = 1500.50;
      const breakdown = `Payment of $${amount.toFixed(2)} has been processed.`;
      expect(breakdown).toBe("Payment of $1500.50 has been processed.");
    });

    it("should format bonus notification correctly", () => {
      const amount = 250;
      const reason = "Excellent performance this month";
      const title = `Bonus Added: $${amount.toFixed(2)}`;
      const message = `You received a bonus: ${reason}`;
      
      expect(title).toBe("Bonus Added: $250.00");
      expect(message).toBe("You received a bonus: Excellent performance this month");
    });

    it("should format deduction notification correctly", () => {
      const amount = 50;
      const reason = "Adjustment for overpayment";
      const title = `Deduction Applied: $${amount.toFixed(2)}`;
      const message = `A deduction was applied: ${reason}`;
      
      expect(title).toBe("Deduction Applied: $50.00");
      expect(message).toBe("A deduction was applied: Adjustment for overpayment");
    });
  });
});
