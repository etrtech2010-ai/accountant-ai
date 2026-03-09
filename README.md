# AccountantAI

AI-powered document intake and auto-categorization for bookkeeping firms.

## Quick Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Settings → API** and copy your project URL and anon key
3. Go to **Settings → Database** and copy both connection strings
4. Create a Storage bucket named `documents` (set to public)

### 3. Configure environment variables

```bash
cp .env.example .env
```

Fill in all the values in `.env`:
- Supabase URL, anon key, service role key
- Database URLs (Transaction + Session)
- Anthropic API key from [console.anthropic.com](https://console.anthropic.com)
- Mindee API key from [platform.mindee.com](https://platform.mindee.com)

### 4. Set up the database

```bash
npx prisma db push
```

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Deploy to Vercel

```bash
npx vercel
```

Make sure to add all environment variables in Vercel dashboard.

## Stack

- **Framework:** Next.js 15 (App Router)
- **Auth:** Supabase Auth
- **Database:** Supabase Postgres via Prisma ORM
- **Storage:** Supabase Storage
- **OCR:** Mindee Expense Receipts API
- **AI:** Claude API (Anthropic)
- **UI:** TailwindCSS + shadcn/ui
- **Deployment:** Vercel
