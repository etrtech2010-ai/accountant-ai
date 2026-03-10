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

    // Trigger async processing (OCR + classification via Gemini vision)
    processDocument(document.id, dbUser.firmId, fileUrl, fileType).catch(
      (err) => {
        console.error(`Failed to process document ${document.id}:`, err);
      }
    );

    return NextResponse.json({ document });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}

async function processDocument(
  documentId: string,
  firmId: string,
  fileUrl: string,
  fileType: string
) {
  try {
    // Get firm categories for AI classification
    const categories = await prisma.category.findMany({
      where: { firmId },
      select: { id: true, name: true, code: true },
    });

    // Get recent approvals for few-shot examples
    const recentApprovals = await prisma.extractedItem.findMany({
      where: {
        document: { firmId },
        status: "APPROVED",
      },
      orderBy: { approvedAt: "desc" },
      take: 10,
      include: { category: { select: { name: true } } },
    });

    // Single-pass: Gemini reads the image and returns structured items
    const result = await extractAndClassifyWithGemini(
      fileUrl,
      fileType,
      categories,
      recentApprovals
    );

    // Store raw Gemini output (JSON.parse/stringify gives plain any for Prisma Json field)
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

    // Update document status
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

async function extractAndClassifyWithGemini(
  fileUrl: string,
  fileType: string,
  categories: CategoryRef[],
  recentApprovals: ApprovalRef[]
): Promise<{ raw: Record<string, unknown>; items: ExtractedItem[] }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  // Download file and encode as base64 for Gemini vision
  const fileResponse = await fetch(fileUrl);
  if (!fileResponse.ok) {
    throw new Error(`Failed to fetch document: ${fileResponse.status}`);
  }
  const fileBuffer = await fileResponse.arrayBuffer();
  const base64Data = Buffer.from(fileBuffer).toString("base64");
  const mimeType = fileType.startsWith("image/") ? fileType : "image/jpeg";

  const categoryList = categories
    .map((c) => `- ${c.name} (code: ${c.code || "N/A"}, id: ${c.id})`)
    .join("\n");

  const exampleList =
    recentApprovals.length > 0
      ? recentApprovals
          .map(
            (a) =>
              `- "${a.vendor}" → ${a.category?.name || "Unknown"} ($${a.amount}, ${a.date ? new Date(a.date).toISOString().split("T")[0] : "N/A"})`
          )
          .join("\n")
      : "No previous approvals yet.";

  const prompt = `You are a bookkeeping assistant. Read this receipt or invoice image and extract all transactions.

## Available Categories
${categoryList || "- Other / Uncategorized (code: N/A, id: none)"}

## Past Classifications (for reference)
${exampleList}

## Instructions
1. Return ONLY valid JSON. No explanation, no markdown fences.
2. Extract every line item or transaction visible on the document.
3. For each item, pick the single best category from the list above.
4. If uncertain about a category, use "Other / Uncategorized" and set confidence below 0.5.
5. Dates must be in YYYY-MM-DD format or null.
6. Amounts must be numbers (no currency symbols).

## Output Format
{"items":[{"vendor":"string","description":"string or null","date":"YYYY-MM-DD or null","amount":0.00,"taxAmount":null,"currency":"USD","categoryName":"exact name from list","categoryId":"id from list","confidence":0.9}]}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inlineData: { mimeType, data: base64Data } },
              { text: prompt },
            ],
          },
        ],
        generationConfig: { maxOutputTokens: 2000 },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  const cleaned = text.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned || '{"items":[]}');

  return {
    raw: { gemini: data, text },
    items: parsed.items || [],
  };
}
