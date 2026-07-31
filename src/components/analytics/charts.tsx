"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import type { AnalyticsData } from "@/server/analytics";

const COLORS: Record<string, string> = {
  OPEN: "var(--chart-1)",
  MERGED: "var(--chart-2)",
  CLOSED: "var(--chart-3)",
};

const STATE_LABEL: Record<string, string> = { OPEN: "Open", MERGED: "Merged", CLOSED: "Closed" };

export function RatioChart({ data }: { data: AnalyticsData["stateRatio"] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="state" innerRadius={60} outerRadius={95} paddingAngle={3}>
          {data.map((d) => (
            <Cell key={d.state} fill={COLORS[d.state]} />
          ))}
        </Pie>
        <Tooltip formatter={(v: any, name: any) => [v, STATE_LABEL[name] ?? name]} />
        <Legend formatter={(v) => STATE_LABEL[v] ?? v} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function RepoChart({ data }: { data: AnalyticsData["perRepo"] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
        <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} />
        <YAxis
          type="category"
          dataKey="repo"
          width={170}
          stroke="var(--muted-foreground)"
          fontSize={10}
          tickFormatter={(v: string) => (v.length > 20 ? v.slice(0, 19) + "…" : v)}
        />
        <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
        <Legend formatter={(v) => STATE_LABEL[v] ?? v} />
        <Bar dataKey="OPEN" stackId="a" fill={COLORS.OPEN} />
        <Bar dataKey="MERGED" stackId="a" fill={COLORS.MERGED} />
        <Bar dataKey="CLOSED" stackId="a" fill={COLORS.CLOSED} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AuthorChart({ data }: { data: AnalyticsData["perAuthor"] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ left: 0, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="author" stroke="var(--muted-foreground)" fontSize={11} interval={0} angle={-30} textAnchor="end" height={60} />
        <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
        <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
        <Bar dataKey="count" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendChart({ data }: { data: AnalyticsData["trend"] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ left: 0, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="week" stroke="var(--muted-foreground)" fontSize={10} />
        <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
        <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
        <Legend formatter={(v) => STATE_LABEL[v] ?? v} />
        <Area type="monotone" dataKey="OPEN" stackId="1" stroke={COLORS.OPEN} fill={COLORS.OPEN} fillOpacity={0.5} />
        <Area type="monotone" dataKey="MERGED" stackId="1" stroke={COLORS.MERGED} fill={COLORS.MERGED} fillOpacity={0.5} />
        <Area type="monotone" dataKey="CLOSED" stackId="1" stroke={COLORS.CLOSED} fill={COLORS.CLOSED} fillOpacity={0.5} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
