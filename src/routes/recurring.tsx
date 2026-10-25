import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import { fmtINR, fmtDate, type RecurringPayment } from "@/lib/finance";
import { Repeat, Check, X, Pencil, AlertCircle, CircleCheck } from "lucide-react";

export const Route = createFileRoute("/recurring")({
  head: () => ({
    meta: [
      { title: "Recurring Payments · LedgeVue" },
      {
        name: "description",
        content:
          "Detected subscriptions, loan repayments and repeating commitments — confirm or correct each one.",
      },
      { property: "og:title", content: "Recurring Payments · LedgeVue" },
      { property: "og:description", content: "Detected subscriptions and repeating commitments." },
    ],
  }),
  component: RecurringPage,
});

export default function RecurringPage() {
  const finance = useFinanceData();
  const loading = finance.loading ?? false;
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [updates, setUpdates] = useState<Record<string, Partial<RecurringPayment>>>({});
  const [editing, setEditing] = useState<RecurringPayment | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editFreq, setEditFreq] = useState<"monthly" | "quarterly">("monthly");

  if (loading) return <LoadingSkeletons rows={5} />;

  const visible = finance.recurring
    .filter((item) => !dismissed.has(item.id))
    .map((item) => ({ ...item, ...updates[item.id] }));
  const monthlyTotal = visible
    .filter((r) => r.frequency === "monthly" && r.category !== "Salary")
    .reduce((s, r) => s + r.amount, 0);

  const confirm = (item: RecurringPayment) => {
    setUpdates((current) => ({
      ...current,
      [item.id]: { ...current[item.id], confidence: "confirmed" },
    }));
    toast.success(`${item.merchant} confirmed for this session`);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-3">
            <Repeat className="size-5 text-primary" aria-hidden />
            <div>
              <p className="text-sm font-medium">Estimated future commitment</p>
              <p className="text-xs text-muted-foreground">
                Based on items shown below (salary excluded)
              </p>
            </div>
          </div>
          <p className="tabular text-xl font-semibold">
            {fmtINR(monthlyTotal)}
            <span className="text-sm font-normal text-muted-foreground">
              {" "}
              / month · {fmtINR(monthlyTotal * 12)} / year
            </span>
          </p>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Detected patterns come from your imported transactions. Confirmations, corrections, and
        dismissals are temporary in this version.
      </p>

      {visible.length === 0 ? (
        <EmptyState
          title="No recurring payments to show"
          hint="Revisit after more transactions are imported, or reset filters."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visible.map((r) => (
            <Card key={r.id} className="hover-lift">
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div>
                  <CardTitle className="text-base">{r.merchant}</CardTitle>
                  <CardDescription>
                    {r.category} · {r.frequency}
                  </CardDescription>
                </div>
                {r.confidence === "confirmed" ? (
                  <Badge variant="secondary" className="gap-1">
                    <CircleCheck className="size-3" /> Confirmed
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-warning">
                    <AlertCircle className="size-3" /> Detected
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Amount</p>
                    <p className="tabular font-semibold">{fmtINR(r.amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Last paid</p>
                    <p className="tabular">{fmtDate(r.lastPaid)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Next expected</p>
                    <p className="tabular">
                      {r.nextExpected ? fmtDate(r.nextExpected) : "Not enough data"}
                    </p>
                  </div>
                </div>
                {r.confidence === "detected" && (
                  <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
                    Detected from repeating patterns in your history — it is not a confirmed
                    subscription until you confirm it.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => confirm(r)}>
                    <Check className="mr-1 size-3.5" /> Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDismissed((current) => new Set(current).add(r.id));
                      toast.success(`${r.merchant} dismissed for this session`);
                    }}
                  >
                    <X className="mr-1 size-3.5" /> Dismiss
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(r);
                      setEditAmount(String(r.amount));
                      setEditFreq(r.frequency);
                    }}
                  >
                    <Pencil className="mr-1 size-3.5" /> Correct
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Correct {editing?.merchant}</DialogTitle>
            <DialogDescription>
              Fix the amount or frequency so future estimates stay accurate.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="rp-amount">Amount (₹)</Label>
              <Input
                id="rp-amount"
                type="number"
                min={1}
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Frequency</Label>
              <Select value={editFreq} onValueChange={(v) => setEditFreq(v as typeof editFreq)}>
                <SelectTrigger aria-label="Frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(!editAmount || Number(editAmount) <= 0) && (
              <p className="text-xs text-destructive">Enter an amount greater than zero.</p>
            )}
            <Button
              className="w-full"
              disabled={!editAmount || Number(editAmount) <= 0}
              onClick={() => {
                if (!editing) return;
                setUpdates((current) => ({
                  ...current,
                  [editing.id]: {
                    ...current[editing.id],
                    amount: Number(editAmount),
                    frequency: editFreq,
                  },
                }));
                setEditing(null);
                toast.success(`${editing.merchant} corrected for this session`);
              }}
            >
              Save correction
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
