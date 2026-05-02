// Client Directory — every client in the system, in one place.
//
// Whoever is signed in (setter, closer, coach, payroll, admin) sees the same
// list and can click into any client's full Profile. The "one team, one view"
// surface — so the setter who set the call can follow it through to closing,
// onboarding, and coaching, and the coach can see how the client got here.

import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import {
  Users, Search, ChevronRight, CheckCircle2, FileSignature,
  Hourglass, GraduationCap, TrendingUp, Sparkles,
} from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";

type Filter = "all" | "onboarded" | "pending" | "trading";

export default function ClientDirectory() {
  const q = trpc.clients.listAll.useQuery();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const rows = q.data ?? [];

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter(r => {
      if (s) {
        const hit =
          r.clientName.toLowerCase().includes(s) ||
          (r.closerName ?? "").toLowerCase().includes(s) ||
          (r.setterName ?? "").toLowerCase().includes(s) ||
          (r.coachName ?? "").toLowerCase().includes(s);
        if (!hit) return false;
      }
      if (filter === "onboarded" && !r.onboardedAt) return false;
      if (filter === "pending" && (r.onboardedAt || !r.docusignSigned)) return false;
      if (filter === "trading" && (!r.hasTradingLog || r.tradeCount === 0)) return false;
      return true;
    });
  }, [rows, search, filter]);

  // Counts per filter pill so people can scan
  const counts = useMemo(() => ({
    all: rows.length,
    onboarded: rows.filter(r => !!r.onboardedAt).length,
    pending: rows.filter(r => !r.onboardedAt && r.docusignSigned).length,
    trading: rows.filter(r => r.hasTradingLog && r.tradeCount > 0).length,
  }), [rows]);

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
            One team, one view
          </div>
          <h1 className="text-3xl font-bold text-primary tracking-tight flex items-center gap-3">
            <Users className="h-7 w-7" />
            Clients
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
            Every client in the system — set, closed, onboarded, coached, trading.
            Click any name to open their full Profile with the complete history.
          </p>
        </div>
      </div>

      {/* Search + filter */}
      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by client, closer, setter, or coach…"
            className="pl-9"
          />
        </div>

        <Tabs value={filter} onValueChange={v => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="all">
              All <Badge variant="outline" className="ml-1.5 h-5 px-1.5">{counts.all}</Badge>
            </TabsTrigger>
            <TabsTrigger value="pending">
              Awaiting onboarding <Badge variant="outline" className="ml-1.5 h-5 px-1.5">{counts.pending}</Badge>
            </TabsTrigger>
            <TabsTrigger value="onboarded">
              Onboarded <Badge variant="outline" className="ml-1.5 h-5 px-1.5">{counts.onboarded}</Badge>
            </TabsTrigger>
            <TabsTrigger value="trading">
              With trades <Badge variant="outline" className="ml-1.5 h-5 px-1.5">{counts.trading}</Badge>
            </TabsTrigger>
          </TabsList>
          <TabsContent value={filter} className="mt-3">
            {/* Body */}
            {q.isLoading ? (
              <Card><CardContent className="p-4 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </CardContent></Card>
            ) : filtered.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
                No clients match your filter.
              </CardContent></Card>
            ) : (
              <Card><CardContent className="p-0">
                <div className="divide-y divide-border/40">
                  {filtered.map(r => <DirectoryRow key={r.dealId} row={r} />)}
                </div>
              </CardContent></Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

type Row = inferRouterOutputs<AppRouter>["clients"]["listAll"][number];

function DirectoryRow({ row }: { row: Row }) {
  return (
    <Link href={`/clients/${row.dealId}`}>
      <a className="flex items-center gap-4 p-4 hover:bg-secondary/30 cursor-pointer transition-colors group">
        {/* Status icon */}
        <StatusIcon row={row} />

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-foreground truncate">{row.clientName}</p>
            {row.tradeCount > 0 && (
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 h-5 gap-1">
                <TrendingUp className="h-3 w-3" />
                {row.tradeCount} {row.tradeCount === 1 ? "trade" : "trades"}
              </Badge>
            )}
            {row.hasClientLogin && row.lastSignedIn && (
              <Badge variant="outline" className="h-5 text-[10px]">
                logged in {formatDistanceToNow(new Date(row.lastSignedIn), { addSuffix: true })}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Closed {format(parseISO(row.dealDate), "MMM d, yyyy")}
            {row.totalDealAmount > 0 && <> · ${row.totalDealAmount.toLocaleString()}</>}
          </p>
          <div className="flex flex-wrap gap-2 mt-1.5 text-xs">
            {row.closerName && (
              <span className="text-muted-foreground">
                Closer: <span className="text-foreground">{row.closerName}</span>
              </span>
            )}
            {row.setterName && (
              <span className="text-muted-foreground">
                · Setter: <span className="text-foreground">{row.setterName}</span>
              </span>
            )}
            {row.coachName && (
              <span className="text-muted-foreground">
                · Coach: <span className="text-foreground">{row.coachName}</span>
              </span>
            )}
          </div>
        </div>

        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </a>
    </Link>
  );
}

function StatusIcon({ row }: { row: Row }) {
  if (row.onboardedAt) {
    return (
      <div className="w-10 h-10 rounded-full bg-green-500/15 flex items-center justify-center shrink-0" title="Onboarded">
        <GraduationCap className="h-5 w-5 text-green-400" />
      </div>
    );
  }
  if (row.docusignSigned) {
    return (
      <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0" title="Awaiting onboarding">
        <Hourglass className="h-5 w-5 text-amber-400" />
      </div>
    );
  }
  return (
    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0" title="Pre-DocuSign">
      <FileSignature className="h-5 w-5 text-muted-foreground" />
    </div>
  );
}
