import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

const prisma = new PrismaClient();
const DOC_ID = process.argv[2];

const doc = await prisma.document.findUnique({
  where: { id: DOC_ID },
  include: { items: { include: { category: { select: { name: true } } } } },
});

if (!doc) { console.log("Document not found"); process.exit(1); }

console.log("Doc ID:", doc.id);
console.log("Doc status:", doc.status);
console.log("Items:", doc.items.length);
doc.items.forEach((i) =>
  console.log(" -", i.id, `vendor="${i.vendor}"`, `amount=${i.amount}`, `status=${i.status}`, `category="${i.category?.name}"`)
);

const raw = doc.ocrRawOutput;
if (raw?.text) {
  console.log("\nRaw Groq text:");
  console.log(raw.text);
}

await prisma.$disconnect();
