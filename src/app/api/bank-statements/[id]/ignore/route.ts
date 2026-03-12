import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  _request: NextRequest,
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

    const txn = await prisma.bankTransaction.findFirst({
      where: { id, firmId: dbUser.firmId },
    });
    if (!txn) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await prisma.bankTransaction.update({
      where: { id },
      data: {
        status: txn.status === "IGNORED" ? "UNMATCHED" : "IGNORED",
        // Clear match when ignoring
        matchedItemId: txn.status === "IGNORED" ? txn.matchedItemId : null,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Ignore error:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
