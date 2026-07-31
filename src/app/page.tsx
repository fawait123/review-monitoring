import { listPRs } from "@/server/db/prs";
import { listRepos } from "@/server/db/repos";
import { PrTable } from "@/components/pr-table";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const prs = listPRs(undefined, "OPEN");
  const repos = listRepos().map((r) => r.nameWithOwner);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard Monitoring</h1>
        <p className="text-sm text-muted-foreground">
          Pull request open dari repo yang bisa diakses ({repos.length} repo, {prs.length} PR open)
        </p>
      </div>
      <PrTable prs={prs} repos={repos} />
    </div>
  );
}
