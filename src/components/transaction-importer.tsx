import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileUp, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

const ALLOWED_EXTENSIONS = [".csv", ".xlsx", ".xls"];
const ACCEPT_ATTRIBUTE =
  ".csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";

export function TransactionImporter({ compact = false }: { compact?: boolean }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [dragging, setDragging] = useState(false);

  const importFile = async (file?: File) => {
    if (!file) return;

    const fileNameLower = file.name.toLowerCase();
    const isValidFormat = ALLOWED_EXTENSIONS.some((ext) => fileNameLower.endsWith(ext));

    if (!isValidFormat) {
      setState("error");
      setMessage("Invalid format. Please upload a CSV or Excel file (.csv, .xlsx, .xls).");
      return;
    }
    setState("uploading");
    setMessage("");

    const form = new FormData();
    form.append("file", file);

    try {
      const result = await apiFetch<{ imported: number; message?: string }>("/api/import/csv", {
        method: "POST",
        body: form,
      });

      await queryClient.invalidateQueries({ queryKey: ["finance"] });

      setState("success");
      setMessage(
        result.message ||
          `${result.imported} financial entries imported and categorized from ${file.name}.`,
      );
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Import failed.");
    }
  };

  const onSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    void importFile(file);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (state !== "uploading") void importFile(event.dataTransfer.files[0]);
  };

  return (
    <section className={compact ? "space-y-3" : "space-y-4"}>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        aria-label="Choose a financial data file"
        onChange={onSelect}
        disabled={state === "uploading"}
      />

      {compact ? (
        <Button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={state === "uploading"}
        >
          {state === "uploading" ? (
            <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden />
          ) : (
            <FileUp className="mr-2 size-4" aria-hidden />
          )}
          {state === "uploading" ? "Importing…" : "Import Financial Data"}
        </Button>
      ) : (
        <div
          className={`rounded-lg border border-dashed p-6 text-center transition-colors ${
            dragging ? "border-primary bg-accent" : "border-border"
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            if (state !== "uploading") setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <FileUp className="mx-auto size-7 text-primary" aria-hidden />
          <p className="mt-3 text-sm font-medium">
            Drop your statements or transaction history here
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Supports CSV, XLSX, and XLS statement exports
          </p>
          <Button
            className="mt-4"
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={state === "uploading"}
          >
            Choose file
          </Button>
        </div>
      )}

      {state === "uploading" && (
        <div className="space-y-2" role="status" aria-live="polite">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            Uploading, parsing, and auto-categorizing financial data…
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-2/3 rounded-full bg-primary animate-pulse" />
          </div>
        </div>
      )}
      {state === "success" && (
        <p className="flex items-center gap-2 text-sm text-success" role="status">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden /> {message}
        </p>
      )}
      {state === "error" && (
        <p className="text-sm text-destructive" role="alert">
          {message}
        </p>
      )}
    </section>
  );
}
