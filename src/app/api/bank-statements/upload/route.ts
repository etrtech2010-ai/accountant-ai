import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { parseBankStatement } from "@/lib/parse-bank-statement";
import { Decimal } from "@prisma/client/runtime/library";
import { runAutoMatch } from "@/lib/reconcile";

export async function POST(request: NextRequest) {
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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const clientId = formData.get("clientId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const filename = file.name;
    const mimeType = file.type;
    const buffer = Buffer.from(await file.arrayBuffer());

    const parsed = await parseBankStatement(buffer, filename, mimeType);

    if (parsed.length === 0) {
      return NextResponse.json(
        { error: "No transactions found in file" },
        { status: 422 }
      );
    }

    // Bulk insert
    const data = parsed.map((t) => ({
      firmId: dbUser.firmId,
      clientId: clientId || null,
      date: t.date,
      description: t.description,
      amount: new Decimal(t.amount.toFixed(2)),
      type: t.type,
      balance: t.balance ?? null,
      status: "UNMATCHED",
    }));

    await prisma.bankTransaction.createMany({ data });

    // Run auto-match
    const matchResult = await runAutoMatch(dbUser.firmId);

    return NextResponse.json({
      uploaded: parsed.length,
      matched: matchResult.matched,
      unmatched: parsed.length - matchResult.matched,
    });
  } catch (error) {
    console.error("Bank statement upload error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
