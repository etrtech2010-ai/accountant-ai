export interface ParsedTransaction {
  date: Date;
  description: string;
  amount: number; // always positive
  type: "DEBIT" | "CREDIT";
  balance?: number;
}

// ── CSV ─────────────────────────────────────────────────────────────────────

function parseAmount(raw: string): number {
  return Math.abs(parseFloat(raw.replace(/[$,\s]/g, "")) || 0);
}

function parseDate(raw: string): Date | null {
  const s = raw.trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s);
  // MM/DD/YYYY or DD/MM/YYYY — heuristic: if day > 12 it must be DD first
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const [, a, b, y] = m;
    const year = y.length === 2 ? 2000 + parseInt(y) : parseInt(y);
    const aNum = parseInt(a);
    const bNum = parseInt(b);
    // If a > 12, must be DD/MM
    const [month, day] = aNum > 12 ? [bNum, aNum] : [aNum, bNum];
    const d = new Date(year, month - 1, day);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findColumn(
  headers: string[],
  candidates: string[]
): number {
  const normalized = headers.map(normalizeHeader);
  for (const c of candidates) {
    const idx = normalized.indexOf(c);
    if (idx !== -1) return idx;
  }
  // partial match
  for (const c of candidates) {
    const idx = normalized.findIndex((h) => h.includes(c));
    if (idx !== -1) return idx;
  }
  return -1;
}

export function parseCsv(content: string): ParsedTransaction[] {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  // Split CSV line respecting quoted fields
  function splitLine(line: string): string[] {
    const result: string[] = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        result.push(field.trim());
        field = "";
      } else {
        field += ch;
      }
    }
    result.push(field.trim());
    return result;
  }

  const headers = splitLine(lines[0]);
  const dateIdx = findColumn(headers, ["date", "transactiondate", "txndate", "postdate", "posteddate"]);
  const descIdx = findColumn(headers, ["description", "memo", "details", "narrative", "particular", "payee"]);
  const amountIdx = findColumn(headers, ["amount", "transactionamount"]);
  const debitIdx = findColumn(headers, ["debit", "debitamount", "withdrawal", "withdrawals"]);
  const creditIdx = findColumn(headers, ["credit", "creditamount", "deposit", "deposits"]);
  const balanceIdx = findColumn(headers, ["balance", "runningbalance", "closingbalance"]);

  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    if (cols.length < 2) continue;

    const rawDate = dateIdx >= 0 ? cols[dateIdx] : "";
    const rawDesc = descIdx >= 0 ? cols[descIdx] : "";
    const rawBalance = balanceIdx >= 0 ? cols[balanceIdx] : "";

    const date = parseDate(rawDate);
    if (!date) continue;
    const description = rawDesc || "Unknown";

    let amount = 0;
    let type: "DEBIT" | "CREDIT" = "DEBIT";

    if (amountIdx >= 0) {
      // Single amount column — negative = debit, positive = credit
      const raw = cols[amountIdx] || "";
      const val = parseFloat(raw.replace(/[$,\s]/g, ""));
      if (!isNaN(val)) {
        amount = Math.abs(val);
        type = val < 0 ? "DEBIT" : "CREDIT";
      }
    } else if (debitIdx >= 0 || creditIdx >= 0) {
      const debitRaw = debitIdx >= 0 ? cols[debitIdx] : "";
      const creditRaw = creditIdx >= 0 ? cols[creditIdx] : "";
      const debitVal = parseAmount(debitRaw);
      const creditVal = parseAmount(creditRaw);
      if (debitVal > 0) {
        amount = debitVal;
        type = "DEBIT";
      } else if (creditVal > 0) {
        amount = creditVal;
        type = "CREDIT";
      } else {
        continue; // no amount
      }
    } else {
      continue;
    }

    if (amount === 0) continue;

    const balance = rawBalance ? parseAmount(rawBalance) : undefined;

    transactions.push({ date, description, amount, type, balance });
  }

  return transactions;
}

// ── OFX / QFX ───────────────────────────────────────────────────────────────

export function parseOfx(content: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  // Match STMTTRN blocks
  const blocks = content.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];

  for (const block of blocks) {
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}>([^<\n\r]+)`, "i"));
      return m ? m[1].trim() : "";
    };

    const rawDate = get("DTPOSTED") || get("DTUSER");
    const rawAmount = get("TRNAMT");
    const memo = get("MEMO") || get("NAME") || "Unknown";
    const trnType = get("TRNTYPE").toUpperCase(); // DEBIT, CREDIT, etc.

    // OFX date: YYYYMMDDHHMMSS
    const dateMatch = rawDate.match(/^(\d{4})(\d{2})(\d{2})/);
    if (!dateMatch) continue;
    const date = new Date(
      parseInt(dateMatch[1]),
      parseInt(dateMatch[2]) - 1,
      parseInt(dateMatch[3])
    );

    const val = parseFloat(rawAmount);
    if (isNaN(val) || val === 0) continue;
    const amount = Math.abs(val);
    // OFX: negative TRNAMT = debit
    const type: "DEBIT" | "CREDIT" =
      trnType === "CREDIT" || val > 0 ? "CREDIT" : "DEBIT";

    transactions.push({ date, description: memo, amount, type });
  }

  return transactions;
}

// ── PDF (Groq vision) ────────────────────────────────────────────────────────

export async function parsePdf(
  fileBuffer: Buffer,
  mimeType: string
): Promise<ParsedTransaction[]> {
  const base64 = fileBuffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: dataUrl } },
              {
                type: "text",
                text: `Extract all bank transactions from this bank statement image.
Return ONLY a JSON array with no additional text. Each element must have:
- date: ISO date string (YYYY-MM-DD)
- description: transaction description/memo
- amount: positive number
- type: "DEBIT" or "CREDIT"
- balance: running balance if shown (number, optional)

Example: [{"date":"2024-01-15","description":"GROCERY STORE","amount":45.23,"type":"DEBIT","balance":1234.56}]`,
              },
            ],
          },
        ],
      }),
    }
  );

  const json = await response.json();
  const raw: string = json.choices?.[0]?.message?.content || "[]";

  // Extract JSON array from response
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return [];

  try {
    const rows = JSON.parse(match[0]);
    return (Array.isArray(rows) ? rows : []).map(
      (r: Record<string, unknown>) => ({
        date: new Date(r.date as string),
        description: String(r.description || "Unknown"),
        amount: Math.abs(Number(r.amount) || 0),
        type: String(r.type || "DEBIT").toUpperCase() === "CREDIT"
          ? ("CREDIT" as const)
          : ("DEBIT" as const),
        balance: r.balance != null ? Number(r.balance) : undefined,
      })
    ).filter((t: ParsedTransaction) => t.amount > 0 && !isNaN(t.date.getTime()));
  } catch {
    return [];
  }
}

// ── Main dispatcher ──────────────────────────────────────────────────────────

export async function parseBankStatement(
  content: string | Buffer,
  filename: string,
  mimeType: string
): Promise<ParsedTransaction[]> {
  const ext = filename.toLowerCase().split(".").pop() || "";

  if (ext === "ofx" || ext === "qfx") {
    return parseOfx(content.toString());
  }

  if (ext === "pdf" || mimeType === "application/pdf") {
    return parsePdf(Buffer.isBuffer(content) ? content : Buffer.from(content), mimeType);
  }

  // Default: CSV
  return parseCsv(content.toString());
}
