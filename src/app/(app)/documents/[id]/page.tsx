import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, ExternalLink } from "lucide-react";

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  const document = await prisma.document.findFirst({
    where: { id, firmId: user.firmId },
    include: {
      client: { select: { name: true } },
      uploadedBy: { select: { name: true } },
      items: {
        orderBy: { createdAt: "asc" },
        include: { category: { select: { name: true } } },
      },
    },
  });

  if (!document) notFound();

  const statusConfig: Record<string, { label: string; classes: string }> = {
    PROCESSING: { label: "Processing", classes: "bg-blue-100 text-blue-700" },
    NEEDS_REVIEW: { label: "Needs Review", classes: "bg-amber-100 text-amber-700" },
    APPROVED: { label: "Approved", classes: "bg-emerald-100 text-emerald-700" },
    FAILED: { label: "Failed", classes: "bg-red-100 text-red-700" },
  };

  const itemStatusConfig: Record<string, { label: string; classes: string }> = {
    PENDING: { label: "Pending", classes: "bg-amber-100 text-amber-700" },
    APPROVED: { label: "Approved", classes: "bg-emerald-100 text-emerald-700" },
    REJECTED: { label: "Rejected", classes: "bg-red-100 text-red-700" },
    EDITED: { label: "Edited", classes: "bg-purple-100 text-purple-700" },
  };

  const docStatus = statusConfig[document.status] ?? { label: document.status, classes: "bg-gray-100 text-gray-700" };

  return (
    <div>
      {/* Back link */}
      <Link
        href="/documents"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Documents
      </Link>

      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-muted-foreground/60 shrink-0" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">{document.fileName}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Uploaded by {document.uploadedBy.name || "—"} on{" "}
              {new Date(document.createdAt).toLocaleDateString()}
              {document.client ? ` · ${document.client.name}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${docStatus.classes}`}>
            {docStatus.label}
          </span>
          <a
            href={document.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View File
          </a>
        </div>
      </div>

      {/* Metadata grid */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "File Type", value: document.fileType.toUpperCase() },
          { label: "Size", value: `${(document.fileSizeBytes / 1024).toFixed(0)} KB` },
          { label: "Items Extracted", value: String(document.items.length) },
          { label: "Client", value: document.client?.name || "None" },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Extracted Items */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <h2 className="text-sm font-medium text-foreground">Extracted Items</h2>
          {document.items.some((i) => i.status === "PENDING") && (
            <Link
              href="/review"
              className="text-xs text-primary hover:text-primary/80 transition-colors"
            >
              Review in Queue →
            </Link>
          )}
        </div>

        {document.items.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No items were extracted from this document.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Vendor</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Description</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Amount</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Category</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {document.items.map((item) => {
                const s = itemStatusConfig[item.status] ?? { label: item.status, classes: "bg-gray-100 text-gray-700" };
                return (
                  <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{item.vendor || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.description || "—"}</td>
                    <td className="px-4 py-3 text-foreground">${parseFloat(item.amount.toString()).toFixed(2)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.date ? new Date(item.date).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                        {item.category?.name || "Uncategorized"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.classes}`}>
                        {s.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
