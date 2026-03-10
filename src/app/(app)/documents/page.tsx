import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DocumentUploadZone } from "@/components/documents/upload-zone";
import Link from "next/link";
import { FileText } from "lucide-react";

export default async function DocumentsPage() {
  const user = await getCurrentUser();
  const firmId = user.firmId;

  const [documents, clients] = await Promise.all([
    prisma.document.findMany({
      where: { firmId },
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { name: true } },
        uploadedBy: { select: { name: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.client.findMany({
      where: { firmId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Documents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload receipts and invoices for AI processing.
        </p>
      </div>

      {/* Upload Zone */}
      <DocumentUploadZone firmId={firmId} clients={clients} />

      {/* Documents Table */}
      <div className="mt-8 rounded-xl border border-border bg-card overflow-hidden">
        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium text-muted-foreground">
              No documents uploaded yet
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  File
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Client
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Items
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Uploaded By
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr
                  key={doc.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/documents/${doc.id}`}
                      className="font-medium text-foreground hover:text-primary transition-colors"
                    >
                      {doc.fileName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {doc.client?.name || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {doc._count.items}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={doc.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {doc.uploadedBy.name || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; classes: string }> = {
    PROCESSING: {
      label: "Processing",
      classes: "bg-blue-100 text-blue-700",
    },
    NEEDS_REVIEW: {
      label: "Needs Review",
      classes: "bg-amber-100 text-amber-700",
    },
    APPROVED: {
      label: "Approved",
      classes: "bg-emerald-100 text-emerald-700",
    },
    FAILED: {
      label: "Failed",
      classes: "bg-red-100 text-red-700",
    },
  };

  const { label, classes } = config[status] || {
    label: status,
    classes: "bg-gray-100 text-gray-700",
  };

  return (
    <span
      title={status === "FAILED" ? "Upload a clearer receipt image" : undefined}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}
    >
      {label}
    </span>
  );
}
