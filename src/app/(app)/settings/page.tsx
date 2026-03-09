import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";
import { Tag, Users, Building } from "lucide-react";

export default async function SettingsPage() {
  const user = await getCurrentUser();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your firm, team, and expense categories.
        </p>
      </div>

      {/* Firm Info */}
      <div className="rounded-xl border border-border bg-card p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Building className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">{user.firm.name}</h2>
            <p className="text-xs text-muted-foreground capitalize">
              {user.firm.plan.toLowerCase()} plan
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Owner:</span>{" "}
            <span className="text-foreground">{user.name}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Email:</span>{" "}
            <span className="text-foreground">{user.email}</span>
          </div>
        </div>
      </div>

      {/* Settings Links */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/settings/categories"
          className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 hover:bg-muted/30 transition-colors"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
            <Tag className="h-5 w-5 text-amber-700" />
          </div>
          <div>
            <h3 className="font-medium text-foreground">
              Expense Categories
            </h3>
            <p className="text-xs text-muted-foreground">
              Manage your chart of accounts categories
            </p>
          </div>
        </Link>
        <Link
          href="/settings/team"
          className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 hover:bg-muted/30 transition-colors"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
            <Users className="h-5 w-5 text-blue-700" />
          </div>
          <div>
            <h3 className="font-medium text-foreground">Team Members</h3>
            <p className="text-xs text-muted-foreground">
              Invite and manage your team
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
