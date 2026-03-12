import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

function escapeCsv(value: string): string {
  let v = (value || "").toString().trim();
  if (v && /^[=+@\-\t\r]/.test(v)) v = "'" + v;
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");

    const where: Record<string, unknown> = { firmId: dbUser.firmId };
    if (clientId) where.clientId = clientId;

    const txns = await prisma.bankTransaction.findMany({
      where,
      orderBy: [{ status: "asc" }, { date: "desc" }],
      include: {
        client: { select: { name: true } },
        matchedItem: {
          select: {
            vendor: true,
            description: true,
            category: { select: { name: true } },
            confidence: true,
          },
        },
      },
    });

    const headers = [
      "Date",
      "Bank Description",
      "Amount",
      "Type",
      "Status",
      "Client",
      "Matched Vendor",
      "Matched Category",
      "Matched Confidence",
      "Notes",
    ];

    const rows = txns.map((t) => [
      new Date(t.date).toISOString().split("T")[0],
      escapeCsv(t.description),
      t.amount.toString(),
      t.type,
      t.status,
      escapeCsv(t.client?.name || ""),
      escapeCsv(t.matchedItem?.vendor || ""),
      escapeCsv(t.matchedItem?.category?.name || ""),
      t.matchedItem?.confidence != null
        ? `${Math.round(t.matchedItem.confidence * 100)}%`
        : "",
      "",
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const today = new Date().toISOString().split("T")[0];

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="reconciliation-${today}.csv"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
