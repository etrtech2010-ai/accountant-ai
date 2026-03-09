import Link from "next/link";
import { FileText, Zap, CheckCircle, ArrowRight } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <FileText className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-foreground">
              AccountantAI
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
            >
              Start Free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            <Zap className="h-3.5 w-3.5" />
            AI-Powered Bookkeeping
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-foreground leading-tight">
            Stop manually categorizing
            <br />
            receipts and invoices.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-xl">
            Upload your client documents. Our AI extracts the data, categorizes
            every transaction, and gives you a clean review queue. Export to CSV
            in one click.
          </p>
          <div className="mt-8 flex items-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
            >
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <span className="text-sm text-muted-foreground">
              No credit card required
            </span>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-border bg-muted/50">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            How it works
          </h2>
          <p className="mt-2 text-muted-foreground">
            Three steps. Fifteen seconds per document instead of fifteen minutes.
          </p>
          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Upload documents",
                description:
                  "Drag and drop receipts, invoices, or bank statements. PDF, PNG, JPG — we handle it all.",
              },
              {
                step: "02",
                title: "AI extracts & categorizes",
                description:
                  "Our AI reads every document, extracts vendor, amount, date, and assigns the right expense category.",
              },
              {
                step: "03",
                title: "Review & export",
                description:
                  "Quick review queue to approve or adjust. Export approved transactions to CSV for your accounting software.",
              },
            ].map((item) => (
              <div key={item.step} className="flex flex-col">
                <span className="text-sm font-bold text-primary">
                  {item.step}
                </span>
                <h3 className="mt-3 text-lg font-semibold text-foreground">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof Placeholder */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="flex items-center gap-3 text-muted-foreground">
            <CheckCircle className="h-5 w-5 text-success" />
            <span className="text-sm">
              Currently in beta — free for early adopters.
            </span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <span className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} AccountantAI
          </span>
          <div className="flex items-center gap-6">
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
