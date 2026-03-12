import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { resend, FROM_EMAIL, APP_URL } from "@/lib/resend";
import { render } from "@react-email/render";
import { DocumentProcessedEmail, documentProcessedSubject } from "@/lib/emails/document-processed";
import { DocumentFailedEmail, documentFailedSubject } from "@/lib/emails/document-failed";

const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "application/pdf",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const uploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileUrl: z.string().url().refine((url) => {
    try {
      const u = new URL(url);
      return u.protocol === "https:" && u.hostname.endsWith(".supabase.co");
    } catch {
      return false;
    }
  }, "fileUrl must be an HTTPS Supabase Storage URL"),
  fileType: z.string().refine((t) => ALLOWED_FILE_TYPES.includes(t), {
    message: `fileType must be one of: ${ALLOWED_FILE_TYPES.join(", ")}`,
  }),
  fileSizeBytes: z.number().int().min(1, "File cannot be empty").max(MAX_FILE_SIZE, "File exceeds 10 MB limit"),
  storagePath: z.string().min(1),
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
    await processDocument(document.id, dbUser.firmId, fileUrl, clientId || null);

    // Re-fetch so response reflects final status (NEEDS_REVIEW or FAILED)
    const updatedDocument = await prisma.document.findUnique({
      where: { id: document.id },
    });

    // Fire email notification async — do NOT await (must not slow down response)
    sendDocumentEmail(
      dbUser.firmId,
      fileName,
      updatedDocument?.status ?? document.status,
      updatedDocument?.id ?? document.id,
    ).catch((err) => console.error("Email send error (non-fatal):", err));

    return NextResponse.json({ document: updatedDocument ?? document });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Upload error:", msg, error);
    return NextResponse.json({ error: "Upload failed", detail: msg }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Email notification (fire-and-forget — never throws)
// ---------------------------------------------------------------------------
async function sendDocumentEmail(
  firmId: string,
  fileName: string,
  status: string,
  documentId: string,
) {
  if (!process.env.RESEND_API_KEY) return; // Skip if not configured

  // Get firm owner email + firm name
  const owner = await prisma.user.findFirst({
    where: { firmId, role: "OWNER" },
    select: { email: true, firm: { select: { name: true } } },
  });

  if (!owner?.email) return;

  const firmName = owner.firm?.name ?? "Your Firm";
  const uploadedAt = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  if (status === "NEEDS_REVIEW") {
    const itemCount = await prisma.extractedItem.count({ where: { documentId } });
    const html = await render(
      <DocumentProcessedEmail
        firmName={firmName}
        fileName={fileName}
        itemCount={itemCount}
        uploadedAt={uploadedAt}
        reviewUrl={`${APP_URL}/review`}
      />
    );
    await resend.emails.send({
      from: FROM_EMAIL,
      to: owner.email,
      subject: documentProcessedSubject(fileName, itemCount),
      html,
    });
  } else if (status === "FAILED") {
    const html = await render(
      <DocumentFailedEmail
        firmName={firmName}
        fileName={fileName}
        uploadedAt={uploadedAt}
        documentsUrl={`${APP_URL}/documents`}
      />
    );
    await resend.emails.send({
      from: FROM_EMAIL,
      to: owner.email,
      subject: documentFailedSubject(fileName),
      html,
    });
  }
}

async function processDocument(
  documentId: string,
  firmId: string,
  fileUrl: string,
  clientId: string | null = null
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
        // Match by exact name first, then case-insensitive, then partial
        const normalise = (s: string) => s.toLowerCase().trim();
        const matchedCategory =
          categories.find((c) => c.name === item.categoryName) ||
          categories.find(
            (c) => normalise(c.name) === normalise(item.categoryName ?? "")
          ) ||
          categories.find((c) =>
            normalise(c.name).includes(normalise(item.categoryName ?? "").slice(0, 8))
          );

        // Lorem Ipsum detection — fake vendor names get low confidence
        const loremPattern = /\b(lorem|ipsum|dolor|sit amet|consectetur|adipiscing)\b/i;
        const isLoremVendor = loremPattern.test(item.vendor ?? "") || loremPattern.test(item.description ?? "");
        const confidence = isLoremVendor ? 0.1 : (item.confidence ?? 0.5);

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
            clientId: clientId || null,
            confidence,
            status: "PENDING",
          },
        });
      }

      // Mark document ready for review
      await prisma.document.update({
        where: { id: documentId },
        data: { status: "NEEDS_REVIEW" },
      });
    } else {
      // No items extracted — mark as failed
      await prisma.document.update({
        where: { id: documentId },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { status: "FAILED", ocrRawOutput: { ...(result.raw as any), message: "No items could be extracted from this document" } },
      });
    }
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
  confidence: number;
}

async function extractAndClassifyWithGroq(
  fileUrl: string,
  categories: CategoryRef[],
  recentApprovals: ApprovalRef[]
): Promise<{ raw: Record<string, unknown>; items: ExtractedItem[] }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  // Build category list without IDs — Groq fabricates IDs, so only use names
  const categoryList =
    categories.length > 0
      ? categories.map((c) => `  "${c.name}"`).join(",\n")
      : `  "Other / Uncategorized"`;

  const exampleList =
    recentApprovals.length > 0
      ? recentApprovals
          .map(
            (a) =>
              `  { "vendor": "${a.vendor}", "categoryName": "${a.category?.name || "Other / Uncategorized"}" }`
          )
          .join(",\n")
      : "  (none yet)";

  const prompt = `You are an expert bookkeeper. Examine this receipt or invoice image and extract ALL line items.

CATEGORY LIST (you MUST pick exactly one name from this list for each item):
[
${categoryList}
]

CLASSIFICATION RULES:
- Restaurant, cafe, bar, food, beverage, dining → "Meals & Entertainment"
- Hotel, airline, taxi, train, bus, fuel, parking, tolls → "Travel & Transportation"
- Computer, phone, printer, camera, machinery → "Equipment & Machinery"
- Rent, office space, lease payment → "Rent & Lease"
- Electricity, gas, water, internet, phone bill → "Utilities"
- Software, app, SaaS subscription, cloud service → "Software & SaaS"
- Legal, accounting, consulting fees → "Professional Services"
- Office paper, pens, stationery, printer ink → "Office Supplies"
- Google Ads, Facebook Ads, marketing agency → "Advertising & Marketing"
- Bank fee, wire transfer fee, credit card fee → "Bank & Financial Charges"
- Freelancer, contractor invoice → "Contractors & Freelancers"
- Gym, professional association, magazine → "Dues & Subscriptions"
- Car fuel, car repair for business vehicle → "Vehicle Expenses"
- Business insurance premium → "Insurance"
- Payroll, employee wages → "Wages & Salaries"
- Property tax, business license, permits → "Taxes & Licenses"
- Plumber, electrician, HVAC for office → "Repairs & Maintenance"
- Anything else → "Other / Uncategorized"

Past approved classifications (use as reference):
[
${exampleList}
]

IMPORTANT:
- Return ONLY valid JSON — no explanation, no markdown, no code fences
- "categoryName" MUST be copied exactly (same spelling, spacing, ampersands) from the CATEGORY LIST above
- Do NOT use "Other / Uncategorized" if a better match exists
- Amounts are plain numbers (no currency symbols). Dates are YYYY-MM-DD or null.
- "confidence" is a float 0.0–1.0 reflecting how certain you are of the extraction

{"items":[{"vendor":"string","description":"string or null","date":"YYYY-MM-DD or null","amount":0.00,"taxAmount":null,"currency":"USD","categoryName":"exact name from category list","confidence":0.95}]}`;

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
        max_tokens: 4000,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text: string = data.choices?.[0]?.message?.content ?? "";

  // Extract JSON from the response.
  // Groq may return any of:
  //   [item, item, ...]               — raw array of items
  //   {"items":[item, ...]}           — object with items key
  //   [{"items":[item, ...]}, ...]    — array wrapping an object with items key
  let items: ExtractedItem[] = [];
  try {
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    const objectMatch = text.match(/\{[\s\S]*\}/);

    if (arrayMatch) {
      const arr = JSON.parse(arrayMatch[0]);
      if (Array.isArray(arr)) {
        // Check if it's a wrapper array like [{"items":[...]}]
        if (arr.length > 0 && arr[0]?.items && Array.isArray(arr[0].items)) {
          items = arr[0].items;
        } else {
          items = arr;
        }
      }
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
