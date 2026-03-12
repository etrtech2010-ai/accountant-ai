import { prisma } from "@/lib/prisma";

const AMOUNT_TOLERANCE = 0.01; // 1%
const DATE_WINDOW_DAYS = 3;

export async function runAutoMatch(
  firmId: string
): Promise<{ matched: number; multipleMatches: number; noMatch: number }> {
  // Fetch all UNMATCHED transactions for this firm
  const unmatched = await prisma.bankTransaction.findMany({
    where: { firmId, status: "UNMATCHED" },
  });

  // Fetch all ExtractedItems for this firm that are not yet linked
  const items = await prisma.extractedItem.findMany({
    where: {
      document: { firmId },
      matchedTransaction: null,
    },
    select: { id: true, amount: true, date: true },
  });

  let matched = 0;
  let multipleMatches = 0;
  let noMatch = 0;

  for (const txn of unmatched) {
    const txnAmount = Number(txn.amount);
    const txnDate = new Date(txn.date).getTime();

    const candidates = items.filter((item) => {
      if (!item.date || !item.amount) return false;
      const itemAmount = Number(item.amount);
      const itemDate = new Date(item.date).getTime();

      // Amount within 1% tolerance
      const amountDiff = Math.abs(txnAmount - itemAmount) / txnAmount;
      if (amountDiff > AMOUNT_TOLERANCE) return false;

      // Date within ±3 days
      const dayDiff =
        Math.abs(txnDate - itemDate) / (1000 * 60 * 60 * 24);
      return dayDiff <= DATE_WINDOW_DAYS;
    });

    if (candidates.length === 1) {
      const itemId = candidates[0].id;
      // Check the item hasn't been grabbed by a previous iteration
      const alreadyTaken = await prisma.bankTransaction.findFirst({
        where: { matchedItemId: itemId },
      });
      if (alreadyTaken) {
        noMatch++;
        continue;
      }
      await prisma.bankTransaction.update({
        where: { id: txn.id },
        data: { status: "MATCHED", matchedItemId: itemId },
      });
      // Remove from candidates pool (in-memory)
      const idx = items.findIndex((i) => i.id === itemId);
      if (idx !== -1) items.splice(idx, 1);
      matched++;
    } else if (candidates.length > 1) {
      // Multiple candidates — leave UNMATCHED for manual review
      multipleMatches++;
    } else {
      noMatch++;
    }
  }

  return { matched, multipleMatches, noMatch };
}
