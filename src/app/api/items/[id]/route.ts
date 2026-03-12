import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "EDITED", "PENDING"]).optional(),
  vendor: z.string().min(1, "Vendor name cannot be blank").optional(),
  amount: z.number().min(0, "Amount must be non-negative").optional(),
  categoryId: z.string().optional(),
  clientId: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

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
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Verify item belongs to user's firm
    const item = await prisma.extractedItem.findFirst({
      where: { id, document: { firmId: dbUser.firmId } },
    });

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    const { status, vendor, amount, categoryId, clientId, notes } = parsed.data;

    if (vendor !== undefined) updateData.vendor = vendor;
    if (amount !== undefined) updateData.amount = amount;
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (clientId !== undefined) updateData.clientId = clientId;
    if (notes !== undefined) updateData.notes = notes;

    if (status === "APPROVED") {
      updateData.status =
        vendor || amount || categoryId ? "EDITED" : "APPROVED";
      updateData.approvedById = dbUser.id;
      updateData.approvedAt = new Date();
    } else if (status) {
      updateData.status = status;
    }

    const updated = await prisma.extractedItem.update({
      where: { id },
      data: updateData,
    });

    // Check if all items in document are reviewed → update document status
    const pendingCount = await prisma.extractedItem.count({
      where: { documentId: item.documentId, status: "PENDING" },
    });

    if (pendingCount === 0) {
      const approvedCount = await prisma.extractedItem.count({
        where: { documentId: item.documentId, status: { in: ["APPROVED", "EDITED"] } },
      });
      await prisma.document.update({
        where: { id: item.documentId },
        data: { status: approvedCount > 0 ? "APPROVED" : "FAILED" },
      });
    }

    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error("Item update error:", error);
    return NextResponse.json(
      { error: "Failed to update item" },
      { status: 500 }
    );
  }
}
