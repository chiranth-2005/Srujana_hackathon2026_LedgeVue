export type ApiUser = { id: string; name: string; email: string };

export type ApiIntelligence = {
  runway: {
    score: number | null;
    status: string;
    runwayMonths: number | null;
    monthlyIncome: number;
    monthlyExpense: number;
    buffer: number;
    insights: string[];
  };
  purchasePlan?: {
    plannedPurchase: number;
    projectedBuffer: number;
    minimumBuffer: number;
    risk: string;
    upcomingBills: number;
    availableFunds: number;
    explanation: string[];
  };
  priceCreep: Array<{
    merchant: string;
    previousAmount: number;
    newAmount: number;
    change: number;
    percentage: number;
    period: string;
    evidenceDates: string[];
    evidenceTransactionIds?: string[];
    frequency?: string;
    previousFrequency?: string | null;
    changeType?: "possible_price_change" | "billing_frequency_change";
    confidence?: string;
    observationKey?: string;
    reviewStatus?: "pending" | "confirmed" | "dismissed" | "corrected";
    correctedAmount?: number | null;
  }>;
  rules: Array<{
    id: string;
    name: string;
    conditionType: string;
    category: string | null;
    threshold: number;
    period: string;
    action: string;
    active: boolean;
  }>;
  goals: Array<{
    id: string;
    title: string;
    targetAmount: number;
    currentAmount: number;
    dueDate: string;
    monthlyTarget: number;
    remainingAmount: number;
    monthsRemaining: number;
    progress: number;
    priority: string;
    status: string;
  }>;
  scenarios: Array<{
    id: string;
    kind: string;
    title: string;
    data: Record<string, unknown>;
    createdAt: string;
  }>;
  ruleTriggers: Array<{
    id: string;
    ruleId: string;
    explanation: string;
    evidence: unknown[];
    createdAt: string;
  }>;
  recurring: import("@/lib/finance").RecurringPayment[];
};

export type ApiFinance = {
  transactions: import("@/lib/finance").Transaction[];
  accounts: import("@/lib/finance").Account[];
  budgets: import("@/lib/finance").Budget[];
  recurring: import("@/lib/finance").RecurringPayment[];
  intelligence?: ApiIntelligence;
  lastImportedAt: string | null;
};

function cookieValue(name: string) {
  if (typeof document === "undefined") return "";
  const prefix = `${name}=`;
  return (
    document.cookie
      .split(";")
      .map((value) => value.trim())
      .find((value) => value.startsWith(prefix))
      ?.slice(prefix.length) ?? ""
  );
}

async function csrfToken() {
  const existing = cookieValue("ledgevue_csrf");
  if (existing) return decodeURIComponent(existing);
  const response = await fetch("/api/auth/csrf", { credentials: "same-origin" });
  if (!response.ok)
    throw new Error("Security token could not be initialized. Check that the API is running.");
  const body = (await response.json()) as { csrfToken: string };
  return body.csrfToken;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (!new Set(["GET", "HEAD", "OPTIONS"]).has(method)) {
    headers.set("X-CSRF-Token", await csrfToken());
  }
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(path, { ...init, method, headers, credentials: "same-origin" });
  const payload = (await response.json().catch(() => null)) as { detail?: unknown } | null;
  if (!response.ok) {
    const detail = payload?.detail;
    if (typeof detail === "string") throw new Error(detail);
    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) => {
          if (!item || typeof item !== "object") return "";
          const message = "msg" in item && typeof item.msg === "string" ? item.msg : "";
          const location =
            "loc" in item && Array.isArray(item.loc)
              ? item.loc
                  .filter(
                    (part: unknown): part is string | number =>
                      typeof part === "string" || typeof part === "number",
                  )
                  .join(" ")
              : "";
          return [location, message].filter(Boolean).join(": ");
        })
        .filter(Boolean);
      if (messages.length) throw new Error(messages.join("; "));
    }
    throw new Error(`Request failed (${response.status})`);
  }
  return payload as T;
}
