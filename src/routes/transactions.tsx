import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { EmptyState, TypeBadge, LoadingSkeletons } from "@/components/bits";
import { useFinanceData } from "@/components/auth";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { Copy, Download, CheckCircle2, SearchX, ArrowUpDown } from "lucide-react";
import { CATEGORIES, fmtINR, fmtDate, type Category, type TxType } from "@/lib/finance";

export const Route = createFileRoute("/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions · LedgeVue" },
      {
        name: "description",
        content: "Search, filter, review and categorize every transaction across your accounts.",
      },
      { property: "og:title", content: "Transactions · LedgeVue" },
      {
        property: "og:description",
        content: "Search, filter, review and categorize every transaction across your accounts.",
      },
    ],
  }),
  component: TransactionsPage,
});

const PAGE_SIZE = 10;

function TransactionsPage() {
  const { transactions, accounts, loading } = useFinanceData();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [acc, setAcc] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [sortKey, setSortKey] = useState<"date" | "amount">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<string | null>(null);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = [...transactions];
    if (term)
      list = list.filter((t) =>
        (t.merchant + " " + t.description + " " + t.ref).toLowerCase().includes(term),
      );
    if (cat !== "all") list = list.filter((t) => t.category === cat);
    if (acc !== "all") list = list.filter((t) => t.accountId === acc);
    if (type !== "all") list = list.filter((t) => t.type === type);
    list.sort(
      (a, b) =>
        (sortKey === "date" ? a.date.localeCompare(b.date) : a.amount - b.amount) *
        (sortDir === "asc" ? 1 : -1),
    );
    return list;
  }, [transactions, q, cat, acc, type, sortKey, sortDir]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const tx = detail ? rows.find((r) => r.id === detail) : null;

  const toggleSort = (k: "date" | "amount") => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir("desc");
    }
    setPage(1);
  };

  const updateCategory = async (id: string, category: Category) => {
    try {
      await apiFetch(`/api/transactions/${encodeURIComponent(id)}/category`, {
        method: "PATCH",
        body: JSON.stringify({ category }),
      });
      await queryClient.invalidateQueries({ queryKey: ["finance"] });
      toast.success(`Category updated to ${category}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Category could not be updated");
    }
  };

  const exportCsv = () => {
    const chosen = rows.filter((r) => selected.has(r.id));
    if (chosen.length === 0) {
      toast.error("Select at least one transaction to export");
      return;
    }
    const csvCell = (value: string | number) => {
      const text = String(value);
      const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
      return `"${safe.replaceAll('"', '""')}"`;
    };
    const csv = [
      ["ref", "date", "merchant", "description", "amount", "type", "account", "category"],
      ...chosen.map((t) => [
        t.ref,
        t.date,
        t.merchant,
        t.description,
        t.amount,
        t.type,
        accounts.find((account) => account.id === t.accountId)?.name ?? t.accountId,
        t.category,
      ]),
    ]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledgevue-transactions-${chosen.length}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${chosen.length} transactions`);
  };

  const copyRef = (ref: string) => {
    navigator.clipboard?.writeText(ref).then(
      () => toast.success(`Copied ${ref}`),
      () => toast.error("Copying is unavailable in this browser — reference: " + ref),
    );
  };

  if (loading) return <LoadingSkeletons rows={6} />;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 py-4">
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search merchant, description or reference…"
            className="w-full sm:w-64"
            aria-label="Search transactions"
          />
          <Select
            value={cat}
            onValueChange={(v) => {
              setCat(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-40" aria-label="Filter by category">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={acc}
            onValueChange={(v) => {
              setAcc(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-44" aria-label="Filter by account">
              <SelectValue placeholder="Account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={type}
            onValueChange={(v) => {
              setType(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-36" aria-label="Filter by type">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
              <SelectItem value="refund">Refund</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCsv} className="ml-auto">
            <Download className="mr-1 size-4" /> Export selected ({selected.size})
          </Button>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          title="No transactions match your filters"
          hint="Try clearing the search or widening the filters."
          icon={<SearchX className="size-6 text-muted-foreground" />}
        />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto pb-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox
                      aria-label="Select all on page"
                      checked={pageRows.every((r) => selected.has(r.id)) && pageRows.length > 0}
                      onCheckedChange={(c) => {
                        const s = new Set(selected);
                        pageRows.forEach((r) => (c ? s.add(r.id) : s.delete(r.id)));
                        setSelected(s);
                      }}
                    />
                  </TableHead>
                  <TableHead>
                    <button
                      className="inline-flex items-center gap-1"
                      onClick={() => toggleSort("date")}
                    >
                      Date <ArrowUpDown className="size-3" />
                    </button>
                  </TableHead>
                  <TableHead>Merchant / description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">
                    <button
                      className="inline-flex items-center gap-1"
                      onClick={() => toggleSort("amount")}
                    >
                      Amount <ArrowUpDown className="size-3" />
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((t) => (
                  <TableRow
                    key={t.id}
                    className="cursor-pointer hover:bg-accent/60"
                    onClick={() => setDetail(t.id)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        aria-label={`Select ${t.merchant}`}
                        checked={selected.has(t.id)}
                        onCheckedChange={(c) => {
                          const s = new Set(selected);
                          if (c) s.add(t.id);
                          else s.delete(t.id);
                          setSelected(s);
                        }}
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {fmtDate(t.date)}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{t.merchant}</p>
                      <p className="text-xs text-muted-foreground">{t.description}</p>
                    </TableCell>
                    <TableCell>
                      <TypeBadge type={t.type} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {accounts.find((account) => account.id === t.accountId)?.name ?? t.accountId}
                    </TableCell>
                    <TableCell>{t.category}</TableCell>
                    <TableCell>
                      <Badge variant={reviewed.has(t.id) || t.reviewed ? "secondary" : "outline"}>
                        {reviewed.has(t.id) || t.reviewed ? "Reviewed" : "Unreviewed"}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular text-right font-semibold">
                      {t.type === "income" || t.type === "refund"
                        ? "+"
                        : t.type === "expense"
                          ? "−"
                          : ""}
                      {fmtINR(t.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between pt-3 text-sm text-muted-foreground">
              <span>
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, rows.length)} of{" "}
                {rows.length}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <span aria-live="polite">
                  Page {page} of {pages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === pages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Sheet open={!!tx} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent side="right" className="w-96 max-w-[92vw] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{tx?.merchant}</SheetTitle>
            <SheetDescription>Transaction details</SheetDescription>
          </SheetHeader>
          {tx && (
            <div className="space-y-4 px-4">
              <p className="tabular text-3xl font-semibold">
                {tx.type === "income" || tx.type === "refund"
                  ? "+"
                  : tx.type === "expense"
                    ? "−"
                    : ""}
                {fmtINR(tx.amount)}
              </p>
              <dl className="space-y-2 text-sm">
                {[
                  ["Date", fmtDate(tx.date)],
                  ["Description", tx.description],
                  ["Type", tx.type],
                  [
                    "Account",
                    accounts.find((account) => account.id === tx.accountId)?.name ?? tx.accountId,
                  ],
                  ["Reference", tx.ref],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 border-b pb-2">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="text-right font-medium">{v}</dd>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-4 border-b pb-2">
                  <dt className="text-muted-foreground">Category</dt>
                  <dd onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={tx.category}
                      onValueChange={(v) => {
                        void updateCategory(tx.id, v as Category);
                      }}
                    >
                      <SelectTrigger className="h-8 w-36" aria-label="Change category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </dd>
                </div>
              </dl>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => copyRef(tx.ref)}>
                  <Copy className="mr-1 size-3.5" /> Copy reference
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const s = new Set(reviewed);
                    s.add(tx.id);
                    setReviewed(s);
                    toast.success("Marked reviewed for this session");
                  }}
                >
                  <CheckCircle2 className="mr-1 size-3.5" /> Mark reviewed
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Type is distinguished by label and icon as well as colour, so it stays readable for
                everyone.
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
