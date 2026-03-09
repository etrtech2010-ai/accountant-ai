"use client";

import { useState } from "react";
import { Plus, Users, Loader2, Pencil, Trash2, Check, X } from "lucide-react";
import { useRouter } from "next/navigation";

interface ClientItem {
  id: string;
  name: string;
  email: string | null;
  notes: string | null;
  _count: { documents: number; items: number };
}

export function ClientsClient({
  initialClients,
}: {
  initialClients: ClientItem[];
}) {
  const [clients, setClients] = useState(initialClients);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const router = useRouter();

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() || null }),
      });

      const data = await res.json();

      if (res.ok) {
        setName("");
        setEmail("");
        setShowForm(false);
        // Optimistically add to list; router.refresh() syncs counts
        setClients((prev) =>
          [...prev, { ...data.client, _count: { documents: 0, items: 0 } }].sort((a, b) =>
            a.name.localeCompare(b.name)
          )
        );
        router.refresh();
      } else {
        setError(data.error || "Failed to create client");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (client: ClientItem) => {
    setEditingId(client.id);
    setEditName(client.name);
    setEditEmail(client.email || "");
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError(null);
  };

  const handleEdit = async (id: string) => {
    if (!editName.trim()) return;
    setEditLoading(true);
    setEditError(null);

    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          email: editEmail.trim() || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setClients((prev) =>
          prev
            .map((c) => (c.id === id ? { ...c, ...data.client } : c))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
        setEditingId(null);
        router.refresh();
      } else {
        setEditError(data.error || "Failed to update client");
      }
    } catch {
      setEditError("Network error — please try again");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);

    try {
      const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });

      if (res.ok) {
        setClients((prev) => prev.filter((c) => c.id !== id));
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete client");
      }
    } catch {
      alert("Network error — please try again");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Add Client */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Client
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Client Name *
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Company or individual name"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Email
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@example.com"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          {error && (
            <p className="mt-3 text-sm text-destructive">{error}</p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => { setShowForm(false); setError(null); }}
              className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={loading || !name.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Create
            </button>
          </div>
        </div>
      )}

      {/* Clients List */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium text-muted-foreground">
              No clients yet
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add your first client to start organizing documents.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Name
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Email
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Documents
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Transactions
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) =>
                editingId === client.id ? (
                  <tr
                    key={client.id}
                    className="border-b border-border last:border-0 bg-muted/20"
                  >
                    <td className="px-4 py-2">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        placeholder="client@example.com"
                        className="w-full rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      {editError && (
                        <p className="mt-1 text-xs text-destructive">{editError}</p>
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {client._count.documents}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {client._count.items}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => handleEdit(client.id)}
                          disabled={editLoading || !editName.trim()}
                          className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs text-white hover:bg-primary/90 disabled:opacity-50"
                        >
                          {editLoading ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                          Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={client.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {client.name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {client.email || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {client._count.documents}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {client._count.items}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => startEdit(client)}
                          className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(client.id)}
                          disabled={deletingId === client.id}
                          className="rounded p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          {deletingId === client.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
