"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  GitMerge,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Download,
  RefreshCw,
} from "lucide-react";

interface MatchedItem {
  id: string;
  vendor: string | null;
  description: string | null;
  confidence: number | null;
  category: { name: string } | null;
}

interface Transaction {
  id: string;
  date: Date | string;
  description: string;
  amount: string;
  type: string;
  status: string;
  balance?: number;
  client: { id: string; name: string } | null;
  matchedItem: MatchedItem | null;
}

interface Client {
  id: string;
  name: string;
}

interface Stats {
  total: number;
  MATCHED: number;
  UNMATCHED: number;
  IGNORED: number;
  matchRate: number;
}

type Filter = "ALL" | "MATCHED" | "UNMATCHED" | "IGNORED";

export function ReconciliationClient({
  transactions: initialTransactions,
  clients,
  stats: initialStats,
}: {
  transactions: Transaction[];
  clients: Client[];
  stats: Stats;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [clientId, setClientId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [autoMatching, setAutoMatching] = useState(false);
  const transactions = initialTransactions;
  const stats = initialStats;
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);

  const filtered = transactions.filter((t) =>
    filter === "ALL" ? true : t.status === filter
  );

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);

    const form = new FormData();
    form.append("file", file);
    if (clientId) form.append("clientId", clientId);

    try {
      const res = await fetch("/api/bank-statements/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setUploadMsg(
        `Uploaded ${data.uploaded} transactions — ${data.matched} matched, ${data.unmatched} unmatched.`
      );
      startTransition(() => router.refresh());
    } catch (err) {
      setUploadMsg((err as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleAutoMatch() {
    setAutoMatching(true);
    try {
      const res = await fetch("/api/bank-statements/match", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUploadMsg(`Auto-match complete: ${data.matched} new matches.`);
      startTransition(() => router.refresh());
    } catch (err) {
      setUploadMsg((err as Error).message);
    } finally {
      setAutoMatching(false);
    }
  }

  async function handleIgnore(txn: Transaction) {
    await fetch(`/api/bank-statements/${txn.id}/ignore`, { method: "PATCH" });
    startTransition(() => router.refresh());
  }

  function formatDate(d: Date | string) {
    return new Date(d).toLocaleDateString("en-CA"); // YYYY-MM-DD
  }

  function formatAmount(amount: string, type: string) {
    const sign = type === "DEBIT" ? "-" : "+";
    return `${sign}$${parseFloat(amount).toFixed(2)}`;
  }

  const statusBadge = (status: string) => {
    if (status === "MATCHED")
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
          <CheckCircle2 className="h-3 w-3" /> Matched
        </span>
      );
    if (status === "IGNORED")
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          <MinusCircle className="h-3 w-3" /> Ignored
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        <XCircle className="h-3 w-3" /> Unmatched
      </span>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reconciliation</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Match bank transactions to uploaded receipts
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleAutoMatch}
            disabled={autoMatching || isPending}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${autoMatching ? "animate-spin" : ""}`} />
            Auto-Match All
          </button>
          <a
            href="/api/bank-statements/export"
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </a>
        </div>
      </div>

      {/* Upload Zone */}
      <div className="mb-6 rounded-xl border border-dashed border-border bg-card p-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            {clients.length > 0 && (
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All clients</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            <div>
              <p className="text-sm font-medium text-foreground">
                Upload Bank Statement
              </p>
              <p className="text-xs text-muted-foreground">
                CSV, OFX/QFX, or PDF — RBC, TD, Scotiabank, BMO formats supported
              </p>
            </div>
          </div>
          <label className="cursor-pointer">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.ofx,.qfx,.pdf"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
            <div className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50">
              <Upload className="h-4 w-4" />
              {uploading ? "Uploading…" : "Choose File"}
            </div>
          </label>
        </div>
        {uploadMsg && (
          <p className="mt-3 text-sm text-muted-foreground">{uploadMsg}</p>
        )}
      </div>

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Transactions", value: stats.total, color: "text-foreground" },
          { label: "Matched", value: stats.MATCHED, color: "text-emerald-600" },
          { label: "Unmatched", value: stats.UNMATCHED, color: "text-red-600" },
          { label: "Match Rate", value: `${stats.matchRate}%`, color: "text-primary" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-border bg-card p-4"
          >
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="mb-4 flex gap-1 border-b border-border">
        {(["ALL", "UNMATCHED", "MATCHED", "IGNORED"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filter === f
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
            <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs">
              {f === "ALL"
                ? stats.total
                : stats[f as keyof Stats]}
            </span>
          </button>
        ))}
      </div>

      {/* Two-Panel View */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 text-center">
          <GitMerge className="h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            {transactions.length === 0
              ? "No bank statements uploaded yet"
              : "No transactions in this filter"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* LEFT: Transaction List */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="border-b border-border bg-muted/50 px-4 py-3">
              <p className="text-sm font-medium text-muted-foreground">
                Bank Transactions ({filtered.length})
              </p>
            </div>
            <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
              {filtered.map((txn) => (
                <div
                  key={txn.id}
                  onClick={() => setSelectedTxn(txn.id === selectedTxn?.id ? null : txn)}
                  className={`cursor-pointer px-4 py-3 transition-colors hover:bg-muted/30 ${
                    selectedTxn?.id === txn.id ? "bg-primary/5 ring-1 ring-inset ring-primary/20" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {txn.description}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDate(txn.date)}
                        {txn.client && ` · ${txn.client.name}`}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className={`text-sm font-semibold ${
                          txn.type === "CREDIT" ? "text-emerald-600" : "text-foreground"
                        }`}
                      >
                        {formatAmount(txn.amount, txn.type)}
                      </span>
                      {statusBadge(txn.status)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: Match Detail */}
          <div className="rounded-xl border border-border bg-card">
            {selectedTxn ? (
              <div className="p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">
                  Transaction Detail
                </h3>
                <dl className="space-y-2 text-sm">
                  {[
                    ["Date", formatDate(selectedTxn.date)],
                    ["Description", selectedTxn.description],
                    ["Amount", formatAmount(selectedTxn.amount, selectedTxn.type)],
                    ["Type", selectedTxn.type],
                    ["Status", selectedTxn.status],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="font-medium text-foreground">{v}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-6 border-t border-border pt-4">
                  <h4 className="text-sm font-semibold text-foreground mb-3">
                    Matched Receipt
                  </h4>
                  {selectedTxn.matchedItem ? (
                    <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 space-y-1 text-sm">
                      <p className="font-medium text-emerald-800">
                        {selectedTxn.matchedItem.vendor || "Unknown vendor"}
                      </p>
                      {selectedTxn.matchedItem.description && (
                        <p className="text-emerald-700">
                          {selectedTxn.matchedItem.description}
                        </p>
                      )}
                      {selectedTxn.matchedItem.category && (
                        <p className="text-emerald-600 text-xs">
                          Category: {selectedTxn.matchedItem.category.name}
                        </p>
                      )}
                      {selectedTxn.matchedItem.confidence != null && (
                        <p className="text-emerald-600 text-xs">
                          Confidence:{" "}
                          {Math.round(selectedTxn.matchedItem.confidence * 100)}%
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No match found
                    </p>
                  )}
                </div>

                <div className="mt-4 flex gap-2">
                  {selectedTxn.status !== "IGNORED" && (
                    <button
                      onClick={() => handleIgnore(selectedTxn)}
                      className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
                    >
                      {selectedTxn.status === "MATCHED" ? "Unmatch & " : ""}Ignore
                    </button>
                  )}
                  {selectedTxn.status === "IGNORED" && (
                    <button
                      onClick={() => handleIgnore(selectedTxn)}
                      className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
                    >
                      Un-ignore
                    </button>
                  )}
                  {selectedTxn.status === "MATCHED" && selectedTxn.matchedItem && (
                    <button
                      onClick={async () => {
                        await fetch(`/api/bank-statements/${selectedTxn.id}/match`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ itemId: null }),
                        });
                        startTransition(() => router.refresh());
                      }}
                      className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                    >
                      Unmatch
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-16 text-center px-6">
                <GitMerge className="h-8 w-8 text-muted-foreground/40" />
                <p className="mt-3 text-sm text-muted-foreground">
                  Select a transaction to view details and matching info
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
