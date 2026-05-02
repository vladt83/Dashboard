import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Loader2, UserCheck, DollarSign, Calendar, CheckCircle, Users, HelpCircle, CreditCard, ChevronDown, ClipboardList, Phone, Sparkles, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format } from "date-fns";

// Single entry type: sales. Subscriptions were removed entirely.

export default function NewDeal() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // Fetch team members (only needed for admin to pick a closer)
  const { data: closers } = trpc.team.getByRole.useQuery({ role: "closer" });
  // Setters list — anyone can attribute a setter to a deal
  const { data: setters } = trpc.team.getByRole.useQuery({ role: "setter" });
  // Get the logged-in user's linked team member (for closers)
  const { data: myTeamLink } = trpc.userTeam.getMyTeamMember.useQuery(undefined, {
    enabled: !isAdmin,
  });

  // Pending bookings + pre-call preps assigned to ME (the closer). After
  // picking a setter above, we filter these to that setter and let the
  // closer click a row to auto-fill the client info — no double-typing
  // names that the setter already captured.
  const myBookings = trpc.bookedCalls.listAssignedToMe.useQuery();
  const myPreps = trpc.vslPreps.listAssignedToMe.useQuery();
  const updateBooking = trpc.bookedCalls.update.useMutation();
  const updatePrep = trpc.vslPreps.update.useMutation();

  const today = format(new Date(), "yyyy-MM-dd");
  const now = new Date();

  // Sale form state
  const [saleForm, setSaleForm] = useState({
    clientName: "",
    dealDate: today,
    closerId: "",
    setterId: "",        // "" = self-generated lead (no setter)
    showed: false,
    prepared: false,
    offered: false,
    canceled: false,
    closed: false,
    isNewClient: true,
    totalDealAmount: "",
    newCashCollected: "",
    notes: "",
    paymentType: "" as "" | "full_pay" | "in_house_payment_plan" | "bnpl",
    paymentProcessor: "",
    paymentProcessorOther: "",
    downPayment: "",
    paymentPlanMonths: "",
    monthlyPaymentAmount: "",
    bnplFee: "",
  });

  const [submitted, setSubmitted] = useState(false);
  const [submittedName, setSubmittedName] = useState("");

  // Track which booking/prep was clicked-to-fill (so we can link it to the
  // deal after creation, marking it "consumed" so it drops off the picker).
  const [linkedSource, setLinkedSource] = useState<{
    type: "booking" | "prep";
    id: number;
  } | null>(null);
  // Once the closer starts editing the auto-filled name, show all pending
  // sources again (they may have picked the wrong one).
  const [manualEntry, setManualEntry] = useState(false);

  // Auto-assign closerId for non-admin users
  useEffect(() => {
    if (!isAdmin && myTeamLink?.teamMember?.id) {
      const id = myTeamLink.teamMember!.id.toString();
      if (!saleForm.closerId) {
        setSaleForm(prev => ({ ...prev, closerId: id }));
      }
    }
  }, [isAdmin, myTeamLink, saleForm.closerId]);

  // Create deal mutation
  const createDeal = trpc.deals.create.useMutation({
    onSuccess: async (deal) => {
      // Link the source booking/prep to this deal so it drops off the
      // pending picker. Best-effort — failure here doesn't break the deal.
      if (linkedSource && deal?.id) {
        try {
          if (linkedSource.type === "booking") {
            await updateBooking.mutateAsync({ id: linkedSource.id, dealId: deal.id });
          } else {
            await updatePrep.mutateAsync({ id: linkedSource.id, dealId: deal.id });
          }
        } catch (err) {
          // Don't block the success flow on the link step
          console.warn("[NewDeal] failed to link source to deal", err);
        }
      }
      setSubmittedName(saleForm.clientName);
      setSubmitted(true);
      utils.deals.getByMonth.invalidate();
      utils.stats.getMonthly.invalidate();
      utils.stats.getCloserLeaderboard.invalidate();
      utils.bookedCalls.listAssignedToMe.invalidate();
      utils.vslPreps.listAssignedToMe.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to record sale");
    },
  });

  // Get provider options based on payment type
  const getProviderOptions = () => {
    switch (saleForm.paymentType) {
      case "full_pay":
        return [
          { value: "fanbasis", label: "Fanbasis" },
          { value: "other", label: "Other" },
        ];
      case "in_house_payment_plan":
        return [
          { value: "fanbasis", label: "Fanbasis" },
          { value: "denefits", label: "Denefits" },
          { value: "client_financing", label: "Client Financing" },
          { value: "other", label: "Other" },
        ];
      case "bnpl":
        return [
          { value: "climb", label: "Climb" },
          { value: "claritypay", label: "ClarityPay" },
          { value: "hfd", label: "HFD" },
          { value: "elective", label: "Elective" },
          { value: "split_it", label: "Split-It" },
          { value: "other", label: "Other" },
        ];
      default:
        return [];
    }
  };

  const handleSaleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!saleForm.clientName.trim()) {
      toast.error("Please enter a client name");
      return;
    }

    if (!saleForm.closerId) {
      toast.error(isAdmin ? "Please select a closer" : "Your account is not linked to a team member. Contact admin.");
      return;
    }

    if (saleForm.closed && !saleForm.paymentType) {
      toast.error("Please select a payment type");
      return;
    }

    if (saleForm.closed && saleForm.paymentType && !saleForm.paymentProcessor) {
      toast.error("Please select a payment processor");
      return;
    }

    let processor = saleForm.paymentProcessor;
    if (saleForm.paymentProcessor === "other" && saleForm.paymentProcessorOther) {
      processor = saleForm.paymentProcessorOther;
    }

    let cashCollected = parseFloat(saleForm.newCashCollected) || 0;
    if (saleForm.paymentType === "in_house_payment_plan") {
      cashCollected = parseFloat(saleForm.downPayment) || 0;
    } else if (saleForm.paymentType === "bnpl") {
      const fee = parseFloat(saleForm.bnplFee) || 0;
      cashCollected = (parseFloat(saleForm.newCashCollected) || 0) - fee;
    }

    createDeal.mutate({
      clientName: saleForm.clientName.trim(),
      dealDate: saleForm.dealDate,
      closerId: parseInt(saleForm.closerId),
      setterId: saleForm.setterId ? parseInt(saleForm.setterId) : null,
      showed: saleForm.showed,
      prepared: saleForm.prepared,
      offered: saleForm.offered,
      canceled: saleForm.canceled,
      closed: saleForm.closed,
      isNewClient: saleForm.isNewClient,
      totalDealAmount: parseFloat(saleForm.totalDealAmount) || 0,
      newCashCollected: cashCollected,
      existingCashCollected: 0,
      notes: saleForm.notes,
      paymentType: saleForm.paymentType || null,
      paymentProcessor: processor || null,
      downPayment: parseFloat(saleForm.downPayment) || null,
      paymentPlanMonths: parseInt(saleForm.paymentPlanMonths) || null,
      monthlyPaymentAmount: parseFloat(saleForm.monthlyPaymentAmount) || null,
      bnplFee: parseFloat(saleForm.bnplFee) || null,
    });
  };


  const resetForm = () => {
    setSaleForm({
      clientName: "",
      dealDate: today,
      closerId: "",
      setterId: "",
      showed: false,
      prepared: false,
      offered: false,
      canceled: false,
      closed: false,
      isNewClient: true,
      totalDealAmount: "",
      newCashCollected: "",
      notes: "",
      paymentType: "",
      paymentProcessor: "",
      paymentProcessorOther: "",
      downPayment: "",
      paymentPlanMonths: "",
      monthlyPaymentAmount: "",
      bnplFee: "",
    });
    setSubmitted(false);
    setSubmittedName("");
    setLinkedSource(null);
    setManualEntry(false);
    // Re-assign closerId for non-admin
    if (!isAdmin && myTeamLink?.teamMember?.id) {
      const id = myTeamLink.teamMember!.id.toString();
      setSaleForm(prev => ({ ...prev, closerId: id }));
    }
  };

  // Pending sources filtered to the currently-picked setter, where dealId
  // hasn't been set yet (i.e. "open" — not already converted).
  const pendingSources = useMemo(() => {
    const setterIdNum = saleForm.setterId ? parseInt(saleForm.setterId, 10) : null;
    if (!setterIdNum) return [];
    type Row = {
      kind: "booking" | "prep";
      id: number;
      clientFirstName: string;
      clientLastName: string;
      phoneNumber: string;
      email?: string | null;
      bookedDate?: string;
      vslBookedAt?: Date | string | null;
      coachability?: string | null;
    };
    const out: Row[] = [];
    for (const b of myBookings.data ?? []) {
      if (b.dealId) continue;
      if (b.setterId !== setterIdNum) continue;
      out.push({
        kind: "booking",
        id: b.id,
        clientFirstName: b.clientFirstName,
        clientLastName: b.clientLastName,
        phoneNumber: b.phoneNumber,
        bookedDate: b.bookedDate,
      });
    }
    for (const p of myPreps.data ?? []) {
      if (p.dealId) continue;
      if (p.setterId !== setterIdNum) continue;
      out.push({
        kind: "prep",
        id: p.id,
        clientFirstName: p.clientFirstName,
        clientLastName: p.clientLastName,
        phoneNumber: p.phoneNumber,
        email: p.email,
        vslBookedAt: p.vslBookedAt,
        coachability: p.q4Coachability,
      });
    }
    return out;
  }, [saleForm.setterId, myBookings.data, myPreps.data]);

  // Pick a pending source — auto-fills the client name and remembers which
  // source so we can link it on submit.
  const handlePickSource = (src: typeof pendingSources[number]) => {
    setSaleForm(prev => ({
      ...prev,
      clientName: `${src.clientFirstName} ${src.clientLastName}`.trim(),
    }));
    setLinkedSource({ type: src.kind, id: src.id });
    setManualEntry(false);
  };

  const clearLinkedSource = () => {
    setLinkedSource(null);
    setManualEntry(true);
  };

  const setterPickedName = useMemo(() => {
    if (!saleForm.setterId) return null;
    const s = setters?.find(x => x.id.toString() === saleForm.setterId);
    return s?.name ?? null;
  }, [saleForm.setterId, setters]);

  // Success screen
  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="border-primary/30">
          <CardContent className="pt-12 pb-8">
            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                <CheckCircle className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Sale Recorded!</h2>
              <p className="text-muted-foreground mb-6">
                {submittedName} has been successfully recorded.
              </p>
              {saleForm.paymentType === "in_house_payment_plan" && saleForm.paymentPlanMonths && (
                <p className="text-sm text-[#c7ab77] mb-4">
                  Payment plan created: {saleForm.paymentPlanMonths} monthly payments of ${saleForm.monthlyPaymentAmount} will be tracked.
                </p>
              )}
              <div className="flex gap-3">
                <Button variant="outline" onClick={resetForm}>
                  Add Another Entry
                </Button>
                <Button onClick={() => navigate("/")} className="bg-primary hover:bg-primary/90">
                  View Dashboard
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="hidden md:flex">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="hidden md:block">
          <h1 className="text-2xl font-bold">New Entry</h1>
          <p className="text-muted-foreground">Record a new sale</p>
        </div>
      </div>

      {/* ==================== SALE FORM ==================== */}
      <form onSubmit={handleSaleSubmit} className="space-y-6">
          {/* Instructions Card */}
          <Collapsible>
            <Card className="border-[#c7ab77]/30 bg-[#c7ab77]/5">
              <CollapsibleTrigger className="w-full">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-[#c7ab77]">
                    <span className="flex items-center gap-2">
                      <HelpCircle className="h-5 w-5" />
                      How to Fill Out This Form
                    </span>
                    <ChevronDown className="h-5 w-5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="text-sm text-zinc-300 space-y-2 pt-0">
                  <p><strong>1. Client Info:</strong> Enter the client's name and the date of the call.</p>
                  <p><strong>2. Call Outcome:</strong> Check what happened — showed, prepared, closed.</p>
                  <p><strong>3. Payment Type:</strong> If closed, select how they paid:</p>
                  <ul className="list-disc list-inside ml-4 space-y-1">
                    <li><strong>Full Pay:</strong> Full payment upfront</li>
                    <li><strong>In-House Payment Plan:</strong> Down payment + monthly payments via Fanbasis</li>
                    <li><strong>BNPL:</strong> Buy Now Pay Later (Climb, ClarityPay, HFD, Elective, Split-It)</li>
                  </ul>
                  <p className="text-[#c7ab77] mt-3"><strong>Note:</strong> Commission is automatically calculated based on your deals.</p>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Step 1 — Team Assignment. Pick the setter FIRST so we can
              surface their pending bookings/preps in the next card. The
              closer is auto-set to the signed-in user (or admin can pick). */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Step 1 · Who set this call?
              </CardTitle>
              <CardDescription>Pick the setter first — we'll show their pending calls below.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Setter</Label>
                <Select
                  value={saleForm.setterId || "none"}
                  onValueChange={(value) => {
                    setSaleForm({ ...saleForm, setterId: value === "none" ? "" : value });
                    // Switching setters voids any source we picked from the
                    // previous setter's list.
                    setLinkedSource(null);
                    setManualEntry(false);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pick setter (or self-generated lead)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Self-generated lead (no setter)</SelectItem>
                    {setters?.map((setter) => (
                      <SelectItem key={setter.id} value={setter.id.toString()}>
                        {setter.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Kresha (Call Setting · text outreach) or Jake (Pre Call · VSL discovery).
                  Pick them so commission attributes correctly.
                </p>
              </div>

              {isAdmin ? (
                <div className="space-y-2 pt-2 border-t border-border/40">
                  <Label>Closer *</Label>
                  <Select
                    value={saleForm.closerId}
                    onValueChange={(value) => setSaleForm({ ...saleForm, closerId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select closer" />
                    </SelectTrigger>
                    <SelectContent>
                      {closers?.map((closer) => (
                        <SelectItem key={closer.id} value={closer.id.toString()}>
                          {closer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground pt-2 border-t border-border/40">
                  Recording as closer:{" "}
                  <span className="text-foreground font-medium">
                    {myTeamLink?.teamMember?.name || user?.name || "Loading..."}
                  </span>
                </p>
              )}
            </CardContent>
          </Card>

          {/* Step 2 — Pick from setter's pending calls (only when a setter
              was picked above). Auto-fills client name on click. Closer can
              skip this and type manually if the call wasn't pre-logged. */}
          {saleForm.setterId && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  Step 2 · Pick from {setterPickedName ?? "their"} pending calls
                </CardTitle>
                <CardDescription>
                  {pendingSources.length > 0
                    ? "Click a row to auto-fill the client info — saves you re-typing what they already captured."
                    : "Nothing pending from this setter assigned to you. Type the client info manually below."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {linkedSource && !manualEntry ? (
                  <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 flex items-center gap-3">
                    <Sparkles className="h-4 w-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">
                        Auto-filled from {linkedSource.type === "booking" ? "Call Setting booking" : "Pre Call prep"} ·
                        will be linked to this deal on save.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearLinkedSource}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Edit / pick different
                    </Button>
                  </div>
                ) : pendingSources.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    No pending {setterPickedName} calls assigned to you. The form below works fine — type the client info manually.
                  </p>
                ) : (
                  <div className="divide-y divide-border/30 -mx-2">
                    {pendingSources.map(src => (
                      <button
                        key={`${src.kind}:${src.id}`}
                        type="button"
                        onClick={() => handlePickSource(src)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/40 rounded-md transition-colors text-left"
                      >
                        <Badge
                          variant="outline"
                          className={src.kind === "prep"
                            ? "bg-purple-500/10 text-purple-300 border-purple-500/30 h-5"
                            : "bg-blue-500/10 text-blue-300 border-blue-500/30 h-5"}
                        >
                          {src.kind === "prep" ? "Pre Call" : "Call Setting"}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">
                            {src.clientFirstName} {src.clientLastName}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {src.phoneNumber}
                            </span>
                            {src.kind === "booking" && src.bookedDate && (
                              <span>booked {src.bookedDate}</span>
                            )}
                            {src.kind === "prep" && src.coachability && (
                              <span className="truncate max-w-xs">
                                "{src.coachability.length > 60 ? src.coachability.slice(0, 60) + "…" : src.coachability}"
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 3 — Client info. Either auto-filled from above, or typed
              manually. */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-primary" />
                {saleForm.setterId ? "Step 3 · Client info" : "Client info"}
              </CardTitle>
              <CardDescription>
                {linkedSource && !manualEntry
                  ? "Auto-filled from the picker above. Edit if anything's wrong."
                  : "Basic details about the client."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clientName">Client Name *</Label>
                  <Input
                    id="clientName"
                    value={saleForm.clientName}
                    onChange={(e) => setSaleForm({ ...saleForm, clientName: e.target.value })}
                    placeholder="Enter client name"
                    autoFocus
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dealDate">Date *</Label>
                  <Input
                    id="dealDate"
                    type="date"
                    value={saleForm.dealDate}
                    onChange={(e) => setSaleForm({ ...saleForm, dealDate: e.target.value })}
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Call Outcome */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Call Outcome
              </CardTitle>
              <CardDescription>What happened on the call?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="flex items-center space-x-2 p-3 rounded-lg bg-secondary/50">
                  <Checkbox
                    id="showed"
                    checked={saleForm.showed}
                    onCheckedChange={(checked) => setSaleForm({
                      ...saleForm,
                      showed: !!checked,
                      // Showing implies not canceled
                      canceled: !!checked ? false : saleForm.canceled,
                      prepared: !!checked ? saleForm.prepared : false,
                    })}
                  />
                  <Label htmlFor="showed" className="cursor-pointer font-medium text-sm">
                    Showed
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 rounded-lg bg-secondary/50">
                  <Checkbox
                    id="prepared"
                    checked={saleForm.prepared}
                    onCheckedChange={(checked) => setSaleForm({ ...saleForm, prepared: !!checked })}
                    disabled={!saleForm.showed}
                  />
                  <Label htmlFor="prepared" className={`cursor-pointer font-medium text-sm ${!saleForm.showed ? 'opacity-50' : ''}`}>
                    Prepared
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 rounded-lg bg-secondary/50">
                  <Checkbox
                    id="offered"
                    checked={saleForm.offered}
                    onCheckedChange={(checked) => setSaleForm({ ...saleForm, offered: !!checked })}
                    disabled={!saleForm.showed}
                  />
                  <Label htmlFor="offered" className={`cursor-pointer font-medium text-sm ${!saleForm.showed ? 'opacity-50' : ''}`}>
                    Offered
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 rounded-lg bg-secondary/50">
                  <Checkbox
                    id="canceled"
                    checked={saleForm.canceled}
                    onCheckedChange={(checked) => setSaleForm({
                      ...saleForm,
                      canceled: !!checked,
                      // Canceled implies not showed/prepared/offered/closed
                      showed: !!checked ? false : saleForm.showed,
                      prepared: !!checked ? false : saleForm.prepared,
                      offered: !!checked ? false : saleForm.offered,
                      closed: !!checked ? false : saleForm.closed,
                    })}
                  />
                  <Label htmlFor="canceled" className="cursor-pointer font-medium text-sm">
                    Canceled
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 rounded-lg bg-secondary/50">
                  <Checkbox
                    id="closed"
                    checked={saleForm.closed}
                    onCheckedChange={(checked) => setSaleForm({ ...saleForm, closed: !!checked, paymentType: "", paymentProcessor: "" })}
                    disabled={!saleForm.showed}
                  />
                  <Label htmlFor="closed" className={`cursor-pointer font-medium text-sm ${!saleForm.showed ? 'opacity-50' : ''}`}>
                    Closed
                  </Label>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Funnel order: <span className="text-foreground">Showed</span> → <span className="text-foreground">Prepared</span> → <span className="text-foreground">Offered</span> → <span className="text-foreground">Closed</span>. Mark <span className="text-foreground">Canceled</span> if the client preempted before the call (different from a no-show, which is "Showed" left unchecked).
              </p>
            </CardContent>
          </Card>

          {/* Payment Type (only if closed) */}
          {saleForm.closed && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Payment Type
                </CardTitle>
                <CardDescription>How did the client pay?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      saleForm.paymentType === "full_pay"
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => setSaleForm({ ...saleForm, paymentType: "full_pay", paymentProcessor: "", downPayment: "", paymentPlanMonths: "", monthlyPaymentAmount: "", bnplFee: "" })}
                  >
                    <div className="font-medium mb-1">Full Pay</div>
                    <div className="text-xs text-muted-foreground">Paid in full upfront</div>
                  </div>
                  <div
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      saleForm.paymentType === "in_house_payment_plan"
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => setSaleForm({ ...saleForm, paymentType: "in_house_payment_plan", paymentProcessor: "", bnplFee: "" })}
                  >
                    <div className="font-medium mb-1">In-House Plan</div>
                    <div className="text-xs text-muted-foreground">Fanbasis / Denefits / Client Financing — down + monthly · 9% commission</div>
                  </div>
                  <div
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      saleForm.paymentType === "bnpl"
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => setSaleForm({ ...saleForm, paymentType: "bnpl", paymentProcessor: "", downPayment: "", paymentPlanMonths: "", monthlyPaymentAmount: "" })}
                  >
                    <div className="font-medium mb-1">BNPL</div>
                    <div className="text-xs text-muted-foreground">Buy Now Pay Later</div>
                  </div>
                </div>

                {/* Provider Selection */}
                {saleForm.paymentType && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Payment Processor *</Label>
                      <Select
                        value={saleForm.paymentProcessor}
                        onValueChange={(value) => setSaleForm({ ...saleForm, paymentProcessor: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                        <SelectContent>
                          {getProviderOptions().map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {saleForm.paymentProcessor === "other" && (
                      <div className="space-y-2">
                        <Label>Specify Processor *</Label>
                        <Input
                          value={saleForm.paymentProcessorOther}
                          onChange={(e) => setSaleForm({ ...saleForm, paymentProcessorOther: e.target.value })}
                          placeholder="Enter processor name"
                        />
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Deal Amounts (only if closed) */}
          {saleForm.closed && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Deal Amounts
                </CardTitle>
                <CardDescription>Financial details of the closed deal</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="totalDealAmount">Amount Charged to Client (Total Revenue) *</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="totalDealAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={saleForm.totalDealAmount}
                      onChange={(e) => {
                        const total = parseFloat(e.target.value) || 0;
                        const down = parseFloat(saleForm.downPayment) || 0;
                        const months = parseInt(saleForm.paymentPlanMonths) || 0;
                        const calculatedMonthly = (saleForm.paymentType === "in_house_payment_plan" && months > 0)
                          ? ((total - down) / months).toFixed(2)
                          : saleForm.monthlyPaymentAmount;
                        setSaleForm({ ...saleForm, totalDealAmount: e.target.value, monthlyPaymentAmount: calculatedMonthly });
                      }}
                      placeholder="0.00"
                      className="pl-9"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The full price you quoted the client — what we'd love them to pay total. Cash, financed, and fees are tracked separately below.
                  </p>
                </div>

                {/* Pay In Full fields */}
                {saleForm.paymentType === "full_pay" && (
                  <div className="space-y-2">
                    <Label htmlFor="newCashCollected">Actual Cash Collected Today *</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="newCashCollected"
                        type="number"
                        step="0.01"
                        min="0"
                        value={saleForm.newCashCollected}
                        onChange={(e) => setSaleForm({ ...saleForm, newCashCollected: e.target.value })}
                        placeholder="0.00"
                        className="pl-9"
                        required
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      What actually hit the account today. For full pay, usually equals the amount charged.
                    </p>
                  </div>
                )}

                {/* Payment Plan fields */}
                {saleForm.paymentType === "in_house_payment_plan" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="downPayment">Actual Cash Collected Today (Down Payment) *</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="downPayment"
                          type="number"
                          step="0.01"
                          min="0"
                          value={saleForm.downPayment}
                          onChange={(e) => {
                            const down = parseFloat(e.target.value) || 0;
                            const total = parseFloat(saleForm.totalDealAmount) || 0;
                            const months = parseInt(saleForm.paymentPlanMonths) || 0;
                            const calculatedMonthly = months > 0 ? ((total - down) / months).toFixed(2) : saleForm.monthlyPaymentAmount;
                            setSaleForm({ ...saleForm, downPayment: e.target.value, monthlyPaymentAmount: calculatedMonthly });
                          }}
                          placeholder="0.00"
                          className="pl-9"
                          required
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Commission is paid on this amount now</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="paymentPlanMonths">Number of Monthly Payments *</Label>
                        <Input
                          id="paymentPlanMonths"
                          type="number"
                          min="1"
                          max="60"
                          value={saleForm.paymentPlanMonths}
                          onChange={(e) => {
                            const months = parseInt(e.target.value) || 0;
                            const total = parseFloat(saleForm.totalDealAmount) || 0;
                            const down = parseFloat(saleForm.downPayment) || 0;
                            const calculatedMonthly = months > 0 ? ((total - down) / months).toFixed(2) : "";
                            setSaleForm({ ...saleForm, paymentPlanMonths: e.target.value, monthlyPaymentAmount: calculatedMonthly });
                          }}
                          placeholder="e.g., 6"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="monthlyPaymentAmount">Monthly Payment Amount *</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="monthlyPaymentAmount"
                            type="number"
                            step="0.01"
                            min="0"
                            value={saleForm.monthlyPaymentAmount}
                            onChange={(e) => setSaleForm({ ...saleForm, monthlyPaymentAmount: e.target.value })}
                            placeholder="0.00"
                            className="pl-9"
                            required
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">Auto-calculated, but editable if needed</p>
                      </div>
                    </div>
                  </>
                )}

                {/* BNPL fields */}
                {saleForm.paymentType === "bnpl" && (
                  <>
                    {/* Quick visual reference of the quoted amount from above */}
                    <div className="rounded-md border border-border/40 bg-secondary/30 px-3 py-2 text-sm flex items-center justify-between">
                      <span className="text-muted-foreground">Total Price Quoted</span>
                      <span className="font-semibold text-foreground">
                        {(() => {
                          const v = parseFloat(saleForm.totalDealAmount) || 0;
                          return v.toLocaleString("en-US", {
                            style: "currency", currency: "USD",
                            minimumFractionDigits: 2, maximumFractionDigits: 2,
                          });
                        })()}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="newCashCollected">Charged via BNPL *</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="newCashCollected"
                            type="number"
                            step="0.01"
                            min="0"
                            value={saleForm.newCashCollected}
                            onChange={(e) => setSaleForm({ ...saleForm, newCashCollected: e.target.value })}
                            placeholder="0.00"
                            className="pl-9"
                            required
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          What the BNPL provider actually charged the client (gross, before their fee). Often equals the price quoted, but can be lower if BNPL only approved part of it.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bnplFee">BNPL Fee *</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="bnplFee"
                            type="number"
                            step="0.01"
                            min="0"
                            value={saleForm.bnplFee}
                            onChange={(e) => setSaleForm({ ...saleForm, bnplFee: e.target.value })}
                            placeholder="0.00"
                            className="pl-9"
                            required
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          The cut taken by the BNPL provider (Climb / ClarityPay / HFD / Elective / Split-It).
                        </p>
                      </div>
                    </div>

                    {/* Auto-calculated cash collected — read-only display */}
                    {(() => {
                      const charged = parseFloat(saleForm.newCashCollected) || 0;
                      const fee = parseFloat(saleForm.bnplFee) || 0;
                      const net = Math.max(0, charged - fee);
                      const fmt = (n: number) =>
                        n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
                      return (
                        <div className="rounded-md border-2 border-primary/40 bg-primary/5 p-3 flex items-center justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-wider text-primary font-bold">
                              Cash Collected (auto-calculated)
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Charged via BNPL − BNPL Fee = what TF actually receives
                            </p>
                          </div>
                          <span className="text-2xl font-bold text-primary">{fmt(net)}</span>
                        </div>
                      );
                    })()}
                  </>
                )}

                {/* ─────── Unified Deal Breakdown — what gets saved ─────── */}
                {(() => {
                  const charged = parseFloat(saleForm.totalDealAmount) || 0;
                  const fee = parseFloat(saleForm.bnplFee) || 0;
                  const grossEntry = parseFloat(saleForm.newCashCollected) || 0;
                  const down = parseFloat(saleForm.downPayment) || 0;
                  const monthly = parseFloat(saleForm.monthlyPaymentAmount) || 0;
                  const months = parseInt(saleForm.paymentPlanMonths) || 0;

                  let cashToday = 0;
                  let financedFuture = 0;
                  let bnplFeeShown = 0;
                  if (saleForm.paymentType === "full_pay") {
                    cashToday = grossEntry;
                  } else if (saleForm.paymentType === "in_house_payment_plan") {
                    cashToday = down;
                    financedFuture = Math.max(0, charged - down);
                  } else if (saleForm.paymentType === "bnpl") {
                    cashToday = grossEntry - fee;
                    bnplFeeShown = fee;
                  }

                  const fmt = (n: number) =>
                    n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

                  return (
                    <div className="rounded-lg border border-[#c7ab77]/40 bg-[#c7ab77]/5 p-4 space-y-2">
                      <p className="text-xs uppercase tracking-wider text-[#c7ab77] font-bold">
                        Deal Breakdown — what gets saved
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Charged to client (revenue)</span>
                          <span className="font-semibold">{fmt(charged)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Cash collected today</span>
                          <span className="font-semibold text-[#c7ab77]">{fmt(cashToday)}</span>
                        </div>
                        {saleForm.paymentType === "in_house_payment_plan" && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Financed (collect later)</span>
                              <span className="font-semibold text-blue-400">{fmt(financedFuture)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{months || 0} × monthly</span>
                              <span className="font-semibold">{fmt(monthly)}/mo</span>
                            </div>
                          </>
                        )}
                        {saleForm.paymentType === "bnpl" && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">BNPL fee absorbed</span>
                            <span className="font-semibold text-red-400">{fmt(bnplFeeShown)}</span>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground pt-1 border-t border-[#c7ab77]/20">
                        These three numbers — Charged, Collected, Fees — feed the Dashboard chart and Sales Tracker. Be honest, be exact.
                      </p>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
              <CardDescription>Any additional information</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={saleForm.notes}
                onChange={(e) => setSaleForm({ ...saleForm, notes: e.target.value })}
                placeholder="Add any notes about this entry..."
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/")}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createDeal.isPending}
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              {createDeal.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Recording...
                </>
              ) : (
                "Record Sale"
              )}
            </Button>
          </div>
        </form>
    </div>
  );
}
