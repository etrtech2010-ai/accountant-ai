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

    // Trigger async processing (OCR + classification)
    // In v1 this is done synchronously for simplicity
    // In production, move to a queue/edge function
    processDocument(document.id, dbUser.firmId, fileUrl).catch(
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
  fileUrl: string
) {
  try {
    // Step 1: OCR extraction via Mindee
    const ocrResult = await extractWithMindee(fileUrl);

    // Store raw OCR output
    await prisma.document.update({
      where: { id: documentId },
      data: { ocrRawOutput: ocrResult },
    });

    // Step 2: Get firm categories for AI classification
    const categories = await prisma.category.findMany({
      where: { firmId },
      select: { id: true, name: true, code: true },
    });

    // Step 3: Get recent approvals for few-shot examples
    const recentApprovals = await prisma.extractedItem.findMany({
      where: {
        document: { firmId },
        status: "APPROVED",
      },
      orderBy: { approvedAt: "desc" },
      take: 10,
      include: { category: { select: { name: true } } },
    });

    // Step 4: AI classification via Gemini
    const classification = await classifyWithGemini(
      ocrResult,
      categories,
      recentApprovals
    );

    // Step 5: Create extracted items
    if (classification && classification.items) {
      for (const item of classification.items) {
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

async function extractWithMindee(fileUrl: string) {
  const apiKey = process.env.MINDEE_API_KEY;
  if (!apiKey) throw new Error("MINDEE_API_KEY not configured");

  // Use Mindee's Receipt API
  const response = await fetch(
    "https://api.mindee.net/v1/products/mindee/expense_receipts/v5/predict",
    {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        document: fileUrl,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mindee API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data;
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

async function classifyWithGemini(
  ocrResult: Record<string, unknown>,
  categories: CategoryRef[],
  recentApprovals: ApprovalRef[]
) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const prediction =
    (ocrResult as { document?: { inference?: { prediction?: Record<string, unknown> } } })?.document
      ?.inference?.prediction || {};

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

  const prompt = `You are a bookkeeping categorization assistant.

## Available Categories
${categoryList}

## OCR Extracted Data
${JSON.stringify(prediction, null, 2)}

## Past Classifications (for reference)
${exampleList}

## Instructions
1. Return ONLY valid JSON. No explanation, no markdown.
2. Extract all line items/transactions from the document.
3. For each item, pick the single best category from the list above.
4. If uncertain, use "Other / Uncategorized" and set confidence below 0.5.

## Output Format
{
  "items": [
    {
      "vendor": "string",
      "description": "string or null",
      "date": "YYYY-MM-DD or null",
      "amount": number,
      "taxAmount": number or null,
      "currency": "USD" or "CAD",
      "categoryName": "exact category name from list",
      "categoryId": "category id from list",
      "confidence": number between 0.0 and 1.0
    }
  ]
}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 2000 },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text: string =
    data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  // Parse JSON from response
  const cleaned = text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned || "{}");
}
