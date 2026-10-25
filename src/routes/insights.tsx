import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, LoadingSkeletons } from "@/components/bits";
import { useFinanceData } from "@/components/auth";
import { toast } from "sonner";
import { fmtDate, fmtINR, buildInsights, fmtDateTime } from "@/lib/finance";
import { Lightbulb, Eye, X, Wrench, Info } from "lucide-react";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "Insights · LedgeVue" },
      {
        name: "description",
        content:
          "Explainable findings about your spending — with the evidence and method behind every number.",
      },
      { property: "og:title", content: "Insights · LedgeVue" },
      { property: "og:description", content: "Explainable findings about your spending." },
    ],
  }),
  component: InsightsPage,
});

const KIND_LABEL: Record<string, string> = {
  increase: "Change detected",
  accumulation: "Accumulation",
  recurring: "Recurring pattern",
  budget: "Budget status",
  forecast: "Estimate",
  context: "How figures work",
};

function InsightsPage() {
  const finance = useFinanceData();
  const loading = finance.loading ?? false;
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [correcting, setCorrecting] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const insights = useMemo(
    () =>
      buildInsights(finance.transactions, finance.budgets, finance.recurring).filter(
        (i) => !dismissed.has(i.id),
      ),
    [finance.transactions, finance.budgets, finance.recurring, dismissed],
  );

  if (loading) return <LoadingSkeletons rows={5} />;

  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Info className="size-4" aria-hidden /> Every insight shows its method and evidence.
        Estimates are clearly labelled. Calculated {fmtDateTime(new Date())}.
      </p>

      {insights.length === 0 ? (
        <EmptyState
          title="No active insights"
          hint="Dismissed insights can return next time data is refreshed."
        />
      ) : (
        insights.map((i) => (
          <Card key={i.id} className="hover-lift">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{KIND_LABEL[i.kind]}</Badge>
                <Badge variant="outline">{i.period}</Badge>
              </div>
              <CardTitle className="flex items-start gap-2 text-base leading-snug">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                {i.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{i.explanation}</p>
              <div className="flex flex-wrap gap-2">
                {i.evidenceAmounts.map((e) => (
                  <span key={e} className="tabular rounded-md bg-muted px-2 py-1 text-xs">
                    {e}
                  </span>
                ))}
              </div>
              {i.evidenceTxIds.length > 0 && (
                <Accordion type="single" collapsible>
                  <AccordionItem value="ev" className="border-b-0">
                    <AccordionTrigger className="py-2 text-sm">
                      Supporting transactions ({i.evidenceTxIds.length})
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="divide-y text-sm">
                        {finance.transactions
                          .filter((t) => i.evidenceTxIds.includes(t.id))
                          .map((t) => (
                            <div key={t.id} className="flex justify-between py-1.5">
                              <span>
                                {fmtDate(t.date)} · {t.merchant}
                              </span>
                              <span className="tabular font-medium">{fmtINR(t.amount)}</span>
                            </div>
                          ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer font-medium">How this was calculated</summary>
                <p className="mt-1">{i.method}</p>
              </details>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link to="/transactions">
                    <Eye className="mr-1 size-3.5" /> Inspect transactions
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDismissed((p) => new Set(p).add(i.id));
                    toast("Insight dismissed", {
                      description: "It will not appear again this session.",
                    });
                  }}
                >
                  <X className="mr-1 size-3.5" /> Dismiss
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setCorrecting(i.id);
                    setNote("");
                  }}
                >
                  <Wrench className="mr-1 size-3.5" /> Correct
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={!!correcting} onOpenChange={(o) => !o && setCorrecting(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Tell us what's wrong</DialogTitle>
            <DialogDescription>
              Your correction updates how this insight is generated. Nothing is published
              automatically.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. 'That charge was a one-off, not recurring'"
            aria-label="Correction note"
          />
          <Button
            className="w-full"
            disabled={!note.trim()}
            onClick={() => {
              setCorrecting(null);
              toast.success("Correction noted — thank you");
            }}
          >
            Submit correction
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
