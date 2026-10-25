import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ChartNoAxesCombined,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, type ApiFinance, type ApiUser } from "@/lib/api";
import { detectRecurring } from "@/lib/finance";

type AuthContextValue = {
  user: ApiUser | null;
  loading: boolean;
  unavailable: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const emptyFinance: ApiFinance = {
  transactions: [],
  accounts: [],
  budgets: [],
  recurring: [],
  lastImportedAt: null,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch<{ user: ApiUser }>("/api/auth/me")
      .then(({ user: currentUser }) => {
        if (active) setUser(currentUser);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof Error && error.message === "Authentication required") return;
        setUnavailable(error instanceof Error ? error.message : "The API is unavailable.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const result = await apiFetch<{ user: ApiUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setUnavailable(null);
    setUser(result.user);
  };

  const register = async (name: string, email: string, password: string) => {
    const result = await apiFetch<{ user: ApiUser }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    setUnavailable(null);
    setUser(result.user);
  };

  const logout = async () => {
    await apiFetch<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
    queryClient.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, unavailable, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["finance", user?.id],
    queryFn: () => apiFetch<ApiFinance>("/api/finance"),
    enabled: Boolean(user),
    retry: false,
  });
  const value = {
    ...emptyFinance,
    ...query.data,
    recurring: query.data?.recurring?.length
      ? query.data.recurring
      : detectRecurring(query.data?.transactions ?? []),
    intelligence: query.data?.intelligence ?? {
      runway: {
        score: 0,
        status: "Critical",
        runwayMonths: 0,
        monthlyIncome: 0,
        monthlyExpense: 0,
        buffer: 0,
        insights: ["No intelligence available yet."],
      },
      purchasePlan: {
        plannedPurchase: 0,
        projectedBuffer: 0,
        minimumBuffer: 5000,
        risk: "Insufficient Data",
        upcomingBills: 0,
        availableFunds: 0,
        explanation: ["Import transactions to calculate the purchase risk."],
      },
      priceCreep: [],
      rules: [],
      goals: [],
      scenarios: [],
      ruleTriggers: [],
      recurring: [],
    },
    loading: Boolean(user) && query.isPending,
    error: query.error instanceof Error ? query.error.message : null,
  };
  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

const FinanceContext = createContext(
  emptyFinance as ApiFinance & { loading?: boolean; error?: string | null },
);

export function useFinanceData() {
  return useContext(FinanceContext);
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, unavailable } = useAuth();
  const finance = useFinanceData();
  if (loading) return <FullScreenState label="Opening your private workspace" />;
  if (!user) return <AuthScreen unavailable={unavailable} />;
  if (finance.loading) return <FullScreenState label="Loading your financial records" />;
  if (finance.error) return <ServiceError message={finance.error} />;
  return <>{children}</>;
}

function BrandMark({ large = false }: { large?: boolean }) {
  return (
    <div className={`brand-mark ${large ? "brand-mark-large" : ""}`} aria-hidden="true">
      <span className="brand-mark-ring" />
      <ChartNoAxesCombined className="brand-mark-icon" strokeWidth={1.7} />
    </div>
  );
}

function FullScreenState({ label }: { label: string }) {
  return (
    <main className="auth-screen" aria-busy="true">
      <div className="auth-loading">
        <div className="auth-orbit">
          <BrandMark large />
          <span className="loading-float loading-float-one" />
          <span className="loading-float loading-float-two" />
          <span className="loading-float loading-float-three" />
        </div>
        <p className="auth-status" role="status">
          <LoaderCircle className="size-4 animate-spin" aria-hidden /> {label}
        </p>
      </div>
    </main>
  );
}

function ServiceError({ message }: { message: string }) {
  return (
    <main className="auth-screen">
      <div className="auth-panel">
        <BrandMark />
        <h1>LedgeVue is offline</h1>
        <p>{message}</p>
        <p className="auth-note">
          Start the PostgreSQL service and FastAPI backend, then reload this page. Your financial
          data stays unavailable until the API responds.
        </p>
      </div>
    </main>
  );
}

function AuthScreen({ unavailable }: { unavailable: string | null }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "register") await register(name, email, password);
      else await login(email, password);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-screen">
      <section className="auth-layout">
        <div className="auth-story">
          <div className="auth-orbit">
            <BrandMark large />
          </div>
          <p className="auth-eyebrow">A clearer view of your money</p>
          <h1>
            Make space for
            <br />
            <em>better decisions.</em>
          </h1>
          <p className="auth-copy">
            One private place to understand spending, uncover recurring costs, and see pressure
            building before it catches you off guard.
          </p>
          <div className="auth-assurances">
            <ShieldCheck className="size-4" aria-hidden /> Your records stay private and belong to
            you
          </div>
        </div>

        <div className="auth-panel">
          <div className="auth-wordmark">
            <BrandMark />
            <span>LedgeVue</span>
          </div>
          <p className="auth-eyebrow">Your financial workspace</p>
          <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
          <p className="auth-note">
            {mode === "login"
              ? "Sign in to view your imported records."
              : "Use at least 12 characters for your password."}
          </p>
          <form className="auth-form" onSubmit={submit}>
            {mode === "register" && (
              <div className="space-y-2">
                <Label htmlFor="auth-name">Name</Label>
                <Input
                  id="auth-name"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  maxLength={100}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="auth-email">Email</Label>
              <Input
                id="auth-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                maxLength={320}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="auth-password">Password</Label>
              <div className="auth-password-field">
                <Input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={mode === "register" ? 12 : 1}
                  maxLength={128}
                />
                <button
                  className="auth-password-toggle"
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  aria-controls="auth-password"
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" aria-hidden />
                  ) : (
                    <Eye className="size-4" aria-hidden />
                  )}
                </button>
              </div>
            </div>
            {(error || unavailable) && (
              <p className="auth-error" role="alert">
                {error ?? unavailable}
              </p>
            )}
            <Button
              className="auth-submit"
              type="submit"
              disabled={submitting || Boolean(unavailable)}
            >
              {submitting ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <LockKeyhole className="size-4" />
              )}
              {mode === "login" ? "Sign in securely" : "Create account"}
              {!submitting && <ArrowRight className="ml-auto size-4" />}
            </Button>
          </form>
          <p className="auth-switch">
            {mode === "login" ? "New to LedgeVue?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError(null);
              }}
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
          <p className="auth-footnote">
            Passwords are hashed before storage. LedgeVue never asks for bank login credentials.
          </p>
        </div>
      </section>
    </main>
  );
}
