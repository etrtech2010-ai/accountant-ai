import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { resend, FROM_EMAIL, APP_URL } from "@/lib/resend";
import { render } from "@react-email/render";
import { WeeklySummaryEmail, weeklySummarySubject } from "@/lib/emails/weekly-summary";

export async function POST() {
  try {
    // Auth check — must be authenticated to trigger
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { authId: authUser.id },
      include: { firm: { select: { name: true } } },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: "Email service not configured" }, { status: 503 });
    }

    const firmId = dbUser.firmId;
    const firmName = dbUser.firm.name;

    // Date range: last 7 days
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weekStart = weekAgo.toLocaleDateString("en-US", {
      month: "short", day: "numeric",
    });
    const weekEnd = now.toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });

    // Fetch stats in parallel
    const [docsProcessed, itemsApproved, itemsPending, categoryAgg, spendAgg] =
      await Promise.all([
        // Documents processed this week
        prisma.document.count({
          where: {
            firmId,
            createdAt: { gte: weekAgo },
            status: { not: "PROCESSING" },
          },
        }),
        // Items approved this week
        prisma.extractedItem.count({
          where: {
            document: { firmId },
            status: { in: ["APPROVED", "EDITED"] },
            approvedAt: { gte: weekAgo },
          },
        }),
        // Items still pending
        prisma.extractedItem.count({
          where: { document: { firmId }, status: "PENDING" },
        }),
        // Top spending category this week (by sum of approved amounts)
        prisma.extractedItem.groupBy({
          by: ["categoryId"],
          where: {
            document: { firmId },
            status: { in: ["APPROVED", "EDITED"] },
            approvedAt: { gte: weekAgo },
            categoryId: { not: null },
          },
          _sum: { amount: true },
          orderBy: { _sum: { amount: "desc" } },
          take: 1,
        }),
        // Total approved spend this week
        prisma.extractedItem.aggregate({
          where: {
            document: { firmId },
            status: { in: ["APPROVED", "EDITED"] },
            approvedAt: { gte: weekAgo },
          },
          _sum: { amount: true },
        }),
      ]);

    // Resolve top category name
    let topCategory: string | null = null;
    if (categoryAgg.length > 0 && categoryAgg[0].categoryId) {
      const cat = await prisma.category.findUnique({
        where: { id: categoryAgg[0].categoryId },
        select: { name: true },
      });
      topCategory = cat?.name ?? null;
    }

    const totalSpend = Number(spendAgg._sum.amount ?? 0);

    // Get firm owner email
    const owner = await prisma.user.findFirst({
      where: { firmId, role: "OWNER" },
      select: { email: true },
    });

    if (!owner?.email) {
      return NextResponse.json(
        { error: "No owner email found for this firm" },
        { status: 404 }
      );
    }

    const html = await render(
      <WeeklySummaryEmail
        firmName={firmName}
        weekStart={weekStart}
        weekEnd={weekEnd}
        docsProcessed={docsProcessed}
        itemsApproved={itemsApproved}
        itemsPending={itemsPending}
        topCategory={topCategory}
        totalSpend={totalSpend}
        currency="USD"
        dashboardUrl={`${APP_URL}/dashboard`}
      />
    );

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: owner.email,
      subject: weeklySummarySubject(firmName),
      html,
    });

    return NextResponse.json({
      success: true,
      emailId: result.data?.id,
      sentTo: owner.email,
      stats: { docsProcessed, itemsApproved, itemsPending, topCategory, totalSpend },
    });
  } catch (error) {
    console.error("Weekly summary email error:", error);
    return NextResponse.json(
      { error: "Failed to send weekly summary" },
      { status: 500 }
    );
  }
}
