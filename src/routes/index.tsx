import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatCard, TypeBadge, EmptyState, LoadingSkeletons } from "@/components/bits";
import { useFinanceData } from "@/components/auth";
import { TransactionImporter } from "@/components/transaction-importer";
import {
  fmtINR,
  fmtDate,
  fmtDateTime,
  rangeForSelection,
  inRange,
  sumType,
  netSpending,
  categoryTotals,
  monthlySeries,
  budgetSpend,
  buildInsights,
  assessCashflowHealth,
} from "@/lib/finance";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  PiggyBank,
  Target,
  RefreshCcw,
  Lightbulb,
  Inbox,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview · LedgeVue" },
      {
        name: "description",
        content:
          "Your complete financial picture: income, spending, budgets and upcoming commitments.",
      },
      { property: "og:title", content: "Overview · LedgeVue" },
      {
        property: "og:description",
        content:
          "Your complete financial picture: income, spending, budgets and upcoming commitments.",
      },
    ],
  }),
  component: Index,
});

const PIE_COLORS = ["#137C65", "#2E8B87", "#D9A441", "#3E5C76", "#D96C4F", "#7A9E7E"];
const QUICK_ACCESS = [
  {
    to: "/transactions",
    label: "Transactions",
    detail: "Search, filter, and review every movement.",
  },
  { to: "/analytics", label: "Analytics", detail: "Patterns, categories, and monthly trends." },
  {
    to: "/recurring",
    label: "Recurring",
    detail: "See repeated commitments before they surprise you.",
  },
  { to: "/budgets", label: "Budgets", detail: "Monitor category limits and pressure points." },
  { to: "/insights", label: "Insights", detail: "Actionable explanations with evidence." },
  { to: "/reports", label: "Reports", detail: "Summaries ready to share and review." },
  {
    to: "/intelligence",
    label: "Financial Intelligence",
    detail: "Test choices, manage goals, and tune your rules.",
  },
] as const;
const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  color: "var(--popover-foreground)",
  fontSize: 13,
};

function Index() {
  const finance = useFinanceData();
  const loading = finance.loading ?? false;
  const [range, setRange] = useState<"this" | "last" | "3m" | "custom">("this");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const data = useMemo(() => {
    const sel = rangeForSelection(range, { from: customFrom, to: customTo });
    const filtered = finance.transactions.filter((t) => inRange(t, sel.from, sel.to));
    const budgetUtil = Math.round(
      finance.budgets.length
        ? budgetSpend(finance.budgets, filtered).reduce((s, b) => s + b.pct, 0) /
            finance.budgets.length
        : 0,
    );
    const catData = categoryTotals(filtered);
    const top = catData.slice(0, 6);
    const other = catData.slice(6).reduce((s, [, v]) => s + v, 0);
    const pie =
      other > 0
        ? [...top.map(([n, v]) => ({ name: n, value: v })), { name: "Other", value: other }]
        : top.map(([n, v]) => ({ name: n, value: v }));
    const upcoming = finance.recurring.filter((r) => r.nextExpected).slice(0, 4);
    const recent = [...finance.transactions]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8);
    const insights = buildInsights(finance.transactions, finance.budgets)
      .filter((i) => i.kind === "increase" || i.kind === "budget" || i.kind === "accumulation")
      .slice(0, 3);
    const cashflow = assessCashflowHealth(finance.transactions, finance.budgets, finance.recurring);
    return {
      sel,
      filtered,
      budgetUtil,
      pie,
      upcoming,
      recent,
      insights,
      series: monthlySeries(finance.transactions),
      cashflow,
    };
  }, [range, customFrom, customTo, finance.transactions, finance.budgets, finance.recurring]);

  const income = sumType(data.filtered, "income");
  const expense = sumType(data.filtered, "expense");
  const net = netSpending(data.filtered);

  if (!loading && finance.transactions.length === 0) {
    return (
      <div className="overview-enter mx-auto max-w-2xl space-y-5 py-12">
        <p className="text-xs font-semibold uppercase text-primary">
          Your financial picture, in focus
        </p>
        <h2 className="font-serif text-4xl font-medium">Start with your own records.</h2>
        <p className="max-w-xl text-muted-foreground">
          LedgeVue has no sample activity. Import a transaction statement to see spending patterns,
          recurring costs, category breakdowns, and pressure points calculated from your data.
        </p>
        <TransactionImporter />
      </div>
    );
  }

  return (
    <div className="overview-enter space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-primary">Your financial picture</p>
          <h1 className="mt-1 font-serif text-3xl font-medium">Overview</h1>
        </div>
        <TransactionImporter compact />
      </header>
      <div className="flex flex-wrap items-center gap-3">
        <Select value={range} onValueChange={(v) => setRange(v as typeof range)}>
          <SelectTrigger className="w-44" aria-label="Date range">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this">This month</SelectItem>
            <SelectItem value="last">Last month</SelectItem>
            <SelectItem value="3m">Last 3 months</SelectItem>
            <SelectItem value="custom">Custom range</SelectItem>
          </SelectContent>
        </Select>
        {range === "custom" && (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              aria-label="From date"
              className="w-40"
            />
            <Input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              aria-label="To date"
              className="w-40"
            />
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          {finance.lastImportedAt
            ? `Last import ${fmtDateTime(new Date(finance.lastImportedAt))}`
            : "No import timestamp"}
        </p>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <LoadingSkeletons />
          <LoadingSkeletons />
          <LoadingSkeletons />
          <LoadingSkeletons />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total income"
              value={fmtINR(income)}
              sub={data.sel.label}
              icon={<TrendingUp className="size-4 text-success" />}
            />
            <StatCard
              title="Total expenditure"
              value={fmtINR(expense)}
              sub="Before refunds"
              icon={<TrendingDown className="size-4 text-destructive" />}
            />
            <StatCard
              title="Net spending"
              value={fmtINR(net)}
              sub={`${fmtINR(sumType(data.filtered, "refund"))} refunds subtracted`}
              icon={<Wallet className="size-4 text-primary" />}
            />
            <StatCard
              title="Imported transactions"
              value={String(finance.transactions.length)}
              sub={`${finance.accounts.length} accounts in your import`}
              icon={<PiggyBank className="size-4 text-chart-4" />}
            />
          </div>

          <Card className="border-primary/30 bg-gradient-to-r from-primary/5 via-background to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base">Financial command center</CardTitle>
                  <CardDescription>
                    Everything important in one place, ready to act on without switching context.
                  </CardDescription>
                </div>
                <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                  One place
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {QUICK_ACCESS.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="group rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <span className="text-xs text-muted-foreground transition-transform group-hover:translate-x-0.5">
                        Open →
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-l-4 border-primary/60">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Cashflow runway</CardTitle>
                <CardDescription>
                  A forward-looking buffer based on your recent income, spending, and recurring
                  costs.
                </CardDescription>
              </div>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                {data.cashflow.status}
              </span>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-3xl font-semibold tracking-tight">
                    {data.cashflow.runwayMonths.toFixed(1)} mo
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Buffer: {fmtINR(data.cashflow.buffer)} · Score: {data.cashflow.score}/100
                  </p>
                </div>
                <div className="h-2.5 w-32 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary via-amber-500 to-rose-500"
                    style={{ width: `${Math.min(100, data.cashflow.score)}%` }}
                  />
                </div>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {data.cashflow.insights.map((point) => (
                  <li key={point} className="flex items-start gap-2">
                    <span className="mt-1 size-2 rounded-full bg-primary" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Budget utilization</CardTitle>
                <CardDescription>
                  {finance.budgets.length
                    ? `Average across your ${finance.budgets.length} category budgets`
                    : "Set category limits to track progress"}
                </CardDescription>
              </div>
              <Target className="size-5 text-primary" />
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${data.budgetUtil}%` }}
                />
              </div>
              <span className="tabular text-sm font-semibold">
                {finance.budgets.length ? `${data.budgetUtil}%` : "—"}
              </span>
              <Button asChild variant="outline" size="sm">
                <Link to="/budgets">Manage</Link>
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Spending by category</CardTitle>
                <CardDescription>{data.sel.label}</CardDescription>
              </CardHeader>
              <CardContent className="h-72">
                {data.pie.length === 0 ? (
                  <EmptyState
                    title="No expenses in this range"
                    hint="Try a wider date range."
                    icon={<Inbox className="size-6 text-muted-foreground" />}
                  />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart role="img" aria-label="Spending by category chart">
                      <Pie
                        data={data.pie}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={2}
                        onClick={() => (window.location.href = "/analytics")}
                      >
                        {data.pie.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmtINR(v)} contentStyle={tooltipStyle} />
                      <Legend iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Income vs expenditure</CardTitle>
                <CardDescription>Trend over the last 6 months</CardDescription>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={data.series}
                    role="img"
                    aria-label="Income versus expenditure trend chart"
                  >
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12 }}
                      stroke="var(--muted-foreground)"
                    />
                    <YAxis
                      tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 11 }}
                      stroke="var(--muted-foreground)"
                      width={48}
                    />
                    <Tooltip formatter={(v: number) => fmtINR(v)} contentStyle={tooltipStyle} />
                    <Area
                      type="monotone"
                      dataKey="income"
                      name="Income"
                      stroke="#137C65"
                      fill="#137C65"
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="expense"
                      name="Expense"
                      stroke="#D96C4F"
                      fill="#D96C4F"
                      fillOpacity={0.12}
                      strokeWidth={2}
                    />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Upcoming recurring commitments</CardTitle>
                <CardDescription>Next expected payments</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.upcoming.length === 0 && (
                  <EmptyState
                    title="No recurring payments identified"
                    hint="Patterns appear after enough transaction history is available."
                  />
                )}
                {data.upcoming.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{r.merchant}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.confidence === "confirmed"
                          ? "Confirmed"
                          : "Detected — not yet confirmed"}{" "}
                        · {r.frequency}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="tabular text-sm font-semibold">{fmtINR(r.amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.nextExpected ? fmtDate(r.nextExpected) : "—"}
                      </p>
                    </div>
                  </div>
                ))}
                <Button asChild variant="outline" size="sm">
                  <Link to="/recurring">Review all recurring payments</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Unusual spending changes</CardTitle>
                <CardDescription>Context, not judgement</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.insights.length === 0 && (
                  <EmptyState
                    title="Not enough history for insights yet"
                    hint="LedgeVue only reports patterns supported by your imported records."
                  />
                )}
                {data.insights.map((i) => (
                  <Link
                    key={i.id}
                    to="/insights"
                    className="block rounded-lg border p-3 hover:bg-accent"
                  >
                    <div className="flex items-center gap-2">
                      <Lightbulb className="size-4 text-warning" aria-hidden />
                      <p className="text-sm font-medium">{i.title}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{i.period}</p>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base">Financial Intelligence</CardTitle>
                <CardDescription>
                  Personal scenarios, goals, price reviews, and rules based on your records.
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/intelligence">Open workspace</Link>
              </Button>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Price changes to review</p>
                <p className="mt-1 text-lg font-semibold">
                  {finance.intelligence?.priceCreep.filter(
                    (item) => !item.reviewStatus || item.reviewStatus === "pending",
                  ).length ?? 0}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Active personal rules</p>
                <p className="mt-1 text-lg font-semibold">
                  {finance.intelligence?.rules.filter((rule) => rule.active).length ?? 0}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Savings goals</p>
                <p className="mt-1 text-lg font-semibold">
                  {finance.intelligence?.goals.filter((goal) => goal.status === "active").length ??
                    0}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Saved scenarios</p>
                <p className="mt-1 text-lg font-semibold">
                  {finance.intelligence?.scenarios.length ?? 0}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Recent transactions</CardTitle>
                <CardDescription>Latest activity across accounts</CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/transactions">View all</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {data.recent.map((t) => (
                  <div key={t.id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.merchant}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {fmtDate(t.date)} · {t.category} · <TypeBadge type={t.type} />
                      </p>
                    </div>
                    <p className="tabular text-sm font-semibold">
                      {t.type === "income" || t.type === "refund" ? "+" : "−"}
                      {fmtINR(t.amount)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCcw className="size-3.5" aria-hidden /> Insights are calculated from your
            imported transactions.
          </p>
        </>
      )}
    </div>
  );
}
