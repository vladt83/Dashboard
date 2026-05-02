// Client Dashboard — what the trader sees when they log in.
//
// Surfaces:
//   - Header with welcome + program timeline
//   - Assigned coach card (with Book Session button — Phase 4F wires the URL)
//   - Trading Log: live stats + month filter + add/edit/delete trades
//   - Quick links: Skool, onboarding presentation
//   - Recent coaching sessions (read-only)

import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  GraduationCap, BookOpen, ExternalLink, CalendarClock, Sparkles,
  TrendingUp, Hourglass, Plus, Edit2, Trash2, ChevronLeft, ChevronRight,
  TrendingDown, Wallet, Check, X as XIcon,
} from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";

type TradingLogPayload = inferRouterOutputs<AppRouter>["tradingLog"]["getMine"];
type TradeEntry = TradingLogPayload["entries"][number];

const STRATEGIES = [
  { value: "bounce_profit",       label: "Bounce Profit" },
  { value: "ready_set_explode",   label: "Ready Set Explode" },
  { value: "paycheck_collector",  label: "Paycheck Collector" },
] as const;
const STRATEGY_LABELS: Record<string, string> = Object.fromEntries(
  STRATEGIES.map(s => [s.value, s.label])
);

const DIRECTIONS = [
  { value: "directional_bullish",  label: "Bullish" },
  { value: "directional_bearish",  label: "Bearish" },
] as const;

export default function ClientDashboard() {
  const { data: me } = trpc.auth.me.useQuery();
  const profileQuery = trpc.clients.getMyProfile.useQuery();

  // Trading log — one fetch handles log row + entries + stats
  const [filterYear, setFilterYear] = useState<number | null>(null);
  const [filterMonth, setFilterMonth] = useState<number | null>(null);
  const tlQuery = trpc.tradingLog.getMine.useQuery(
    filterYear !== null && filterMonth !== null
      ? { year: filterYear, month: filterMonth }
      : undefined,
  );

  if (profileQuery.isLoading) {
    return (
      <div className="space-y-6 max-w-5xl">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (profileQuery.isError) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-2">
          <p className="text-sm text-muted-foreground">{profileQuery.error.message}</p>
          <p className="text-xs text-muted-foreground">
            Reach out to Ariana — she'll fix this in a minute.
          </p>
        </CardContent>
      </Card>
    );
  }

  const p = profileQuery.data;
  if (!p) return null;
  const t = p.timeline;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="rounded-2xl border border-border/40 bg-gradient-to-br from-card to-card/40 p-6 relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-primary/[0.04] blur-3xl"
        />
        <div className="relative">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Welcome back
          </div>
          <h1 className="text-3xl font-bold text-primary tracking-tight">
            {me?.name?.split(" ")[0] ?? "Trader"}
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Your home base — coach, trading log, and program timeline in one place.
          </p>
          {t && (
            <div className="flex flex-wrap items-center gap-3 mt-4 text-sm">
              <Badge variant="outline" className="bg-background gap-1.5">
                <CalendarClock className="h-3.5 w-3.5 text-primary" />
                {t.daysRemaining > 0
                  ? `${t.daysRemaining} days left in your 90-day program`
                  : t.daysRemaining === 0
                  ? "Last day of your 90-day program"
                  : `Program ended ${Math.abs(t.daysRemaining)} days ago`}
              </Badge>
              <Badge variant="outline" className="bg-background">
                Day {Math.max(0, t.daysSinceOnboarded)} of 90
              </Badge>
            </div>
          )}
          {!t && p.onboarding && !p.onboarding.onboardedAt && (
            <Badge className="mt-4 bg-amber-500/15 text-amber-400 border-0 gap-1">
              <Hourglass className="h-3 w-3" />
              Ariana is wrapping up your onboarding — your program clock starts the moment she does.
            </Badge>
          )}
        </div>
      </div>

      {/* Coach card */}
      <CoachCard profile={p} />

      {/* Trading Log */}
      <TradingLogPanel
        data={tlQuery.data}
        isLoading={tlQuery.isLoading}
        filterYear={filterYear}
        filterMonth={filterMonth}
        onFilterChange={(y, m) => { setFilterYear(y); setFilterMonth(m); }}
      />

      {/* Quick links */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5 text-primary" />
            Quick Links
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <a
            href="https://www.skool.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 p-4 rounded-lg border border-border/40 bg-secondary/20 hover:border-primary/40 transition-colors"
          >
            <div>
              <p className="font-semibold">Skool</p>
              <p className="text-xs text-muted-foreground">Community · Course · Coach comms</p>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </a>
          <a
            href="/onboarding-presentation.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 p-4 rounded-lg border border-border/40 bg-secondary/20 hover:border-primary/40 transition-colors"
          >
            <div>
              <p className="font-semibold">Onboarding Guide</p>
              <p className="text-xs text-muted-foreground">Re-read what Ariana walked you through</p>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </a>
        </CardContent>
      </Card>

      {/* Recent coaching sessions */}
      {p.coachingSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-lg">
              <span>Recent Coaching Sessions</span>
              <span className="text-xs font-normal text-muted-foreground">
                {p.coachingSessions.length} sessions
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {p.coachingSessions.slice(0, 8).map(s => (
                <div
                  key={s.id}
                  className="flex items-center justify-between text-sm py-2 border-b border-border/30"
                >
                  <span>{format(new Date(s.sessionDate), "MMM d, yyyy")}</span>
                  <span className="text-muted-foreground">
                    {s.isNoShow ? "No-show" : `${s.minutes} min`}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Coach card ─────────────────────────────────────────────────────────

type MyProfile = inferRouterOutputs<AppRouter>["clients"]["getMyProfile"];

function CoachCard({ profile }: { profile: MyProfile }) {
  const main = profile.assignedCoach;
  // Other active coaches (anyone who isn't the assigned coach). The client
  // can book with any of them — sometimes their main coach is in another
  // session, sometimes they want a different perspective.
  const alternates = profile.allCoaches.filter(
    c => !main || c.id !== main.id,
  );

  if (!main && alternates.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <GraduationCap className="h-5 w-5 text-primary" />
            Your Coach
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Ariana will assign your coach during onboarding — check back shortly.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <GraduationCap className="h-5 w-5 text-primary" />
          Your Coach
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Main coach: photo + name + big "Book a Session" button */}
        {main ? (
          <div className="flex items-start gap-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <CoachAvatar photoUrl={main.photoUrl} name={main.name} size={72} ringPrimary />
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-wider text-primary font-bold">Your Lead Coach</p>
              <p className="text-xl font-bold mt-1">{main.name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Talk via Skool — replies between 9am-5pm EST, Monday-Friday.
              </p>
              <div className="mt-3">
                <BookSessionButton bookingUrl={main.bookingUrl} coachName={main.name} primary />
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Your main coach hasn't been assigned yet — book with any coach below in the meantime.
          </p>
        )}

        {/* Alternate coaches — book with anyone else if needed */}
        {alternates.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              {main ? "Or book with another coach" : "Available coaches"}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {alternates.map(c => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-lg border border-border/40 bg-secondary/20 p-3"
                >
                  <CoachAvatar photoUrl={c.photoUrl} name={c.name} size={48} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{c.name}</p>
                    <BookSessionButton bookingUrl={c.bookingUrl} coachName={c.name} compact />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Initials when no photo URL is configured (defensive — every coach has one
// after the latest seed, but new coaches added later may not yet).
function CoachAvatar({
  photoUrl, name, size, ringPrimary,
}: {
  photoUrl: string | null;
  name: string;
  size: number;
  ringPrimary?: boolean;
}) {
  const ring = ringPrimary
    ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
    : "ring-1 ring-border/60";
  const initials = name
    .split(" ")
    .map(p => p[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        style={{ width: size, height: size }}
        className={`rounded-full object-cover shrink-0 ${ring}`}
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className={`rounded-full bg-secondary flex items-center justify-center font-bold text-primary shrink-0 ${ring}`}
    >
      {initials}
    </div>
  );
}

// Opens the coach's booking page (Google Calendar). When the URL isn't set
// yet, shows a polite nudge to message them in Skool instead.
function BookSessionButton({
  bookingUrl, coachName, primary, compact,
}: {
  bookingUrl: string | null;
  coachName: string;
  primary?: boolean;
  compact?: boolean;
}) {
  const label = compact ? "Book session" : "Book a Session";
  if (!bookingUrl) {
    return (
      <button
        type="button"
        onClick={() => toast(`No booking link for ${coachName} yet — message them in Skool.`)}
        className={`inline-flex items-center gap-1.5 rounded-md bg-secondary/40 ${compact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"} font-semibold text-muted-foreground border border-border/40`}
      >
        <CalendarClock className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        {label}
      </button>
    );
  }
  return (
    <a
      href={bookingUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 rounded-md ${primary ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-secondary/60 hover:bg-secondary text-foreground"} ${compact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"} font-semibold`}
    >
      <CalendarClock className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      {label}
    </a>
  );
}

// ─── Trading log panel ──────────────────────────────────────────────────

function TradingLogPanel({
  data, isLoading, filterYear, filterMonth, onFilterChange,
}: {
  data: TradingLogPayload | undefined;
  isLoading: boolean;
  filterYear: number | null;
  filterMonth: number | null;
  onFilterChange: (year: number | null, month: number | null) => void;
}) {
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TradeEntry | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const log = data?.log ?? null;
  const stats = data?.stats ?? null;
  const entries = data?.entries ?? [];

  if (!log) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-primary" />
            Your Trading Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your trading log isn't set up yet — Ariana will create it during your
            onboarding. Once it's active, you'll log every trade here and your
            coach reviews it weekly.
          </p>
        </CardContent>
      </Card>
    );
  }

  const needsStartingBalance = !!log && parseFloat(log.startingBalance) === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Your Trading Log
          </span>
          <Button
            size="sm"
            onClick={() => { setEditingEntry(null); setEntryDialogOpen(true); }}
            className="bg-primary hover:bg-primary/90"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add Trade
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* First-time prompt: set your starting balance */}
        {needsStartingBalance && (
          <StartingBalancePrompt tradingLogId={log.id} />
        )}

        {/* Headline stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Trades" value={stats.totalTrades} />
            <Stat
              label="Win rate"
              value={
                stats.closedTrades > 0
                  ? `${stats.winRatePct.toFixed(0)}%`
                  : "—"
              }
              hint={`${stats.wins}W · ${stats.losses}L`}
            />
            <Stat
              label="Total P/L"
              value={
                <span className={stats.totalProfitLoss >= 0 ? "text-green-400" : "text-red-400"}>
                  {stats.totalProfitLoss >= 0 ? "+" : ""}
                  ${stats.totalProfitLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              }
              hint={`${(stats.totalROI * 100).toFixed(1)}% ROI`}
            />
            <AccountStat
              currentBalance={stats.currentBalance}
              startingBalance={stats.startingBalance}
              tradingLogId={log!.id}
            />
          </div>
        )}

        {/* Per-strategy breakdown */}
        {stats && stats.byStrategy.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-2 border-t border-border/30">
            {stats.byStrategy.map(s => (
              <div
                key={s.strategy}
                className="flex items-center justify-between text-xs px-3 py-2 rounded-md bg-secondary/20 border border-border/30"
              >
                <span className="font-medium">{STRATEGY_LABELS[s.strategy]}</span>
                <span className="text-muted-foreground">
                  {s.trades} trades · {(s.wins + s.losses) > 0 ? `${s.winRatePct.toFixed(0)}% W` : "—"}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-2 pt-2 border-t border-border/30">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Filter:</span>
          <MonthFilter year={filterYear} month={filterMonth} onChange={onFilterChange} />
        </div>

        {/* Entries table */}
        {entries.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {filterYear !== null
              ? "No trades in this month."
              : "No trades logged yet. Click \"Add Trade\" to log your first one."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b border-border/50">
                <tr>
                  <th className="text-left py-2 font-medium">Date</th>
                  <th className="text-left py-2 font-medium">Ticker</th>
                  <th className="text-left py-2 font-medium">Strategy</th>
                  <th className="text-left py-2 font-medium">Direction</th>
                  <th className="text-right py-2 font-medium">Cost</th>
                  <th className="text-right py-2 font-medium">P/L</th>
                  <th className="text-right py-2 font-medium">Result</th>
                  <th className="w-16"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map(e => {
                  const pl = parseFloat(e.profitLoss);
                  const inv = parseFloat(e.totalInvestment);
                  return (
                    <tr key={e.id} className="border-b border-border/30 hover:bg-secondary/20">
                      <td className="py-2.5">{e.entryDate}</td>
                      <td className="py-2.5 font-medium">{e.ticker}</td>
                      <td className="py-2.5 text-xs text-muted-foreground">
                        {STRATEGY_LABELS[e.strategy]}
                      </td>
                      <td className="py-2.5 text-xs">
                        {e.direction === "directional_bullish" ? (
                          <span className="text-green-400 inline-flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" /> Bullish
                          </span>
                        ) : (
                          <span className="text-red-400 inline-flex items-center gap-1">
                            <TrendingDown className="h-3 w-3" /> Bearish
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-right text-muted-foreground">
                        ${inv.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className={`py-2.5 text-right font-semibold ${pl >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {pl >= 0 ? "+" : ""}${pl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="py-2.5 text-right">
                        {e.result === "win" ? (
                          <Badge className="bg-green-500/15 text-green-400 border-0">Win</Badge>
                        ) : e.result === "loss" ? (
                          <Badge className="bg-red-500/15 text-red-400 border-0">Loss</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Open</Badge>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => { setEditingEntry(e); setEntryDialogOpen(true); }}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-400/70 hover:text-red-400"
                            onClick={() => setConfirmDeleteId(e.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* Entry add/edit dialog */}
      <TradeEntryDialog
        open={entryDialogOpen}
        onOpenChange={setEntryDialogOpen}
        tradingLogId={log.id}
        existing={editingEntry}
      />

      {/* Delete confirmation */}
      <DeleteConfirmation
        entryId={confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
      />
    </Card>
  );
}

// ─── Helpers + sub-components ───────────────────────────────────────────

function Stat({
  label, value, hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-md border border-border/40 bg-secondary/20 p-3">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-0.5">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

function MonthFilter({
  year, month, onChange,
}: {
  year: number | null;
  month: number | null;
  onChange: (year: number | null, month: number | null) => void;
}) {
  const isAll = year === null;
  const today = new Date();
  const cur = year !== null && month !== null ? new Date(year, month - 1, 1) : today;
  const goPrev = () => {
    const d = new Date(cur);
    d.setMonth(d.getMonth() - 1);
    onChange(d.getFullYear(), d.getMonth() + 1);
  };
  const goNext = () => {
    const d = new Date(cur);
    d.setMonth(d.getMonth() + 1);
    onChange(d.getFullYear(), d.getMonth() + 1);
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant={isAll ? "default" : "outline"}
        onClick={() => onChange(null, null)}
        className={isAll ? "bg-primary hover:bg-primary/90" : ""}
      >
        All time
      </Button>
      <Button size="sm" variant="ghost" onClick={goPrev} className="h-8 w-8 p-0">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm min-w-[120px] text-center">
        {isAll ? "—" : format(cur, "MMMM yyyy")}
      </span>
      <Button size="sm" variant="ghost" onClick={goNext} className="h-8 w-8 p-0">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ─── Add/Edit trade dialog ──────────────────────────────────────────────

const empty = {
  ticker: "",
  strategy: "" as "" | "bounce_profit" | "ready_set_explode" | "paycheck_collector",
  direction: "" as "" | "directional_bullish" | "directional_bearish",
  result: "" as "" | "win" | "loss",
  entryDate: new Date().toISOString().slice(0, 10),
  entryTime: "",
  exitDate: "",
  strikePrices: "",
  expirationDate: "",
  contractCount: "1",
  askPrice: "",
  bidPrice: "",
  notes: "",
};

function TradeEntryDialog({
  open, onOpenChange, tradingLogId, existing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tradingLogId: number;
  existing: TradeEntry | null;
}) {
  const utils = trpc.useUtils();
  const isEdit = !!existing;
  const [form, setForm] = useState(empty);

  // Re-initialize when the dialog opens
  useMemo(() => {
    if (open) {
      if (existing) {
        setForm({
          ticker: existing.ticker,
          strategy: existing.strategy,
          direction: existing.direction,
          result: (existing.result ?? "") as typeof empty.result,
          entryDate: existing.entryDate,
          entryTime: existing.entryTime ?? "",
          exitDate: existing.exitDate ?? "",
          strikePrices: existing.strikePrices ?? "",
          expirationDate: existing.expirationDate ?? "",
          contractCount: String(existing.contractCount),
          askPrice: existing.askPrice,
          bidPrice: existing.bidPrice,
          notes: existing.notes ?? "",
        });
      } else {
        setForm(empty);
      }
    }
  }, [open, existing]);

  const add = trpc.tradingLog.addEntry.useMutation({
    onSuccess: () => {
      utils.tradingLog.getMine.invalidate();
      utils.tradingLog.getForDeal.invalidate();
      onOpenChange(false);
      toast.success("Trade logged.");
    },
    onError: e => toast.error(e.message),
  });
  const upd = trpc.tradingLog.updateEntry.useMutation({
    onSuccess: () => {
      utils.tradingLog.getMine.invalidate();
      utils.tradingLog.getForDeal.invalidate();
      onOpenChange(false);
      toast.success("Trade updated.");
    },
    onError: e => toast.error(e.message),
  });

  const isPending = add.isPending || upd.isPending;
  const canSubmit = form.ticker.trim().length > 0
    && form.strategy && form.direction
    && form.entryDate
    && form.askPrice !== "" && form.bidPrice !== ""
    && parseInt(form.contractCount || "0", 10) > 0;

  const handleSubmit = () => {
    const base = {
      ticker: form.ticker.trim().toUpperCase(),
      strategy: form.strategy as "bounce_profit" | "ready_set_explode" | "paycheck_collector",
      direction: form.direction as "directional_bullish" | "directional_bearish",
      result: form.result === "" ? null : (form.result as "win" | "loss"),
      entryDate: form.entryDate,
      entryTime: form.entryTime.trim() || undefined,
      exitDate: form.exitDate || undefined,
      strikePrices: form.strikePrices.trim() || undefined,
      expirationDate: form.expirationDate || undefined,
      contractCount: parseInt(form.contractCount, 10),
      askPrice: parseFloat(form.askPrice),
      bidPrice: parseFloat(form.bidPrice),
      notes: form.notes.trim() || undefined,
    };
    if (isEdit && existing) {
      upd.mutate({ entryId: existing.id, patch: base });
    } else {
      add.mutate({ tradingLogId, ...base });
    }
  };

  // Live P/L preview
  const preview = useMemo(() => {
    const ask = parseFloat(form.askPrice || "0");
    const bid = parseFloat(form.bidPrice || "0");
    const c = parseInt(form.contractCount || "0", 10);
    const totalInv = ask * 100 * c;
    const pl = (bid - ask) * 100 * c;
    const pct = totalInv === 0 ? 0 : pl / totalInv;
    return { totalInv, pl, pct };
  }, [form.askPrice, form.bidPrice, form.contractCount]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Trade" : "Add Trade"}</DialogTitle>
          <DialogDescription>
            Log every trade — entries, exits, strategy, P/L. Your coach reviews
            this weekly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Identity */}
          <Section title="The trade">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Ticker</Label>
                <Input
                  value={form.ticker}
                  onChange={e => setForm(f => ({ ...f, ticker: e.target.value }))}
                  placeholder="TSLA"
                  className="mt-1 uppercase"
                />
              </div>
              <div>
                <Label className="text-xs">Strategy</Label>
                <Select value={form.strategy} onValueChange={v => setForm(f => ({ ...f, strategy: v as typeof empty.strategy }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Pick" /></SelectTrigger>
                  <SelectContent>
                    {STRATEGIES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Direction</Label>
                <Select value={form.direction} onValueChange={v => setForm(f => ({ ...f, direction: v as typeof empty.direction }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Pick" /></SelectTrigger>
                  <SelectContent>
                    {DIRECTIONS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Section>

          {/* Dates */}
          <Section title="Dates">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Entry date</Label>
                <Input
                  type="date"
                  value={form.entryDate}
                  onChange={e => setForm(f => ({ ...f, entryDate: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Entry time (optional)</Label>
                <Input
                  type="time"
                  value={form.entryTime}
                  onChange={e => setForm(f => ({ ...f, entryTime: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Exit date (optional)</Label>
                <Input
                  type="date"
                  value={form.exitDate}
                  onChange={e => setForm(f => ({ ...f, exitDate: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
          </Section>

          {/* Options details */}
          <Section title="Options details">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Strike price(s)</Label>
                <Input
                  value={form.strikePrices}
                  onChange={e => setForm(f => ({ ...f, strikePrices: e.target.value }))}
                  placeholder="e.g. 234 or 230/240"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Expiration</Label>
                <Input
                  type="date"
                  value={form.expirationDate}
                  onChange={e => setForm(f => ({ ...f, expirationDate: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Contracts</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.contractCount}
                  onChange={e => setForm(f => ({ ...f, contractCount: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
          </Section>

          {/* Pricing + Result */}
          <Section title="Pricing">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Ask (entry cost)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.askPrice}
                  onChange={e => setForm(f => ({ ...f, askPrice: e.target.value }))}
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Bid (exit price)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.bidPrice}
                  onChange={e => setForm(f => ({ ...f, bidPrice: e.target.value }))}
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Result (when closed)</Label>
                <Select value={form.result} onValueChange={v => setForm(f => ({ ...f, result: v as typeof empty.result }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Open / Win / Loss" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="win">Win</SelectItem>
                    <SelectItem value="loss">Loss</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Live P/L preview */}
            <div className="rounded-md border border-border/40 bg-secondary/20 p-3 mt-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Live P/L preview</p>
              <p className="text-sm">
                Total cost: <span className="font-semibold">${preview.totalInv.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                {" · "}
                P/L: <span className={`font-semibold ${preview.pl >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {preview.pl >= 0 ? "+" : ""}${preview.pl.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
                {" · "}
                ROI: <span className={`font-semibold ${preview.pct >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {(preview.pct * 100).toFixed(2)}%
                </span>
              </p>
            </div>
          </Section>

          {/* Notes */}
          <Section title="Notes (optional)">
            <Textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="What you were thinking, what you'd do differently, what your coach should know."
              rows={3}
            />
          </Section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || isPending}
            className="bg-primary hover:bg-primary/90"
          >
            {isPending ? "Saving…" : isEdit ? "Save changes" : "Log trade"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function DeleteConfirmation({
  entryId, onClose,
}: {
  entryId: number | null;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const del = trpc.tradingLog.deleteEntry.useMutation({
    onSuccess: () => {
      utils.tradingLog.getMine.invalidate();
      utils.tradingLog.getForDeal.invalidate();
      onClose();
      toast.success("Trade deleted.");
    },
    onError: e => toast.error(e.message),
  });
  return (
    <AlertDialog open={entryId !== null} onOpenChange={(v) => { if (!v) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this trade?</AlertDialogTitle>
          <AlertDialogDescription>
            This is permanent. Your stats will recalculate.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => entryId !== null && del.mutate({ entryId })}
            disabled={del.isPending}
            className="bg-red-500 hover:bg-red-500/90"
          >
            {del.isPending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Starting balance prompt + inline editor ────────────────────────────
//
// Onboarding creates the trading log empty (starting balance = 0). The
// client sets it themselves the first time they hit the dashboard. We show
// a prominent banner until it's set, then a small "Edit" button to adjust.

function StartingBalancePrompt({ tradingLogId }: { tradingLogId: number }) {
  const [value, setValue] = useState("");
  const utils = trpc.useUtils();
  const update = trpc.tradingLog.updateLog.useMutation({
    onSuccess: () => {
      toast.success("Starting balance saved.");
      utils.tradingLog.getMine.invalidate();
    },
    onError: e => toast.error(e.message),
  });
  const submit = () => {
    const n = parseFloat(value);
    if (!isFinite(n) || n <= 0) {
      toast.error("Enter a positive number.");
      return;
    }
    update.mutate({ tradingLogId, startingBalance: n });
  };
  return (
    <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Wallet className="h-5 w-5 text-primary mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-primary">Set your starting account balance</p>
          <p className="text-xs text-muted-foreground mt-1">
            What's the dollar amount you started with? This anchors your ROI
            and running P/L. You can edit it later if needed.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 ml-8">
        <span className="text-sm text-muted-foreground">$</span>
        <Input
          type="number"
          min={0}
          step={100}
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="4000"
          className="max-w-[180px]"
          onKeyDown={e => { if (e.key === "Enter") submit(); }}
        />
        <Button
          size="sm"
          onClick={submit}
          disabled={update.isPending || !value}
          className="bg-primary hover:bg-primary/90"
        >
          {update.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

function AccountStat({
  currentBalance, startingBalance, tradingLogId,
}: {
  currentBalance: number;
  startingBalance: number;
  tradingLogId: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(startingBalance));
  const utils = trpc.useUtils();
  const update = trpc.tradingLog.updateLog.useMutation({
    onSuccess: () => {
      toast.success("Starting balance updated.");
      utils.tradingLog.getMine.invalidate();
      setEditing(false);
    },
    onError: e => toast.error(e.message),
  });
  const save = () => {
    const n = parseFloat(draft);
    if (!isFinite(n) || n < 0) {
      toast.error("Enter a non-negative number.");
      return;
    }
    update.mutate({ tradingLogId, startingBalance: n });
  };

  if (editing) {
    return (
      <div className="rounded-md border border-primary/40 bg-secondary/20 p-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Starting balance</p>
        <div className="flex items-center gap-1 mt-1">
          <span className="text-lg">$</span>
          <Input
            type="number"
            min={0}
            step={100}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            className="h-8 text-lg font-bold"
            autoFocus
            onKeyDown={e => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
          />
          <Button size="icon" variant="ghost" onClick={save} disabled={update.isPending} className="h-7 w-7 shrink-0">
            <Check className="h-4 w-4 text-green-400" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setEditing(false)} className="h-7 w-7 shrink-0">
            <XIcon className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border/40 bg-secondary/20 p-3 group">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">Account</p>
      <p className="text-2xl font-bold mt-0.5">
        ${currentBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </p>
      <button
        type="button"
        onClick={() => { setDraft(String(startingBalance)); setEditing(true); }}
        className="text-xs text-muted-foreground mt-0.5 hover:text-primary transition-colors flex items-center gap-1"
      >
        from ${startingBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    </div>
  );
}
