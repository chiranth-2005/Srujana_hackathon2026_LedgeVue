import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CircleDollarSign, Plus, Trash2 } from "lucide-react";
import { useAuth, useFinanceData } from "@/components/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";
import { CATEGORIES, fmtDate, fmtINR } from "@/lib/finance";

export const Route = createFileRoute("/intelligence")({
  head: () => ({ meta: [{ title: "Financial Intelligence · LedgeVue" }] }),
  component: FinancialIntelligence,
});

type PurchaseResult = {
  plannedPurchase: number;
  purchaseDate: string;
  horizonMonths: number;
  projectedBuffer: number | null;
  minimumBuffer: number;
  availableFunds: number | null;
  upcomingBills: number;
  risk: string;
  signal: string;
  explanation: string[];
  missingInputs: string[];
};

type Goal = NonNullable<ReturnType<typeof useFinanceData>["intelligence"]>["goals"][number];
type Rule = NonNullable<ReturnType<typeof useFinanceData>["intelligence"]>["rules"][number];

function localIsoToday() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const initialIsoToday = new Date().toISOString().slice(0, 10);

function FinancialIntelligence() {
  const finance = useFinanceData();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const intelligence = finance.intelligence;
  const [isoToday, setIsoToday] = useState(initialIsoToday);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [purchase, setPurchase] = useState<PurchaseResult | null>(null);
  const [purchaseTitle, setPurchaseTitle] = useState("Planned purchase");
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [alternativePurchaseAmount, setAlternativePurchaseAmount] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(initialIsoToday);
  const [horizon, setHorizon] = useState("3");
  const [minimumBuffer, setMinimumBuffer] = useState("5000");
  const [purchaseCategory, setPurchaseCategory] = useState("Shopping");
  const [replayTitle, setReplayTitle] = useState("");
  const [replayTransaction, setReplayTransaction] = useState("");
  const [replayCategory, setReplayCategory] = useState("");
  const [alternativeAmount, setAlternativeAmount] = useState("");
  const [monthlySaving, setMonthlySaving] = useState("0");
  const [replayMonths, setReplayMonths] = useState("12");
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalCurrent, setGoalCurrent] = useState("0");
  const [goalDate, setGoalDate] = useState("");
  const [goalPriority, setGoalPriority] = useState("normal");
  const [goalStatus, setGoalStatus] = useState("active");
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [ruleName, setRuleName] = useState("");
  const [ruleType, setRuleType] = useState("category_spend");
  const [ruleCategory, setRuleCategory] = useState("Dining");
  const [ruleThreshold, setRuleThreshold] = useState("");
  const [ruleAction, setRuleAction] = useState("warn");
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [correctedPriceAmounts, setCorrectedPriceAmounts] = useState<Record<string, string>>({});
  const expenses = useMemo(
    () => finance.transactions.filter((tx) => tx.type === "expense"),
    [finance.transactions],
  );

  useEffect(() => {
    const today = localIsoToday();
    setIsoToday(today);
    setPurchaseDate((currentDate) => (currentDate === initialIsoToday ? today : currentDate));
  }, []);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["finance", user?.id] });
  };

  const act = async (operation: () => Promise<unknown>, success?: string) => {
    setPending(true);
    setError("");
    try {
      await operation();
      await refresh();
      if (success) toast.success(success);
    } catch (reason) {
      const message =
        reason instanceof Error ? reason.message : "The request could not be completed.";
      setError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  };

  const calculatePurchase = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const result = await apiFetch<PurchaseResult & { scenarioId?: string }>(
        "/api/intelligence/purchase-impact",
        {
          method: "POST",
          body: JSON.stringify({
            title: purchaseTitle,
            amount: Number(purchaseAmount),
            category: purchaseCategory,
            purchase_date: purchaseDate,
            horizon_months: Number(horizon),
            minimum_buffer: Number(minimumBuffer),
            save: true,
          }),
        },
      );
      setPurchase(result);
      await refresh();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Purchase projection failed.";
      setError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  };

  const createReplay = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await act(async () => {
      await apiFetch("/api/intelligence/replays", {
        method: "POST",
        body: JSON.stringify({
          title: replayTitle,
          transaction_id: replayTransaction || null,
          category: replayTransaction ? null : replayCategory,
          alternative_amount: Number(alternativeAmount),
          monthly_saving: Number(monthlySaving),
          months: Number(replayMonths),
          save: true,
        }),
      });
    }, "Replay saved");
  };

  const createGoal = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await act(
      async () => {
        await apiFetch(
          editingGoalId ? `/api/intelligence/goals/${editingGoalId}` : "/api/intelligence/goals",
          {
            method: editingGoalId ? "PATCH" : "POST",
            body: JSON.stringify({
              title: goalTitle,
              target_amount: Number(goalTarget),
              current_amount: Number(goalCurrent),
              due_date: goalDate,
              priority: goalPriority,
              status: goalStatus,
            }),
          },
        );
        setGoalTitle("");
        setGoalTarget("");
        setGoalCurrent("0");
        setGoalDate("");
        setGoalPriority("normal");
        setGoalStatus("active");
        setEditingGoalId(null);
      },
      editingGoalId ? "Goal updated" : "Goal created",
    );
  };

  const createRule = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await act(
      async () => {
        await apiFetch(
          editingRuleId ? `/api/intelligence/rules/${editingRuleId}` : "/api/intelligence/rules",
          {
            method: editingRuleId ? "PATCH" : "POST",
            body: JSON.stringify({
              name: ruleName,
              condition_type: ruleType,
              category: ruleType === "category_spend" ? ruleCategory : null,
              threshold: Number(ruleThreshold),
              period: "calendar_month",
              action: ruleAction,
              active: true,
            }),
          },
        );
        setRuleName("");
        setRuleThreshold("");
        setRuleAction("warn");
        setEditingRuleId(null);
      },
      editingRuleId ? "Rule updated" : "Rule created",
    );
  };

  if (!intelligence) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Financial Intelligence is unavailable. Check the API connection and reload.
      </p>
    );
  }

  const scenarios = intelligence.scenarios ?? [];
  const goals = intelligence.goals ?? [];
  const rules = intelligence.rules ?? [];
  const changes = intelligence.priceCreep ?? [];
  const triggers = intelligence.ruleTriggers ?? [];
  const goalMonthlyPace = goals
    .filter((goal) => goal.status === "active")
    .reduce((total, goal) => total + goal.monthlyTarget, 0);
  const estimatedMonthlySurplus =
    intelligence.runway.monthlyIncome - intelligence.runway.monthlyExpense;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase text-primary">Evidence-led planning</p>
        <h2 className="mt-1 font-serif text-3xl font-medium">Financial Intelligence</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Test choices, review recurring-charge changes, compare past spending, plan a goal, and
          define your own alerts.
        </p>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <Tabs defaultValue="prevent" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 md:grid-cols-5">
          <TabsTrigger value="prevent">Prevent a mistake</TabsTrigger>
          <TabsTrigger value="prices">Price changes</TabsTrigger>
          <TabsTrigger value="replay">Decision replay</TabsTrigger>
          <TabsTrigger value="goals">Life-event goals</TabsTrigger>
          <TabsTrigger value="rules">My rules</TabsTrigger>
        </TabsList>

        <TabsContent value="prevent" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Model a planned purchase</CardTitle>
                <CardDescription>
                  Adjust the amount or date and save each comparison.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={calculatePurchase} className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="purchase-title">Scenario name</Label>
                    <Input
                      id="purchase-title"
                      value={purchaseTitle}
                      onChange={(event) => setPurchaseTitle(event.target.value)}
                      maxLength={120}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="purchase-amount">Purchase amount</Label>
                    <Input
                      id="purchase-amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={purchaseAmount}
                      onChange={(event) => setPurchaseAmount(event.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={purchaseCategory} onValueChange={setPurchaseCategory}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="purchase-date">Expected date</Label>
                    <Input
                      id="purchase-date"
                      type="date"
                      min={isoToday}
                      value={purchaseDate}
                      onChange={(event) => setPurchaseDate(event.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="purchase-horizon">Planning horizon (months)</Label>
                    <Input
                      id="purchase-horizon"
                      type="number"
                      min="1"
                      max="24"
                      value={horizon}
                      onChange={(event) => setHorizon(event.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="minimum-buffer">Preferred minimum buffer</Label>
                    <Input
                      id="minimum-buffer"
                      type="number"
                      min="0"
                      step="0.01"
                      value={minimumBuffer}
                      onChange={(event) => setMinimumBuffer(event.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="alternative-purchase-amount">
                      Compare an alternative amount (optional)
                    </Label>
                    <Input
                      id="alternative-purchase-amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={alternativePurchaseAmount}
                      onChange={(event) => setAlternativePurchaseAmount(event.target.value)}
                    />
                  </div>
                  <Button className="sm:col-span-2" disabled={pending}>
                    Calculate and save
                  </Button>
                </form>
                {!finance.transactions.length && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    You can still calculate a scenario without imported records. The result will
                    clearly show when there is not enough data for a reliable estimate.
                  </p>
                )}
              </CardContent>
            </Card>
            <div className="space-y-4">
              {purchase && (
                <PurchaseSummary
                  result={purchase}
                  alternativePurchaseAmount={alternativePurchaseAmount}
                />
              )}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Saved scenarios</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {scenarios.filter((scenario) => scenario.kind === "purchase").length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No purchase scenarios saved yet.
                    </p>
                  )}
                  {scenarios
                    .filter((scenario) => scenario.kind === "purchase")
                    .map((scenario) => (
                      <ScenarioRow
                        key={scenario.id}
                        scenario={scenario}
                        onDelete={() =>
                          void act(() =>
                            apiFetch(`/api/intelligence/scenarios/${scenario.id}`, {
                              method: "DELETE",
                            }),
                          )
                        }
                      />
                    ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="prices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Possible recurring-charge changes</CardTitle>
              <CardDescription>
                Only repeated charges with similar normalized merchant names and a stable monthly or
                quarterly interval are compared. Review each match before treating it as a real
                price change.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {changes.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No comparable recurring amount changes found in imported history.
                </p>
              )}
              {changes.map((change) => (
                <div
                  key={change.observationKey ?? change.merchant + change.period}
                  className="rounded-lg border p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {change.merchant}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          {change.changeType === "billing_frequency_change"
                            ? "Billing frequency changed"
                            : `Possible ${change.change >= 0 ? "increase" : "decrease"}`}
                        </span>
                      </p>
                      <p className="mt-1 text-sm">
                        {fmtINR(change.previousAmount)} → {fmtINR(change.newAmount)}{" "}
                        <span className="text-muted-foreground">
                          ({change.percentage.toFixed(1)}%,{" "}
                          {change.previousFrequency && change.previousFrequency !== change.frequency
                            ? `${change.previousFrequency} to ${change.frequency} billing`
                            : `${change.frequency ?? "recurring"} billing`}
                          )
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Evidence: {change.evidenceDates.map(fmtDate).join(" and ")} ·{" "}
                        {change.confidence ?? "possible match"} match
                      </p>
                    </div>
                    <span className="text-xs capitalize text-muted-foreground">
                      {change.reviewStatus ?? "pending"}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending || !change.observationKey}
                      onClick={() =>
                        void act(
                          () =>
                            apiFetch(
                              `/api/intelligence/price-changes/${change.observationKey}/review`,
                              { method: "PATCH", body: JSON.stringify({ status: "confirmed" }) },
                            ),
                          "Change confirmed",
                        )
                      }
                    >
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending || !change.observationKey}
                      onClick={() =>
                        void act(
                          () =>
                            apiFetch(
                              `/api/intelligence/price-changes/${change.observationKey}/review`,
                              { method: "PATCH", body: JSON.stringify({ status: "dismissed" }) },
                            ),
                          "Change dismissed",
                        )
                      }
                    >
                      Dismiss
                    </Button>
                    <Input
                      className="w-36"
                      type="number"
                      min="0.01"
                      step="0.01"
                      aria-label={`Correct amount for ${change.merchant}`}
                      placeholder="Correct amount"
                      value={correctedPriceAmounts[change.observationKey ?? ""] ?? ""}
                      onChange={(event) =>
                        setCorrectedPriceAmounts((current) => ({
                          ...current,
                          [change.observationKey ?? ""]: event.target.value,
                        }))
                      }
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        pending ||
                        !change.observationKey ||
                        !correctedPriceAmounts[change.observationKey ?? ""]
                      }
                      onClick={() =>
                        void act(
                          () =>
                            apiFetch(
                              `/api/intelligence/price-changes/${change.observationKey}/review`,
                              {
                                method: "PATCH",
                                body: JSON.stringify({
                                  status: "corrected",
                                  corrected_amount: Number(
                                    correctedPriceAmounts[change.observationKey ?? ""],
                                  ),
                                }),
                              },
                            ),
                          "Correction saved",
                        )
                      }
                    >
                      Save correction
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="replay" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Compare a past decision</CardTitle>
                <CardDescription>
                  Hypothetical only. Historical transactions are never changed and no interest is
                  assumed.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={createReplay} className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="replay-title">Scenario name</Label>
                    <Input
                      id="replay-title"
                      value={replayTitle}
                      onChange={(event) => setReplayTitle(event.target.value)}
                      required
                      maxLength={120}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Past expense (optional)</Label>
                    <Select
                      value={replayTransaction || "category"}
                      onValueChange={(value) =>
                        setReplayTransaction(value === "category" ? "" : value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an expense" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="category">Compare a category average</SelectItem>
                        {expenses.slice(0, 100).map((tx) => (
                          <SelectItem key={tx.id} value={tx.id}>
                            {fmtDate(tx.date)} · {tx.merchant} · {fmtINR(tx.amount)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {!replayTransaction && (
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={replayCategory} onValueChange={setReplayCategory}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose category" />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.filter(
                            (category) => category !== "Salary" && category !== "Freelance",
                          ).map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="alt-amount">Alternative amount</Label>
                      <Input
                        id="alt-amount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={alternativeAmount}
                        onChange={(event) => setAlternativeAmount(event.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="replay-months">Comparison period (months)</Label>
                      <Select value={replayMonths} onValueChange={setReplayMonths}>
                        <SelectTrigger id="replay-months">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[3, 6, 12, 24].map((month) => (
                            <SelectItem key={month} value={String(month)}>
                              {month} months
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="monthly-saving">Additional monthly saving (optional)</Label>
                    <Input
                      id="monthly-saving"
                      type="number"
                      min="0"
                      step="0.01"
                      value={monthlySaving}
                      onChange={(event) => setMonthlySaving(event.target.value)}
                    />
                  </div>
                  <Button disabled={pending || (!replayTransaction && !replayCategory)}>
                    Calculate and save replay
                  </Button>
                </form>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Saved replays</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {scenarios.filter((scenario) => scenario.kind === "replay").length === 0 && (
                  <p className="text-sm text-muted-foreground">No replays saved yet.</p>
                )}
                {scenarios
                  .filter((scenario) => scenario.kind === "replay")
                  .map((scenario) => (
                    <ScenarioRow
                      key={scenario.id}
                      scenario={scenario}
                      onDelete={() =>
                        void act(() =>
                          apiFetch(`/api/intelligence/scenarios/${scenario.id}`, {
                            method: "DELETE",
                          }),
                        )
                      }
                    />
                  ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="goals" className="space-y-4">
          {goals.some((goal) => goal.status === "active") &&
            goalMonthlyPace > Math.max(0, estimatedMonthlySurplus) && (
              <div
                role="status"
                className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 p-3 text-sm"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                <span>
                  Active goals call for {fmtINR(goalMonthlyPace)}/month, above the recent estimated
                  net cash flow of {fmtINR(Math.max(0, estimatedMonthlySurplus))}/month. This
                  comparison excludes account balances and may omit income or commitments.
                </span>
              </div>
            )}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Create a savings goal</CardTitle>
                <CardDescription>
                  Required pace is based on the remaining amount and full months until the selected
                  date.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={createGoal} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="goal-title">Goal</Label>
                    <Input
                      id="goal-title"
                      placeholder="Moving, education, emergency fund…"
                      value={goalTitle}
                      onChange={(event) => setGoalTitle(event.target.value)}
                      required
                      maxLength={120}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="goal-target">Target amount</Label>
                      <Input
                        id="goal-target"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={goalTarget}
                        onChange={(event) => setGoalTarget(event.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="goal-current">Already allocated</Label>
                      <Input
                        id="goal-current"
                        type="number"
                        min="0"
                        step="0.01"
                        value={goalCurrent}
                        onChange={(event) => setGoalCurrent(event.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="goal-date">Target date</Label>
                    <Input
                      id="goal-date"
                      type="date"
                      min={editingGoalId ? undefined : isoToday}
                      value={goalDate}
                      onChange={(event) => setGoalDate(event.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={goalPriority} onValueChange={setGoalPriority}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button disabled={pending}>
                    <Plus className="mr-2 size-4" />
                    {editingGoalId ? "Save goal" : "Create goal"}
                  </Button>
                </form>
              </CardContent>
            </Card>
            <div className="space-y-3">
              {goals.length === 0 && (
                <Card>
                  <CardContent className="p-6 text-sm text-muted-foreground">
                    Your goals will appear here after you create one.
                  </CardContent>
                </Card>
              )}
              {goals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  pending={pending}
                  act={act}
                  onEdit={() => {
                    setEditingGoalId(goal.id);
                    setGoalTitle(goal.title);
                    setGoalTarget(String(goal.targetAmount));
                    setGoalCurrent(String(goal.currentAmount));
                    setGoalDate(goal.dueDate);
                    setGoalPriority(goal.priority);
                    setGoalStatus(goal.status);
                    document.getElementById("goal-title")?.focus();
                  }}
                />
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Create a financial rule</CardTitle>
                <CardDescription>
                  Rules use predefined conditions and never execute user-supplied code.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={createRule} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="rule-name">Rule name</Label>
                    <Input
                      id="rule-name"
                      value={ruleName}
                      onChange={(event) => setRuleName(event.target.value)}
                      required
                      maxLength={120}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Condition</Label>
                    <Select value={ruleType} onValueChange={setRuleType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="transaction_amount">
                          Transaction amount reaches threshold
                        </SelectItem>
                        <SelectItem value="category_spend">
                          Category spending exceeds threshold
                        </SelectItem>
                        <SelectItem value="recurring_charge">
                          Detected recurring charge reaches threshold
                        </SelectItem>
                        <SelectItem value="projected_buffer">
                          Average monthly net cash flow below threshold
                        </SelectItem>
                        <SelectItem value="own_transfer">
                          Flag a classified account transfer
                        </SelectItem>
                        <SelectItem value="goal_behind">Goal savings pace falls behind</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {ruleType === "category_spend" && (
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={ruleCategory} onValueChange={setRuleCategory}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="rule-threshold">Threshold</Label>
                    <Input
                      id="rule-threshold"
                      type="number"
                      min="0"
                      step="0.01"
                      value={ruleThreshold}
                      onChange={(event) => setRuleThreshold(event.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Action</Label>
                    <Select value={ruleAction} onValueChange={setRuleAction}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flag">Flag</SelectItem>
                        <SelectItem value="warn">Warn</SelectItem>
                        <SelectItem value="insight">Include in insights</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button disabled={pending}>
                    <Plus className="mr-2 size-4" />
                    {editingRuleId ? "Save rule" : "Add rule"}
                  </Button>
                </form>
              </CardContent>
            </Card>
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Configured rules</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {rules.length === 0 && (
                    <p className="text-sm text-muted-foreground">No rules configured.</p>
                  )}
                  {rules.map((rule) => (
                    <RuleRow
                      key={rule.id}
                      rule={rule}
                      pending={pending}
                      act={act}
                      onEdit={() => {
                        setEditingRuleId(rule.id);
                        setRuleName(rule.name);
                        setRuleType(rule.conditionType);
                        setRuleCategory(rule.category ?? "Dining");
                        setRuleThreshold(String(rule.threshold));
                        setRuleAction(rule.action);
                        document.getElementById("rule-name")?.focus();
                      }}
                      onDuplicate={() =>
                        void act(
                          () =>
                            apiFetch("/api/intelligence/rules", {
                              method: "POST",
                              body: JSON.stringify({
                                name: `${rule.name} copy`,
                                condition_type: rule.conditionType,
                                category: rule.category,
                                threshold: rule.threshold,
                                period: rule.period,
                                action: rule.action,
                                active: true,
                              }),
                            }),
                          "Rule duplicated",
                        )
                      }
                    />
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recent triggers</CardTitle>
                  <CardDescription>
                    Each trigger includes the evidence that matched its rule.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {triggers.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No rules have triggered on current evidence.
                    </p>
                  )}
                  {triggers.map((trigger) => (
                    <div key={trigger.id} className="rounded-md border p-3">
                      <p className="text-sm">{trigger.explanation}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(trigger.createdAt).toLocaleString()}
                      </p>
                      <details className="mt-2 text-xs">
                        <summary className="cursor-pointer">Inspect evidence</summary>
                        <pre className="mt-2 overflow-auto whitespace-pre-wrap">
                          {JSON.stringify(trigger.evidence, null, 2)}
                        </pre>
                      </details>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        These tools provide transparent planning estimates, not financial advice or live account
        balances. Imported records may be incomplete; verify bills and balances before acting.
      </p>
    </div>
  );
}

function PurchaseSummary({
  result,
  alternativePurchaseAmount,
}: {
  result: PurchaseResult;
  alternativePurchaseAmount: string;
}) {
  const alternativeAmount = Number(alternativePurchaseAmount);
  const alternativeBuffer =
    result.availableFunds !== null && Number.isFinite(alternativeAmount) && alternativeAmount > 0
      ? result.availableFunds - alternativeAmount
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CircleDollarSign className="size-4" />
          {result.signal === "Insufficient Data"
            ? "Impact estimate: Insufficient Data"
            : `Indicative impact: ${result.signal}`}
        </CardTitle>
        <CardDescription>
          {fmtDate(result.purchaseDate)} · {result.horizonMonths}-month horizon · Data status:{" "}
          {result.risk}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <p>
            Purchase: <strong>{fmtINR(result.plannedPurchase)}</strong>
          </p>
          <p>
            Preferred buffer: <strong>{fmtINR(result.minimumBuffer)}</strong>
          </p>
          <p>
            Estimated funds before purchase:{" "}
            <strong>
              {result.availableFunds === null ? "Unavailable" : fmtINR(result.availableFunds)}
            </strong>
          </p>
          <p>
            Estimated remainder after purchase:{" "}
            <strong>
              {result.projectedBuffer === null
                ? "Insufficient data"
                : fmtINR(result.projectedBuffer)}
            </strong>
          </p>
          <p className="col-span-2">
            Estimated upcoming recurring bills: <strong>{fmtINR(result.upcomingBills)}</strong>
          </p>
          {alternativeBuffer !== null && (
            <p className="col-span-2">
              Alternative ({fmtINR(alternativeAmount)}) would leave an estimated{" "}
              <strong>{fmtINR(alternativeBuffer)}</strong> for the same date and horizon.
            </p>
          )}
        </div>
        <ul className="space-y-1 text-xs text-muted-foreground">
          {result.explanation.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {result.missingInputs.length > 0 && (
          <p className="text-xs text-warning">Missing inputs: {result.missingInputs.join(", ")}</p>
        )}
      </CardContent>
    </Card>
  );
}

function ScenarioRow({
  scenario,
  onDelete,
}: {
  scenario: { id: string; title: string; createdAt: string; data: Record<string, unknown> };
  onDelete: () => void;
}) {
  const data = scenario.data;
  const potentialSavings = data["potentialSavings"];
  const risk = data["signal"] ?? data["risk"];
  const actualAmount = data["actualAmount"];
  const alternativeAmount = data["alternativeAmount"];
  const plannedPurchase = data["plannedPurchase"];
  const projectedBuffer = data["projectedBuffer"];
  const detail =
    typeof actualAmount === "number" && typeof alternativeAmount === "number"
      ? `Actual ${fmtINR(actualAmount)} vs alternative ${fmtINR(alternativeAmount)} · potential savings ${fmtINR(typeof potentialSavings === "number" ? potentialSavings : 0)}`
      : typeof plannedPurchase === "number"
        ? `Purchase ${fmtINR(plannedPurchase)} · projected remainder ${typeof projectedBuffer === "number" ? fmtINR(projectedBuffer) : "unavailable"} · signal ${typeof risk === "string" ? risk : "insufficient data"}`
        : typeof potentialSavings === "number"
          ? `Potential savings ${fmtINR(potentialSavings)}`
          : typeof risk === "string"
            ? `Indicative signal: ${risk}`
            : "Saved scenario";
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{scenario.title}</p>
        <p className="text-xs text-muted-foreground">
          {new Date(scenario.createdAt).toLocaleDateString()} · {detail}
        </p>
      </div>
      <Button
        size="icon"
        variant="ghost"
        aria-label={`Delete ${scenario.title}`}
        onClick={onDelete}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

function GoalCard({
  goal,
  pending,
  act,
  onEdit,
}: {
  goal: Goal;
  pending: boolean;
  act: (operation: () => Promise<unknown>, success?: string) => Promise<void>;
  onEdit: () => void;
}) {
  const [contribution, setContribution] = useState("");
  const update = (status: string) =>
    act(
      () =>
        apiFetch(`/api/intelligence/goals/${goal.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            title: goal.title,
            target_amount: goal.targetAmount,
            current_amount: goal.currentAmount,
            due_date: goal.dueDate,
            priority: goal.priority,
            status,
          }),
        }),
      "Goal updated",
    );
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium">{goal.title}</h3>
              <span className="text-xs capitalize text-muted-foreground">
                {goal.status} · {goal.priority} priority
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {fmtINR(goal.currentAmount)} of {fmtINR(goal.targetAmount)} ·{" "}
              {fmtINR(goal.remainingAmount)} remaining
            </p>
          </div>
          <div className="flex">
            <Button size="sm" variant="ghost" onClick={onEdit}>
              Edit
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Delete ${goal.title}`}
              onClick={() =>
                void act(() => apiFetch(`/api/intelligence/goals/${goal.id}`, { method: "DELETE" }))
              }
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
        <div className="h-2 overflow-hidden rounded bg-muted">
          <div className="h-full bg-primary" style={{ width: `${goal.progress}%` }} />
        </div>
        <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {goal.progress}% · due {fmtDate(goal.dueDate)}
          </span>
          <span>
            Suggested pace {fmtINR(goal.monthlyTarget)}/month · {goal.monthsRemaining} months left
          </span>
        </div>
        {goal.status !== "complete" && (
          <div className="flex flex-wrap gap-2">
            <Input
              className="max-w-48"
              aria-label={`Contribution to ${goal.title}`}
              type="number"
              min="0.01"
              step="0.01"
              value={contribution}
              onChange={(event) => setContribution(event.target.value)}
              placeholder="Contribution amount"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={pending || !contribution}
              onClick={() =>
                void act(async () => {
                  await apiFetch(`/api/intelligence/goals/${goal.id}/contributions`, {
                    method: "POST",
                    body: JSON.stringify({
                      amount: Number(contribution),
                      contributed_at: isoToday,
                      note: "Manual contribution",
                    }),
                  });
                  setContribution("");
                }, "Contribution recorded")
              }
            >
              Add contribution
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => void update(goal.status === "paused" ? "active" : "paused")}
            >
              {goal.status === "paused" ? "Resume" : "Pause"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RuleRow({
  rule,
  pending,
  act,
  onEdit,
  onDuplicate,
}: {
  rule: Rule;
  pending: boolean;
  act: (operation: () => Promise<unknown>, success?: string) => Promise<void>;
  onEdit: () => void;
  onDuplicate: () => void;
}) {
  const toggle = () =>
    act(
      () =>
        apiFetch(`/api/intelligence/rules/${rule.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: rule.name,
            condition_type: rule.conditionType,
            category: rule.category,
            threshold: rule.threshold,
            period: rule.period,
            action: rule.action,
            active: !rule.active,
          }),
        }),
      rule.active ? "Rule disabled" : "Rule enabled",
    );
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
      <div>
        <p className="text-sm font-medium">{rule.name}</p>
        <p className="text-xs text-muted-foreground">
          {rule.conditionType.replaceAll("_", " ")} · threshold {fmtINR(rule.threshold)}
          {rule.category ? ` · ${rule.category}` : ""} · {rule.period.replaceAll("_", " ")} ·{" "}
          {rule.action}
        </p>
      </div>
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" disabled={pending} onClick={onEdit}>
          Edit
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={onDuplicate}>
          Duplicate
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => void toggle()}>
          {rule.active ? "Disable" : "Enable"}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Delete ${rule.name}`}
          onClick={() =>
            void act(() => apiFetch(`/api/intelligence/rules/${rule.id}`, { method: "DELETE" }))
          }
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
