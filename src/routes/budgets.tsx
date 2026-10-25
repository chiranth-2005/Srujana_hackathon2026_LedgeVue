import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, LoadingSkeletons } from "@/components/bits";
import { useFinanceData } from "@/components/auth";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import {
  fmtINR,
  CATEGORIES,
  rangeForSelection,
  inRange,
  budgetSpend,
  type Category,
} from "@/lib/finance";
import { Plus, Pencil, Trash2, Wallet, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/budgets")({
  head: () => ({
    meta: [
      { title: "Budgets · LedgeVue" },
      {
        name: "description",
        content: "Set monthly category budgets and see how actual spending compares.",
      },
      { property: "og:title", content: "Budgets · LedgeVue" },
      {
        property: "og:description",
        content: "Set monthly category budgets and track actual spending.",
      },
    ],
  }),
  component: BudgetsPage,
});

export default function BudgetsPage() {
  const finance = useFinanceData();
  const queryClient = useQueryClient();
  const loading = finance.loading ?? false;
  const budgets = finance.budgets;
  const [dialog, setDialog] = useState<{ mode: "create" | "edit"; budget?: Budget } | null>(null);
  const [category, setCategory] = useState<Category | "">("");
  const [limit, setLimit] = useState("");

  const data = useMemo(() => {
    const sel = rangeForSelection("this");
    const list = finance.transactions.filter((t) => inRange(t, sel.from, sel.to));
    return budgetSpend(budgets, list);
  }, [budgets, finance.transactions]);

  const openCreate = () => {
    setDialog({ mode: "create" });
    setCategory("");
    setLimit("");
  };
  const openEdit = (b: Budget) => {
    setDialog({ mode: "edit", budget: b });
    setCategory(b.category);
    setLimit(String(b.limit));
  };

  const save = async () => {
    const amount = Number(limit);
    if (!category) {
      toast.error("Choose a category");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Budget must be a positive amount");
      return;
    }
    if (dialog?.mode === "create" && budgets.some((b) => b.category === category)) {
      toast.error("A budget for this category already exists");
      return;
    }
    try {
      if (dialog?.mode === "edit" && dialog.budget && dialog.budget.category !== category) {
        await apiFetch(`/api/budgets/${encodeURIComponent(dialog.budget.category)}`, {
          method: "DELETE",
        });
      }
      await apiFetch("/api/budgets", {
        method: "POST",
        body: JSON.stringify({ category, limit: amount }),
      });
      await queryClient.invalidateQueries({ queryKey: ["finance"] });
      setDialog(null);
      toast.success(`Budget for ${category} saved`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Budget could not be saved");
    }
  };

  if (loading) return <LoadingSkeletons rows={5} />;

  const alerts = data.filter((b) => b.pct >= 80);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="size-5 text-primary" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Monthly budgets compared with this month's spending
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1 size-4" /> New budget
        </Button>
      </div>

      {alerts.length > 0 && (
        <Card className="border-warning/50">
          <CardContent className="flex items-center gap-3 py-4 text-sm">
            <AlertTriangle className="size-4 text-warning" aria-hidden />
            <span>
              {alerts.map((a) => `${a.category} (${a.pct}%)`).join(", ")}{" "}
              {alerts.length === 1 ? "is" : "are"} at or near the limit.
            </span>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {data.map((b) => (
          <Card key={b.category} className="hover-lift">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base">{b.category}</CardTitle>
                <CardDescription className="tabular">
                  {fmtINR(b.spent)} of {fmtINR(b.limit)}
                </CardDescription>
              </div>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Edit ${b.category} budget`}
                  onClick={() => openEdit(b)}
                >
                  <Pencil className="size-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove ${b.category} budget`}
                      className="text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove the {b.category} budget?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Your spending history is kept — only the budget limit for this category is
                        removed. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={async () => {
                          try {
                            await apiFetch(`/api/budgets/${encodeURIComponent(b.category)}`, {
                              method: "DELETE",
                            });
                            await queryClient.invalidateQueries({ queryKey: ["finance"] });
                            toast.success(`${b.category} budget removed`);
                          } catch (error) {
                            toast.error(
                              error instanceof Error
                                ? error.message
                                : "Budget could not be removed",
                            );
                          }
                        }}
                      >
                        Remove budget
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardHeader>
            <CardContent>
              <Progress
                value={b.pct}
                aria-label={`${b.category} budget ${b.pct}% used`}
                className={
                  b.pct >= 100 ? "[&>div]:bg-destructive" : b.pct >= 80 ? "[&>div]:bg-warning" : ""
                }
              />
              <div className="mt-2 flex justify-between text-xs">
                <span className="text-muted-foreground">
                  {b.remaining >= 0
                    ? `${fmtINR(b.remaining)} remaining`
                    : `${fmtINR(-b.remaining)} over budget`}
                </span>
                <span
                  className={`tabular font-semibold ${b.pct >= 100 ? "text-destructive" : b.pct >= 80 ? "text-warning" : "text-success"}`}
                >
                  {b.pct}%
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {data.length === 0 && (
        <EmptyState
          title="No budgets set"
          hint="Create category limits to compare your goals with imported spending."
          icon={<Wallet className="size-6 text-muted-foreground" />}
        />
      )}

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === "edit" ? "Edit budget" : "Create monthly budget"}
            </DialogTitle>
            <DialogDescription>
              Budgets reset every month and compare against actual spending.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="b-cat">Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                <SelectTrigger id="b-cat" aria-label="Budget category">
                  <SelectValue placeholder="Choose category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.filter((c) => c !== "Salary" && c !== "Freelance").map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-limit">Monthly limit (₹)</Label>
              <Input
                id="b-limit"
                type="number"
                min={1}
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                placeholder="e.g. 5000"
              />
            </div>
            {limit && (!Number.isFinite(Number(limit)) || Number(limit) <= 0) && (
              <p className="text-xs text-destructive">Enter a positive amount.</p>
            )}
            <Button className="w-full" onClick={save}>
              Save budget
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
