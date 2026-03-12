import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ReconciliationClient } from "@/components/reconciliation/reconciliation-client";

export default async function ReconciliationPage() {
  const user = await getCurrentUser();
  const firmId = user.firmId;

  const [transactions, clients, summary] = await Promise.all([
    prisma.bankTransaction.findMany({
      where: { firmId },
      orderBy: { date: "desc" },
      include: {
        client: { select: { id: true, name: true } },
        matchedItem: {
          select: {
            id: true,
            vendor: true,
            description: true,
            confidence: true,
            category: { select: { name: true } },
          },
        },
      },
    }),
    prisma.client.findMany({
      where: { firmId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.bankTransaction.groupBy({
      by: ["status"],
      where: { firmId },
      _count: true,
    }),
  ]);

  const statusCount = { UNMATCHED: 0, MATCHED: 0, IGNORED: 0 };
  for (const row of summary) {
    if (row.status in statusCount) {
      statusCount[row.status as keyof typeof statusCount] = row._count;
    }
  }
  const total = statusCount.MATCHED + statusCount.UNMATCHED + statusCount.IGNORED;
  const matchRate = total > 0 ? Math.round((statusCount.MATCHED / total) * 100) : 0;

  return (
    <ReconciliationClient
      transactions={transactions.map((t) => ({
        ...t,
        amount: t.amount.toString(),
        balance: t.balance ?? undefined,
      }))}
      clients={clients}
      stats={{ ...statusCount, total, matchRate }}
    />
  );
}
