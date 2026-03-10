import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  FileText,
  CheckCircle,
  Clock,
  TrendingUp,
} from "lucide-react";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const firmId = user.firmId;

  // Fetch stats
  const [totalDocs, pendingItems, approvedItems, recentDocs] =
    await Promise.all([
      prisma.document.count({ where: { firmId } }),
      prisma.extractedItem.count({
        where: { document: { firmId }, status: "PENDING" },
      }),
      prisma.extractedItem.count({
        where: { document: { firmId }, status: "APPROVED" },
      }),
      prisma.document.findMany({
        where: { firmId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          client: { select: { name: true } },
          _count: { select: { items: true } },
        },
      }),
    ]);

  const totalItems = pendingItems + approvedItems;
  const accuracyRate =
    totalItems > 0 ? Math.round((approvedItems / totalItems) * 100) : 0;

  const stats = [
    {
      label: "Documents Uploaded",
      value: totalDocs,
      icon: FileText,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Pending Review",
      value: pendingItems,
      icon: Clock,
      color: "text-warning",
      bg: "bg-warning/10",
    },
    {
      label: "Approved Items",
      value: approvedItems,
      icon: CheckCircle,
      color: "text-success",
      bg: "bg-success/10",
    },
    {
      label: "AI Accuracy",
      value: `${accuracyRate}%`,
      icon: TrendingUp,
      color: "text-primary",
      bg: "bg-primary/10",
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">
          Welcome back, {user.name || user.email}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening at {user.firm.name}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-card p-5"
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.bg}`}
              >
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {stat.value}
                </p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Documents */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">
          Recent Documents
        </h2>
        <div className="mt-4 rounded-xl border border-border bg-card overflow-hidden">
          {recentDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium text-muted-foreground">
                No documents yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Upload your first receipt or invoice to get started.
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
                    Uploaded
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentDocs.map((doc) => (
                  <tr
                    key={doc.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {doc.fileName}
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
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
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
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}
    >
      {label}
    </span>
  );
}
