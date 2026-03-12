import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { authId: authUser.id },
    });
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const firmId = dbUser.firmId;

    const [total, matched, ignored, unmatchedAgg] = await Promise.all([
      prisma.bankTransaction.count({ where: { firmId } }),
      prisma.bankTransaction.count({ where: { firmId, status: "MATCHED" } }),
      prisma.bankTransaction.count({ where: { firmId, status: "IGNORED" } }),
      prisma.bankTransaction.aggregate({
        where: { firmId, status: "UNMATCHED" },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const unmatched = unmatchedAgg._count;
    const unmatchedAmount = Number(unmatchedAgg._sum.amount || 0);
    const matchRate = total > 0 ? Math.round((matched / total) * 100) : 0;

    return NextResponse.json({
      total,
      matched,
      unmatched,
      ignored,
      matchRate,
      unmatchedAmount,
    });
  } catch (error) {
    console.error("Summary error:", error);
    return NextResponse.json({ error: "Summary failed" }, { status: 500 });
  }
}
