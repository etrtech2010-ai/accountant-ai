import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

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

    // Parse optional filters
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: Record<string, unknown> = {
      document: { firmId: dbUser.firmId },
      status: { in: ["APPROVED", "EDITED"] },
    };

    if (clientId) where.clientId = clientId;
    if (from || to) {
      where.date = {};
      if (from) (where.date as Record<string, unknown>).gte = new Date(from);
      if (to) (where.date as Record<string, unknown>).lte = new Date(to);
    }

    const items = await prisma.extractedItem.findMany({
      where,
      orderBy: { date: "desc" },
      include: {
        category: { select: { name: true, code: true } },
        client: { select: { name: true } },
        document: { select: { fileName: true, client: { select: { name: true } } } },
      },
    });

    // Build CSV
    const headers = [
      "Date",
      "Vendor",
      "Description",
      "Amount",
      "Tax",
      "Currency",
      "Category",
      "Category Code",
      "Client",
      "Source Document",
      "Notes",
    ];

    const rows = items.map((item) => [
      item.date ? new Date(item.date).toISOString().split("T")[0] : "",
      escapeCsv(item.vendor || ""),
      escapeCsv(item.description || ""),
      item.amount.toString(),
      item.taxAmount?.toString() || "",
      item.currency,
      escapeCsv(item.category?.name || ""),
      item.category?.code || "",
      escapeCsv(item.client?.name || item.document.client?.name || ""),
      escapeCsv(item.document.fileName),
      escapeCsv(item.notes || ""),
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join(
      "\n"
    );

    const today = new Date().toISOString().split("T")[0];

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="export-${today}.csv"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Export failed" },
      { status: 500 }
    );
  }
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
