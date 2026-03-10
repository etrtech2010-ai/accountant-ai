import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const uploadSchema = z.object({
  fileName: z.string(),
  fileUrl: z.string().url(),
  fileType: z.string(),
  fileSizeBytes: z.number(),
  storagePath: z.string(),
  clientId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Auth check
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
    const parsed = uploadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { fileName, fileUrl, fileType, fileSizeBytes, clientId } =
      parsed.data;

    // Create document record
    const document = await prisma.document.create({
      data: {
        firmId: dbUser.firmId,
        clientId: clientId || null,
        uploadedById: dbUser.id,
        fileName,
        fileUrl,
        fileType,
        fileSizeBytes,
        status: "PROCESSING",
      },
    });

    // Process synchronously so Vercel doesn't kill the function before completion
    await processDocument(document.id, dbUser.firmId, fileUrl);

    return NextResponse.json({ document });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Upload error:", msg, error);
    return NextResponse.json({ error: "Upload failed", detail: msg }, { status: 500 });
  }
}

async function processDocument(
  documentId: string,
  firmId: string,
  fileUrl: string
) {
  try {
    // Get firm categories
    const categories = await prisma.category.findMany({
      where: { firmId },
      select: { id: true, name: true, code: true },
    });

    // Get recent approvals for few-shot context
    const recentApprovals = await prisma.extractedItem.findMany({
      where: { document: { firmId }, status: "APPROVED" },
      orderBy: { approvedAt: "desc" },
      take: 10,
      include: { category: { select: { name: true } } },
    });

    // Single-pass: Groq vision reads the document image and returns classified items
    const result = await extractAndClassifyWithGroq(
      fileUrl,
      categories,
      recentApprovals
    );

    // Store raw model output
    await prisma.document.update({
      where: { id: documentId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { ocrRawOutput: result.raw as any },
    });

    // Create extracted items
    if (result.items && result.items.length > 0) {
      for (const item of result.items) {
        const matchedCategory = categories.find(
          (c) => c.name === item.categoryName || c.id === item.categoryId
        );

        await prisma.extractedItem.create({
          data: {
            documentId,
            vendor: item.vendor || null,
            description: item.description || null,
            amount: item.amount || 0,
            taxAmount: item.taxAmount || null,
            currency: item.currency || "USD",
            date: item.date ? new Date(item.date) : null,
            categoryId: matchedCategory?.id || null,
            aiCategoryId: matchedCategory?.id || null,
            confidence: item.confidence || 0,
            status: "PENDING",
          },
        });
      }
    }

    // Mark document ready for review
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "NEEDS_REVIEW" },
    });
  } catch (error) {
    console.error(`Processing failed for document ${documentId}:`, error);
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "FAILED" },
    });
  }
}

interface CategoryRef {
  id: string;
  name: string;
  code: string | null;
}

interface ApprovalRef {
  vendor: string | null;
  amount: unknown;
  date: Date | null;
  category: { name: string } | null;
}

interface ExtractedItem {
  vendor: string | null;
  description: string | null;
  date: string | null;
  amount: number;
  taxAmount: number | null;
  currency: string;
  categoryName: string;
  categoryId: string;
  confidence: number;
}

async function extractAndClassifyWithGroq(
  fileUrl: string,
  categories: CategoryRef[],
  recentApprovals: ApprovalRef[]
): Promise<{ raw: Record<string, unknown>; items: ExtractedItem[] }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  const categoryList =
    categories.length > 0
      ? categories.map((c) => `- ${c.name} (id: ${c.id})`).join("\n")
      : "- Other / Uncategorized (id: none)";

  const exampleList =
    recentApprovals.length > 0
      ? recentApprovals
          .map(
            (a) =>
              `- "${a.vendor}" → ${a.category?.name || "Unknown"} ($${a.amount})`
          )
          .join("\n")
      : "None yet.";

  const prompt = `You are a bookkeeping assistant. Examine this receipt or invoice image and extract all transactions.

Available categories:
${categoryList}

Past classifications for reference:
${exampleList}

Return ONLY valid JSON — no explanation, no markdown fences.
Extract every line item. For each item assign the best matching category from the list.
Amounts are numbers without currency symbols. Dates are YYYY-MM-DD or null.

{"items":[{"vendor":"string","description":"string or null","date":"YYYY-MM-DD or null","amount":0.00,"taxAmount":null,"currency":"USD","categoryName":"exact name from list","categoryId":"id from list","confidence":0.9}]}`;

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: fileUrl } },
              { type: "text", text: prompt },
            ],
          },
        ],
        max_tokens: 2000,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text: string = data.choices?.[0]?.message?.content ?? "";

  // Extract JSON from the response — Groq may return {"items":[...]} or a raw array [...]
  let items: ExtractedItem[] = [];
  try {
    // Try array first: [...]
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    // Try object: {"items":[...]}
    const objectMatch = text.match(/\{[\s\S]*\}/);

    if (arrayMatch) {
      const arr = JSON.parse(arrayMatch[0]);
      if (Array.isArray(arr)) items = arr;
    } else if (objectMatch) {
      const obj = JSON.parse(objectMatch[0]);
      if (obj.items && Array.isArray(obj.items)) items = obj.items;
    }
  } catch {
    console.warn("Groq returned non-parseable JSON, treating as empty.");
  }

  return {
    raw: { groq: data, text },
    items,
  };
}
