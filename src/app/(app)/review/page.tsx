import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ReviewQueueClient } from "@/components/review/review-queue-client";

export default async function ReviewPage() {
  const user = await getCurrentUser();
  const firmId = user.firmId;

  const items = await prisma.extractedItem.findMany({
    where: {
      document: { firmId },
      status: "PENDING",
    },
    orderBy: [{ confidence: "asc" }, { createdAt: "desc" }],
    include: {
      document: { select: { fileName: true } },
      client: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
    },
  });

  const categories = await prisma.category.findMany({
    where: { firmId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });

  const clients = await prisma.client.findMany({
    where: { firmId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  // Serialize Decimal fields to strings for client component
  const serializedItems = items.map((item) => ({
    ...item,
    amount: item.amount.toString(),
    taxAmount: item.taxAmount?.toString() || null,
    date: item.date?.toISOString() || null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }));

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Review Queue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {items.length} item{items.length !== 1 ? "s" : ""} pending review.
          Low-confidence items appear first.
        </p>
      </div>

      <ReviewQueueClient
        initialItems={serializedItems}
        categories={categories}
        clients={clients}
      />
    </div>
  );
}
