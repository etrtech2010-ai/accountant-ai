import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { authId: authUser.id },
    include: { firm: true },
  });

  if (!user) redirect("/signup");

  return user;
}

export async function getCurrentFirmId() {
  const user = await getCurrentUser();
  return user.firmId;
}
