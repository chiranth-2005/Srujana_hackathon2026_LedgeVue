import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { useTheme } from "@/components/theme";
import { TransactionImporter } from "@/components/transaction-importer";
import { toast } from "sonner";
import { Download, Trash2, LifeBuoy, ShieldCheck, LogOut } from "lucide-react";
import { useAuth, useFinanceData } from "@/components/auth";
import { apiFetch } from "@/lib/api";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings · LedgeVue" },
      {
        name: "description",
        content: "Profile, security, and financial data management for LedgeVue.",
      },
      { property: "og:title", content: "Settings · LedgeVue" },
      {
        property: "og:description",
        content: "Profile, appearance, privacy and data-management preferences.",
      },
    ],
  }),
  component: SettingsPage,
});

export default function SettingsPage() {
  const { theme, set } = useTheme();
  const { user, logout } = useAuth();
  const finance = useFinanceData();

  const exportData = () => {
    if (finance.transactions.length === 0) {
      toast.error("There are no imported transactions to export");
      return;
    }
    const quote = (value: string | number) => {
      const text = String(value);
      const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
      return `"${safe.replaceAll('"', '""')}"`;
    };
    const rows = [
      ["date", "merchant", "description", "amount", "type", "category"],
      ...finance.transactions.map((transaction) => [
        transaction.date,
        transaction.merchant,
        transaction.description,
        transaction.amount,
        transaction.type,
        transaction.category,
      ]),
    ];
    const blob = new Blob([rows.map((row) => row.map(quote).join(",")).join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "ledgevue-transactions.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const deleteData = async () => {
    try {
      await apiFetch("/api/transactions", { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: ["finance"] });
      toast.success("Your imported transactions were deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Transactions could not be deleted");
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase text-primary">Account preferences</p>
        <h1 className="mt-1 font-serif text-3xl font-medium">Settings</h1>
      </header>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>
            Your account identity is stored with your LedgeVue account.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid max-w-md gap-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <p className="text-sm">{user?.name}</p>
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <p className="text-sm">{user?.email}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
          <CardDescription>Persisted across visits and charts adapt automatically.</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={theme}
            onValueChange={(v) => set(v as "light" | "dark")}
            className="flex gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="light" id="th-light" />
              <Label htmlFor="th-light">Light</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="dark" id="th-dark" />
              <Label htmlFor="th-dark">Dark</Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Security</CardTitle>
          <CardDescription>Session and credential handling</CardDescription>
        </CardHeader>
        <CardContent className="grid max-w-md gap-4">
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" /> Passwords are hashed
            server-side. Session cookies are HttpOnly, same-site, and expire after seven days.
          </p>
          <Button
            variant="outline"
            className="w-fit"
            onClick={() => {
              void logout().catch((error: unknown) =>
                toast.error(error instanceof Error ? error.message : "Could not sign out"),
              );
            }}
          >
            <LogOut className="mr-2 size-4" /> Sign out
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Privacy & cookies</CardTitle>
          <CardDescription>
            LedgeVue does not send financial data to analytics or marketing services.
          </CardDescription>
        </CardHeader>
        <CardContent className="max-w-md space-y-4">
          <p className="text-sm text-muted-foreground">
            Required cookies are used only for authentication and cross-site request protection.
            Optional tracking is not configured.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data import & management</CardTitle>
        </CardHeader>
        <CardContent className="max-w-md space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload CSV or Excel transaction exports. Bank statements need date, description, and
            amount columns; card datasets with merchant IDs and locations are also supported.
            Imports are validated and saved in batches.
          </p>
          <TransactionImporter compact />
          <Button variant="outline" onClick={exportData}>
            <Download className="mr-1 size-4" /> Export transactions ({finance.transactions.length})
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-1 size-4" /> Delete all imported transactions
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete all imported transactions?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes your imported transaction rows from LedgeVue. Budgets
                  remain. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    void deleteData();
                  }}
                >
                  Yes, delete transactions
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Support</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LifeBuoy className="size-4" /> Accessible support is available via the floating chat
            button or the Support page — screen-reader friendly, keyboard navigable.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
