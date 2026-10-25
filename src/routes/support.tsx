import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { LifeBuoy } from "lucide-react";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support · LedgeVue" },
      {
        name: "description",
        content:
          "FAQs about importing, categorization, recurring detection, refunds, budgets and privacy — plus a contact form.",
      },
      { property: "og:title", content: "Support · LedgeVue" },
      { property: "og:description", content: "FAQs and contact form for LedgeVue." },
    ],
  }),
  component: SupportPage,
});

const FAQS = [
  [
    "How do I import my transactions?",
    "Go to Settings → Data import and choose CSV upload or auto-import from a connected account. Auto-categorization applies on import, and you can correct any category later from the transaction explorer.",
  ],
  [
    "How does categorization work?",
    "Merchants are matched against known categories first, then amounts and timing refine the guess. Every assignment is editable — corrections feed back into future matches.",
  ],
  [
    "How are recurring payments detected?",
    "LedgeVue looks for similar amounts from the same merchant repeating on a stable interval across at least three cycles. Detected items remain suggestions until you review them.",
  ],
  [
    "How are refunds handled?",
    "Refunds are subtracted from expenditure in every summary, so 'net spending' always reflects money that came back. You can see gross expenditure separately on the dashboard.",
  ],
  [
    "What about transfers between my own accounts?",
    "Transfers are excluded from income and spending summaries entirely, so moving money between your own accounts never inflates your expenses.",
  ],
  [
    "How do budgets work?",
    "Budgets are monthly limits per category. They compare against actual spending for the current month and reset automatically. Alerts appear when a category reaches 80% of its limit.",
  ],
  [
    "What data do you collect?",
    "Only what's needed to run the product. Optional analytics and marketing cookies require your consent, and no financial figures are ever placed in tracking events.",
  ],
  [
    "What if an insight is wrong?",
    "Every insight shows the evidence and the calculation method. Use the 'Correct' action on the insight to tell us what's off — your correction changes how that insight is generated.",
  ],
];

function SupportPage() {
  const [sent, setSent] = useState(false);
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LifeBuoy className="size-4 text-primary" /> Frequently asked questions
          </CardTitle>
          <CardDescription>
            Everything about imports, detection, refunds and privacy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map(([q, a], i) => (
              <AccordionItem key={i} value={`q${i}`}>
                <AccordionTrigger className="text-left text-sm font-medium">{q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact us</CardTitle>
          <CardDescription>Typical response time: under 1 business day.</CardDescription>
        </CardHeader>
        <CardContent className="max-w-md">
          {sent ? (
            <div
              role="status"
              className="rounded-lg border border-success/40 bg-success/10 p-4 text-sm"
            >
              Thanks — your message was sent. We'll reply to your email shortly.
            </div>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                setSent(true);
                toast.success("Message sent to support");
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="c-name">Name</Label>
                <Input id="c-name" required placeholder="Your name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-email">Email</Label>
                <Input id="c-email" type="email" required placeholder="you@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-msg">Message</Label>
                <Textarea id="c-msg" required rows={4} placeholder="How can we help?" />
              </div>
              <Button type="submit">Send message</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
