import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, BarChart3, FileSpreadsheet } from "lucide-react";

/**
 * Sales Tracker — mirrors the spreadsheet view your team has been using
 * (Steve2026 / Jhalil 2026 in the Google Sheet).
 *
 * Layout:
 *   - Top: monthly grid (12 rows, Jan–Dec) with all metrics + percentages
 *   - Below: quarterly rollup (Q1–Q4)
 *   - Click a month → drill-down view with daily breakdown for that month
 *
 * Numbers come from a unified view of `deals` (live) + `dailyStats`
 * (historical import). Both contribute to the same totals.
 */

type Metrics = {
  booked: number;
  showed: number;
  canceled: number;
  noShow: number;
  offered: number;
  closed: number;
  cashCollected: number;
  revGenerated: number;
};

const ZERO: Metrics = {
  booked: 0, showed: 0, canceled: 0, noShow: 0,
  offered: 0, closed: 0, cashCollected: 0, revGenerated: 0,
};

const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

function pct(num: number, den: number): string {
  if (!den) return "—";
  return `${(100 * num / den).toFixed(1)}%`;
}

function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function moneyOrDash(n: number, den: number): string {
  if (!den) return "—";
  return money(n / den);
}

function sumMetrics(rows: Metrics[]): Metrics {
  return rows.reduce<Metrics>((acc, r) => ({
    booked: acc.booked + r.booked,
    showed: acc.showed + r.showed,
    canceled: acc.canceled + r.canceled,
    noShow: acc.noShow + r.noShow,
    offered: acc.offered + r.offered,
    closed: acc.closed + r.closed,
    cashCollected: acc.cashCollected + r.cashCollected,
    revGenerated: acc.revGenerated + r.revGenerated,
  }), { ...ZERO });
}

export default function SalesTracker() {
  const { data: me } = trpc.auth.me.useQuery();
  const isAdminOrPayroll = me?.role === "admin" || me?.role === "payroll";

  const [year, setYear] = useState(2026);
  const [drilldown, setDrilldown] = useState<{ closerId: number; closerName: string; month: number } | null>(null);

  // Closers list (admin/payroll see picker; closer sees only themselves)
  const closers = trpc.team.getByRole.useQuery({ role: "closer" });
  const myLink = trpc.userTeam.getMyTeamMember.useQuery(undefined, {
    enabled: !!me && me.role === "closer",
  });

  const [selectedCloserId, setSelectedCloserId] = useState<number | null>(null);

  // For closers: auto-select self
  const effectiveCloserId = (() => {
    if (selectedCloserId) return selectedCloserId;
    if (me?.role === "closer" && myLink.data?.teamMember?.id) {
      return myLink.data.teamMember.id;
    }
    if (isAdminOrPayroll && closers.data && closers.data.length > 0) {
      return closers.data[0].id;
    }
    return null;
  })();

  const closerName = useMemo(() => {
    if (!effectiveCloserId) return "";
    const found = closers.data?.find(c => c.id === effectiveCloserId);
    return found?.name || `Closer #${effectiveCloserId}`;
  }, [effectiveCloserId, closers.data]);

  const monthlyQuery = trpc.salesTracker.monthly.useQuery(
    { closerId: effectiveCloserId!, year },
    { enabled: !!effectiveCloserId }
  );

  return (
    <div className="space-y-6 max-w-[1600px]">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
            Sales Tracker
          </p>
          <h1 className="text-3xl font-bold text-primary">Per-closer scoreboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monthly + quarterly funnel + collection metrics, the way your team likes it.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdminOrPayroll && (
            <Select
              value={effectiveCloserId ? String(effectiveCloserId) : ""}
              onValueChange={v => { setSelectedCloserId(parseInt(v)); setDrilldown(null); }}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Pick closer" />
              </SelectTrigger>
              <SelectContent>
                {(closers.data ?? []).map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => { setYear(y => y - 1); setDrilldown(null); }}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold w-16 text-center">{year}</span>
            <Button variant="outline" size="icon" onClick={() => { setYear(y => y + 1); setDrilldown(null); }}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Monthly grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{closerName} — {year}</span>
            <span className="text-xs text-muted-foreground font-normal">
              click a month to drill into daily detail
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {monthlyQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : (
            <MonthlyGrid
              data={monthlyQuery.data ?? []}
              onMonthClick={(m) => {
                if (effectiveCloserId) {
                  setDrilldown({ closerId: effectiveCloserId, closerName, month: m });
                }
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Quarterly rollup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Quarterly Rollup
          </CardTitle>
          <CardDescription>Quarter sums + percentages</CardDescription>
        </CardHeader>
        <CardContent>
          {monthlyQuery.data && (
            <QuarterlyRollup data={monthlyQuery.data} />
          )}
        </CardContent>
      </Card>

      {/* Drilldown */}
      {drilldown && effectiveCloserId && (
        <DailyDrilldown
          closerId={drilldown.closerId}
          closerName={drilldown.closerName}
          year={year}
          month={drilldown.month}
          onClose={() => setDrilldown(null)}
        />
      )}
    </div>
  );
}

// ─── Monthly grid ────────────────────────────────────────────────────────

function MonthlyGrid({
  data,
  onMonthClick,
}: {
  data: Metrics[];
  onMonthClick: (month: number) => void;
}) {
  const total = sumMetrics(data);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm whitespace-nowrap">
        <thead>
          <tr className="border-b border-border/40">
            <th className="text-left py-2 px-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Month</th>
            {["Booked", "Showed", "Canceled", "No Show", "Offer", "Closed"].map(h => (
              <th key={h} className="text-right py-2 px-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">{h}</th>
            ))}
            <th className="text-right py-2 px-2 font-semibold text-xs uppercase tracking-wider text-primary">Cash</th>
            <th className="text-right py-2 px-2 font-semibold text-xs uppercase tracking-wider text-primary">Rev</th>
            {["Coll %", "Show %", "Offer %", "Close %"].map(h => (
              <th key={h} className="text-right py-2 px-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">{h}</th>
            ))}
            <th className="text-right py-2 px-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Cash/Book</th>
            <th className="text-right py-2 px-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Cash/Show</th>
          </tr>
        </thead>
        <tbody>
          {data.map((m, i) => (
            <tr
              key={i}
              className="border-b border-border/20 hover:bg-secondary/30 cursor-pointer transition-colors"
              onClick={() => onMonthClick(i + 1)}
            >
              <td className="py-2 px-2 font-medium">{MONTHS[i]}</td>
              <td className="py-2 px-2 text-right">{m.booked || "—"}</td>
              <td className="py-2 px-2 text-right">{m.showed || "—"}</td>
              <td className="py-2 px-2 text-right">{m.canceled || "—"}</td>
              <td className="py-2 px-2 text-right">{m.noShow || "—"}</td>
              <td className="py-2 px-2 text-right">{m.offered || "—"}</td>
              <td className="py-2 px-2 text-right font-semibold">{m.closed || "—"}</td>
              <td className="py-2 px-2 text-right text-primary">{m.cashCollected ? money(m.cashCollected) : "—"}</td>
              <td className="py-2 px-2 text-right text-primary">{m.revGenerated ? money(m.revGenerated) : "—"}</td>
              <td className="py-2 px-2 text-right text-muted-foreground">{pct(m.cashCollected, m.revGenerated)}</td>
              <td className="py-2 px-2 text-right text-muted-foreground">{pct(m.showed, m.booked)}</td>
              <td className="py-2 px-2 text-right text-muted-foreground">{pct(m.offered, m.showed)}</td>
              <td className="py-2 px-2 text-right text-muted-foreground">{pct(m.closed, m.showed)}</td>
              <td className="py-2 px-2 text-right text-muted-foreground">{moneyOrDash(m.cashCollected, m.booked)}</td>
              <td className="py-2 px-2 text-right text-muted-foreground">{moneyOrDash(m.cashCollected, m.showed)}</td>
            </tr>
          ))}
          {/* Year total */}
          <tr className="border-t-2 border-primary/40 bg-primary/5 font-semibold">
            <td className="py-3 px-2 uppercase tracking-wider text-primary">Year</td>
            <td className="py-3 px-2 text-right">{total.booked || "—"}</td>
            <td className="py-3 px-2 text-right">{total.showed || "—"}</td>
            <td className="py-3 px-2 text-right">{total.canceled || "—"}</td>
            <td className="py-3 px-2 text-right">{total.noShow || "—"}</td>
            <td className="py-3 px-2 text-right">{total.offered || "—"}</td>
            <td className="py-3 px-2 text-right text-primary">{total.closed || "—"}</td>
            <td className="py-3 px-2 text-right text-primary">{total.cashCollected ? money(total.cashCollected) : "—"}</td>
            <td className="py-3 px-2 text-right text-primary">{total.revGenerated ? money(total.revGenerated) : "—"}</td>
            <td className="py-3 px-2 text-right">{pct(total.cashCollected, total.revGenerated)}</td>
            <td className="py-3 px-2 text-right">{pct(total.showed, total.booked)}</td>
            <td className="py-3 px-2 text-right">{pct(total.offered, total.showed)}</td>
            <td className="py-3 px-2 text-right">{pct(total.closed, total.showed)}</td>
            <td className="py-3 px-2 text-right">{moneyOrDash(total.cashCollected, total.booked)}</td>
            <td className="py-3 px-2 text-right">{moneyOrDash(total.cashCollected, total.showed)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── Quarterly rollup ────────────────────────────────────────────────────

function QuarterlyRollup({ data }: { data: Metrics[] }) {
  const quarters: { label: string; metrics: Metrics }[] = [
    { label: "Q1", metrics: sumMetrics(data.slice(0, 3)) },
    { label: "Q2", metrics: sumMetrics(data.slice(3, 6)) },
    { label: "Q3", metrics: sumMetrics(data.slice(6, 9)) },
    { label: "Q4", metrics: sumMetrics(data.slice(9, 12)) },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {quarters.map(q => (
        <div key={q.label} className="rounded-lg border border-border/40 bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-wider font-bold text-primary">{q.label}</span>
            <span className="text-xs text-muted-foreground">{q.metrics.closed} closed</span>
          </div>
          <div className="space-y-1.5 text-sm">
            <Row label="Booked"  value={q.metrics.booked} />
            <Row label="Showed"  value={q.metrics.showed} />
            <Row label="Closed"  value={q.metrics.closed} highlight />
            <Row label="Cash"    value={money(q.metrics.cashCollected)} highlight />
            <Row label="Rev"     value={money(q.metrics.revGenerated)} />
            <Row label="Show %"  value={pct(q.metrics.showed, q.metrics.booked)} />
            <Row label="Close %" value={pct(q.metrics.closed, q.metrics.showed)} />
            <Row label="Coll %"  value={pct(q.metrics.cashCollected, q.metrics.revGenerated)} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={highlight ? "text-primary font-semibold" : ""}>{value || "—"}</span>
    </div>
  );
}

// ─── Daily drill-down ────────────────────────────────────────────────────

function DailyDrilldown({
  closerId, closerName, year, month, onClose,
}: {
  closerId: number; closerName: string; year: number; month: number; onClose: () => void;
}) {
  const dailyQuery = trpc.salesTracker.daily.useQuery({ closerId, year, month });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>{closerName} — {MONTHS[month - 1]} {year} daily detail</CardTitle>
          <CardDescription>Per-day funnel breakdown</CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </CardHeader>
      <CardContent>
        {dailyQuery.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (dailyQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No activity recorded for this month.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-left py-2 px-2 font-semibold text-xs uppercase text-muted-foreground">Date</th>
                  {["Booked", "Showed", "Canceled", "No Show", "Offer", "Closed", "Cash", "Rev"].map(h => (
                    <th key={h} className="text-right py-2 px-2 font-semibold text-xs uppercase text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(dailyQuery.data ?? []).map(d => (
                  <tr key={d.date} className="border-b border-border/20">
                    <td className="py-2 px-2">{d.date}</td>
                    <td className="py-2 px-2 text-right">{d.booked || "—"}</td>
                    <td className="py-2 px-2 text-right">{d.showed || "—"}</td>
                    <td className="py-2 px-2 text-right">{d.canceled || "—"}</td>
                    <td className="py-2 px-2 text-right">{d.noShow || "—"}</td>
                    <td className="py-2 px-2 text-right">{d.offered || "—"}</td>
                    <td className="py-2 px-2 text-right font-semibold">{d.closed || "—"}</td>
                    <td className="py-2 px-2 text-right text-primary">{d.cashCollected ? money(d.cashCollected) : "—"}</td>
                    <td className="py-2 px-2 text-right text-primary">{d.revGenerated ? money(d.revGenerated) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
