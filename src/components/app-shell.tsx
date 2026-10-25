import { useEffect, useMemo, useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTheme } from "@/components/theme";
import { toast } from "sonner";
import { fmtINR } from "@/lib/finance";
import { AuthGate, useAuth, useFinanceData } from "@/components/auth";
import {
  LayoutDashboard,
  ArrowLeftRight,
  ChartPie,
  Repeat,
  Wallet,
  Lightbulb,
  BrainCircuit,
  FileText,
  Settings,
  LifeBuoy,
  Search,
  Sun,
  Moon,
  Menu,
  X,
  ArrowUp,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  ChartNoAxesCombined,
} from "lucide-react";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/analytics", label: "Spending Analytics", icon: ChartPie },
  { to: "/recurring", label: "Recurring Payments", icon: Repeat },
  { to: "/budgets", label: "Budgets", icon: Wallet },
  { to: "/insights", label: "Insights", icon: Lightbulb },
  { to: "/intelligence", label: "Financial Intelligence", icon: BrainCircuit },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/support", label: "Support", icon: LifeBuoy },
] as const;

const TITLES: Record<string, string> = Object.fromEntries(NAV.map((n) => [n.to, n.label]));

function usePath() {
  return useRouterState({ select: (s) => s.location.pathname });
}

/* ---------------- Sidebar ---------------- */
function Sidebar({
  collapsed,
  setCollapsed,
}: {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}) {
  const path = usePath();
  return (
    <aside
      className={`app-sidebar no-print fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-sidebar-accent/40 bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex ${collapsed ? "w-16" : "w-60"}`}
    >
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-accent/40 px-4">
        <div className="brand-mark brand-mark-small">
          <ChartNoAxesCombined className="brand-mark-icon" aria-hidden />
        </div>
        {!collapsed && <span className="text-lg font-semibold tracking-tight">LedgeVue</span>}
      </div>
      <nav aria-label="Main" className="flex-1 space-y-1 overflow-y-auto p-2">
        {NAV.map((n) => {
          const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
          const Icon = n.icon;
          return (
            <Link
              key={n.to}
              to={n.to}
              title={collapsed ? n.label : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-ring ${active ? "bg-sidebar-accent font-medium text-foreground" : ""}`}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {!collapsed && <span>{n.label}</span>}
            </Link>
          );
        })}
      </nav>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setCollapsed(!collapsed)}
        className="m-2 self-start text-sidebar-foreground hover:bg-sidebar-accent"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
      </Button>
    </aside>
  );
}

/* ---------------- Global search ---------------- */
function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const { transactions, recurring } = useFinanceData();
  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return { nav: [], txs: [], rec: [] };
    return {
      nav: NAV.filter((n) => n.label.toLowerCase().includes(term)),
      txs: transactions
        .filter(
          (t) =>
            t.merchant.toLowerCase().includes(term) ||
            t.description.toLowerCase().includes(term) ||
            t.category.toLowerCase().includes(term),
        )
        .slice(0, 6),
      rec: recurring.filter((r) => r.merchant.toLowerCase().includes(term)),
    };
  }, [q, transactions, recurring]);
  const total = results.nav.length + results.txs.length + results.rec.length;
  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="gap-2 text-muted-foreground sm:w-64 sm:justify-start"
        aria-label="Open search"
      >
        <Search className="size-4" /> <span className="hidden sm:inline">Search…</span>
        <kbd className="ml-auto hidden rounded border border-input bg-muted px-1.5 text-xs sm:inline-block">
          ⌘K
        </kbd>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Search</DialogTitle>
            <DialogDescription className="sr-only">
              Search your transactions, recurring payments and pages.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Merchants, categories, pages…"
            aria-label="Search query"
          />
          <div className="max-h-80 overflow-y-auto" role="listbox" aria-label="Search results">
            {!q.trim() && (
              <p className="p-4 text-sm text-muted-foreground">Type to search your data.</p>
            )}
            {q.trim() && total === 0 && (
              <p className="p-4 text-sm text-muted-foreground">No results for “{q}”.</p>
            )}
            {results.nav.map((n) => (
              <button
                key={n.to}
                className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  setOpen(false);
                  navigate({ to: n.to });
                }}
              >
                <n.icon className="size-4 text-muted-foreground" /> {n.label}
              </button>
            ))}
            {results.txs.map((t) => (
              <button
                key={t.id}
                className="flex w-full items-center justify-between gap-2 rounded-md p-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  setOpen(false);
                  navigate({ to: "/transactions" });
                }}
              >
                <span className="truncate">
                  {t.merchant} <span className="text-muted-foreground">· {t.description}</span>
                </span>
                <span className="tabular shrink-0 text-muted-foreground">{fmtINR(t.amount)}</span>
              </button>
            ))}
            {results.rec.map((r) => (
              <button
                key={r.id}
                className="flex w-full items-center justify-between gap-2 rounded-md p-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  setOpen(false);
                  navigate({ to: "/recurring" });
                }}
              >
                <span className="truncate">
                  {r.merchant} <span className="text-muted-foreground">· recurring</span>
                </span>
                <span className="tabular shrink-0 text-muted-foreground">{fmtINR(r.amount)}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ---------------- Header ---------------- */
function Header({ onOpenMenu }: { onOpenMenu: () => void }) {
  const path = usePath();
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const initials =
    user?.name
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "";
  return (
    <header className="app-header no-print sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onOpenMenu}
          aria-label="Open navigation menu"
        >
          <Menu className="size-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight">
            {TITLES[path] ?? "LedgeVue"}
          </h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <GlobalSearch />
          <span className="hidden items-center gap-1.5 text-xs text-muted-foreground lg:inline-flex">
            <ShieldCheck className="size-3.5 text-success" aria-hidden /> Private session
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="User profile menu"
                className="rounded-full bg-primary text-primary-foreground"
              >
                {initials}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                {user?.name}
                <br />
                <span className="font-normal text-muted-foreground">{user?.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/settings">Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/support">Support</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  void logout().catch((error: unknown) =>
                    toast.error(error instanceof Error ? error.message : "Could not sign out"),
                  );
                }}
              >
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

/* ---------------- Mobile menu ---------------- */
function MobileMenu({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const path = usePath();
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <span className="hidden" />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground">
        <SheetHeader className="flex-row items-center gap-2 border-b border-sidebar-accent/40 px-4 py-4">
          <div className="brand-mark brand-mark-small">
            <ChartNoAxesCombined className="brand-mark-icon" aria-hidden />
          </div>
          <SheetTitle className="text-sidebar-foreground">LedgeVue</SheetTitle>
        </SheetHeader>
        <nav aria-label="Mobile" className="space-y-1 p-2" onClick={() => setOpen(false)}>
          {NAV.map((n) => {
            const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-sidebar-accent ${active ? "bg-sidebar-accent font-medium" : ""}`}
              >
                <n.icon className="size-4" /> {n.label}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

/* ---------------- Floating widgets ---------------- */
function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!show) return null;
  return (
    <button
      onClick={() =>
        window.scrollTo({
          top: 0,
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        })
      }
      className="app-float no-print fixed bottom-20 right-4 z-40 grid size-10 place-items-center rounded-full border border-border bg-card shadow-md transition hover:bg-accent md:bottom-24"
      aria-label="Back to top"
    >
      <ArrowUp className="size-4" />
    </button>
  );
}

function SupportFab() {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          className="app-float no-print fixed bottom-4 right-4 z-40 size-12 rounded-full shadow-lg"
          aria-label="Open support panel"
        >
          <MessageCircle className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-96 max-w-[90vw] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <LifeBuoy className="size-4" /> Support
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-8">
          <p className="text-sm text-muted-foreground">
            Typical response time: under 1 business day.
          </p>
          <Link
            to="/support"
            onClick={() => setOpen(false)}
            className="block rounded-lg border p-3 text-sm hover:bg-accent"
          >
            Browse the FAQ →
          </Link>
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
                <Label htmlFor="s-email">Your email</Label>
                <Input id="s-email" type="email" required placeholder="you@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-msg">How can we help?</Label>
                <Textarea id="s-msg" required rows={4} placeholder="Describe your issue…" />
              </div>
              <Button type="submit" className="w-full">
                Send message
              </Button>
            </form>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ---------------- Scroll progress ---------------- */
export function ScrollProgress() {
  const path = usePath();
  const [pct, setPct] = useState(0);
  const enabled = path === "/reports" || path === "/support";
  useEffect(() => {
    if (!enabled) return;
    const onScroll = () => {
      const h = document.documentElement;
      setPct(
        h.scrollTop > 0 ? Math.round((h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100) : 0,
      );
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [enabled]);
  if (!enabled) return null;
  return (
    <div className="no-print fixed inset-x-0 top-0 z-50 h-0.5 bg-transparent" aria-hidden>
      <div
        className="h-full bg-primary transition-[width] duration-150"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ---------------- Shell ---------------- */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("ledgevue-sidebar") === "1";
    } catch {
      return false;
    }
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleCollapse = (v: boolean) => {
    setCollapsed(v);
    try {
      localStorage.setItem("ledgevue-sidebar", v ? "1" : "0");
    } catch {
      /* ignore */
    }
  };
  return (
    <AuthGate>
      <div className="min-h-screen">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <Sidebar collapsed={collapsed} setCollapsed={toggleCollapse} />
        <MobileMenu open={menuOpen} setOpen={setMenuOpen} />
        <div className={`transition-[padding] duration-200 ${collapsed ? "md:pl-16" : "md:pl-60"}`}>
          <Header onOpenMenu={() => setMenuOpen(true)} />
          <main id="main-content" className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-6 print-page">
            {children}
          </main>
        </div>
        <ScrollProgress />
        <BackToTop />
        <SupportFab />
      </div>
    </AuthGate>
  );
}

export function CloseIcon() {
  return <X className="size-4" />;
}
