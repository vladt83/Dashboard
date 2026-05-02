import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Phone,
  User as UserIcon,
  CalendarDays,
  ClipboardList,
  AlertTriangle,
  Mail,
  ChevronDown,
  ChevronRight,
  Search,
  CheckCircle2,
  Sparkles,
  Inbox,
  X,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

/**
 * Setter Intel — closer-facing pre-call intelligence.
 *
 * Two information sources side-by-side:
 *   • Pre Call Notes — Jake's 5-question discovery (Pre Call lane)
 *   • Text Bookings  — Kresha's text-outreach bookings (Call Setting lane)
 *
 * Closer-only by default; admin sees all setters' work across the team.
 */
export default function SetterBookings() {
  const { data: me } = trpc.auth.me.useQuery();
  const isAdmin = me?.role === "admin";

  // Counts for the tab badges (so closers see "you've got 3 new" at a glance).
  const myPreps = trpc.vslPreps.listAssignedToMe.useQuery(undefined, { enabled: !isAdmin });
  const allPreps = trpc.vslPreps.listAll.useQuery(undefined, { enabled: isAdmin });
  const myBookings = trpc.bookedCalls.listAssignedToMe.useQuery(undefined, { enabled: !isAdmin });
  const allBookings = trpc.bookedCalls.listAll.useQuery(undefined, { enabled: isAdmin });

  const prepCount = (isAdmin ? allPreps.data : myPreps.data)?.length ?? 0;
  const unreviewedCount =
    (isAdmin ? allPreps.data : myPreps.data)?.filter(p => !p.reviewedByCloser).length ?? 0;
  const bookingCount = (isAdmin ? allBookings.data : myBookings.data)?.length ?? 0;

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
            Setter Intel
          </div>
          <h1 className="text-3xl font-bold text-primary tracking-tight">
            Pre-call intelligence
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
            {isAdmin
              ? "Everything your setters have logged across the team — Pre Call discovery answers (Jake) and Call Setting bookings (Kresha) — searchable and grouped per closer."
              : "Read this before opening every call. The setter has already done discovery — Jake's 5-question Pre Call notes tell you who you're about to speak with, and Kresha's text-outreach bookings give you context from the text thread."}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="vsl" className="space-y-4">
        <TabsList className="bg-card border border-border/40 h-11 p-1">
          <TabsTrigger value="vsl" className="gap-2 px-4 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <ClipboardList className="h-4 w-4" />
            Pre Call Notes
            {prepCount > 0 && (
              <Badge variant="outline" className="ml-1 border-primary/40 text-primary bg-primary/5 h-5">
                {prepCount}
              </Badge>
            )}
            {unreviewedCount > 0 && !isAdmin && (
              <Badge className="ml-1 bg-amber-500/15 text-amber-400 hover:bg-amber-500/20 border-0 h-5">
                {unreviewedCount} new
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="bookings" className="gap-2 px-4 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <CalendarDays className="h-4 w-4" />
            Text Bookings
            {bookingCount > 0 && (
              <Badge variant="outline" className="ml-1 border-primary/40 text-primary bg-primary/5 h-5">
                {bookingCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vsl" className="mt-0">
          <VslPrepNotesTab isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="bookings" className="mt-0">
          <BookingsTab isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────── Pre Call Notes ───────────────────────────────

function VslPrepNotesTab({ isAdmin }: { isAdmin: boolean }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unreviewed" | "flagged">("all");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const myAssigned = trpc.vslPreps.listAssignedToMe.useQuery(undefined, { enabled: !isAdmin });
  const all = trpc.vslPreps.listAll.useQuery(undefined, { enabled: isAdmin });
  const setters = trpc.team.getByRole.useQuery({ role: "setter" });
  const closers = trpc.team.getByRole.useQuery({ role: "closer" });

  const settersById = useMemo(() => {
    const m = new Map<number, string>();
    (setters.data ?? []).forEach(s => m.set(s.id, s.name));
    return m;
  }, [setters.data]);
  const closersById = useMemo(() => {
    const m = new Map<number, string>();
    (closers.data ?? []).forEach(c => m.set(c.id, c.name));
    return m;
  }, [closers.data]);

  const utils = trpc.useUtils();
  const markReviewed = trpc.vslPreps.update.useMutation({
    onSuccess: async () => {
      toast.success("Marked reviewed.");
      await utils.vslPreps.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const list = isAdmin ? all.data : myAssigned.data;
  const isLoading = isAdmin ? all.isLoading : myAssigned.isLoading;

  const filtered = useMemo(() => {
    let rows = list ?? [];
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(p => {
        const name = `${p.clientFirstName} ${p.clientLastName}`.toLowerCase();
        const phone = (p.phoneNumber || "").toLowerCase();
        const email = (p.email || "").toLowerCase();
        return name.includes(q) || phone.includes(q) || email.includes(q);
      });
    }
    if (filter === "unreviewed") rows = rows.filter(p => !p.reviewedByCloser);
    if (filter === "flagged") rows = rows.filter(p => p.redFlags && p.redFlags.trim().length > 0);
    return rows;
  }, [list, search, filter]);

  const toggle = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Toolbar — search + filter chips */}
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by client name, phone, or email…"
              className="pl-10 h-10 bg-background/50"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-muted hover:bg-muted-foreground/20 flex items-center justify-center"
                aria-label="Clear"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All" count={list?.length} />
            <FilterChip active={filter === "unreviewed"} onClick={() => setFilter("unreviewed")} label="New" count={list?.filter(p => !p.reviewedByCloser).length} tone="amber" />
            <FilterChip active={filter === "flagged"} onClick={() => setFilter("flagged")} label="Flagged" count={list?.filter(p => p.redFlags && p.redFlags.trim().length > 0).length} tone="red" />
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={
            search
              ? `No matches for "${search}"`
              : filter === "unreviewed"
                ? "No unreviewed preps"
                : filter === "flagged"
                  ? "No flagged preps"
                  : "No VSL preps yet"
          }
          subtitle={
            search
              ? "Try a different name or phone number."
              : "When the setter logs a discovery call, you'll see it here."
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <PrepCard
              key={p.id}
              prep={p}
              isOpen={expanded.has(p.id)}
              onToggle={() => toggle(p.id)}
              setterName={settersById.get(p.setterId)}
              closerName={closersById.get(p.closerId)}
              isAdmin={isAdmin}
              onMarkReviewed={() => markReviewed.mutate({ id: p.id, reviewedByCloser: true })}
              isMarking={markReviewed.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PrepCard({
  prep, isOpen, onToggle, setterName, closerName, isAdmin, onMarkReviewed, isMarking,
}: {
  prep: any;
  isOpen: boolean;
  onToggle: () => void;
  setterName?: string;
  closerName?: string;
  isAdmin: boolean;
  onMarkReviewed: () => void;
  isMarking: boolean;
}) {
  const flagged = prep.redFlags && prep.redFlags.trim().length > 0;
  const ageStr = formatDistanceToNow(new Date(prep.createdAt), { addSuffix: true });

  return (
    <Card
      className={[
        "transition-all overflow-hidden",
        isOpen ? "border-primary/40 shadow-lg shadow-primary/5" : "hover:border-primary/30",
        !prep.reviewedByCloser && !isAdmin ? "ring-1 ring-amber-500/20" : "",
      ].join(" ")}
    >
      {/* Header — clickable to toggle */}
      <button
        onClick={onToggle}
        className="w-full text-left p-5 flex items-start justify-between gap-4 hover:bg-secondary/20 transition-colors"
      >
        <div className="flex items-start gap-4 min-w-0 flex-1">
          <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0 mt-0.5">
            <span className="font-bold text-sm text-primary">
              {prep.clientFirstName?.[0]?.toUpperCase()}
              {prep.clientLastName?.[0]?.toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-base">
                {prep.clientFirstName} {prep.clientLastName}
              </h3>
              {!prep.reviewedByCloser && !isAdmin && (
                <Badge className="bg-amber-500/15 text-amber-400 hover:bg-amber-500/20 border-0 h-5">
                  unread
                </Badge>
              )}
              {prep.reviewedByCloser && (
                <Badge variant="outline" className="border-green-500/40 text-green-400 bg-green-500/5 h-5">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  reviewed
                </Badge>
              )}
              {flagged && (
                <Badge className="bg-red-500/15 text-red-400 hover:bg-red-500/20 border-0 h-5">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  flagged
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-x-3 gap-y-0.5 mt-1.5 flex-wrap text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {prep.phoneNumber}
              </span>
              {prep.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {prep.email}
                </span>
              )}
              <span className="text-muted-foreground/70">·</span>
              <span>
                {isAdmin
                  ? `${setterName ?? "Setter"} → ${closerName ?? "Closer"}`
                  : `set by ${setterName ?? "Setter"}`}
              </span>
              <span className="text-muted-foreground/70">·</span>
              <span>{ageStr}</span>
            </div>
            {/* Preview line — first chunk of motivation, if collapsed */}
            {!isOpen && prep.q1Motivation && (
              <p className="text-sm text-foreground/70 mt-2 line-clamp-1 italic">
                "{prep.q1Motivation}"
              </p>
            )}
          </div>
        </div>
        <div className="text-muted-foreground shrink-0 mt-1">
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </button>

      {/* Expanded body */}
      {isOpen && (
        <div className="border-t border-border/40 bg-secondary/10 p-5 space-y-4">
          {/* Discovery answers */}
          <div className="grid gap-3">
            <DiscoveryItem num={1} label="Why now — motivation" answer={prep.q1Motivation} />
            <DiscoveryItem num={2} label="Trading experience" answer={prep.q2TradingExperience} />
            <DiscoveryItem num={3} label="Day-to-day situation" answer={prep.q3DayToDay} />
            <DiscoveryItem num={4} label="Coachability" answer={prep.q4Coachability} highlight />
            <DiscoveryItem num={5} label="Wants covered on call" answer={prep.q5SpecificQuestions} />
          </div>

          {/* Red flags */}
          {flagged && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-4">
              <p className="text-xs uppercase tracking-wider text-red-400 font-bold flex items-center gap-1.5 mb-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Red Flags
              </p>
              <p className="text-sm text-foreground/90">{prep.redFlags}</p>
            </div>
          )}

          {/* Free-form notes */}
          {prep.notes && (
            <div className="rounded-lg border border-border/50 bg-background/40 p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                General Notes
              </p>
              <p className="text-sm text-foreground/90 whitespace-pre-line">{prep.notes}</p>
            </div>
          )}

          {/* Context strip — show-up incentive, VSL watched, scheduled time */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {prep.stockPredatorDelivered && (
              <Badge variant="outline" className="border-green-500/30 text-green-400 bg-green-500/5">
                ✓ Stock Predator promised
              </Badge>
            )}
            {prep.vslWatched && (
              <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-500/5">
                ✓ Watched the VSL
              </Badge>
            )}
            {prep.vslBookedAt && (
              <Badge variant="outline" className="border-border text-muted-foreground">
                Call scheduled: {format(new Date(prep.vslBookedAt), "MMM d 'at' h:mma")}
              </Badge>
            )}
          </div>

          {/* Mark reviewed — closer-only action */}
          {!isAdmin && !prep.reviewedByCloser && (
            <div className="pt-2 border-t border-border/30 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Letting the setter know you've read it improves the feedback loop.
              </p>
              <Button
                size="sm"
                disabled={isMarking}
                onClick={(e) => { e.stopPropagation(); onMarkReviewed(); }}
                className="bg-primary hover:bg-primary/90"
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                {isMarking ? "Saving…" : "Mark as reviewed"}
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function DiscoveryItem({
  num, label, answer, highlight,
}: {
  num: number;
  label: string;
  answer?: string | null;
  highlight?: boolean;
}) {
  if (!answer) return null;
  return (
    <div className={[
      "rounded-lg p-3.5",
      highlight ? "border border-primary/40 bg-primary/5" : "border border-border/40 bg-background/40",
    ].join(" ")}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className={[
          "h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0",
          highlight ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary",
        ].join(" ")}>
          {num}
        </span>
        <p className={[
          "text-xs uppercase tracking-wider font-semibold",
          highlight ? "text-primary" : "text-muted-foreground",
        ].join(" ")}>
          {label}
        </p>
      </div>
      <p className="text-sm text-foreground/90 leading-relaxed pl-7">"{answer}"</p>
    </div>
  );
}

function FilterChip({
  active, onClick, label, count, tone = "default",
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  tone?: "default" | "amber" | "red";
}) {
  const activeColor =
    tone === "amber" ? "bg-amber-500/15 text-amber-400 border-amber-500/40"
    : tone === "red" ? "bg-red-500/15 text-red-400 border-red-500/40"
    : "bg-primary/15 text-primary border-primary/40";
  return (
    <button
      onClick={onClick}
      className={[
        "px-3 py-1.5 rounded-md text-xs font-medium border transition-all",
        active ? activeColor : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground",
      ].join(" ")}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className="ml-1.5 opacity-70">{count}</span>
      )}
    </button>
  );
}

function EmptyState({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <Card>
      <CardContent className="py-16 flex flex-col items-center text-center">
        <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────── Text Bookings ────────────────────────────────

function BookingsTab({ isAdmin }: { isAdmin: boolean }) {
  const [search, setSearch] = useState("");

  const myAssigned = trpc.bookedCalls.listAssignedToMe.useQuery(undefined, { enabled: !isAdmin });
  const all = trpc.bookedCalls.listAll.useQuery(undefined, { enabled: isAdmin });
  const setters = trpc.team.getByRole.useQuery({ role: "setter" });
  const closers = trpc.team.getByRole.useQuery({ role: "closer" });

  const settersById = useMemo(() => {
    const m = new Map<number, string>();
    (setters.data ?? []).forEach(s => m.set(s.id, s.name));
    return m;
  }, [setters.data]);
  const closersById = useMemo(() => {
    const m = new Map<number, string>();
    (closers.data ?? []).forEach(c => m.set(c.id, c.name));
    return m;
  }, [closers.data]);

  const list = isAdmin ? all.data : myAssigned.data;
  const isLoading = isAdmin ? all.isLoading : myAssigned.isLoading;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list ?? [];
    return (list ?? []).filter(b => {
      const name = `${b.clientFirstName} ${b.clientLastName}`.toLowerCase();
      const phone = (b.phoneNumber || "").toLowerCase();
      return name.includes(q) || phone.includes(q);
    });
  }, [list, search]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search bookings by client name or phone…"
              className="pl-10 h-10 bg-background/50"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-muted hover:bg-muted-foreground/20 flex items-center justify-center"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Text Bookings
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Calls Kresha booked from text outreach.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title={search ? `No matches for "${search}"` : "No text bookings yet"}
              subtitle={search ? "Try a different name or phone number." : "When the setter books a call, it shows up here."}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground border-b border-border/40">
                  <tr>
                    <th className="text-left py-2.5 pr-3 font-medium">Date</th>
                    <th className="text-left py-2.5 pr-3 font-medium">Client</th>
                    <th className="text-left py-2.5 pr-3 font-medium">Phone</th>
                    {isAdmin && <th className="text-left py-2.5 pr-3 font-medium">Setter</th>}
                    <th className="text-left py-2.5 pr-3 font-medium">Closer</th>
                    <th className="text-left py-2.5 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(b => (
                    <tr key={b.id} className="border-b border-border/30 hover:bg-secondary/20">
                      <td className="py-3 pr-3 text-muted-foreground">{b.bookedDate}</td>
                      <td className="py-3 pr-3 font-medium">
                        <span className="flex items-center gap-2">
                          <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          {b.clientFirstName} {b.clientLastName}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5" />
                          {b.phoneNumber}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="py-3 pr-3 text-muted-foreground">
                          {settersById.get(b.setterId) ?? `Setter #${b.setterId}`}
                        </td>
                      )}
                      <td className="py-3 pr-3 text-muted-foreground">
                        {closersById.get(b.closerId) ?? `Closer #${b.closerId}`}
                      </td>
                      <td className="py-3 text-muted-foreground max-w-xs truncate">{b.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
