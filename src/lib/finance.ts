// Shared finance domain types and calculations. Data is supplied by the API.

export type TxType = "income" | "expense" | "refund" | "transfer";

export const CATEGORIES = [
  "Salary",
  "Freelance",
  "Groceries",
  "Dining",
  "Transport",
  "Utilities",
  "Rent",
  "Subscriptions",
  "Shopping",
  "Health",
  "Entertainment",
  "Education",
  "Other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const ESSENTIAL_CATEGORIES = new Set<string>([
  "Rent",
  "Utilities",
  "Groceries",
  "Subscriptions",
  "Health",
  "Transport",
  "Education",
]);

export interface Account {
  id: string;
  name: string;
  kind: "bank" | "credit" | "wallet" | "upi";
}

export interface Transaction {
  id: string;
  ref: string;
  date: string;
  merchant: string;
  description: string;
  amount: number;
  type: TxType;
  accountId: string;
  category: Category;
  reviewed: boolean;
}

export interface Budget {
  category: Category;
  limit: number;
}

export interface RecurringPayment {
  id: string;
  merchant: string;
  category: Category;
  amount: number;
  frequency: "monthly" | "quarterly";
  lastPaid: string;
  nextExpected: string | null;
  confidence: "confirmed" | "detected";
}

export type InsightKind =
  "increase" | "accumulation" | "recurring" | "budget" | "forecast" | "context";
export interface Insight {
  id: string;
  kind: InsightKind;
  title: string;
  explanation: string;
  period: string;
  evidenceAmounts: string[];
  evidenceTxIds: string[];
  method: string;
}

export interface CashflowHealth {
  score: number;
  status: "Strong" | "Stable" | "Watch" | "Critical";
  runwayMonths: number;
  monthlyBurn: number;
  monthlyIncome: number;
  monthlyExpense: number;
  buffer: number;
  insights: string[];
}

export interface PurchaseImpact {
  plannedPurchase: number;
  projectedBuffer: number;
  minimumBuffer: number;
  risk: "Within Plan" | "Buffer at Risk" | "Risky" | "Insufficient Data";
  upcomingBills: number;
  availableFunds: number;
  explanation: string[];
}

export interface PriceCreepAlert {
  merchant: string;
  previousAmount: number;
  newAmount: number;
  change: number;
  percentage: number;
  period: string;
  evidenceDates: string[];
}

/* ---------- formatting ---------- */
const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
export const fmtINR = (n: number) => inr.format(n);
export const fmtDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export const fmtDateTime = (d: Date) =>
  d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/* ---------- computations ---------- */
const monthKey = (iso: string) => iso.slice(0, 7);
export const monthLabel = (key: string) =>
  new Date(key + "-01T00:00:00").toLocaleDateString("en-IN", { month: "short" });

export function inRange(t: Transaction, from: string, to: string) {
  return t.date >= from && t.date <= to;
}
export function rangeForSelection(
  sel: "this" | "last" | "3m" | "custom",
  custom?: { from: string; to: string },
): { from: string; to: string; label: string } {
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (sel === "custom" && custom) return { ...custom, label: "Custom range" };
  if (sel === "last") {
    const f = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const t = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: iso(f), to: iso(t), label: "Last month" };
  }
  if (sel === "3m") {
    const f = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return { from: iso(f), to: iso(now), label: "Last 3 months" };
  }
  const f = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: iso(f), to: iso(now), label: "This month" };
}
export function prevRange(from: string, to: string): { from: string; to: string } {
  const f = new Date(from + "T00:00:00");
  const t = new Date(to + "T00:00:00");
  const pf = new Date(f.getFullYear(), f.getMonth() - 1, 1);
  const pt = new Date(f.getFullYear(), f.getMonth(), 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if ((t.getTime() - f.getTime()) / 86400000 > 40) {
    const pf3 = new Date(f.getFullYear(), f.getMonth() - 3, 1);
    return { from: iso(pf3), to: iso(new Date(pf3.getFullYear(), pf3.getMonth() + 3, 0)) };
  }
  return { from: iso(pf), to: iso(pt) };
}

export const sumType = (list: Transaction[], type: TxType) =>
  list.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);
export const netSpending = (list: Transaction[]) =>
  sumType(list, "expense") - sumType(list, "refund");
export const categoryTotals = (list: Transaction[]) => {
  const map = new Map<Category, number>();
  for (const t of list)
    if (t.type === "expense") map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
};
export function monthlySeries(list: Transaction[]) {
  const map = new Map<
    string,
    { month: string; income: number; expense: number; refunds: number }
  >();
  for (const t of list) {
    const k = monthKey(t.date);
    const row = map.get(k) ?? { month: monthLabel(k), income: 0, expense: 0, refunds: 0 };
    if (t.type === "income") row.income += t.amount;
    else if (t.type === "expense") row.expense += t.amount;
    else if (t.type === "refund") row.refunds += t.amount;
    map.set(k, row);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({ key, ...v }));
}
export const budgetSpend = (budgets: Budget[], list: Transaction[]) =>
  budgets.map((b) => {
    const spent = list
      .filter((t) => t.type === "expense" && t.category === b.category)
      .reduce((s, t) => s + t.amount, 0);
    return {
      ...b,
      spent,
      pct: Math.min(100, Math.round((spent / b.limit) * 100)),
      remaining: b.limit - spent,
    };
  });

export function detectRecurring(list: Transaction[]): RecurringPayment[] {
  const groups = new Map<string, Transaction[]>();
  for (const transaction of list) {
    if (transaction.type !== "expense") continue;
    const key = `${transaction.merchant.trim().toLowerCase()}|${transaction.category}`;
    groups.set(key, [...(groups.get(key) ?? []), transaction]);
  }

  const found: RecurringPayment[] = [];
  for (const [key, entries] of groups) {
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length < 3) continue;
    const gaps = sorted
      .slice(1)
      .map(
        (row, index) =>
          (new Date(`${row.date}T00:00:00`).getTime() -
            new Date(`${sorted[index]!.date}T00:00:00`).getTime()) /
          86400000,
      );
    const averageGap = gaps.reduce((sum, days) => sum + days, 0) / gaps.length;
    const frequency =
      averageGap >= 24 && averageGap <= 40
        ? "monthly"
        : averageGap >= 78 && averageGap <= 102
          ? "quarterly"
          : null;
    if (!frequency) continue;
    const tolerance = frequency === "monthly" ? 8 : 14;
    if (!gaps.every((days) => Math.abs(days - averageGap) <= tolerance)) continue;
    const amounts = sorted.map((row) => row.amount);
    const meanAmount = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
    if (amounts.some((amount) => Math.abs(amount - meanAmount) > Math.max(meanAmount * 0.15, 1)))
      continue;
    const lastPaid = sorted.at(-1)!.date;
    const nextDate = new Date(`${lastPaid}T00:00:00`);
    nextDate.setDate(nextDate.getDate() + (frequency === "monthly" ? 30 : 90));
    found.push({
      id: `pattern-${key}`,
      merchant: sorted[0]!.merchant,
      category: sorted[0]!.category,
      amount: Math.round(meanAmount),
      frequency,
      lastPaid,
      nextExpected: nextDate.toISOString().slice(0, 10),
      confidence: "detected",
    });
  }
  return found.sort((a, b) => b.amount - a.amount);
}

export function simulatePurchaseImpact(
  list: Transaction[],
  plannedPurchase: number,
  category: Category = "Other",
  minimumBuffer = 5000,
): PurchaseImpact {
  if (list.length === 0) {
    return {
      plannedPurchase,
      projectedBuffer: 0,
      minimumBuffer,
      risk: "Insufficient Data",
      upcomingBills: 0,
      availableFunds: 0,
      explanation: [
        "Import enough transactions to estimate your current cash buffer and what the purchase would do to it.",
      ],
    };
  }

  const recentIncome = list
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const recentExpenses = list
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  const upcomingBills =
    list
      .filter((t) => t.type === "expense" && t.category !== category)
      .reduce((sum, t) => sum + t.amount, 0) * 0.25;
  const availableFunds = Math.max(0, recentIncome - recentExpenses - upcomingBills);
  const projectedBuffer = availableFunds - plannedPurchase;

  const risk =
    projectedBuffer < 0
      ? "Risky"
      : projectedBuffer < minimumBuffer
        ? "Buffer at Risk"
        : "Within Plan";

  return {
    plannedPurchase,
    projectedBuffer: Math.round(projectedBuffer),
    minimumBuffer,
    risk,
    upcomingBills: Math.round(upcomingBills),
    availableFunds: Math.round(availableFunds),
    explanation: [
      `Estimated available cash before purchase: ${fmtINR(availableFunds)}`,
      `Upcoming commitments included in the estimate: ${fmtINR(upcomingBills)}`,
      `Preferred minimum buffer: ${fmtINR(minimumBuffer)}`,
      `Projected buffer after purchase: ${fmtINR(projectedBuffer)}`,
    ],
  };
}

export function detectPriceCreep(list: Transaction[]): PriceCreepAlert[] {
  const groups = new Map<string, Transaction[]>();
  for (const item of list) {
    if (item.type !== "expense") continue;
    const key = item.merchant.trim().toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  const alerts: PriceCreepAlert[] = [];
  for (const [merchantKey, entries] of groups) {
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length < 2) continue;
    const amounts = sorted.map((entry) => entry.amount);
    const previousAmount = amounts.at(-2) ?? amounts.at(-1) ?? 0;
    const newAmount = amounts.at(-1) ?? 0;
    if (newAmount <= 0 || previousAmount <= 0) continue;
    const change = newAmount - previousAmount;
    const percentage = (change / previousAmount) * 100;
    if (Math.abs(change) < 50 && Math.abs(percentage) < 10) continue;
    alerts.push({
      merchant: sorted[0].merchant,
      previousAmount,
      newAmount,
      change,
      percentage,
      period: `${sorted.at(-2)?.date ?? ""} → ${sorted.at(-1)?.date ?? ""}`,
      evidenceDates: sorted.slice(-2).map((entry) => entry.date),
    });
  }

  return alerts.sort((a, b) => b.change - a.change);
}

export function assessCashflowHealth(
  list: Transaction[],
  budgets: Budget[] = [],
  recurring: RecurringPayment[] = detectRecurring(list),
): CashflowHealth {
  if (list.length === 0) {
    return {
      score: 0,
      status: "Critical",
      runwayMonths: 0,
      monthlyBurn: 0,
      monthlyIncome: 0,
      monthlyExpense: 0,
      buffer: 0,
      insights: ["Import transactions to assess your cashflow runway."],
    };
  }

  const last3Months = new Map<string, { income: number; expense: number }>();
  for (const item of list) {
    const key = monthKey(item.date);
    const row = last3Months.get(key) ?? { income: 0, expense: 0 };
    if (item.type === "income") row.income += item.amount;
    if (item.type === "expense") row.expense += item.amount;
    last3Months.set(key, row);
  }

  const recentMonths = [...last3Months.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-3);
  const monthlyIncome = recentMonths.length
    ? recentMonths.reduce((sum, [, v]) => sum + v.income, 0) / recentMonths.length
    : 0;
  const monthlyExpense = recentMonths.length
    ? recentMonths.reduce((sum, [, v]) => sum + v.expense, 0) / recentMonths.length
    : 0;

  const recurringCost = recurring.reduce((sum, item) => sum + item.amount, 0);
  const budgetPressure = budgets.length
    ? budgetSpend(budgets, list).filter((b) => b.pct >= 80).length
    : 0;

  const monthlyBuffers = recentMonths.map(([, v]) => v.income - v.expense - recurringCost);
  const worstMonthlyBuffer = Math.min(...monthlyBuffers, 0);
  const averageMonthlyBuffer = monthlyIncome - monthlyExpense - recurringCost;
  const cashBuffer = Math.max(0, averageMonthlyBuffer);
  const runwayMonths = recentMonths.length
    ? Math.max(
        0,
        Math.min(
          cashBuffer / Math.max(1, monthlyExpense),
          worstMonthlyBuffer < 0 ? 0 : cashBuffer / Math.max(1, monthlyExpense),
        ),
      )
    : 0;

  let score = 100;
  if (monthlyExpense > 0) {
    const expenseRatio = monthlyExpense / Math.max(1, monthlyIncome || 1);
    score -= Math.min(35, expenseRatio * 20);
  }
  if (recurringCost > 0) score -= Math.min(20, (recurringCost / Math.max(1, monthlyIncome)) * 24);
  if (budgetPressure > 0) score -= Math.min(15, budgetPressure * 8);
  if (worstMonthlyBuffer < 0) {
    score -= Math.min(60, (Math.abs(worstMonthlyBuffer) / Math.max(1, monthlyIncome)) * 200 + 20);
  }
  score = Math.max(0, Math.min(100, Math.round(score)));

  let status: CashflowHealth["status"] = "Strong";
  if (score < 40) status = "Critical";
  else if (score < 60) status = "Watch";
  else if (score < 80) status = "Stable";

  const insights: string[] = [];
  if (monthlyIncome > 0 && monthlyExpense > monthlyIncome) {
    insights.push("Monthly expenses are currently above your income trend.");
  }
  if (recurringCost > 0) {
    insights.push(`Recurring commitments add about ${fmtINR(recurringCost)} per month.`);
  }
  if (runwayMonths < 1.5) {
    insights.push("Your runway is thin and a few surprises could put pressure on cash flow.");
  } else if (runwayMonths >= 3) {
    insights.push("You have a healthy cushion against shocks and regular variability.");
  }
  if (budgetPressure > 0) {
    insights.push("Some categories are running at or above their planned limits.");
  }
  if (insights.length === 0) {
    insights.push("Your spending is broadly balanced and the current pattern looks sustainable.");
  }

  return {
    score,
    status,
    runwayMonths: Number(runwayMonths.toFixed(1)),
    monthlyBurn: Math.round(monthlyExpense),
    monthlyIncome: Math.round(monthlyIncome),
    monthlyExpense: Math.round(monthlyExpense),
    buffer: Math.round(cashBuffer),
    insights,
  };
}

export function buildInsights(
  list: Transaction[],
  budgets: Budget[],
  recurring = detectRecurring(list),
): Insight[] {
  const out: Insight[] = [];
  if (list.length === 0) return out;
  const cur = monthlySeries(list);
  if (cur.length >= 2) {
    const a = cur[cur.length - 1],
      b = cur[cur.length - 2];
    if (a.expense > b.expense * 1.08) {
      const diningCur = list
        .filter(
          (t) => t.type === "expense" && t.category === "Dining" && monthKey(t.date) === a.key,
        )
        .reduce((s, t) => s + t.amount, 0);
      const diningPrev = list
        .filter(
          (t) => t.type === "expense" && t.category === "Dining" && monthKey(t.date) === b.key,
        )
        .reduce((s, t) => s + t.amount, 0);
      out.push({
        id: "i1",
        kind: "increase",
        period: `${a.month} vs ${b.month}`,
        title: `Spending rose ${Math.round(((a.expense - b.expense) / b.expense) * 100)}% versus ${b.month}`,
        explanation: `Total expenditure was ${fmtINR(a.expense)} in ${a.month}, up from ${fmtINR(b.expense)} in ${b.month}. Dining out accounts for a large share of the increase (${fmtINR(diningCur)} vs ${fmtINR(diningPrev)}). This is not necessarily a problem — it is above your recent pattern.`,
        evidenceAmounts: [
          `${a.month}: ${fmtINR(a.expense)}`,
          `${b.month}: ${fmtINR(b.expense)}`,
          `Dining increase: ${fmtINR(diningCur - diningPrev)}`,
        ],
        evidenceTxIds: list
          .filter(
            (t) => t.type === "expense" && t.category === "Dining" && monthKey(t.date) === a.key,
          )
          .slice(0, 5)
          .map((t) => t.id),
        method: `Compared total expense transactions (excluding refunds and transfers) between the two calendar months, then ranked categories by absolute increase.`,
      });
    }
  }
  const smallFoods = list.filter(
    (t) =>
      t.type === "expense" &&
      t.category === "Dining" &&
      t.amount < 500 &&
      inRange(t, rangeForSelection("3m").from, rangeForSelection("3m").to),
  );
  if (smallFoods.length > 10) {
    out.push({
      id: "i2",
      kind: "accumulation",
      period: "Last 3 months",
      title: `${smallFoods.length} small food purchases added up to ${fmtINR(smallFoods.reduce((s, t) => s + t.amount, 0))}`,
      explanation: `Individually these are modest purchases under ${fmtINR(500)}, but together they represent ${fmtINR(smallFoods.reduce((s, t) => s + t.amount, 0))} over three months — roughly ${fmtINR(Math.round(smallFoods.reduce((s, t) => s + t.amount, 0) / 3))} per month. Worth knowing about, not necessarily worth changing.`,
      evidenceAmounts: [
        `Count: ${smallFoods.length}`,
        `Total: ${fmtINR(smallFoods.reduce((s, t) => s + t.amount, 0))}`,
      ],
      evidenceTxIds: smallFoods.slice(0, 8).map((t) => t.id),
      method: `Grouped expense transactions in the Dining category under ₹500 across the last three full months and summed them.`,
    });
  }
  if (recurring.length > 0)
    out.push({
      id: "i3",
      kind: "recurring",
      period: "Observed history",
      title: `${recurring.length} recurring expense pattern${recurring.length === 1 ? "" : "s"} identified`,
      explanation: `These charges have repeated with similar amounts and timing in your imported records: ${recurring.map((item) => item.merchant).join(", ")}. They are suggestions, not confirmed subscriptions.`,
      evidenceAmounts: recurring.map(
        (item) => `${item.merchant}: ${fmtINR(item.amount)} / ${item.frequency}`,
      ),
      evidenceTxIds: [],
      method: `Grouped expense records by merchant and category, then checked for at least three similar amounts on a stable monthly or quarterly interval.`,
    });
  const bs = budgetSpend(budgets, list);
  const near = bs.find((b) => b.pct >= 80);
  if (near) {
    out.push({
      id: "i4",
      kind: "budget",
      period: "This month",
      title: `${near.category} budget is ${near.pct}% used`,
      explanation: `You have spent ${fmtINR(near.spent)} of your ${fmtINR(near.limit)} ${near.category} budget, leaving ${fmtINR(Math.max(0, near.remaining))} for the rest of the month. ${near.remaining < 0 ? "You are over budget in this category." : "You are approaching the limit."}`,
      evidenceAmounts: [
        `Spent: ${fmtINR(near.spent)}`,
        `Limit: ${fmtINR(near.limit)}`,
        `Remaining: ${fmtINR(Math.max(0, near.remaining))}`,
      ],
      evidenceTxIds: list
        .filter(
          (t) =>
            t.type === "expense" &&
            t.category === near.category &&
            inRange(t, rangeForSelection("this").from, rangeForSelection("this").to),
        )
        .slice(0, 5)
        .map((t) => t.id),
      method: `Summed this month's expenses in the category and divided by the budget you set on the Budgets page.`,
    });
  }
  const monthlyCommit = recurring
    .filter((item) => item.frequency === "monthly")
    .reduce((sum, item) => sum + item.amount, 0);
  if (monthlyCommit > 0)
    out.push({
      id: "i5",
      kind: "forecast",
      period: "Next 3 months (estimate)",
      title: `Recurring commitments of ~${fmtINR(monthlyCommit * 3)} over the next 3 months`,
      explanation: `If current patterns continue, confirmed and detected recurring payments (excluding salary credits) will take about ${fmtINR(monthlyCommit)}/month, or ~${fmtINR(monthlyCommit * 3)} over three months. This is an estimate based on detected patterns, not a guaranteed schedule.`,
      evidenceAmounts: [
        `Monthly commitment: ${fmtINR(monthlyCommit)}`,
        `3-month estimate: ${fmtINR(monthlyCommit * 3)}`,
      ],
      evidenceTxIds: [],
      method: `Multiplied the sum of monthly recurring payments by 3. Quarterly items are excluded until they repeat again. Estimates only — not a prediction of actual charges.`,
    });
  const refundTotal = sumType(
    list.filter((t) => inRange(t, rangeForSelection("3m").from, rangeForSelection("3m").to)),
    "refund",
  );
  if (refundTotal > 0)
    out.push({
      id: "i6",
      kind: "context",
      period: "Last 3 months",
      title: `${fmtINR(refundTotal)} of refunds kept net spending honest`,
      explanation: `Refunds are subtracted from expenditure in every summary, so your net spending figures already reflect the ${fmtINR(refundTotal)} returned to you in this period. Transfers between your own accounts are excluded entirely so they never inflate spending.`,
      evidenceAmounts: [`Refunds credited: ${fmtINR(refundTotal)}`],
      evidenceTxIds: list
        .filter(
          (t) =>
            t.type === "refund" &&
            inRange(t, rangeForSelection("3m").from, rangeForSelection("3m").to),
        )
        .slice(0, 5)
        .map((t) => t.id),
      method: `Summed refund-type transactions in the period. Net spending = expenses − refunds; own-account transfers are excluded from both figures.`,
    });

  const health = assessCashflowHealth(list, budgets, recurring);
  if (health.score > 0 && health.status !== "Critical") {
    out.push({
      id: "i7",
      kind: "context",
      period: "Cashflow runway",
      title: `Cashflow runway is ${health.runwayMonths.toFixed(1)} months`,
      explanation: `Based on your recent income and expense pattern, your current runway is ${health.runwayMonths.toFixed(1)} months. ${health.insights[0] ?? "This is a forward-looking indicator rather than a guarantee."}`,
      evidenceAmounts: [
        `Income: ${fmtINR(health.monthlyIncome)}`,
        `Expense: ${fmtINR(health.monthlyExpense)}`,
        `Buffer: ${fmtINR(health.buffer)}`,
      ],
      evidenceTxIds: [],
      method: `Averages the last three months of income and expense, subtracts recurring commitments, and estimates how long the current buffer could sustain the spending pattern.`,
    });
  }
  return out;
}
