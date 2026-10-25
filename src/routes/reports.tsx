import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/bits";
import { useFinanceData } from "@/components/auth";
import {
  fmtINR,
  fmtDateTime,
  rangeForSelection,
  inRange,
  sumType,
  netSpending,
  categoryTotals,
  budgetSpend,
} from "@/lib/finance";
import { Printer, RefreshCcw } from "lucide-react";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports · LedgeVue" },
      {
        name: "description",
        content:
          "Printable financial report: income and expenditure summaries, category breakdowns and budget comparisons.",
      },
      { property: "og:title", content: "Reports · LedgeVue" },
      {
        property: "og:description",
        content: "Printable financial report with summaries and comparisons.",
      },
    ],
  }),
  component: ReportsPage,
});

export default function ReportsPage() {
  const finance = useFinanceData();
  const [range, setRange] = useState<"this" | "last" | "3m">("this");
  const data = useMemo(() => {
    const sel = rangeForSelection(range);
    const list = finance.transactions.filter((t) => inRange(t, sel.from, sel.to));
    const cats = categoryTotals(list);
    const catTotal = cats.reduce((s, [, v]) => s + v, 0) || 1;
    return { sel, list, cats, catTotal, budgets: budgetSpend(finance.budgets, list) };
  }, [range, finance.transactions, finance.budgets]);

  if (finance.transactions.length === 0)
    return (
      <EmptyState
        title="No report data yet"
        hint="Import transactions to generate a report from your records."
      />
    );

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-center gap-3">
        <Select value={range} onValueChange={(v) => setRange(v as typeof range)}>
          <SelectTrigger className="w-44" aria-label="Report period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this">This month</SelectItem>
            <SelectItem value="last">Last month</SelectItem>
            <SelectItem value="3m">Last 3 months</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="mr-1 size-4" /> Print / Save as PDF
        </Button>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <RefreshCcw className="size-3.5" /> Last imported{" "}
          {finance.lastImportedAt ? fmtDateTime(new Date(finance.lastImportedAt)) : "not available"}{" "}
          · report calculated {fmtDateTime(new Date())}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Financial report — {data.sel.label}</CardTitle>
          <CardDescription>
            All figures exclude transfers between your own accounts; refunds are subtracted from
            expenditure.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Summary</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                ["Total income", fmtINR(sumType(data.list, "income"))],
                ["Total expenditure", fmtINR(sumType(data.list, "expense"))],
                ["Refunds received", fmtINR(sumType(data.list, "refund"))],
                ["Net spending (after refunds)", fmtINR(netSpending(data.list))],
              ].map(([k, v]) => (
                <TableRow key={k}>
                  <TableCell className="font-medium">{k}</TableCell>
                  <TableCell className="tabular text-right font-semibold">{v}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Category breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Spent</TableHead>
                <TableHead className="text-right">Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.cats.map(([c, v]) => (
                <TableRow key={c}>
                  <TableCell>{c}</TableCell>
                  <TableCell className="tabular text-right">{fmtINR(v)}</TableCell>
                  <TableCell className="tabular text-right text-muted-foreground">
                    {Math.round((v / data.catTotal) * 100)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Budget comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Budget</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.budgets.map((b) => (
                <TableRow key={b.category}>
                  <TableCell>{b.category}</TableCell>
                  <TableCell className="tabular text-right">{fmtINR(b.limit)}</TableCell>
                  <TableCell className="tabular text-right">{fmtINR(b.spent)}</TableCell>
                  <TableCell
                    className={`tabular text-right ${b.remaining < 0 ? "text-destructive" : ""}`}
                  >
                    {fmtINR(b.remaining)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recurring commitments</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {finance.recurring.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.merchant}</TableCell>
                  <TableCell className="capitalize">{r.frequency}</TableCell>
                  <TableCell className="tabular text-right">{fmtINR(r.amount)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {r.confidence === "confirmed" ? "Confirmed" : "Detected"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
