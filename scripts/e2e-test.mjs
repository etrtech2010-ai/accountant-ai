/**
 * End-to-end pipeline test: upload → extract → review → approve → export
 * Run: node scripts/e2e-test.mjs
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { createRequire } from "module";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

const prisma = new PrismaClient({ log: ["error"] });

const FIRM_ID = "cmmjsmt5x0000l804rpy6zjty";
const FILE_URL =
  "https://mkmzuiqpzrqtsdqsbeyz.supabase.co/storage/v1/object/public/documents/cmmjsmt5x0000l804rpy6zjty/1773170686-e2etest.jpg";

function log(step, msg, data) {
  const prefix = `[STEP ${step}]`;
  console.log(`\n${"=".repeat(60)}`);
  console.log(`${prefix} ${msg}`);
  if (data !== undefined) console.log(JSON.stringify(data, null, 2));
}

function pass(msg) {
  console.log(`  ✅ PASS: ${msg}`);
}

function fail(msg) {
  console.log(`  ❌ FAIL: ${msg}`);
  process.exit(1);
}

// ─── STEP 1: Verify DB connection and firm/user ──────────────────────────────
log(1, "Verify DB connection, firm & test user");

const firm = await prisma.firm.findUnique({ where: { id: FIRM_ID } });
if (!firm) fail(`Firm ${FIRM_ID} not found in DB`);
pass(`Firm found: "${firm.name}"`);

const dbUser = await prisma.user.findFirst({ where: { firmId: FIRM_ID } });
if (!dbUser) fail("No user found for firm");
pass(`User: ${dbUser.email} (id: ${dbUser.id})`);

const categories = await prisma.category.findMany({
  where: { firmId: FIRM_ID },
  select: { id: true, name: true, code: true },
  orderBy: { name: "asc" },
});
pass(`Categories available: ${categories.length}`);
categories.forEach((c) => console.log(`    - ${c.name} (${c.id})`));

// ─── STEP 2: Create Document record ──────────────────────────────────────────
log(2, "Create Document record in DB");

const document = await prisma.document.create({
  data: {
    firmId: FIRM_ID,
    uploadedById: dbUser.id,
    fileName: "ReceiptSwiss_e2etest.jpg",
    fileUrl: FILE_URL,
    fileType: "jpg",
    fileSizeBytes: 962613,
    status: "PROCESSING",
  },
});
pass(`Document created: id=${document.id}, status=PROCESSING`);

// ─── STEP 3: Call Groq API (vision OCR + classify) ───────────────────────────
log(3, "Call Groq Llama 4 Scout vision API");

const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (!GROQ_API_KEY) fail("GROQ_API_KEY not set");

const categoryList = categories
  .map((c) => `- ${c.name} (id: ${c.id})`)
  .join("\n");

const prompt = `You are a bookkeeping assistant. Examine this receipt or invoice image and extract all transactions.

Available categories:
${categoryList}

Return ONLY valid JSON — no explanation, no markdown fences.
Extract every line item. For each item assign the best matching category from the list.
Amounts are numbers without currency symbols. Dates are YYYY-MM-DD or null.

{"items":[{"vendor":"string","description":"string or null","date":"YYYY-MM-DD or null","amount":0.00,"taxAmount":null,"currency":"USD","categoryName":"exact name from list","categoryId":"id from list","confidence":0.9}]}`;

const groqResponse = await fetch(
  "https://api.groq.com/openai/v1/chat/completions",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: FILE_URL } },
            { type: "text", text: prompt },
          ],
        },
      ],
      max_tokens: 2000,
    }),
  }
);

if (!groqResponse.ok) {
  const err = await groqResponse.text();
  fail(`Groq API error ${groqResponse.status}: ${err}`);
}

const groqData = await groqResponse.json();
const rawText = groqData.choices?.[0]?.message?.content ?? "";
console.log(`  Raw Groq response:\n${rawText}`);

// Parse JSON — handle both array [...] and object {"items":[...]}
let extractedItems = [];
try {
  const arrayMatch = rawText.match(/\[[\s\S]*\]/);
  const objectMatch = rawText.match(/\{[\s\S]*\}/);
  if (arrayMatch) {
    const arr = JSON.parse(arrayMatch[0]);
    if (Array.isArray(arr)) extractedItems = arr;
  } else if (objectMatch) {
    const obj = JSON.parse(objectMatch[0]);
    if (obj.items && Array.isArray(obj.items)) extractedItems = obj.items;
  }
} catch (e) {
  fail(`JSON parse error: ${e.message}\nRaw: ${rawText}`);
}

if (extractedItems.length === 0) {
  fail("Groq returned 0 items — parser or model issue");
}
pass(`Groq extracted ${extractedItems.length} items`);
extractedItems.forEach((item, i) => {
  console.log(
    `    [${i + 1}] vendor="${item.vendor}" amount=${item.amount} category="${item.categoryName}" confidence=${item.confidence}`
  );
});

// ─── STEP 4: Save items to DB ─────────────────────────────────────────────────
log(4, "Save ExtractedItems to DB");

const createdItemIds = [];
for (const item of extractedItems) {
  const matchedCategory = categories.find(
    (c) => c.name === item.categoryName || c.id === item.categoryId
  );
  const created = await prisma.extractedItem.create({
    data: {
      documentId: document.id,
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
  createdItemIds.push(created.id);
}

await prisma.document.update({
  where: { id: document.id },
  data: { status: "NEEDS_REVIEW" },
});

pass(`${createdItemIds.length} items created, document → NEEDS_REVIEW`);

// ─── STEP 5: Verify items in DB ──────────────────────────────────────────────
log(5, "Verify PENDING items in DB (Review Queue check)");

const pendingItems = await prisma.extractedItem.findMany({
  where: { documentId: document.id, status: "PENDING" },
  include: { category: { select: { name: true } } },
});

if (pendingItems.length !== extractedItems.length) {
  fail(
    `Expected ${extractedItems.length} PENDING items, found ${pendingItems.length}`
  );
}
pass(`${pendingItems.length} PENDING items in Review Queue`);
pendingItems.forEach((item) => {
  console.log(
    `    id=${item.id} vendor="${item.vendor}" amount=${item.amount} status=${item.status} category="${item.category?.name || "none"}"`
  );
});

// ─── STEP 6: Bulk approve all items ──────────────────────────────────────────
log(6, "Bulk approve all items");

const updateResult = await prisma.extractedItem.updateMany({
  where: { id: { in: createdItemIds }, document: { firmId: FIRM_ID } },
  data: {
    status: "APPROVED",
    approvedById: dbUser.id,
    approvedAt: new Date(),
  },
});
pass(`Updated ${updateResult.count} items to APPROVED`);

// Update document status
const remainingPending = await prisma.extractedItem.count({
  where: { documentId: document.id, status: "PENDING" },
});
if (remainingPending === 0) {
  await prisma.document.update({
    where: { id: document.id },
    data: { status: "APPROVED" },
  });
  pass("Document status → APPROVED");
}

// ─── STEP 7: Verify APPROVED status ──────────────────────────────────────────
log(7, "Verify items are APPROVED");

const approvedItems = await prisma.extractedItem.findMany({
  where: { documentId: document.id, status: "APPROVED" },
  include: { category: { select: { name: true, code: true } } },
});
if (approvedItems.length !== createdItemIds.length) {
  fail(
    `Expected ${createdItemIds.length} APPROVED, found ${approvedItems.length}`
  );
}
pass(`${approvedItems.length} items confirmed APPROVED`);

// ─── STEP 8: Export CSV ───────────────────────────────────────────────────────
log(8, "Generate CSV export");

function escapeCsv(value) {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const headers = [
  "Date",
  "Vendor",
  "Description",
  "Amount",
  "Tax",
  "Currency",
  "Category",
  "Category Code",
  "Source Document",
];
const rows = approvedItems.map((item) => [
  item.date ? new Date(item.date).toISOString().split("T")[0] : "",
  escapeCsv(item.vendor || ""),
  escapeCsv(item.description || ""),
  item.amount.toString(),
  item.taxAmount?.toString() || "",
  item.currency,
  escapeCsv(item.category?.name || ""),
  item.category?.code || "",
  "ReceiptSwiss_e2etest.jpg",
]);

const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
console.log("\n  CSV output:");
console.log(csv);

if (rows.length === 0) fail("CSV has 0 data rows");
pass(`CSV contains ${rows.length} rows`);

// ─── SUMMARY ─────────────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(60));
console.log("FINAL SUMMARY");
console.log("=".repeat(60));
console.log(`  Document ID   : ${document.id}`);
console.log(`  Items extracted: ${extractedItems.length}`);
console.log(`  Items approved : ${approvedItems.length}`);
console.log(`  CSV rows       : ${rows.length}`);
console.log(
  "\n  ✅ ALL STEPS PASSED — upload → extract → review → approve → export pipeline is WORKING"
);

await prisma.$disconnect();
