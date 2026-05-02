// Onboarding queue — Ariana's home base for getting new clients up and running.
//
//   Pending tab:    every DocuSigned, closed deal not yet fully onboarded.
//                   Sorted oldest first so nothing rots at the back.
//   Recent tab:     last 30 days of completed onboardings — read-only reference.
//
// Click any row → /clients/:dealId for the full unified profile, where Ariana
// works the checklist inline and clicks "Mark fully onboarded" when ready.

import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import {
  UserCheck, Inbox, CheckCircle2, Clock, ChevronRight,
  AlertCircle, Sparkles, Bell, Loader2,
} from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";

type Row = inferRouterOutputs<AppRouter>["onboarding"]["listPending"][number];

export default function Onboarding() {
  const [tab, setTab] = useState<"pending" | "recent">("pending");
  const { data: me } = trpc.auth.me.useQuery();
  const isAdmin = me?.role === "admin";
  const pendingQuery = trpc.onboarding.listPending.useQuery();
  const recentQuery = trpc.onboarding.listRecent.useQuery();

  const pending = pendingQuery.data ?? [];
  const recent = recentQuery.data ?? [];
  const pendingLoading = pendingQuery.isLoading;
  const recentLoading = recentQuery.isLoading;

  // Admin-only: manually trigger the cron. Useful for testing and for the
  // first run of the day if the external scheduler is delayed.
  const utils = trpc.useUtils();
  const runReminders = trpc.extensions.runRemindersNow.useMutation({
    onSuccess: r => {
      const summary = r.newAlerts === 0
        ? "No new alerts — all due milestones already fired."
        : `Fired ${r.newAlerts} alert${r.newAlerts === 1 ? "" : "s"} across ${r.fired.length} client${r.fired.length === 1 ? "" : "s"}.`;
      toast.success(summary);
      utils.clients.getProfile.invalidate();
      utils.extensions.listUpcoming.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="rounded-2xl border border-border/40 bg-gradient-to-br from-card to-card/40 p-6 relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-primary/[0.04] blur-3xl"
        />
        <div className="relative">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Ariana's queue
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-primary tracking-tight flex items-center gap-3">
                <UserCheck className="h-7 w-7" />
                Onboarding
              </h1>
              <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
                Get every new client set up — Skool access, payment confirmed,
                sessions booked, course assigned. The 90-day program clock starts
                the moment you mark a client fully onboarded.
              </p>
            </div>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => runReminders.mutate()}
                disabled={runReminders.isPending}
                title="Manually scan all onboarded clients and fire any due 90-day alerts now. Idempotent."
              >
                {runReminders.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Bell className="h-4 w-4 mr-2" />
                )}
                Run reminders now
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={v => setTab(v as "pending" | "recent")} className="space-y-4">
        <TabsList className="bg-card border border-border/40 h-11 p-1">
          <TabsTrigger value="pending" className="gap-2 px-4 data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-400">
            <Inbox className="h-4 w-4" />
            Pending
            {pending.length > 0 && (
              <Badge className="ml-1 bg-amber-500/15 text-amber-400 hover:bg-amber-500/20 border-0 h-5">
                {pending.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="recent" className="gap-2 px-4 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <CheckCircle2 className="h-4 w-4" />
            Recently onboarded
            {recent.length > 0 && (
              <Badge variant="outline" className="ml-1 border-primary/40 text-primary bg-primary/5 h-5">
                {recent.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-0">
          {pendingLoading ? <RowsSkeleton /> :
           pending.length === 0 ? <EmptyPending /> :
           <RowList rows={pending} mode="pending" />}
        </TabsContent>

        <TabsContent value="recent" className="mt-0">
          {recentLoading ? <RowsSkeleton /> :
           recent.length === 0 ? <EmptyRecent /> :
           <RowList rows={recent} mode="recent" />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── List ───────────────────────────────────────────────────────────────

function RowList({ rows, mode }: { rows: Row[]; mode: "pending" | "recent" }) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y divide-border/40">
          {rows.map(r => <OnboardingRow key={r.dealId} row={r} mode={mode} />)}
        </div>
      </CardContent>
    </Card>
  );
}

function OnboardingRow({ row, mode }: { row: Row; mode: "pending" | "recent" }) {
  const dealDate = parseISO(row.dealDate);
  const daysWaiting = mode === "pending"
    ? Math.floor((Date.now() - dealDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const isStale = daysWaiting !== null && daysWaiting > 7;

  return (
    <Link href={`/clients/${row.dealId}`}>
      <div className="flex items-center gap-4 p-4 hover:bg-secondary/30 cursor-pointer transition-colors group">
        {/* Progress ring */}
        <ProgressRing done={row.itemsDone} total={row.itemsTotal} />

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-foreground truncate">{row.clientName}</p>
            {isStale && (
              <Badge className="bg-amber-500/15 text-amber-400 border-0 h-5 gap-1">
                <AlertCircle className="h-3 w-3" />
                {daysWaiting}d waiting
              </Badge>
            )}
            {mode === "recent" && row.onboardedAt && (
              <Badge variant="outline" className="border-primary/40 text-primary bg-primary/5 h-5 gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {formatDistanceToNow(new Date(row.onboardedAt), { addSuffix: true })}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Closed {format(dealDate, "MMM d, yyyy")}
            {row.closerName && <> · by {row.closerName}</>}
            {row.totalDealAmount > 0 && <> · ${row.totalDealAmount.toLocaleString()}</>}
          </p>
        </div>

        {/* Checklist chips */}
        <div className="hidden md:flex items-center gap-1.5">
          <Chip on label="DocuSign" />
          <Chip on={row.skoolAccessGranted} label="Skool" />
          <Chip on={row.paymentVerified} label="Payment" />
          <Chip on={row.introCallBooked} label="Intro call" />
          <Chip on={row.tradingLogAssigned} label="Log" />
          <Chip on={row.weeklyCheckInSent} label="Check-in" />
        </div>

        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </div>
    </Link>
  );
}

// ─── Pieces ─────────────────────────────────────────────────────────────

function ProgressRing({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : done / total;
  const radius = 18;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - pct);
  const isDone = done === total;

  return (
    <div className="relative w-12 h-12 shrink-0">
      <svg className="w-12 h-12 -rotate-90" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={radius} fill="none" strokeWidth="3" className="stroke-border/50" />
        <circle
          cx="22" cy="22" r={radius} fill="none" strokeWidth="3" strokeLinecap="round"
          className={isDone ? "stroke-green-400" : "stroke-primary"}
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold">
        {done}/{total}
      </div>
    </div>
  );
}

function Chip({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={
        "px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider " +
        (on
          ? "bg-green-500/15 text-green-400"
          : "bg-secondary/40 text-muted-foreground")
      }
    >
      {label}
    </span>
  );
}

function RowsSkeleton() {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
      </CardContent>
    </Card>
  );
}

function EmptyPending() {
  return (
    <Card>
      <CardContent className="py-16 text-center space-y-3">
        <CheckCircle2 className="h-10 w-10 mx-auto text-green-400/70" />
        <p className="text-sm text-muted-foreground">
          Nothing pending. All DocuSigned clients are onboarded.
        </p>
      </CardContent>
    </Card>
  );
}

function EmptyRecent() {
  return (
    <Card>
      <CardContent className="py-16 text-center space-y-3">
        <Clock className="h-10 w-10 mx-auto text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">
          No clients onboarded in the last 30 days yet.
        </p>
      </CardContent>
    </Card>
  );
}
