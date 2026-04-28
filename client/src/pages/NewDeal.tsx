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
import { ArrowLeft, Loader2, UserCheck, DollarSign, Calendar, CheckCircle, Users, HelpCircle, CreditCard, ChevronDown, ShoppingBag, RefreshCw } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format } from "date-fns";

type EntryType = "" | "sale" | "subscription";

export default function NewDeal() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // Entry type selector
  const [entryType, setEntryType] = useState<EntryType>("");

  // Fetch team members (only needed for admin to pick a closer)
  const { data: closers } = trpc.team.getByRole.useQuery({ role: "closer" });
  // Setters list — anyone can attribute a setter to a deal
  const { data: setters } = trpc.team.getByRole.useQuery({ role: "setter" });
  // Get the logged-in user's linked team member (for closers)
  const { data: myTeamLink } = trpc.userTeam.getMyTeamMember.useQuery(undefined, {
    enabled: !isAdmin,
  });

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
    existingCashCollected: "",
    notes: "",
    paymentType: "" as "" | "full_pay" | "in_house_payment_plan" | "bnpl",
    paymentProcessor: "",
    paymentProcessorOther: "",
    downPayment: "",
    paymentPlanMonths: "",
    monthlyPaymentAmount: "",
    bnplFee: "",
  });

  // Subscription form state
  const [subForm, setSubForm] = useState({
    clientName: "",
    monthlyAmount: "",
    closerId: "",
    notes: "",
  });

  const [submitted, setSubmitted] = useState(false);
  const [submittedName, setSubmittedName] = useState("");
  const [submittedType, setSubmittedType] = useState<EntryType>("");

  // Auto-assign closerId for non-admin users
  useEffect(() => {
    if (!isAdmin && myTeamLink?.teamMember?.id) {
      const id = myTeamLink.teamMember!.id.toString();
      if (!saleForm.closerId) {
        setSaleForm(prev => ({ ...prev, closerId: id }));
      }
      if (!subForm.closerId) {
        setSubForm(prev => ({ ...prev, closerId: id }));
      }
    }
  }, [isAdmin, myTeamLink, saleForm.closerId, subForm.closerId]);

  // Create deal mutation (for sales)
  const createDeal = trpc.deals.create.useMutation({
    onSuccess: () => {
      setSubmittedName(saleForm.clientName);
      setSubmittedType("sale");
      setSubmitted(true);
      utils.deals.getByMonth.invalidate();
      utils.stats.getMonthly.invalidate();
      utils.stats.getCloserLeaderboard.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to record sale");
    },
  });

  // Create subscription mutation
  const createSubscription = trpc.subscriptions.create.useMutation({
    onSuccess: () => {
      setSubmittedName(subForm.clientName);
      setSubmittedType("subscription");
      setSubmitted(true);
      utils.subscriptions.getAll.invalidate();
      utils.subscriptions.getVerifications.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to record subscription");
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
      existingCashCollected: parseFloat(saleForm.existingCashCollected) || 0,
      notes: saleForm.notes,
      paymentType: saleForm.paymentType || null,
      paymentProcessor: processor || null,
      downPayment: parseFloat(saleForm.downPayment) || null,
      paymentPlanMonths: parseInt(saleForm.paymentPlanMonths) || null,
      monthlyPaymentAmount: parseFloat(saleForm.monthlyPaymentAmount) || null,
      bnplFee: parseFloat(saleForm.bnplFee) || null,
    });
  };

  const handleSubSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!subForm.clientName.trim()) {
      toast.error("Please enter a client name");
      return;
    }

    if (!subForm.monthlyAmount || parseFloat(subForm.monthlyAmount) <= 0) {
      toast.error("Please enter a valid monthly amount");
      return;
    }

    if (!subForm.closerId) {
      toast.error(isAdmin ? "Please select a closer" : "Your account is not linked to a team member. Contact admin.");
      return;
    }

    createSubscription.mutate({
      clientName: subForm.clientName.trim(),
      monthlyAmount: parseFloat(subForm.monthlyAmount),
      closerId: parseInt(subForm.closerId),
      startDate: today,
      startMonth: now.getMonth() + 1,
      startYear: now.getFullYear(),
      notes: subForm.notes || undefined,
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
      existingCashCollected: "",
      notes: "",
      paymentType: "",
      paymentProcessor: "",
      paymentProcessorOther: "",
      downPayment: "",
      paymentPlanMonths: "",
      monthlyPaymentAmount: "",
      bnplFee: "",
    });
    setSubForm({
      clientName: "",
      monthlyAmount: "",
      closerId: "",
      notes: "",
    });
    setSubmitted(false);
    setSubmittedName("");
    setSubmittedType("");
    setEntryType("");
    // Re-assign closerId for non-admin
    if (!isAdmin && myTeamLink?.teamMember?.id) {
      const id = myTeamLink.teamMember!.id.toString();
      setSaleForm(prev => ({ ...prev, closerId: id }));
      setSubForm(prev => ({ ...prev, closerId: id }));
    }
  };

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
              <h2 className="text-2xl font-bold mb-2">
                {submittedType === "subscription" ? "Subscription Recorded!" : "Sale Recorded!"}
              </h2>
              <p className="text-muted-foreground mb-6">
                {submittedName} has been successfully recorded
                {submittedType === "subscription" ? " as a new subscription." : "."}
              </p>
              {submittedType === "subscription" && (
                <p className="text-sm text-[#c7ab77] mb-4">
                  You'll earn 25% of the monthly amount as long as this subscriber stays active.
                </p>
              )}
              {submittedType === "sale" && saleForm.paymentType === "in_house_payment_plan" && saleForm.paymentPlanMonths && (
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
          <p className="text-muted-foreground">Record a new sale or subscription</p>
        </div>
      </div>

      {/* Entry Type Selector */}
      <Card className="border-[#c7ab77]/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#c7ab77]">
            What are you recording?
          </CardTitle>
          <CardDescription>Choose the type of entry to show the correct fields</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div
              className={`p-6 rounded-xl border-2 cursor-pointer transition-all text-center ${
                entryType === "sale"
                  ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                  : "border-border hover:border-primary/50 hover:bg-primary/5"
              }`}
              onClick={() => setEntryType("sale")}
            >
              <ShoppingBag className={`h-8 w-8 mx-auto mb-3 ${entryType === "sale" ? "text-primary" : "text-muted-foreground"}`} />
              <div className="font-semibold text-lg mb-1">Sale</div>
              <div className="text-xs text-muted-foreground">One-time deal or payment plan</div>
            </div>
            <div
              className={`p-6 rounded-xl border-2 cursor-pointer transition-all text-center ${
                entryType === "subscription"
                  ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                  : "border-border hover:border-primary/50 hover:bg-primary/5"
              }`}
              onClick={() => setEntryType("subscription")}
            >
              <RefreshCw className={`h-8 w-8 mx-auto mb-3 ${entryType === "subscription" ? "text-primary" : "text-muted-foreground"}`} />
              <div className="font-semibold text-lg mb-1">Subscription</div>
              <div className="text-xs text-muted-foreground">Monthly recurring — 25% commission</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ==================== SALE FORM ==================== */}
      {entryType === "sale" && (
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

          {/* Client Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-primary" />
                Client Information
              </CardTitle>
              <CardDescription>Basic details about the client</CardDescription>
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

          {/* Team Assignment - admin sees closer dropdown; everyone sees setter picker */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Team Assignment
              </CardTitle>
              <CardDescription>Who handled this call?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isAdmin ? (
                <div className="space-y-2">
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
                <p className="text-sm text-muted-foreground">
                  Recording as:{" "}
                  <span className="text-foreground font-medium">
                    {myTeamLink?.teamMember?.name || user?.name || "Loading..."}
                  </span>
                </p>
              )}

              <div className="space-y-2">
                <Label>Setter (who booked this call)</Label>
                <Select
                  value={saleForm.setterId || "none"}
                  onValueChange={(value) =>
                    setSaleForm({ ...saleForm, setterId: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Self-generated lead (no setter)" />
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
                  If a setter booked this call from a text outreach, pick her here so commission attributes correctly.
                  Setter commission (3%) applies to one-time sales only — subscriptions never pay setter commission.
                </p>
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
                    <div className="text-xs text-muted-foreground">Fanbasis — down + monthly</div>
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
                  <Label htmlFor="totalDealAmount">Total Deal Amount *</Label>
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
                </div>

                {/* Pay In Full fields */}
                {saleForm.paymentType === "full_pay" && (
                  <div className="space-y-2">
                    <Label htmlFor="newCashCollected">Cash Collected *</Label>
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
                  </div>
                )}

                {/* Payment Plan fields */}
                {saleForm.paymentType === "in_house_payment_plan" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="downPayment">Down Payment (Cash Collected Now) *</Label>
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
                    <div className="p-3 rounded-lg bg-[#c7ab77]/10 border border-[#c7ab77]/20 text-sm">
                      <strong>Payment Plan Summary:</strong> Client will pay ${saleForm.monthlyPaymentAmount || "0"}/month for {saleForm.paymentPlanMonths || "0"} months.
                      These payments will be tracked and you'll be reminded to collect each month.
                      Commission is paid only when each payment is collected.
                    </div>
                  </>
                )}

                {/* BNPL fields */}
                {saleForm.paymentType === "bnpl" && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="newCashCollected">Total Amount from BNPL *</Label>
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
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bnplFee">BNPL Provider Fee *</Label>
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
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-[#c7ab77]/10 border border-[#c7ab77]/20 text-sm">
                      <strong>Net Cash Collected:</strong> ${((parseFloat(saleForm.newCashCollected) || 0) - (parseFloat(saleForm.bnplFee) || 0)).toFixed(2)}
                      <br />
                      <span className="text-muted-foreground">Commission is calculated on this net amount (after BNPL fee)</span>
                    </div>
                  </>
                )}

                {/* Existing client cash */}
                <div className="space-y-2">
                  <Label htmlFor="existingCashCollected">Existing Client Cash Collected</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="existingCashCollected"
                      type="number"
                      step="0.01"
                      min="0"
                      value={saleForm.existingCashCollected}
                      onChange={(e) => setSaleForm({ ...saleForm, existingCashCollected: e.target.value })}
                      placeholder="0.00"
                      className="pl-9"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">For returning clients with additional purchases</p>
                </div>
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
              onClick={() => setEntryType("")}
              className="flex-1"
            >
              Back
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
      )}

      {/* ==================== SUBSCRIPTION FORM ==================== */}
      {entryType === "subscription" && (
        <form onSubmit={handleSubSubmit} className="space-y-6">
          {/* Info banner */}
          <Card className="border-[#c7ab77]/30 bg-[#c7ab77]/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <RefreshCw className="h-5 w-5 text-[#c7ab77] mt-0.5 shrink-0" />
                <div className="text-sm text-zinc-300">
                  <p className="font-medium text-[#c7ab77] mb-1">Subscription Commission</p>
                  <p>You earn <strong>25%</strong> of the monthly subscription amount as long as the subscriber stays active. Ariana verifies each month that the subscriber is still in the group.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Client & Amount */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-primary" />
                Subscription Details
              </CardTitle>
              <CardDescription>Who is subscribing and how much?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subClientName">Client Name *</Label>
                <Input
                  id="subClientName"
                  value={subForm.clientName}
                  onChange={(e) => setSubForm({ ...subForm, clientName: e.target.value })}
                  placeholder="Enter subscriber name"
                  autoFocus
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="monthlyAmount">Monthly Amount *</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="monthlyAmount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={subForm.monthlyAmount}
                    onChange={(e) => setSubForm({ ...subForm, monthlyAmount: e.target.value })}
                    placeholder="0.00"
                    className="pl-9"
                    required
                  />
                </div>
                {subForm.monthlyAmount && parseFloat(subForm.monthlyAmount) > 0 && (
                  <p className="text-xs text-[#c7ab77]">
                    Your monthly commission: ${(parseFloat(subForm.monthlyAmount) * 0.25).toFixed(2)}/month
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Team Assignment for admin */}
          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Closer Assignment
                </CardTitle>
                <CardDescription>Who signed up this subscriber?</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>Closer *</Label>
                  <Select
                    value={subForm.closerId}
                    onValueChange={(value) => setSubForm({ ...subForm, closerId: value })}
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
                value={subForm.notes}
                onChange={(e) => setSubForm({ ...subForm, notes: e.target.value })}
                placeholder="Add any notes about this subscription..."
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEntryType("")}
              className="flex-1"
            >
              Back
            </Button>
            <Button
              type="submit"
              disabled={createSubscription.isPending}
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              {createSubscription.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Recording...
                </>
              ) : (
                "Record Subscription"
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
