import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await request.json();
    const { itemId } = body as { itemId: string | null };

    // Verify transaction belongs to this firm
    const txn = await prisma.bankTransaction.findFirst({
      where: { id, firmId: dbUser.firmId },
    });
    if (!txn) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (itemId === null) {
      // Unlink
      await prisma.bankTransaction.update({
        where: { id },
        data: { status: "UNMATCHED", matchedItemId: null },
      });
      return NextResponse.json({ status: "UNMATCHED" });
    }

    // Verify item belongs to same firm
    const item = await prisma.extractedItem.findFirst({
      where: { id: itemId, document: { firmId: dbUser.firmId } },
    });
    if (!item) {
      return NextResponse.json(
        { error: "Item not found or wrong firm" },
        { status: 404 }
      );
    }

    // Check item isn't already linked to a different transaction
    const existing = await prisma.bankTransaction.findFirst({
      where: { matchedItemId: itemId, id: { not: id } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Item already matched to another transaction" },
        { status: 409 }
      );
    }

    // Clear old match if this txn had one
    if (txn.matchedItemId && txn.matchedItemId !== itemId) {
      // Old item becomes free — nothing to do on ExtractedItem side
    }

    const updated = await prisma.bankTransaction.update({
      where: { id },
      data: { status: "MATCHED", matchedItemId: itemId },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Manual match error:", error);
    return NextResponse.json({ error: "Match failed" }, { status: 500 });
  }
}
