import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDownLeft, ArrowUpRight, RotateCcw, ArrowRight } from "lucide-react";
import type { TxType } from "@/lib/finance";
import { cn } from "@/lib/utils";

export function StatCard({
  title,
  value,
  sub,
  icon,
}: {
  title: string;
  value: string;
  sub?: string;
  icon?: ReactNode;
}) {
  return (
    <Card className="hover-lift">
      <CardHeader className="flex flex-row items-center justify-between pb-1">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <p className="tabular text-2xl font-semibold tracking-tight">{value}</p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export const TYPE_META: Record<TxType, { label: string; icon: typeof ArrowUpRight; cls: string }> =
  {
    income: { label: "Income", icon: ArrowDownLeft, cls: "text-success" },
    expense: { label: "Expense", icon: ArrowUpRight, cls: "text-destructive" },
    refund: { label: "Refund", icon: RotateCcw, cls: "text-chart-2" },
    transfer: { label: "Transfer", icon: ArrowRight, cls: "text-chart-4" },
  };

export function TypeBadge({ type }: { type: TxType }) {
  const m = TYPE_META[type];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <m.icon className={cn("size-3.5", m.cls)} aria-hidden />
      <span>{m.label}</span>
    </span>
  );
}

export function EmptyState({
  title,
  hint,
  icon,
}: {
  title: string;
  hint: string;
  icon?: ReactNode;
}) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed p-10 text-center">
      {icon}
      <p className="mt-2 font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

export function LoadingSkeletons({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading content">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}
