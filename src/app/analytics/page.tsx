import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAnalytics } from "@/server/analytics";
import { RatioChart, RepoChart, AuthorChart, TrendChart } from "@/components/analytics/charts";

export const dynamic = "force-dynamic";

function fmtDays(days: number | null): string {
  if (days === null) return "—";
  if (days < 1) return `${Math.round(days * 24)} jam`;
  return `${days.toFixed(1)} hari`;
}

export default function AnalyticsPage() {
  const data = getAnalytics();

  const kpis = [
    { label: "Total PR", value: String(data.total) },
    { label: "Repo", value: String(data.repoCount) },
    {
      label: "Open",
      value: String(data.stateRatio.find((s) => s.state === "OPEN")?.count ?? 0),
    },
    {
      label: "Merged",
      value: String(data.stateRatio.find((s) => s.state === "MERGED")?.count ?? 0),
    },
    {
      label: "Closed",
      value: String(data.stateRatio.find((s) => s.state === "CLOSED")?.count ?? 0),
    },
    { label: "Avg time-to-review", value: fmtDays(data.avgTimeToReviewDays), sub: `${data.reviewedCount} PR direview` },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Statistik pull request dari seluruh repo ter-<i>collect</i> (refresh otomatis via dashboard)
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">{k.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{k.value}</div>
              {k.sub && <div className="text-[11px] text-muted-foreground mt-0.5">{k.sub}</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Open / Merged / Closed Ratio</CardTitle>
          </CardHeader>
          <CardContent>
            <RatioChart data={data.stateRatio} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">PR per Repo</CardTitle>
          </CardHeader>
          <CardContent>
            <RepoChart data={data.perRepo} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">PR per Author</CardTitle>
          </CardHeader>
          <CardContent>
            <AuthorChart data={data.perAuthor} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Trend PR per Minggu (12 bulan)</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart data={data.trend} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
