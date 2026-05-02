// Unified Client Profile — single page that surfaces every interaction with
// a client. Whoever opens this gets exactly the slice of truth their role
// allows (server-gated). Sections, top to bottom:
//
//   1. Header           — name, plan amount, days since onboarding (Phase 3)
//   2. Sales            — closer + setter, DocuSign status
//   3. Onboarding       — Ariana's checklist (editable for payroll/admin)
//   4. Coaching         — every session logged for this client
//   5. Payments         — payment-plan progress (if applicable)
//   6. Activity         — chronological timeline derived from the above
//
// Designed so that:
//   - Ariana works the onboarding checklist inline (no separate edit screen)
//   - Closers + setters see the whole picture for context but can't edit
//   - The 90-day program clock (Phase 3) anchors to the onboardedAt stamp
//     this page produces.

import { useMemo } from "react";
import { Link, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  ArrowLeft, User, ShieldCheck, CheckCircle2, Circle,
  GraduationCap, CreditCard, Activity, Lock, FileSignature, BookOpen,
  Sparkles, Hourglass, RotateCcw, CalendarClock, Bell,
  Phone, MessageSquare, TrendingUp, XCircle,
  KeyRound, Copy, Mail,
} from "lucide-react";
import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export default function ClientProfile() {
  const [, params] = useRoute("/clients/:dealId");
  const dealId = params?.dealId ? parseInt(params.dealId, 10) : null;
  const { data: me } = trpc.auth.me.useQuery();
  const profileQuery = trpc.clients.getProfile.useQuery(
    { dealId: dealId! },
    { enabled: dealId !== null },
  );

  if (dealId === null) {
    return <p className="text-sm text-muted-foreground">Invalid deal id.</p>;
  }

  if (profileQuery.isLoading) return <LoadingSkeleton />;
  if (profileQuery.isError) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-3">
          <Lock className="h-10 w-10 mx-auto text-amber-500/70" />
          <p className="text-sm text-muted-foreground">{profileQuery.error.message}</p>
          <BackLink />
        </CardContent>
      </Card>
    );
  }

  const p = profileQuery.data;
  if (!p) return null;

  const canEdit = me?.role === "admin" || me?.role === "payroll";

  const canSetStatus = me?.role === "admin" || me?.role === "payroll" || me?.role === "closer";

  return (
    <div className="space-y-6 max-w-6xl">
      <BackLink />
      <Header profile={p} />
      <SalesSection profile={p} />
      <ClientAccountSection profile={p} dealId={dealId} canEdit={canEdit} />
      <TradingLogSection profile={p} dealId={dealId} canEdit={canEdit} />
      <OnboardingSection profile={p} dealId={dealId} canEdit={canEdit} />
      <ExtensionSection profile={p} dealId={dealId} canSetStatus={canSetStatus} />
      <CoachingSection profile={p} />
      <PaymentsSection profile={p} />
      <ActivitySection profile={p} />
    </div>
  );
}

// ─── Header ─────────────────────────────────────────────────────────────

type Profile = inferRouterOutputs<AppRouter>["clients"]["getProfile"];

function Header({ profile }: { profile: Profile }) {
  const { deal, onboarding } = profile;
  const totalCash =
    parseFloat(deal.newCashCollected || "0") + parseFloat(deal.existingCashCollected || "0");

  return (
    <div className="rounded-2xl border border-border/40 bg-gradient-to-br from-card to-card/40 p-6 relative overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-primary/[0.04] blur-3xl"
      />
      <div className="relative">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Client profile
        </div>
        <h1 className="text-3xl font-bold text-primary tracking-tight flex items-center gap-3">
          <User className="h-7 w-7" />
          {deal.clientName}
        </h1>
        <div className="flex flex-wrap items-center gap-3 mt-3 text-sm">
          <Badge variant="outline" className="bg-background">
            Closed {format(parseISO(deal.dealDate), "MMM d, yyyy")}
          </Badge>
          {parseFloat(deal.totalDealAmount || "0") > 0 && (
            <Badge variant="outline" className="bg-background">
              Plan ${parseFloat(deal.totalDealAmount || "0").toLocaleString()}
            </Badge>
          )}
          {totalCash > 0 && (
            <Badge variant="outline" className="bg-background">
              Cash collected ${totalCash.toLocaleString()}
            </Badge>
          )}
          {deal.docusignSigned ? (
            <Badge className="bg-green-500/15 text-green-400 border-0 gap-1">
              <FileSignature className="h-3 w-3" />
              DocuSign signed
            </Badge>
          ) : (
            <Badge className="bg-amber-500/15 text-amber-400 border-0 gap-1">
              <FileSignature className="h-3 w-3" />
              DocuSign pending
            </Badge>
          )}
          {onboarding?.onboardedAt ? (
            <Badge className="bg-primary/15 text-primary border-0 gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Onboarded {formatDistanceToNow(new Date(onboarding.onboardedAt), { addSuffix: true })}
            </Badge>
          ) : deal.docusignSigned ? (
            <Badge className="bg-amber-500/15 text-amber-400 border-0 gap-1">
              <Hourglass className="h-3 w-3" />
              In onboarding
            </Badge>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Sales section ──────────────────────────────────────────────────────

function SalesSection({ profile }: { profile: Profile }) {
  const { deal, closer, setter } = profile;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Sales
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <Field
            label="Closer"
            value={closer?.name ?? `#${deal.closerId}`}
          />
          <Field
            label="Setter"
            value={
              setter
                ? `${setter.name}${setter.setterMotion ? ` (${setter.setterMotion === "vsl" ? "Pre Call" : "Call Setting"})` : ""}`
                : "—"
            }
          />
          <Field
            label="Payment type"
            value={
              deal.paymentType === "in_house_payment_plan" ? "In-house plan" :
              deal.paymentType === "bnpl" ? "BNPL" :
              deal.paymentType === "full_pay" ? "Full pay" :
              "—"
            }
          />
        </dl>
      </CardContent>
    </Card>
  );
}

// ─── Client Account section ─────────────────────────────────────────────
//
// Surfaces whether Ariana has created a login for this client yet. If not,
// "Create Login" opens a dialog with email/name pre-filled from the deal,
// default password "Trader". Once created, shows the email + last sign-in.

function ClientAccountSection({
  profile, dealId, canEdit,
}: {
  profile: Profile;
  dealId: number;
  canEdit: boolean;
}) {
  const { deal, clientUser } = profile;
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState(deal.clientName);

  const utils = trpc.useUtils();
  const createLogin = trpc.clients.createLogin.useMutation({
    onSuccess: async (_r) => {
      utils.clients.getProfile.invalidate({ dealId });
      // Auto-fire the sign-in link right after creation — saves Ariana a click.
      await sendLink.mutateAsync({ dealId });
      setOpen(false);
    },
    onError: e => toast.error(e.message),
  });
  const sendLink = trpc.clients.sendSignInLink.useMutation({
    onSuccess: () => toast.success("Sign-in link emailed to client."),
    onError: e => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Client Login
          </span>
          {clientUser && (
            <Badge className="bg-green-500/15 text-green-400 border-0 gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Active
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {clientUser ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <Field label="Email" value={
                <span className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  {clientUser.email}
                </span>
              } />
              <Field label="Name" value={clientUser.name ?? "—"} />
              <Field
                label="Last sign-in"
                value={clientUser.lastSignedIn
                  ? formatDistanceToNow(new Date(clientUser.lastSignedIn), { addSuffix: true })
                  : "Never (account created, hasn't logged in yet)"}
              />
            </div>
            {canEdit && (
              <div className="flex items-center justify-between gap-4 pt-3 border-t border-border/40">
                <p className="text-xs text-muted-foreground">
                  Clients sign in via emailed link — no password to remember.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => sendLink.mutate({ dealId })}
                  disabled={sendLink.isPending}
                >
                  <Mail className="h-3.5 w-3.5 mr-1.5" />
                  {sendLink.isPending ? "Sending…" : "Send sign-in link"}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm">No login created yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Clicking <strong>Create Login</strong> creates the client's account
                AND emails them a one-click sign-in link — no password needed.
                They already manage Skool's, this is one less to remember.
              </p>
            </div>
            {canEdit && (
              <Button
                onClick={() => {
                  setEmail("");
                  setName(deal.clientName);
                  setOpen(true);
                }}
                className="bg-primary hover:bg-primary/90 shrink-0"
              >
                <KeyRound className="h-4 w-4 mr-2" />
                Create Login
              </Button>
            )}
          </div>
        )}
      </CardContent>

      {/* Create Login dialog — passwordless. Client sets nothing; clicking
          "Create + send link" mints the account AND emails a magic link
          that signs them in for 30 days. */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Client Login</DialogTitle>
            <DialogDescription>
              The client doesn't get a password — they sign in via an emailed
              link. We'll create the account AND send the welcome email in one click.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="client@example.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Name</Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                className="mt-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              The link works for 30 days. Client can request a fresh one anytime
              from the login page.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={createLogin.isPending || sendLink.isPending || !email || !name}
              onClick={() => createLogin.mutate({ dealId, email, name })}
              className="bg-primary hover:bg-primary/90"
            >
              <Mail className="h-4 w-4 mr-1.5" />
              {createLogin.isPending || sendLink.isPending ? "Setting up…" : "Create + send link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Trading Log section ────────────────────────────────────────────────
//
// Ariana creates the trading log here once the client login exists. Shows
// active stats (trades, win rate, total P/L) once the client has logged
// trades. The actual log entry UI lives on the client's own dashboard.

function TradingLogSection({
  profile, dealId, canEdit,
}: {
  profile: Profile;
  dealId: number;
  canEdit: boolean;
}) {
  const { clientUser } = profile;
  const tlQuery = trpc.tradingLog.getForDeal.useQuery({ dealId });
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [brokerNote, setBrokerNote] = useState("");

  const createLog = trpc.tradingLog.create.useMutation({
    onSuccess: (r) => {
      utils.tradingLog.getForDeal.invalidate({ dealId });
      setOpen(false);
      toast.success(r.created ? "Trading log created — client sets their own starting balance from their dashboard." : "Trading log already existed.");
    },
    onError: e => toast.error(e.message),
  });

  if (tlQuery.isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <Skeleton className="h-6 w-32" />
        </CardContent>
      </Card>
    );
  }

  const log = tlQuery.data?.log;
  const stats = tlQuery.data?.stats;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Trading Log
          </span>
          {log && (
            <Badge className="bg-green-500/15 text-green-400 border-0 gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Active
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!clientUser ? (
          <p className="text-sm text-muted-foreground">
            Create the client login first — the trading log is bound to their account.
          </p>
        ) : !log ? (
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm">No trading log yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Once you create the log, the client can start adding trades from
                their dashboard. Their assigned coach reviews it weekly.
              </p>
            </div>
            {canEdit && (
              <Button
                onClick={() => setOpen(true)}
                className="bg-primary hover:bg-primary/90 shrink-0"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Create Trading Log
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <Field label="Total trades" value={stats?.totalTrades ?? 0} />
              <Field
                label="Win rate"
                value={
                  stats?.closedTrades && stats.closedTrades > 0
                    ? `${stats.winRatePct.toFixed(0)}%`
                    : "—"
                }
              />
              <Field
                label="Total P/L"
                value={
                  <span className={(stats?.totalProfitLoss ?? 0) >= 0 ? "text-green-400" : "text-red-400"}>
                    {(stats?.totalProfitLoss ?? 0) >= 0 ? "+" : ""}
                    ${(stats?.totalProfitLoss ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                }
              />
              <Field
                label="Account"
                value={`$${(stats?.currentBalance ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              />
            </div>

            {/* Per-strategy breakdown */}
            {stats && stats.byStrategy.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {stats.byStrategy.map(s => (
                  <div key={s.strategy} className="flex items-center justify-between text-xs px-3 py-2 rounded-md bg-secondary/20 border border-border/30">
                    <span className="font-medium">
                      {s.strategy === "bounce_profit" ? "Bounce Profit" :
                       s.strategy === "ready_set_explode" ? "Ready Set Explode" :
                       "Paycheck Collector"}
                    </span>
                    <span className="text-muted-foreground">
                      {s.trades} trades{(s.wins + s.losses) > 0 ? ` · ${s.winRatePct.toFixed(0)}% W` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Trades table — read-only view for everyone seeing this page */}
            {tlQuery.data?.entries && tlQuery.data.entries.length > 0 ? (
              <div className="overflow-x-auto pt-2 border-t border-border/30">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Recent trades
                </p>
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground border-b border-border/50">
                    <tr>
                      <th className="text-left py-2 font-medium">Date</th>
                      <th className="text-left py-2 font-medium">Ticker</th>
                      <th className="text-left py-2 font-medium">Strategy</th>
                      <th className="text-right py-2 font-medium">Cost</th>
                      <th className="text-right py-2 font-medium">P/L</th>
                      <th className="text-right py-2 font-medium">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tlQuery.data.entries.slice(0, 25).map(e => {
                      const pl = parseFloat(e.profitLoss);
                      const inv = parseFloat(e.totalInvestment);
                      return (
                        <tr key={e.id} className="border-b border-border/30">
                          <td className="py-2">{e.entryDate}</td>
                          <td className="py-2 font-medium">{e.ticker}</td>
                          <td className="py-2 text-xs text-muted-foreground">
                            {e.strategy === "bounce_profit" ? "Bounce" :
                             e.strategy === "ready_set_explode" ? "RSE" :
                             "Paycheck"}
                            {" · "}{e.direction === "directional_bullish" ? "↑" : "↓"}
                          </td>
                          <td className="py-2 text-right text-muted-foreground">
                            ${inv.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                          <td className={`py-2 text-right font-semibold ${pl >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {pl >= 0 ? "+" : ""}${pl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                          <td className="py-2 text-right">
                            {e.result === "win" ? (
                              <Badge className="bg-green-500/15 text-green-400 border-0">W</Badge>
                            ) : e.result === "loss" ? (
                              <Badge className="bg-red-500/15 text-red-400 border-0">L</Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">—</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {tlQuery.data.entries.length > 25 && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Showing 25 most-recent trades · {tlQuery.data.entries.length} total
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic pt-2 border-t border-border/30">
                No trades logged yet. The client adds rows from their dashboard.
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              Started at ${parseFloat(log.startingBalance).toLocaleString()}
              {log.brokerNote ? ` · ${log.brokerNote}` : ""}.
            </p>
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Trading Log</DialogTitle>
            <DialogDescription>
              The client sets their starting balance from their own dashboard
              — they know their account size best. You can optionally pre-fill
              a broker note here if it helps them get oriented.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Broker / Account Note (optional)</Label>
              <Input
                value={brokerNote}
                onChange={e => setBrokerNote(e.target.value)}
                placeholder="e.g. ThinkOrSwim · primary trading account"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={createLog.isPending}
              onClick={() => createLog.mutate({
                dealId,
                startingBalance: 0,
                brokerNote: brokerNote.trim() || undefined,
              })}
              className="bg-primary hover:bg-primary/90"
            >
              {createLog.isPending ? "Creating…" : "Create Log"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Onboarding section ─────────────────────────────────────────────────

function OnboardingSection({
  profile, dealId, canEdit,
}: {
  profile: Profile;
  dealId: number;
  canEdit: boolean;
}) {
  const { deal, onboarding, assignedCoach, coachOptions } = profile;
  const utils = trpc.useUtils();

  const update = trpc.onboarding.update.useMutation({
    onSuccess: () => utils.clients.getProfile.invalidate({ dealId }),
    onError: e => toast.error(e.message),
  });
  const complete = trpc.onboarding.complete.useMutation({
    onSuccess: () => {
      toast.success("Marked fully onboarded — 90-day clock has started.");
      utils.clients.getProfile.invalidate({ dealId });
      utils.onboarding.invalidate();
    },
    onError: e => toast.error(e.message),
  });
  const reopen = trpc.onboarding.reopen.useMutation({
    onSuccess: () => {
      toast.success("Reopened onboarding.");
      utils.clients.getProfile.invalidate({ dealId });
      utils.onboarding.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const items = useMemo(() => ({
    docusign: deal.docusignSigned,
    skool: onboarding?.skoolAccessGranted ?? false,
    payment: onboarding?.paymentVerified ?? false,
    introCall: onboarding?.introCallBooked ?? false,
    tradingLog: onboarding?.tradingLogAssigned ?? false,
    checkIn: onboarding?.weeklyCheckInSent ?? false,
  }), [deal.docusignSigned, onboarding]);

  const allDone = Object.values(items).every(Boolean);
  const isComplete = !!onboarding?.onboardedAt;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Onboarding
          </span>
          {isComplete && (
            <Badge className="bg-green-500/15 text-green-400 border-0 gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Fully onboarded
            </Badge>
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {canEdit
            ? "Work each item, then click Mark fully onboarded to start the 90-day program clock."
            : "Read-only — Ariana works this checklist on the Onboarding page."}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 1. DocuSign — auto */}
        <ChecklistItem
          done={items.docusign}
          locked
          title="DocuSign verified"
          subtitle={
            items.docusign
              ? "Auto-confirmed from the closer's flag."
              : "Closer hasn't flipped DocuSign yet — they do that on My Deals."
          }
        />

        {/* 2. Skool */}
        <ChecklistItem
          done={items.skool}
          title="Skool access set up"
          subtitle={
            onboarding?.skoolAccessAt
              ? `Granted ${format(new Date(onboarding.skoolAccessAt), "MMM d, h:mma")}`
              : "Add to the course community."
          }
        >
          {canEdit && (
            <Checkbox
              checked={items.skool}
              onCheckedChange={c => update.mutate({ dealId, skoolAccessGranted: !!c })}
            />
          )}
        </ChecklistItem>

        {/* 3. Payment verified */}
        <ChecklistItem
          done={items.payment}
          title="Payment verified in system"
          subtitle={
            onboarding?.paymentVerifiedAt
              ? `Verified ${format(new Date(onboarding.paymentVerifiedAt), "MMM d, h:mma")}${onboarding.paymentNote ? " — " + onboarding.paymentNote : ""}`
              : "Confirm Fanbasis / Denefits / Stripe / Client Financing matches what's on the deal."
          }
        >
          {canEdit && (
            <Checkbox
              checked={items.payment}
              onCheckedChange={c => update.mutate({ dealId, paymentVerified: !!c })}
            />
          )}
        </ChecklistItem>
        {canEdit && items.payment && (
          <div className="ml-9 -mt-1">
            <Input
              placeholder="Payment note (e.g. Fanbasis monthly $499 confirmed)"
              defaultValue={onboarding?.paymentNote ?? ""}
              onBlur={e => {
                const next = e.target.value.trim();
                if (next !== (onboarding?.paymentNote ?? "")) {
                  update.mutate({ dealId, paymentNote: next });
                }
              }}
              className="text-sm h-8"
            />
          </div>
        )}

        {/* 4. Intro call booked — onboarding only books the FIRST call with
            the coach. The coach handles all follow-up scheduling inside
            Skool / their own calendar. */}
        <ChecklistItem
          done={items.introCall}
          title={
            items.introCall
              ? "Intro call booked"
              : "Intro call booked"
          }
          subtitle={
            items.introCall && onboarding?.introCallBookedAt
              ? `On the calendar as of ${format(new Date(onboarding.introCallBookedAt), "MMM d, h:mma")}. Coach handles all follow-ups.`
              : "Get the intro call on the coach's calendar. Coach handles all follow-up scheduling after that."
          }
        >
          {canEdit && (
            <Checkbox
              checked={!!onboarding?.introCallBooked}
              onCheckedChange={c => update.mutate({ dealId, introCallBooked: !!c })}
            />
          )}
        </ChecklistItem>
        {canEdit && (
          <div className="ml-9">
            <Label className="text-xs">Assigned coach (emailed when set)</Label>
            <Select
              value={onboarding?.coachAssignedPayeeId ? String(onboarding.coachAssignedPayeeId) : ""}
              onValueChange={v => update.mutate({
                dealId,
                coachAssignedPayeeId: v ? parseInt(v, 10) : null,
              })}
            >
              <SelectTrigger className="h-8 text-sm max-w-xs">
                <SelectValue placeholder="Pick coach" />
              </SelectTrigger>
              <SelectContent>
                {coachOptions.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {!canEdit && assignedCoach && (
          <p className="ml-9 text-xs text-muted-foreground">Assigned to {assignedCoach.name}</p>
        )}

        {/* 5. Trading log (manual placeholder) */}
        <ChecklistItem
          done={items.tradingLog}
          title="Trading log assigned"
          subtitle="Manual checkbox today — in-app trading log is on the roadmap."
          manual
        >
          {canEdit && (
            <Checkbox
              checked={items.tradingLog}
              onCheckedChange={c => update.mutate({ dealId, tradingLogAssigned: !!c })}
            />
          )}
        </ChecklistItem>

        {/* 6. Weekly check-in (manual placeholder) */}
        <ChecklistItem
          done={items.checkIn}
          title="Weekly check-in form sent"
          subtitle="Manual checkbox today — in-app check-in form is on the roadmap."
          manual
        >
          {canEdit && (
            <Checkbox
              checked={items.checkIn}
              onCheckedChange={c => update.mutate({ dealId, weeklyCheckInSent: !!c })}
            />
          )}
        </ChecklistItem>

        {/* Notes */}
        {canEdit && (
          <div className="pt-3 border-t border-border/40">
            <Label className="text-xs">Notes</Label>
            <Textarea
              defaultValue={onboarding?.notes ?? ""}
              onBlur={e => {
                const next = e.target.value;
                if (next !== (onboarding?.notes ?? "")) update.mutate({ dealId, notes: next });
              }}
              placeholder="Anything anyone touching this client should know."
              rows={2}
              className="text-sm"
            />
          </div>
        )}

        {/* Action button */}
        {canEdit && (
          <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
            {isComplete ? (
              <Button
                variant="outline"
                size="sm"
                disabled={reopen.isPending}
                onClick={() => reopen.mutate({ dealId })}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reopen onboarding
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={!allDone || complete.isPending}
                onClick={() => complete.mutate({ dealId })}
                className="bg-primary hover:bg-primary/90"
                title={allDone ? "" : "Finish all checklist items first."}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {complete.isPending ? "Marking…" : "Mark fully onboarded"}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChecklistItem({
  done, locked, manual, title, subtitle, children,
}: {
  done: boolean;
  locked?: boolean;
  manual?: boolean;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  const Icon = done ? CheckCircle2 : Circle;
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-border/40 bg-secondary/20">
      <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${done ? "text-green-400" : "text-muted-foreground/50"}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold">{title}</p>
          {locked && (
            <Badge variant="outline" className="h-5 text-[10px] uppercase tracking-wider gap-1 border-border/60">
              <Lock className="h-3 w-3" />
              auto
            </Badge>
          )}
          {manual && (
            <Badge variant="outline" className="h-5 text-[10px] uppercase tracking-wider border-border/60">
              manual for now
            </Badge>
          )}
        </div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  );
}

// ─── Extension section (90-day program clock + renewal pipeline) ───────

const PIPELINE_STEPS: Array<{
  status: "window_open" | "outreach_started" | "call_booked" | "extended" | "lapsed";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "amber" | "green" | "red";
}> = [
  { status: "window_open",      label: "Window open",      icon: Bell,         tone: "primary" },
  { status: "outreach_started", label: "Outreach started", icon: MessageSquare, tone: "amber" },
  { status: "call_booked",      label: "Call booked",      icon: Phone,        tone: "amber" },
  { status: "extended",         label: "Extended",         icon: TrendingUp,   tone: "green" },
];

const MILESTONE_LABELS: Record<string, { label: string; tone: string }> = {
  window_open:   { label: "Renewal window opens (T-21)", tone: "text-primary" },
  one_week_left: { label: "One week left (T-7)",         tone: "text-amber-400" },
  program_ends:  { label: "Program ends today (T-0)",    tone: "text-amber-500" },
  lapsed:        { label: "Lapsed (T+7)",                tone: "text-red-400" },
};

function ExtensionSection({
  profile, dealId, canSetStatus,
}: {
  profile: Profile;
  dealId: number;
  canSetStatus: boolean;
}) {
  const { onboarding, timeline, extensionAlerts: alerts } = profile;
  const utils = trpc.useUtils();
  const setStatus = trpc.extensions.setStatus.useMutation({
    onSuccess: () => {
      toast.success("Pipeline status updated.");
      utils.clients.getProfile.invalidate({ dealId });
      utils.extensions.listUpcoming.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  // Pre-onboarding: nothing to show beyond a stub.
  if (!onboarding?.onboardedAt || !timeline) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarClock className="h-5 w-5 text-primary" />
            Extension
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The 90-day program clock starts the moment Ariana marks this client
            fully onboarded. Renewal alerts (T-21, T-7, T-0, T+7) will fire
            automatically once the clock is running.
          </p>
        </CardContent>
      </Card>
    );
  }

  const status = onboarding.extensionStatus;
  const isExtended = status === "extended";
  const isLapsed = status === "lapsed";
  const programEnds = new Date(timeline.programEndsAt);

  // Headline + tone for the countdown card
  const headline = (() => {
    if (isExtended) return { text: "Extended ✓", tone: "text-green-400" };
    if (isLapsed) return { text: "Lapsed", tone: "text-red-400" };
    if (timeline.daysRemaining > 0) {
      return { text: `${timeline.daysRemaining} days remaining`, tone: "text-foreground" };
    }
    if (timeline.daysRemaining === 0) {
      return { text: "Program ends today", tone: "text-amber-400" };
    }
    return { text: `Program ended ${Math.abs(timeline.daysRemaining)}d ago`, tone: "text-amber-400" };
  })();

  const phaseLabel = {
    pre_window:     "Pre-window",
    renewal_window: "Renewal window open",
    final_week:     "Final week",
    ended_grace:    "Grace period",
    lapsed:         "Lapsed",
  }[timeline.phase];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Extension — 90-day program
          </span>
          <Badge variant="outline" className="bg-background">{phaseLabel}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Countdown */}
        <div className="rounded-lg border border-border/50 bg-secondary/20 p-4 flex items-center justify-between gap-4">
          <div>
            <p className={`text-2xl font-bold ${headline.tone}`}>{headline.text}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Onboarded {format(new Date(timeline.onboardedAt), "MMM d, yyyy")} ·
              {" "}program ends {format(programEnds, "MMM d, yyyy")}
            </p>
          </div>
          <ProgressBar90
            elapsed={timeline.daysSinceOnboarded}
            total={90}
            isExtended={isExtended}
            isLapsed={isLapsed}
          />
        </div>

        {/* Pipeline pills */}
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            Renewal pipeline
          </p>
          {isLapsed ? (
            <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-sm flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-400" />
              <span>Lapsed — client did not extend.</span>
              {canSetStatus && (
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto"
                  onClick={() => setStatus.mutate({ dealId, status: "extended" })}
                  disabled={setStatus.isPending}
                >
                  Mark extended (override)
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {PIPELINE_STEPS.map(step => {
                const isCurrent = status === step.status;
                const Icon = step.icon;
                const tone = step.tone === "primary"
                  ? (isCurrent ? "bg-primary/15 text-primary border-primary/40" : "bg-secondary/30 text-muted-foreground border-border/40")
                  : step.tone === "amber"
                  ? (isCurrent ? "bg-amber-500/15 text-amber-400 border-amber-500/40" : "bg-secondary/30 text-muted-foreground border-border/40")
                  : (isCurrent ? "bg-green-500/15 text-green-400 border-green-500/40" : "bg-secondary/30 text-muted-foreground border-border/40");
                return (
                  <button
                    key={step.status}
                    type="button"
                    disabled={!canSetStatus || setStatus.isPending}
                    onClick={() => setStatus.mutate({ dealId, status: step.status })}
                    className={`px-3 py-1.5 rounded-md border text-xs font-medium uppercase tracking-wider flex items-center gap-1.5 transition-colors ${tone} ${canSetStatus ? "hover:border-primary/60 cursor-pointer" : "cursor-default"}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {step.label}
                    {isCurrent && <CheckCircle2 className="h-3 w-3" />}
                  </button>
                );
              })}
              {canSetStatus && status && status !== "extended" && (
                <button
                  type="button"
                  onClick={() => setStatus.mutate({ dealId, status: "lapsed" })}
                  disabled={setStatus.isPending}
                  className="px-3 py-1.5 rounded-md border border-red-500/30 bg-secondary/30 text-xs font-medium uppercase tracking-wider text-red-400/80 hover:border-red-500/60 transition-colors flex items-center gap-1.5"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Mark lapsed
                </button>
              )}
            </div>
          )}
        </div>

        {/* Alert history */}
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            Alert history
          </p>
          {alerts.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              No alerts fired yet. Window opens at day 69 (T-21).
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {(() => {
                // Group by milestone for compact display
                const byMilestone = new Map<string, typeof alerts>();
                for (const a of alerts) {
                  const list = byMilestone.get(a.milestone) ?? [];
                  list.push(a);
                  byMilestone.set(a.milestone, list);
                }
                return Array.from(byMilestone.entries()).map(([m, list]) => {
                  const meta = MILESTONE_LABELS[m] ?? { label: m, tone: "" };
                  const firedAt = list[0]!.firedAt;
                  const recipients = list.map(a => a.recipientName).join(", ");
                  return (
                    <li key={m} className="flex items-center gap-2 text-xs">
                      <Bell className={`h-3.5 w-3.5 ${meta.tone}`} />
                      <span className="font-medium">{meta.label}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">
                        {format(new Date(firedAt), "MMM d, h:mma")}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">→ {recipients}</span>
                    </li>
                  );
                });
              })()}
            </ul>
          )}
        </div>

        {/* Notes */}
        {canSetStatus && (
          <div className="pt-3 border-t border-border/40">
            <Label className="text-xs">Renewal notes</Label>
            <Textarea
              defaultValue={onboarding.extensionNotes ?? ""}
              onBlur={e => {
                const next = e.target.value;
                if (next !== (onboarding.extensionNotes ?? "")) {
                  setStatus.mutate({
                    dealId,
                    status: status ?? "window_open",
                    notes: next,
                  });
                }
              }}
              placeholder="Outreach attempts, what they said, what to pitch on the call, etc."
              rows={2}
              className="text-sm"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProgressBar90({
  elapsed, total, isExtended, isLapsed,
}: {
  elapsed: number;
  total: number;
  isExtended: boolean;
  isLapsed: boolean;
}) {
  const pct = Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
  // Mark T-21 (day 69) and T-0 (day 90) on the bar
  const t21Pct = (69 / 90) * 100;
  const tone = isExtended ? "bg-green-400" : isLapsed ? "bg-red-400" : "bg-primary";
  return (
    <div className="w-44 shrink-0">
      <div className="relative h-2 bg-secondary/40 rounded overflow-hidden">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
        <div
          className="absolute top-0 h-2 w-px bg-amber-500/60"
          style={{ left: `${t21Pct}%` }}
          title="T-21 (renewal window opens)"
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        <span>day {Math.max(0, elapsed)}</span>
        <span>day 90</span>
      </div>
    </div>
  );
}

// ─── Coaching section ───────────────────────────────────────────────────

function CoachingSection({ profile }: { profile: Profile }) {
  const sessions = profile.coachingSessions;
  const totalMinutes = sessions.reduce((s, x) => s + x.minutes, 0);
  const noShowCount = sessions.filter(s => s.isNoShow).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            Coaching
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {sessions.length} sessions · {totalMinutes} min{noShowCount > 0 ? ` · ${noShowCount} no-show` : ""}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No sessions logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b border-border/50">
                <tr>
                  <th className="text-left py-2 font-medium">Date</th>
                  <th className="text-left py-2 font-medium">Coach</th>
                  <th className="text-right py-2 font-medium">Minutes</th>
                  <th className="text-left py-2 font-medium">Trading log</th>
                  <th className="text-left py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id} className="border-b border-border/30">
                    <td className="py-2">{s.sessionDate}</td>
                    <td className="py-2">#{s.coachPayeeId}</td>
                    <td className="py-2 text-right">
                      {s.isNoShow ? (
                        <Badge className="bg-amber-500/15 text-amber-400 border-0 h-5">no-show</Badge>
                      ) : (
                        <span>{s.minutes}</span>
                      )}
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">{s.tradingLog}</td>
                    <td className="py-2 text-xs text-muted-foreground max-w-xs truncate">{s.notes || "—"}</td>
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

// ─── Payments section ───────────────────────────────────────────────────

function PaymentsSection({ profile }: { profile: Profile }) {
  const { deal, paymentPlanProgress } = profile;
  if (deal.paymentType !== "in_house_payment_plan" || !paymentPlanProgress) {
    // Full-pay or BNPL — show the cash collected and we're done
    const totalCash =
      parseFloat(deal.newCashCollected || "0") + parseFloat(deal.existingCashCollected || "0");
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="h-5 w-5 text-primary" />
            Payments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            <span className="text-muted-foreground">Cash collected: </span>
            <span className="font-semibold">${totalCash.toLocaleString()}</span>
            {parseFloat(deal.totalDealAmount || "0") > totalCash && (
              <span className="text-muted-foreground">
                {" of "}${parseFloat(deal.totalDealAmount || "0").toLocaleString()}
              </span>
            )}
          </p>
        </CardContent>
      </Card>
    );
  }

  const pct = paymentPlanProgress.totalMonths === 0
    ? 0
    : Math.round((paymentPlanProgress.paymentsCompleted / paymentPlanProgress.totalMonths) * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <CreditCard className="h-5 w-5 text-primary" />
          Payments — In-house plan
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {paymentPlanProgress.paymentsCompleted} of {paymentPlanProgress.totalMonths} payments collected
          </span>
          <span className="font-semibold">{pct}%</span>
        </div>
        <div className="h-2 bg-secondary/40 rounded overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm pt-2">
          <Field
            label="Collected"
            value={`$${paymentPlanProgress.totalCollected.toLocaleString()}`}
          />
          <Field
            label="Remaining"
            value={`$${paymentPlanProgress.totalRemaining.toLocaleString()}`}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Activity timeline ──────────────────────────────────────────────────

function ActivitySection({ profile }: { profile: Profile }) {
  const { deal, onboarding, coachingSessions, extensionAlerts: alerts } = profile;
  type Event = { ts: Date; label: string; icon: React.ReactNode };
  const events: Event[] = [];

  // Extension milestone alerts → activity entries (collapsed by milestone so
  // we don't spam one row per recipient).
  const seenMilestones = new Set<string>();
  for (const a of alerts) {
    if (seenMilestones.has(a.milestone)) continue;
    seenMilestones.add(a.milestone);
    const meta = MILESTONE_LABELS[a.milestone] ?? { label: a.milestone, tone: "" };
    const recipientCount = alerts.filter(x => x.milestone === a.milestone).length;
    events.push({
      ts: new Date(a.firedAt),
      label: `${meta.label} — alert sent to ${recipientCount} ${recipientCount === 1 ? "person" : "people"}`,
      icon: <Bell className="h-3.5 w-3.5 text-primary" />,
    });
  }
  if (onboarding?.extensionStatus && onboarding.extensionStatusAt) {
    const statusLabels: Record<string, string> = {
      window_open:      "Renewal window opened",
      outreach_started: "Outreach started",
      call_booked:      "Renewal call booked",
      extended:         "Client extended ✓",
      lapsed:           "Marked lapsed",
    };
    events.push({
      ts: new Date(onboarding.extensionStatusAt),
      label: statusLabels[onboarding.extensionStatus] ?? `Status → ${onboarding.extensionStatus}`,
      icon: <CalendarClock className="h-3.5 w-3.5 text-primary" />,
    });
  }

  events.push({
    ts: new Date(deal.createdAt),
    label: "Deal created",
    icon: <Sparkles className="h-3.5 w-3.5 text-primary" />,
  });

  if (deal.docusignSigned) {
    // We don't store a docusignSignedAt — best signal is deal.updatedAt
    // for now. Future: add a timestamp column.
    events.push({
      ts: new Date(deal.updatedAt),
      label: "DocuSign signed",
      icon: <FileSignature className="h-3.5 w-3.5 text-green-400" />,
    });
  }

  if (onboarding?.skoolAccessAt) {
    events.push({
      ts: new Date(onboarding.skoolAccessAt),
      label: "Skool access granted",
      icon: <BookOpen className="h-3.5 w-3.5 text-primary" />,
    });
  }
  if (onboarding?.paymentVerifiedAt) {
    events.push({
      ts: new Date(onboarding.paymentVerifiedAt),
      label: "Payment verified",
      icon: <CreditCard className="h-3.5 w-3.5 text-primary" />,
    });
  }
  if (onboarding?.onboardedAt) {
    events.push({
      ts: new Date(onboarding.onboardedAt),
      label: "Marked fully onboarded — 90-day clock started",
      icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />,
    });
  }

  for (const s of coachingSessions) {
    events.push({
      ts: new Date(s.sessionDate),
      label: s.isNoShow
        ? `Coaching session no-show (coach #${s.coachPayeeId})`
        : `Coaching session — ${s.minutes} min (coach #${s.coachPayeeId})`,
      icon: <GraduationCap className="h-3.5 w-3.5 text-primary" />,
    });
  }

  events.sort((a, b) => b.ts.getTime() - a.ts.getTime());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5 text-primary" />
          Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nothing logged yet.</p>
        ) : (
          <ol className="relative border-l border-border/40 ml-2 space-y-3">
            {events.map((e, i) => (
              <li key={i} className="ml-4">
                <span className="absolute -left-[7px] mt-1 h-3 w-3 rounded-full bg-card border border-border/60 flex items-center justify-center">
                  {e.icon}
                </span>
                <p className="text-sm">{e.label}</p>
                <p className="text-xs text-muted-foreground">
                  {format(e.ts, "MMM d, yyyy h:mma")}
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Bits ───────────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="font-semibold mt-0.5">{value}</dd>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/onboarding">
      <a className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back
      </a>
    </Link>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 max-w-6xl">
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-96 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
