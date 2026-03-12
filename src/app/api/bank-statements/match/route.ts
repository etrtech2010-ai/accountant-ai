import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { runAutoMatch } from "@/lib/reconcile";

export async function POST() {
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

    const result = await runAutoMatch(dbUser.firmId);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Auto-match error:", error);
    return NextResponse.json({ error: "Match failed" }, { status: 500 });
  }
}
