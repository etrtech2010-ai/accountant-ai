import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const bulkSchema = z.object({
  ids: z.array(z.string()).min(1),
  status: z.enum(["APPROVED", "REJECTED"]),
});

export async function PATCH(request: NextRequest) {
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

    const body = await request.json();
    const parsed = bulkSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { ids, status } = parsed.data;

    // Update all items that belong to this firm
    const result = await prisma.extractedItem.updateMany({
      where: {
        id: { in: ids },
        document: { firmId: dbUser.firmId },
      },
      data: {
        status,
        approvedById: status === "APPROVED" ? dbUser.id : null,
        approvedAt: status === "APPROVED" ? new Date() : null,
      },
    });

    // Update document statuses for affected documents
    const affectedDocs = await prisma.extractedItem.findMany({
      where: { id: { in: ids } },
      select: { documentId: true },
      distinct: ["documentId"],
    });

    for (const { documentId } of affectedDocs) {
      const pendingCount = await prisma.extractedItem.count({
        where: { documentId, status: "PENDING" },
      });

      if (pendingCount === 0) {
        await prisma.document.update({
          where: { id: documentId },
          data: { status: "APPROVED" },
        });
      }
    }

    return NextResponse.json({ updated: result.count });
  } catch (error) {
    console.error("Bulk update error:", error);
    return NextResponse.json(
      { error: "Failed to update items" },
      { status: 500 }
    );
  }
}
