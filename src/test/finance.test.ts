import { describe, expect, it } from "vitest";
import {
  assessCashflowHealth,
  buildInsights,
  detectPriceCreep,
  detectRecurring,
  simulatePurchaseImpact,
  type Transaction,
} from "@/lib/finance";

function expense(
  id: string,
  date: string,
  amount: number,
  merchant = "Cloud Storage",
): Transaction {
  return {
    id,
    ref: id,
    date,
    merchant,
    description: "Monthly service",
    amount,
    type: "expense",
    accountId: "account-1",
    category: "Subscriptions",
    reviewed: false,
  };
}

describe("finance insights from user records", () => {
  it("does not invent insights when no records are imported", () => {
    expect(buildInsights([], [])).toEqual([]);
    expect(detectRecurring([])).toEqual([]);
  });

  it("identifies similar expenses on a stable monthly interval", () => {
    const items = [
      expense("jan", "2026-01-05", 100),
      expense("feb", "2026-02-05", 102),
      expense("mar", "2026-03-05", 101),
    ];

    expect(detectRecurring(items)).toMatchObject([
      { merchant: "Cloud Storage", amount: 101, frequency: "monthly", confidence: "detected" },
    ]);
  });

  it("does not label irregular charges as recurring", () => {
    const items = [
      expense("jan", "2026-01-05", 100),
      expense("feb", "2026-02-05", 102),
      expense("may", "2026-05-05", 101),
    ];

    expect(detectRecurring(items)).toEqual([]);
  });

  it("measures cashflow resilience when income is healthy", () => {
    const items: Transaction[] = [
      {
        id: "inc-1",
        ref: "inc-1",
        date: "2026-01-05",
        merchant: "Salary",
        description: "Salary",
        amount: 60000,
        type: "income",
        accountId: "a1",
        category: "Salary",
        reviewed: true,
      },
      {
        id: "inc-2",
        ref: "inc-2",
        date: "2026-02-05",
        merchant: "Salary",
        description: "Salary",
        amount: 60000,
        type: "income",
        accountId: "a1",
        category: "Salary",
        reviewed: true,
      },
      {
        id: "inc-3",
        ref: "inc-3",
        date: "2026-03-05",
        merchant: "Salary",
        description: "Salary",
        amount: 60000,
        type: "income",
        accountId: "a1",
        category: "Salary",
        reviewed: true,
      },
      {
        id: "rent",
        ref: "rent",
        date: "2026-01-12",
        merchant: "Landlord",
        description: "Rent",
        amount: 22000,
        type: "expense",
        accountId: "a1",
        category: "Rent",
        reviewed: true,
      },
      {
        id: "groceries",
        ref: "groceries",
        date: "2026-01-18",
        merchant: "Supermarket",
        description: "Groceries",
        amount: 6500,
        type: "expense",
        accountId: "a1",
        category: "Groceries",
        reviewed: true,
      },
      {
        id: "utility",
        ref: "utility",
        date: "2026-02-12",
        merchant: "Power Co",
        description: "Utilities",
        amount: 4200,
        type: "expense",
        accountId: "a1",
        category: "Utilities",
        reviewed: true,
      },
      {
        id: "sub",
        ref: "sub",
        date: "2026-02-20",
        merchant: "Streaming",
        description: "Streaming",
        amount: 499,
        type: "expense",
        accountId: "a1",
        category: "Subscriptions",
        reviewed: true,
      },
    ];

    const health = assessCashflowHealth(
      items,
      [],
      [
        {
          id: "r1",
          merchant: "Streaming",
          category: "Subscriptions",
          amount: 499,
          frequency: "monthly",
          lastPaid: "2026-03-05",
          nextExpected: "2026-04-05",
          confidence: "detected",
        },
      ],
    );

    expect(health.score).toBeGreaterThan(70);
    expect(health.status).toBe("Strong");
    expect(health.runwayMonths).toBeGreaterThan(0);
  });

  it("flags a fragile runway when expenses outrun income", () => {
    const items: Transaction[] = [
      {
        id: "inc-1",
        ref: "inc-1",
        date: "2026-01-05",
        merchant: "Salary",
        description: "Salary",
        amount: 25000,
        type: "income",
        accountId: "a1",
        category: "Salary",
        reviewed: true,
      },
      {
        id: "inc-2",
        ref: "inc-2",
        date: "2026-02-05",
        merchant: "Salary",
        description: "Salary",
        amount: 25000,
        type: "income",
        accountId: "a1",
        category: "Salary",
        reviewed: true,
      },
      {
        id: "inc-3",
        ref: "inc-3",
        date: "2026-03-05",
        merchant: "Salary",
        description: "Salary",
        amount: 25000,
        type: "income",
        accountId: "a1",
        category: "Salary",
        reviewed: true,
      },
      {
        id: "rent",
        ref: "rent",
        date: "2026-01-12",
        merchant: "Landlord",
        description: "Rent",
        amount: 22000,
        type: "expense",
        accountId: "a1",
        category: "Rent",
        reviewed: true,
      },
      {
        id: "food",
        ref: "food",
        date: "2026-01-18",
        merchant: "Groceries",
        description: "Groceries",
        amount: 11000,
        type: "expense",
        accountId: "a1",
        category: "Groceries",
        reviewed: true,
      },
      {
        id: "sub",
        ref: "sub",
        date: "2026-02-20",
        merchant: "Streaming",
        description: "Streaming",
        amount: 1500,
        type: "expense",
        accountId: "a1",
        category: "Subscriptions",
        reviewed: true,
      },
    ];

    const health = assessCashflowHealth(items, [], []);

    expect(health.score).toBeLessThan(50);
    expect(health.status).toMatch(/Watch|Critical/);
    expect(health.runwayMonths).toBeLessThanOrEqual(1);
  });

  it("models a risky purchase before the user spends", () => {
    const items: Transaction[] = [
      {
        id: "inc-1",
        ref: "inc-1",
        date: "2026-01-05",
        merchant: "Salary",
        description: "Salary",
        amount: 50000,
        type: "income",
        accountId: "a1",
        category: "Salary",
        reviewed: true,
      },
      {
        id: "rent",
        ref: "rent",
        date: "2026-01-20",
        merchant: "Landlord",
        description: "Rent",
        amount: 18000,
        type: "expense",
        accountId: "a1",
        category: "Rent",
        reviewed: true,
      },
      {
        id: "food",
        ref: "food",
        date: "2026-01-25",
        merchant: "Groceries",
        description: "Groceries",
        amount: 8000,
        type: "expense",
        accountId: "a1",
        category: "Groceries",
        reviewed: true,
      },
      {
        id: "stream",
        ref: "stream",
        date: "2026-02-03",
        merchant: "Streaming",
        description: "Subscription",
        amount: 499,
        type: "expense",
        accountId: "a1",
        category: "Subscriptions",
        reviewed: true,
      },
    ];

    const plan = simulatePurchaseImpact(items, 25000, "Shopping", 5000);

    expect(plan.risk).toMatch(/Buffer at Risk|Risky/);
    expect(plan.projectedBuffer).toBeLessThan(5000);
  });

  it("detects price creep from matched recurring charges", () => {
    const items: Transaction[] = [
      expense("s1", "2026-01-05", 499, "Cloud Storage"),
      expense("s2", "2026-02-05", 499, "Cloud Storage"),
      expense("s3", "2026-03-05", 649, "Cloud Storage"),
    ];

    const creep = detectPriceCreep(items);

    expect(creep[0]).toMatchObject({
      merchant: "Cloud Storage",
      previousAmount: 499,
      newAmount: 649,
    });
  });
});
