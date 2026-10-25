import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("API error messages", () => {
  it("formats structured FastAPI validation details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({
          detail: [{ loc: ["body", "file"], msg: "Field required" }],
        }),
      }),
    );

    await expect(apiFetch("/api/import/csv")).rejects.toThrow("body file: Field required");
  });
});
