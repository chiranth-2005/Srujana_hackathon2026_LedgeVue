import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { routeTree } from "@/routeTree.gen";
import { TransactionImporter } from "@/components/transaction-importer";
import { apiFetch } from "@/lib/api";

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("refreshes shared finance data after a CSV import", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ imported: 2 });
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);

    render(
      <QueryClientProvider client={queryClient}>
        <TransactionImporter />
      </QueryClientProvider>,
    );

    const file = new File(["date,merchant,amount\n2026-01-02,Coffee Shop,-5.25"], "dataset.csv", {
      type: "text/csv",
    });
    fireEvent.change(screen.getByLabelText("Choose a financial data file"), {
      target: { files: [file] },
    });

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("2 financial entries imported"),
    );
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/import/csv",
      expect.objectContaining({ method: "POST", body: expect.any(FormData) }),
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["finance"] });
  });

  it("accepts a 1 GB CSV without a client-side size rejection", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ imported: 1 });
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <TransactionImporter />
      </QueryClientProvider>,
    );

    const file = new File(["date,merchant,amount\n2026-01-02,Coffee Shop,-5.25"], "large.csv", {
      type: "text/csv",
    });
    Object.defineProperty(file, "size", { value: 1024 ** 3 });
    fireEvent.change(screen.getByLabelText("Choose a financial data file"), {
      target: { files: [file] },
    });

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/import/csv",
        expect.objectContaining({ method: "POST", body: expect.any(FormData) }),
      ),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
