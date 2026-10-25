import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/bits";
import { useFinanceData } from "@/components/auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  fmtINR,
  fmtDate,
  rangeForSelection,
  inRange,
  categoryTotals,
  monthlySeries,
  budgetSpend,
  ESSENTIAL_CATEGORIES,
  sumType,
  netSpending,
} from "@/lib/finance";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { MousePointerClick, TrendingUp, TrendingDown, Minus } from "lucide-react";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Spending Analytics · LedgeVue" },
      {
        name: "description",
        content:
          "Interactive breakdowns of where your money goes, with drill-down into the transactions behind every number.",
      },
      { property: "og:title", content: "Spending Analytics · LedgeVue" },
      { property: "og:description", content: "Interactive breakdowns of where your money goes." },
    ],
  }),
  component: AnalyticsPage,
});

const PIE_COLORS = [
  "#137C65",
  "#2E8B87",
  "#D9A441",
  "#3E5C76",
  "#D96C4F",
  "#7A9E7E",
  "#8B7355",
  "#4A6FA5",
  "#B05F8C",
  "#5E8C61",
  "#A67C52",
];
const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  color: "var(--popover-foreground)",
  fontSize: 13,
};

function AnalyticsPage() {
  const { transactions, budgets } = useFinanceData();
  const [drill, setDrill] = useState<string | null>(null);
  const data = useMemo(() => {
    const sel = rangeForSelection("3m");
    const list = transactions.filter((t) => inRange(t, sel.from, sel.to));
    const cats = categoryTotals(transactions);
    const series = monthlySeries(transactions);
    const essDisc = series.map((m) => {
      const rows = transactions.filter((t) => t.type === "expense" && t.date.slice(0, 7) === m.key);
      const ess = rows
        .filter((t) => ESSENTIAL_CATEGORIES.has(t.category))
        .reduce((s, t) => s + t.amount, 0);
      return { month: m.month, Essential: ess, Discretionary: m.expense - ess };
    });
    const budgetRows = budgetSpend(budgets, list).map((b) => ({
      category: b.category,
      Budget: b.limit,
      Actual: b.spent,
    }));
    return { sel, cats, series, essDisc, budgets: budgetRows };
  }, [transactions, budgets]);

  const last = data.series[data.series.length - 1];
  const prev = data.series[data.series.length - 2];
  const change =
    last && prev ? Math.round(((last.expense - prev.expense) / prev.expense) * 100) : 0;
  const drillTx = drill
    ? transactions.filter(
        (t) =>
          t.type === "expense" && t.category === drill && inRange(t, data.sel.from, data.sel.to),
      )
    : [];

  if (transactions.length === 0)
    return (
      <EmptyState
        title="Your analytics are waiting for your data"
        hint="Import a transaction CSV to see category, trend, and budget comparisons."
      />
    );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="hover-lift">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Change vs previous month</p>
            <p className="tabular mt-1 flex items-center gap-2 text-2xl font-semibold">
              {change > 5 ? (
                <TrendingUp className="size-5 text-destructive" />
              ) : change < -5 ? (
                <TrendingDown className="size-5 text-success" />
              ) : (
                <Minus className="size-5 text-muted-foreground" />
              )}
              {change > 0 ? "+" : ""}
              {change}%
            </p>
          </CardContent>
        </Card>
        <Card className="hover-lift">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Income vs spending (this month)</p>
            <p className="tabular mt-1 text-2xl font-semibold">
              {fmtINR(
                sumType(
                  transactions.filter((t) =>
                    inRange(t, rangeForSelection("this").from, rangeForSelection("this").to),
                  ),
                  "income",
                ),
              )}{" "}
              in /{" "}
              {fmtINR(
                netSpending(
                  transactions.filter((t) =>
                    inRange(t, rangeForSelection("this").from, rangeForSelection("this").to),
                  ),
                ),
              )}{" "}
              net out
            </p>
          </CardContent>
        </Card>
        <Card className="hover-lift">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Essential share (last 3 months)</p>
            <p className="tabular mt-1 text-2xl font-semibold">
              {Math.round(
                (data.essDisc.reduce((s, m) => s + m.Essential, 0) /
                  Math.max(
                    1,
                    data.essDisc.reduce((s, m) => s + m.Essential + m.Discretionary, 0),
                  )) *
                  100,
              )}
              %
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Spending by category</CardTitle>
            <CardDescription className="flex items-center gap-1">
              <MousePointerClick className="size-3.5" /> Click a slice to inspect its transactions
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart role="img" aria-label="Category spending chart, click a segment for detail">
                <Pie
                  data={data.cats.map(([name, value]) => ({ name, value }))}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={2}
                  onClick={(d: { name?: string }) => d.name && setDrill(d.name)}
                  className="cursor-pointer"
                >
                  {data.cats.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => fmtINR(v)} contentStyle={tooltipStyle} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly trends</CardTitle>
            <CardDescription>Income and expenses per month</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.series}
                role="img"
                aria-label="Monthly income and expense bar chart"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                <YAxis
                  tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                  width={48}
                />
                <Tooltip formatter={(v: number) => fmtINR(v)} contentStyle={tooltipStyle} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="income" name="Income" fill="#137C65" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expense" fill="#D9A441" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Essential vs discretionary</CardTitle>
            <CardDescription>Commitments first, lifestyle second</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.essDisc}
                role="img"
                aria-label="Essential versus discretionary spending stacked bar chart"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                <YAxis
                  tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                  width={48}
                />
                <Tooltip formatter={(v: number) => fmtINR(v)} contentStyle={tooltipStyle} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Essential" stackId="s" fill="#137C65" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Discretionary" stackId="s" fill="#D9A441" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Budget vs actual</CardTitle>
            <CardDescription>This month, per category budget</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.budgets}
                layout="vertical"
                role="img"
                aria-label="Budget versus actual horizontal bar chart"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  type="number"
                  tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                />
                <YAxis
                  type="category"
                  dataKey="category"
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                  width={90}
                />
                <Tooltip formatter={(v: number) => fmtINR(v)} contentStyle={tooltipStyle} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Budget" fill="#3E5C76" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Actual" fill="#137C65" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!drill} onOpenChange={(o) => !o && setDrill(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {drill} — {fmtINR(drillTx.reduce((s, t) => s + t.amount, 0))} in{" "}
              {data.sel.label.toLowerCase()}
            </DialogTitle>
            <DialogDescription>Transactions behind this number</DialogDescription>
          </DialogHeader>
          <div className="divide-y text-sm">
            {drillTx.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2">
                <span>
                  {fmtDate(t.date)} · {t.merchant}
                </span>
                <span className="tabular font-medium">{fmtINR(t.amount)}</span>
              </div>
            ))}
          </div>
          <Badge variant="outline" asChild>
            <Link to="/transactions">Open in transaction explorer</Link>
          </Badge>
        </DialogContent>
      </Dialog>
    </div>
  );
}
