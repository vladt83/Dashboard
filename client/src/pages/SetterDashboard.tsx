import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  CalendarPlus,
  ListChecks,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Phone,
  User as UserIcon,
  ClipboardList,
  Eye,
  AlertTriangle,
  Lock,
} from "lucide-react";

type SetterTab = "book" | "bookings" | "vsl" | "preps" | "payouts";

// Tabs each motion sees:
//   - vsl  setter (Jake / Pre Call lane):    Pre Call, My Preps, My Payouts
//   - text setter (Kresha / Call Setting):   Call Setting, My Bookings, My Payouts
//   - admin/payroll/no-motion (fallback):    everything (for testing / oversight)
const VSL_TABS: SetterTab[]  = ["vsl", "preps", "payouts"];
const TEXT_TABS: SetterTab[] = ["book", "bookings", "payouts"];
const ALL_TABS: SetterTab[]  = ["book", "vsl", "bookings", "preps", "payouts"];

export default function SetterDashboard() {
  // Resolve which sales lane this user works in, so we can hide the irrelevant
  // tabs (Jake doesn't need Call Setting; Kresha doesn't need Pre Call).
  const myTeamQuery = trpc.userTeam.getMyTeamMember.useQuery();
  const motion = myTeamQuery.data?.teamMember?.setterMotion ?? null;
  const visibleTabs: SetterTab[] =
    motion === "vsl" ? VSL_TABS :
    motion === "text" ? TEXT_TABS :
    ALL_TABS;
  const defaultTab: SetterTab = visibleTabs[0]!;
  const [tab, setTab] = useState<SetterTab>(defaultTab);

  // If the motion loads after first render and the current tab isn't visible
  // for this user, snap to the lane's default.
  useEffect(() => {
    if (!visibleTabs.includes(tab)) setTab(defaultTab);
  }, [motion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Month selector state for the Payouts tab.
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  // ─── Call Setting form state (text-setter — Kresha) ────────────────────
  const [bookForm, setBookForm] = useState({
    clientFirstName: "",
    clientLastName: "",
    phoneNumber: "",
    closerId: "",
    notes: "",
    callSource: "" as "" | "meta" | "existing_client",
  });

  // ─── VSL Prep form state (VSL setter — Jake) ───────────────────────────
  const [vslForm, setVslForm] = useState({
    clientFirstName: "",
    clientLastName: "",
    phoneNumber: "",
    email: "",
    closerId: "",
    vslBookedAt: "",
    vslWatched: false,
    q1Motivation: "",
    q2TradingExperience: "",
    q3DayToDay: "",
    q4Coachability: "",
    q5SpecificQuestions: "",
    stockPredatorDelivered: false,
    redFlags: "",
    notes: "",
  });

  const closersQuery = trpc.team.getByRole.useQuery({ role: "closer" });
  const myBookingsQuery = trpc.bookedCalls.listMine.useQuery();
  const myPrepsQuery = trpc.vslPreps.listMine.useQuery();
  const payoutsQuery = trpc.setter.payouts.useQuery({ year, month });

  const bookCall = trpc.bookedCalls.create.useMutation({
    onSuccess: () => {
      toast.success("Call booked.");
      setBookForm({ clientFirstName: "", clientLastName: "", phoneNumber: "", closerId: "", notes: "", callSource: "" });
      myBookingsQuery.refetch();
      setTab("bookings");
    },
    onError: err => toast.error(err.message),
  });

  const createVslPrep = trpc.vslPreps.create.useMutation({
    onSuccess: () => {
      toast.success("Pre call saved. Closer will see your notes before the call.");
      setVslForm({
        clientFirstName: "",
        clientLastName: "",
        phoneNumber: "",
        email: "",
        closerId: "",
        vslBookedAt: "",
        vslWatched: false,
        q1Motivation: "",
        q2TradingExperience: "",
        q3DayToDay: "",
        q4Coachability: "",
        q5SpecificQuestions: "",
        stockPredatorDelivered: false,
        redFlags: "",
        notes: "",
      });
      myPrepsQuery.refetch();
      setTab("preps");
    },
    onError: err => toast.error(err.message),
  });

  const closersById = useMemo(() => {
    const map = new Map<number, string>();
    (closersQuery.data ?? []).forEach(c => map.set(c.id, c.name));
    return map;
  }, [closersQuery.data]);

  const handleBook = () => {
    if (!bookForm.clientFirstName.trim() || !bookForm.clientLastName.trim()) return toast.error("First and last name are required.");
    if (!bookForm.phoneNumber.trim() || bookForm.phoneNumber.replace(/\D/g, "").length < 7) return toast.error("Phone number is required.");
    if (!bookForm.closerId) return toast.error("Pick the closer this call is assigned to.");
    if (!bookForm.callSource) return toast.error("Pick the source — Meta or existing client. Marketing ROI depends on this split.");
    bookCall.mutate({
      clientFirstName: bookForm.clientFirstName.trim(),
      clientLastName: bookForm.clientLastName.trim(),
      phoneNumber: bookForm.phoneNumber.trim(),
      closerId: parseInt(bookForm.closerId),
      notes: bookForm.notes.trim() || undefined,
      callSource: bookForm.callSource,
    });
  };

  const handleVslSubmit = () => {
    if (!vslForm.clientFirstName.trim() || !vslForm.clientLastName.trim()) return toast.error("First and last name are required.");
    if (!vslForm.phoneNumber.trim() || vslForm.phoneNumber.replace(/\D/g, "").length < 7) return toast.error("Phone number is required.");
    if (!vslForm.closerId) return toast.error("Pick the closer this prospect is assigned to.");
    if (!vslForm.q4Coachability.trim()) {
      return toast.error("Coachability answer is required — it's the most important pre-frame for the closer.");
    }
    createVslPrep.mutate({
      clientFirstName: vslForm.clientFirstName.trim(),
      clientLastName: vslForm.clientLastName.trim(),
      phoneNumber: vslForm.phoneNumber.trim(),
      email: vslForm.email.trim() || undefined,
      closerId: parseInt(vslForm.closerId),
      vslBookedAt: vslForm.vslBookedAt || undefined,
      vslWatched: vslForm.vslWatched,
      q1Motivation: vslForm.q1Motivation.trim() || undefined,
      q2TradingExperience: vslForm.q2TradingExperience.trim() || undefined,
      q3DayToDay: vslForm.q3DayToDay.trim() || undefined,
      q4Coachability: vslForm.q4Coachability.trim(),
      q5SpecificQuestions: vslForm.q5SpecificQuestions.trim() || undefined,
      stockPredatorDelivered: vslForm.stockPredatorDelivered,
      redFlags: vslForm.redFlags.trim() || undefined,
      notes: vslForm.notes.trim() || undefined,
    });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Setter Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          {motion === "vsl"
            ? "Run pre-calls, capture discovery, and track your payouts."
            : motion === "text"
            ? "Set calls from text outreach and track your payouts."
            : "Set calls, log pre-calls, and track your payouts."}
        </p>
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as SetterTab)} className="space-y-4">
        <TabsList
          className="grid max-w-3xl"
          style={{ gridTemplateColumns: `repeat(${visibleTabs.length}, minmax(0, 1fr))` }}
        >
          {visibleTabs.includes("book") && (
            <TabsTrigger value="book" className="gap-2 text-xs md:text-sm">
              <CalendarPlus className="h-4 w-4" />
              Call Setting
            </TabsTrigger>
          )}
          {visibleTabs.includes("vsl") && (
            <TabsTrigger value="vsl" className="gap-2 text-xs md:text-sm">
              <ClipboardList className="h-4 w-4" />
              Pre Call
            </TabsTrigger>
          )}
          {visibleTabs.includes("bookings") && (
            <TabsTrigger value="bookings" className="gap-2 text-xs md:text-sm">
              <ListChecks className="h-4 w-4" />
              My Bookings
            </TabsTrigger>
          )}
          {visibleTabs.includes("preps") && (
            <TabsTrigger value="preps" className="gap-2 text-xs md:text-sm">
              <Eye className="h-4 w-4" />
              My Preps
            </TabsTrigger>
          )}
          {visibleTabs.includes("payouts") && (
            <TabsTrigger value="payouts" className="gap-2 text-xs md:text-sm">
              <DollarSign className="h-4 w-4" />
              My Payouts
            </TabsTrigger>
          )}
        </TabsList>

        {/* ─────────── Call Setting (text-style — Kresha) ─────────── */}
        <TabsContent value="book">
          <Card>
            <CardHeader>
              <CardTitle>Set a New Call</CardTitle>
              <p className="text-xs text-muted-foreground">
                Log a confirmed call from your text outreach — no discovery interview needed at this stage.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Client First Name</Label>
                  <Input id="firstName" value={bookForm.clientFirstName}
                    onChange={e => setBookForm(f => ({ ...f, clientFirstName: e.target.value }))} placeholder="Jane" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Client Last Name</Label>
                  <Input id="lastName" value={bookForm.clientLastName}
                    onChange={e => setBookForm(f => ({ ...f, clientLastName: e.target.value }))} placeholder="Doe" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" value={bookForm.phoneNumber}
                    onChange={e => setBookForm(f => ({ ...f, phoneNumber: e.target.value }))} placeholder="(555) 123-4567" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="closer">Assigned Closer</Label>
                  <Select value={bookForm.closerId} onValueChange={v => setBookForm(f => ({ ...f, closerId: v }))}>
                    <SelectTrigger id="closer"><SelectValue placeholder="Select closer" /></SelectTrigger>
                    <SelectContent>
                      {(closersQuery.data ?? []).map(c => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="callSource">Source</Label>
                <Select value={bookForm.callSource} onValueChange={v => setBookForm(f => ({ ...f, callSource: v as "meta" | "existing_client" }))}>
                  <SelectTrigger id="callSource"><SelectValue placeholder="Pick source" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meta">Meta (paid ad / new prospect)</SelectItem>
                    <SelectItem value="existing_client">Existing client (upsell / referral)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Splits the Marketing Report so ad spend ROI doesn't get mixed with existing-book revenue. Pick accurately every time.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea id="notes" value={bookForm.notes}
                  onChange={e => setBookForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Anything the closer should know — context from the text thread, urgency, etc." rows={3} />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleBook} disabled={bookCall.isPending} className="bg-primary hover:bg-primary/90">
                  {bookCall.isPending ? "Setting…" : "Set Call"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─────────── Pre Call (VSL setter — Jake) ─────────── */}
        <TabsContent value="vsl" className="space-y-4">
          {/* Rules + reminder card pulled directly from the OCE Setter Script V1 */}
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="p-4 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-500 flex items-center gap-2">
                <Lock className="h-3.5 w-3.5" />
                Rules — read before every call
              </p>
              <ul className="text-sm space-y-1 text-foreground/90">
                <li>• <span className="font-semibold">Never explain the program.</span> "Steve will walk you through that."</li>
                <li>• <span className="font-semibold">Never discuss price.</span> "It depends on which program fits your situation. Steve will walk you through the options on the call."</li>
                <li>• <span className="font-semibold">Never go longer than 8 minutes.</span> If they keep talking: "I love that you're this interested. Steve is going to have a field day with you. Save all of that for the call."</li>
                <li>• <span className="font-semibold">Never skip the coachability question (Q4).</span> Single most important pre-frame for the closer.</li>
                <li>• <span className="font-semibold">Never promise results, returns, or income numbers.</span></li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Log Pre Call</CardTitle>
              <p className="text-xs text-muted-foreground">
                Fill this out right after every 5–8 minute discovery call. The closer reads this before opening the prospect's call.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Identity */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Client First Name</Label>
                  <Input value={vslForm.clientFirstName}
                    onChange={e => setVslForm(f => ({ ...f, clientFirstName: e.target.value }))} placeholder="Jane" />
                </div>
                <div className="space-y-2">
                  <Label>Client Last Name</Label>
                  <Input value={vslForm.clientLastName}
                    onChange={e => setVslForm(f => ({ ...f, clientLastName: e.target.value }))} placeholder="Doe" />
                </div>
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input value={vslForm.phoneNumber}
                    onChange={e => setVslForm(f => ({ ...f, phoneNumber: e.target.value }))} placeholder="(555) 123-4567" />
                </div>
                <div className="space-y-2">
                  <Label>Email (optional)</Label>
                  <Input type="email" value={vslForm.email}
                    onChange={e => setVslForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@example.com" />
                </div>
                <div className="space-y-2">
                  <Label>Assigned Closer</Label>
                  <Select value={vslForm.closerId} onValueChange={v => setVslForm(f => ({ ...f, closerId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select closer" /></SelectTrigger>
                    <SelectContent>
                      {(closersQuery.data ?? []).map(c => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Closer's Call Booked At (optional)</Label>
                  <Input type="datetime-local" value={vslForm.vslBookedAt}
                    onChange={e => setVslForm(f => ({ ...f, vslBookedAt: e.target.value }))} />
                </div>
              </div>

              {/* The 5 questions, exactly as they appear in OCE Setter Script V1 */}
              <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">
                  The 5 questions — capture in their own words
                </p>

                <VslQuestion
                  num={1}
                  prompt="What made you interested in learning how to trade? Like, what got you to actually fill out the application today?"
                  hint="Listen for: second income, financial independence, stop trading time for money, learn a new skill."
                  value={vslForm.q1Motivation}
                  onChange={v => setVslForm(f => ({ ...f, q1Motivation: v }))}
                />

                <VslQuestion
                  num={2}
                  prompt="Have you tried trading before, or is this brand new for you?"
                  hint="Both answers are fine. Tried before = more serious. Brand new = more coachable. Neither disqualifies."
                  value={vslForm.q2TradingExperience}
                  onChange={v => setVslForm(f => ({ ...f, q2TradingExperience: v }))}
                />

                <VslQuestion
                  num={3}
                  prompt="What does your day-to-day look like right now? Are you working full time, running a business, something else?"
                  hint="Soft flag if 'between jobs' or 'figuring things out'. Note for the closer."
                  value={vslForm.q3DayToDay}
                  onChange={v => setVslForm(f => ({ ...f, q3DayToDay: v }))}
                />

                <VslQuestion
                  num={4}
                  prompt="If this ends up being a good fit, are you the type of person who's ready to commit and actually do the work? Our best students are the ones who are coachable and actually show up."
                  hint="REQUIRED. Pre-frames coachability. Their answer commits them to showing up before the closer call."
                  value={vslForm.q4Coachability}
                  onChange={v => setVslForm(f => ({ ...f, q4Coachability: v }))}
                  required
                />

                <VslQuestion
                  num={5}
                  prompt="Is there anything specific you're hoping the closer covers on the call? Any questions you want answered?"
                  hint="Whatever they say, capture verbatim. The closer opens with 'Jake mentioned you had a question about X.'"
                  value={vslForm.q5SpecificQuestions}
                  onChange={v => setVslForm(f => ({ ...f, q5SpecificQuestions: v }))}
                />
              </div>

              {/* Show-up incentive + flags */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-border/50 bg-secondary/30 p-3 space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Checkbox
                      checked={vslForm.stockPredatorDelivered}
                      onCheckedChange={c => setVslForm(f => ({ ...f, stockPredatorDelivered: !!c }))}
                    />
                    Mentioned Stock Predator to prospect?
                  </Label>
                  <p className="text-xs text-muted-foreground pl-6">
                    Just talk about it as a show-up incentive — the <strong>closer</strong> presents the course access on the next call. You don't deliver it.
                  </p>
                </div>
                <div className="rounded-lg border border-border/50 bg-secondary/30 p-3 space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Checkbox
                      checked={vslForm.vslWatched}
                      onCheckedChange={c => setVslForm(f => ({ ...f, vslWatched: !!c }))}
                    />
                    Did they watch the VSL?
                  </Label>
                  <p className="text-xs text-muted-foreground pl-6">
                    Optional context for the closer.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Red Flags / Soft Flags (optional)
                </Label>
                <Textarea
                  value={vslForm.redFlags}
                  onChange={e => setVslForm(f => ({ ...f, redFlags: e.target.value }))}
                  placeholder="Seemed hesitant · spouse needs to be involved · 'just looking' · etc."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>General Notes (optional)</Label>
                <Textarea
                  value={vslForm.notes}
                  onChange={e => setVslForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Any other context for the closer."
                  rows={3}
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleVslSubmit} disabled={createVslPrep.isPending} className="bg-primary hover:bg-primary/90">
                  {createVslPrep.isPending ? "Saving…" : "Save Pre Call"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─────────── My Bookings ─────────── */}
        <TabsContent value="bookings">
          <Card>
            <CardHeader><CardTitle>My Bookings</CardTitle></CardHeader>
            <CardContent>
              {myBookingsQuery.isLoading ? (
                <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : (myBookingsQuery.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No bookings yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-muted-foreground border-b border-border/50">
                      <tr>
                        <th className="text-left py-2 font-medium">Date</th>
                        <th className="text-left py-2 font-medium">Client</th>
                        <th className="text-left py-2 font-medium">Phone</th>
                        <th className="text-left py-2 font-medium">Closer</th>
                        <th className="text-left py-2 font-medium">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(myBookingsQuery.data ?? []).map(b => (
                        <tr key={b.id} className="border-b border-border/30">
                          <td className="py-3">{b.bookedDate}</td>
                          <td className="py-3 flex items-center gap-2">
                            <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            {b.clientFirstName} {b.clientLastName}
                          </td>
                          <td className="py-3"><span className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3.5 w-3.5" />{b.phoneNumber}</span></td>
                          <td className="py-3">{closersById.get(b.closerId) ?? `Closer #${b.closerId}`}</td>
                          <td className="py-3 text-muted-foreground max-w-xs truncate">{b.notes || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─────────── My Preps ─────────── */}
        <TabsContent value="preps">
          <Card>
            <CardHeader><CardTitle>My Pre Calls</CardTitle></CardHeader>
            <CardContent>
              {myPrepsQuery.isLoading ? (
                <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
              ) : (myPrepsQuery.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No pre calls yet. Log your first one from the "Pre Call" tab.
                </p>
              ) : (
                <div className="space-y-3">
                  {(myPrepsQuery.data ?? []).map(p => (
                    <div key={p.id} className="rounded-lg border border-border/50 p-4 hover:border-primary/40 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <UserIcon className="h-4 w-4 text-primary" />
                          <span className="font-semibold">{p.clientFirstName} {p.clientLastName}</span>
                          <span className="text-xs text-muted-foreground">→ {closersById.get(p.closerId) ?? `Closer #${p.closerId}`}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {p.reviewedByCloser && (
                            <span className="text-xs px-2 py-0.5 rounded bg-green-500/15 text-green-400 font-medium">
                              ✓ closer reviewed
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">{format(new Date(p.createdAt), "MMM d, h:mma")}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        {p.q1Motivation && <CompactQ label="Why" v={p.q1Motivation} />}
                        {p.q2TradingExperience && <CompactQ label="Experience" v={p.q2TradingExperience} />}
                        {p.q3DayToDay && <CompactQ label="Day-to-day" v={p.q3DayToDay} />}
                        {p.q4Coachability && <CompactQ label="Coachable" v={p.q4Coachability} />}
                        {p.q5SpecificQuestions && <CompactQ label="Wants covered" v={p.q5SpecificQuestions} />}
                        {p.redFlags && <CompactQ label="Flags" v={p.redFlags} tone="warning" />}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─────────── My Payouts ─────────── */}
        <TabsContent value="payouts" className="space-y-4">
          <Card>
            <CardContent className="flex items-center justify-between py-4">
              <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date(year, month - 2, 1))}>
                <ChevronLeft className="h-4 w-4 mr-1" />Prev
              </Button>
              <span className="font-semibold">{format(currentDate, "MMMM yyyy")}</span>
              <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date(year, month, 1))}>
                Next<ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Commission Summary</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs uppercase text-muted-foreground tracking-wider">Closed Deals This Month</p>
                  <p className="text-2xl font-bold mt-1">{payoutsQuery.data?.lines.length ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground tracking-wider">Commission Rate</p>
                  <p className="text-2xl font-bold mt-1">{((payoutsQuery.data?.rate ?? 0.03) * 100).toFixed(0)}%</p>
                  <p className="text-xs text-muted-foreground">of cash collected per closed deal</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground tracking-wider">Total Commission</p>
                  <p className="text-2xl font-bold mt-1 text-primary">
                    ${(payoutsQuery.data?.totalCommission ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Deal Breakdown</CardTitle></CardHeader>
            <CardContent>
              {payoutsQuery.isLoading ? (
                <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : (payoutsQuery.data?.lines.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No closed deals attributed to you in {format(currentDate, "MMMM yyyy")}.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-muted-foreground border-b border-border/50">
                      <tr>
                        <th className="text-left py-2 font-medium">Deal Date</th>
                        <th className="text-right py-2 font-medium">Cash Collected</th>
                        <th className="text-right py-2 font-medium">
                          Your Commission ({((payoutsQuery.data?.rate ?? 0.03) * 100).toFixed(0)}%)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(payoutsQuery.data?.lines ?? []).map(line => (
                        <tr key={line.dealId} className="border-b border-border/30">
                          <td className="py-3">{line.dealDate}</td>
                          <td className="py-3 text-right">${line.cappedCashCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="py-3 text-right text-primary font-semibold">${line.commission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-4">
                Setter commission applies to closed deals you're attributed to.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Mini components ────────────────────────────────────────────────────

function VslQuestion({
  num, prompt, hint, value, onChange, required,
}: {
  num: number;
  prompt: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">
        <span className="inline-block h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs font-bold text-center leading-5 mr-2">
          {num}
        </span>
        {prompt}
        {required && <span className="text-amber-500 ml-1">*</span>}
      </Label>
      <Textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={2}
        placeholder="Their answer in their own words…"
      />
      <p className="text-xs text-muted-foreground italic">{hint}</p>
    </div>
  );
}

function CompactQ({ label, v, tone }: { label: string; v: string; tone?: "warning" }) {
  return (
    <div className="flex gap-2">
      <span className={`text-xs uppercase tracking-wider font-semibold w-24 shrink-0 ${tone === "warning" ? "text-amber-400" : "text-muted-foreground"}`}>
        {label}
      </span>
      <span className="text-foreground/90">{v}</span>
    </div>
  );
}
