import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const setupSchema = z.object({
  authId: z.string(),
  email: z.string().email(),
  name: z.string().min(1),
  firmName: z.string().min(1),
});

const DEFAULT_CATEGORIES = [
  { name: "Advertising & Marketing", code: "5100" },
  { name: "Bank & Financial Charges", code: "5200" },
  { name: "Contractors & Freelancers", code: "5300" },
  { name: "Dues & Subscriptions", code: "5400" },
  { name: "Equipment & Machinery", code: "5500" },
  { name: "Insurance", code: "5600" },
  { name: "Meals & Entertainment", code: "5700" },
  { name: "Office Supplies", code: "5800" },
  { name: "Professional Services", code: "5900" },
  { name: "Rent & Lease", code: "6000" },
  { name: "Repairs & Maintenance", code: "6100" },
  { name: "Software & SaaS", code: "6200" },
  { name: "Taxes & Licenses", code: "6300" },
  { name: "Travel & Transportation", code: "6400" },
  { name: "Utilities", code: "6500" },
  { name: "Vehicle Expenses", code: "6600" },
  { name: "Wages & Salaries", code: "6700" },
  { name: "Other / Uncategorized", code: "9999" },
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = setupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { authId, email, name, firmName } = parsed.data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { authId },
    });

    if (existingUser) {
      return NextResponse.json({ success: true, firmId: existingUser.firmId });
    }

    // Create firm, user, and default categories in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const firm = await tx.firm.create({
        data: { name: firmName },
      });

      const user = await tx.user.create({
        data: {
          authId,
          email,
          name,
          role: "OWNER",
          firmId: firm.id,
        },
      });

      await tx.category.createMany({
        data: DEFAULT_CATEGORIES.map((cat) => ({
          firmId: firm.id,
          name: cat.name,
          code: cat.code,
          isSystem: true,
        })),
      });

      return { firm, user };
    });

    return NextResponse.json({
      success: true,
      firmId: result.firm.id,
      userId: result.user.id,
    });
  } catch (error) {
    console.error("Auth setup error:", error);
    return NextResponse.json(
      { error: "Failed to set up account" },
      { status: 500 }
    );
  }
}
