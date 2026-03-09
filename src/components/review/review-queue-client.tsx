"use client";

import { useState } from "react";
import { CheckCircle, XCircle, Edit2, Check, Loader2 } from "lucide-react";

interface ReviewItem {
  id: string;
  vendor: string | null;
  description: string | null;
  amount: string;
  taxAmount: string | null;
  currency: string;
  date: string | null;
  confidence: number | null;
  status: string;
  document: { fileName: string };
  client: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
}

interface CategoryRef {
  id: string;
  name: string;
  code: string | null;
}

interface ClientRef {
  id: string;
  name: string;
}

export function ReviewQueueClient({
  initialItems,
  categories,
}: {
  initialItems: ReviewItem[];
  categories: CategoryRef[];
  clients: ClientRef[];
}) {
  const [items, setItems] = useState(initialItems);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<ReviewItem>>({});
  const [loading, setLoading] = useState<string | null>(null);

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const selectAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  };

  const handleAction = async (
    id: string,
    action: "APPROVED" | "REJECTED",
    updates?: Record<string, unknown>
  ) => {
    setLoading(id);
    try {
      const res = await fetch(`/api/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action, ...updates }),
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id));
        setEditingId(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(null);
    }
  };

  const handleBulkApprove = async () => {
    if (selected.size === 0) return;
    setLoading("bulk");
    try {
      const res = await fetch("/api/items/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: Array.from(selected),
          status: "APPROVED",
        }),
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => !selected.has(i.id)));
        setSelected(new Set());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(null);
    }
  };

  const startEdit = (item: ReviewItem) => {
    setEditingId(item.id);
    setEditValues({
      vendor: item.vendor,
      amount: item.amount,
      category: item.category,
    });
  };

  const confidenceColor = (c: number | null) => {
    if (!c) return "text-muted-foreground";
    if (c >= 0.8) return "text-emerald-600";
    if (c >= 0.5) return "text-amber-600";
    return "text-red-600";
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 text-center">
        <CheckCircle className="h-10 w-10 text-success/40" />
        <p className="mt-3 text-sm font-medium text-muted-foreground">
          All caught up! No items pending review.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bulk Actions Bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-primary/10 px-4 py-2.5">
          <span className="text-sm font-medium text-primary">
            {selected.size} item{selected.size !== 1 ? "s" : ""} selected
          </span>
          <button
            onClick={handleBulkApprove}
            disabled={loading === "bulk"}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {loading === "bulk" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle className="h-3.5 w-3.5" />
            )}
            Approve Selected
          </button>
        </div>
      )}

      {/* Items Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selected.size === items.length}
                  onChange={selectAll}
                  className="rounded border-border"
                />
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Vendor
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Amount
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Date
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Category
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Confidence
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Source
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(item.id)}
                    onChange={() => toggleSelect(item.id)}
                    className="rounded border-border"
                  />
                </td>
                <td className="px-4 py-3 font-medium text-foreground">
                  {editingId === item.id ? (
                    <input
                      value={editValues.vendor || ""}
                      onChange={(e) =>
                        setEditValues((v) => ({ ...v, vendor: e.target.value }))
                      }
                      className="w-full rounded border border-input bg-background px-2 py-1 text-sm"
                    />
                  ) : (
                    item.vendor || "—"
                  )}
                </td>
                <td className="px-4 py-3 text-foreground">
                  {editingId === item.id ? (
                    <input
                      value={editValues.amount || ""}
                      onChange={(e) =>
                        setEditValues((v) => ({
                          ...v,
                          amount: e.target.value,
                        }))
                      }
                      className="w-24 rounded border border-input bg-background px-2 py-1 text-sm"
                    />
                  ) : (
                    `$${parseFloat(item.amount).toFixed(2)}`
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {item.date
                    ? new Date(item.date).toLocaleDateString()
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  {editingId === item.id ? (
                    <select
                      value={editValues.category?.id || ""}
                      onChange={(e) => {
                        const cat = categories.find(
                          (c) => c.id === e.target.value
                        );
                        setEditValues((v) => ({
                          ...v,
                          category: cat
                            ? { id: cat.id, name: cat.name }
                            : null,
                        }));
                      }}
                      className="w-full rounded border border-input bg-background px-2 py-1 text-sm"
                    >
                      <option value="">Select category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                      {item.category?.name || "Uncategorized"}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs font-semibold ${confidenceColor(item.confidence)}`}
                  >
                    {item.confidence
                      ? `${Math.round(item.confidence * 100)}%`
                      : "—"}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {item.document.fileName}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {editingId === item.id ? (
                      <button
                        onClick={() =>
                          handleAction(item.id, "APPROVED", {
                            vendor: editValues.vendor,
                            amount: parseFloat(editValues.amount || "0"),
                            categoryId: editValues.category?.id,
                          })
                        }
                        className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50 transition-colors"
                        title="Save & Approve"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleAction(item.id, "APPROVED")}
                          disabled={loading === item.id}
                          className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50 transition-colors"
                          title="Approve"
                        >
                          {loading === item.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => startEdit(item)}
                          className="rounded p-1.5 text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleAction(item.id, "REJECTED")}
                          className="rounded p-1.5 text-red-500 hover:bg-red-50 transition-colors"
                          title="Reject"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
