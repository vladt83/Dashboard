import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, ChevronDown, Edit2, Save, X, HelpCircle, FileText, CheckCircle2, XCircle, User, DollarSign, Calendar, CreditCard, Clock, Trash2, AlertTriangle } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Link, useLocation } from "wouter";
import { Phone, Sparkles } from "lucide-react";

export default function MyDeals() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [currentDate, setCurrentDate] = useState(new Date());
  const [editingDeal, setEditingDeal] = useState<any>(null);
  const [editNotes, setEditNotes] = useState("");
  const [selectedCloserId, setSelectedCloserId] = useState<number | null>(null);
  const [viewingDeal, setViewingDeal] = useState<any>(null);
  const [deletingDeal, setDeletingDeal] = useState<any>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  
  // Get team members (admin needs dropdown, closers auto-assign)
  const { data: closers } = trpc.team.getByRole.useQuery({ role: "closer" }, { enabled: isAdmin });
  
  // Get the logged-in user's linked team member (for closers)
  const { data: myTeamLink } = trpc.userTeam.getMyTeamMember.useQuery(undefined, {
    enabled: !isAdmin,
  });
  
  // Auto-assign closerId for non-admin users
  useEffect(() => {
    if (!isAdmin && myTeamLink?.teamMember?.id && !selectedCloserId) {
      setSelectedCloserId(myTeamLink.teamMember.id);
    }
  }, [isAdmin, myTeamLink, selectedCloserId]);
  
  // Get deals for the selected closer
  const { data: deals, refetch: refetchDeals } = trpc.deals.getByCloser.useQuery(
    { closerId: selectedCloserId || 0, year, month },
    { enabled: !!selectedCloserId }
  );

  // Setters list — needed for the setter-attribution dropdown in the edit dialog.
  const { data: setters } = trpc.team.getByRole.useQuery({ role: "setter" });

  // Pending calls assigned to this closer that haven't been converted to a
  // deal yet. Drives the CRM-style hand-off: setter books → the prospect
  // shows up here → closer clicks → New Entry pre-fills client name + setter.
  const pendingBookingsQuery = trpc.bookedCalls.listAssignedToMe.useQuery(
    isAdmin && selectedCloserId ? { closerId: selectedCloserId } : undefined,
    { enabled: !!selectedCloserId }
  );
  const setterNameById = (() => {
    const m = new Map<number, string>();
    (setters ?? []).forEach(s => m.set(s.id, s.name));
    return m;
  })();
  const pendingBookings = (pendingBookingsQuery.data ?? []).filter(b => !b.dealId);
  const [, navigate] = useLocation();
  const startDealFromBooking = (bookingId: number) => {
    navigate(`/deals/new?bookingId=${bookingId}`);
  };

  // We invalidate every dependent namespace after a save so the dashboard,
  // leaderboard, payroll summary, sales tracker, and setter payouts all
  // reflect the new numbers without a manual refresh.
  const utils = trpc.useUtils();
  // Anywhere a deal's numbers show up — refresh after an edit/delete so the
  // closer sees the updated cash, commission, and downstream rollups
  // immediately instead of having to navigate away and back.
  const invalidateEverythingDealLevel = async () => {
    await Promise.all([
      utils.deals.invalidate(),
      utils.stats.invalidate(),
      utils.dashboard.invalidate(),
      utils.salesTracker.invalidate(),
      utils.payeePayments.invalidate(),
      utils.setter.invalidate(),
      utils.bookedCalls.invalidate(),
      utils.payroll.invalidate(),
      utils.paymentPlans.invalidate(),
    ]);
  };

  const updateDealMutation = trpc.deals.update.useMutation({
    onSuccess: async () => {
      toast.success("Deal updated. Dashboards and payroll refreshed.");
      await invalidateEverythingDealLevel();
      refetchDeals();
      setEditingDeal(null);
      setIsEditMode(false);
      setViewingDeal(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update deal");
    },
  });

  const deleteDealMutation = trpc.deals.delete.useMutation({
    onSuccess: async () => {
      toast.success("Deal deleted. Dashboards and payroll refreshed.");
      await invalidateEverythingDealLevel();
      refetchDeals();
      setDeletingDeal(null);
      setViewingDeal(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete deal");
    },
  });

  const [collectingPayment, setCollectingPayment] = useState<any>(null);

  const collectPaymentMutation = trpc.deals.collectPaymentPlanPayment.useMutation({
    onSuccess: async () => {
      toast.success("Payment collected. Dashboards and payroll refreshed.");
      await invalidateEverythingDealLevel();
      refetchDeals();
      setCollectingPayment(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to collect payment");
    },
  });
  
  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === "prev") {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };
  
  const handleEditDeal = (deal: any) => {
    setEditingDeal(deal);
    setEditNotes(deal.notes || "");
    // Pre-populate the full edit form with current values. Money fields are
    // strings to play nice with controlled inputs.
    setEditForm({
      clientName: deal.clientName ?? "",
      dealDate: deal.dealDate ?? "",
      setterId: deal.setterId ? String(deal.setterId) : "",
      showed: !!deal.showed,
      prepared: !!deal.prepared,
      offered: !!deal.offered,
      canceled: !!deal.canceled,
      closed: !!deal.closed,
      isNewClient: !!deal.isNewClient,
      fullyPaid: !!deal.fullyPaid,
      totalDealAmount: String(parseFloat(deal.totalDealAmount || "0")),
      newCashCollected: String(parseFloat(deal.newCashCollected || "0")),
      bnplFee: String(parseFloat(deal.bnplFee || "0")),
      downPayment: String(parseFloat(deal.downPayment || "0")),
      monthlyAmount: String(parseFloat(deal.monthlyAmount || "0")),
      paymentType: deal.paymentType ?? "",
      docusignSigned: !!deal.docusignSigned,
    });
  };

  const handleSaveDeal = () => {
    if (!editingDeal) return;

    // Build payload — all fields are optional on the server, so we only
    // include what makes sense given the deal's payment type.
    const payload: any = {
      id: editingDeal.id,
      clientName: editForm.clientName.trim(),
      dealDate: editForm.dealDate,
      setterId: editForm.setterId ? parseInt(editForm.setterId) : null,
      showed: editForm.showed,
      prepared: editForm.prepared,
      offered: editForm.offered,
      canceled: editForm.canceled,
      closed: editForm.closed,
      isNewClient: editForm.isNewClient,
      fullyPaid: editForm.fullyPaid,
      totalDealAmount: parseFloat(editForm.totalDealAmount) || 0,
      // Drop the legacy "existing cash" concept — closers only ever enter
      // money once via newCashCollected; we zero it so totals stay clean.
      existingCashCollected: 0,
      notes: editNotes,
      docusignSigned: !!editForm.docusignSigned,
    };

    // Cash collected logic mirrors NewDeal: for in-house plans we use the
    // down payment as the cash basis; for BNPL we store gross-minus-fee.
    if (editForm.paymentType === "in_house_payment_plan") {
      payload.newCashCollected = parseFloat(editForm.downPayment) || 0;
      payload.downPayment = parseFloat(editForm.downPayment) || 0;
      payload.monthlyAmount = parseFloat(editForm.monthlyAmount) || 0;
    } else if (editForm.paymentType === "bnpl") {
      const gross = parseFloat(editForm.newCashCollected) || 0;
      const fee = parseFloat(editForm.bnplFee) || 0;
      payload.newCashCollected = Math.max(0, gross - fee);
      payload.bnplFee = fee;
    } else {
      payload.newCashCollected = parseFloat(editForm.newCashCollected) || 0;
    }

    updateDealMutation.mutate(payload);
  };
  
  const handleToggleField = (deal: any, field: "showed" | "prepared" | "closed" | "fullyPaid") => {
    updateDealMutation.mutate({
      id: deal.id,
      [field]: !deal[field],
    });
  };
  
  const getSetterName = (setterId: number | null) => {
    if (!setterId) return "N/A";
    return "N/A";
  };
  
  const formatCurrency = (value: string | number | null) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num || 0);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header - hidden on mobile since DashboardLayout shows it */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="hidden md:block">
            <h1 className="text-2xl font-bold text-white">My Deals</h1>
            <p className="text-zinc-400">View and manage your commission entries</p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateMonth("prev")}
              className="border-zinc-700 hover:bg-zinc-800"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[140px] text-center font-medium text-white">
              {format(currentDate, "MMMM yyyy")}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateMonth("next")}
              className="border-zinc-700 hover:bg-zinc-800"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Instructions Card - Collapsible */}
        <Collapsible>
          <Card className="border-[#c7ab77]/30 bg-[#c7ab77]/5">
            <CollapsibleTrigger className="w-full">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-[#c7ab77]">
                  <span className="flex items-center gap-2">
                    <HelpCircle className="h-5 w-5" />
                    How to Use This Page
                  </span>
                  <ChevronDown className="h-5 w-5 transition-transform duration-200" />
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="text-sm text-zinc-300 space-y-2 pt-0">
                <p><strong>1. View Your Entries:</strong> All deals you've entered for the selected month will appear here.</p>
                <p><strong>2. Update Status:</strong> Click the checkboxes to update showed, prepared, closed, or fully paid status.</p>
                <p><strong>3. Edit Notes:</strong> Click the edit button to add or update notes for any deal.</p>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
        
        {/* Closer Selection - only shown to admin */}
        {isAdmin ? (
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader>
              <CardTitle className="text-white">Select Closer</CardTitle>
              <CardDescription>Choose a closer to view their deals</CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedCloserId?.toString() || ""}
                onValueChange={(value) => setSelectedCloserId(parseInt(value))}
              >
                <SelectTrigger className="w-full max-w-xs border-zinc-700 bg-zinc-800">
                  <SelectValue placeholder="Select a closer..." />
                </SelectTrigger>
                <SelectContent>
                  {closers?.map((closer) => (
                    <SelectItem key={closer.id} value={closer.id.toString()}>
                      {closer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        ) : !myTeamLink?.teamMember ? (
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardContent className="py-8 text-center text-muted-foreground">
              <User className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>Your account hasn't been linked to a team member profile yet. Please contact your admin.</p>
            </CardContent>
          </Card>
        ) : null}

        {/* Pending Calls — bookings assigned to this closer that haven't been
            converted to a deal yet. Click "Start Deal Entry" to flow the
            client straight into New Entry with name + setter pre-filled. */}
        {selectedCloserId && pendingBookings.length > 0 && (
          <Card className="border-[#c7ab77]/30 bg-[#c7ab77]/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#c7ab77]">
                <Phone className="h-5 w-5" />
                Pending Calls ({pendingBookings.length})
              </CardTitle>
              <CardDescription className="text-zinc-300">
                Bookings the setter handed off to you that haven't been logged as a deal yet. Click <strong>Start Deal Entry</strong> after the call — client name and setter come over automatically.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-400">
                      <th className="text-left py-2 px-2 font-semibold">Client</th>
                      <th className="text-left py-2 px-2 font-semibold">Phone</th>
                      <th className="text-left py-2 px-2 font-semibold">Setter</th>
                      <th className="text-left py-2 px-2 font-semibold">Source</th>
                      <th className="text-left py-2 px-2 font-semibold">Booked</th>
                      <th className="text-right py-2 px-2 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingBookings.map(b => {
                      const sourceLabel =
                        b.callSource === "meta" ? "Meta"
                        : b.callSource === "existing_client" ? "Existing client"
                        : "—";
                      return (
                        <tr key={b.id} className="border-b border-zinc-800/60 hover:bg-zinc-900/40 cursor-pointer" onClick={() => startDealFromBooking(b.id)}>
                          <td className="py-3 px-2 font-medium text-white">{b.clientFirstName} {b.clientLastName}</td>
                          <td className="py-3 px-2 text-zinc-300">{b.phoneNumber}</td>
                          <td className="py-3 px-2 text-zinc-300">{setterNameById.get(b.setterId) ?? `Setter #${b.setterId}`}</td>
                          <td className="py-3 px-2 text-zinc-300">{sourceLabel}</td>
                          <td className="py-3 px-2 text-zinc-400 text-xs">{b.bookedDate}</td>
                          <td className="py-3 px-2 text-right">
                            <Button
                              size="sm"
                              className="bg-[#c7ab77] hover:bg-[#c7ab77]/90 text-zinc-950"
                              onClick={(e) => { e.stopPropagation(); startDealFromBooking(b.id); }}
                            >
                              <Sparkles className="h-3.5 w-3.5 mr-1" />
                              Start Deal Entry
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Deals List */}
        {selectedCloserId && (
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <FileText className="h-5 w-5 text-[#c7ab77]" />
                Your Deals for {format(currentDate, "MMMM yyyy")}
              </CardTitle>
              <CardDescription>
                {deals?.length || 0} entries found. Click on any row to edit notes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!deals || deals.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  No deals found for this month. Go to "New Entry" to add deals.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-zinc-800 text-left text-sm text-zinc-400">
                        <th className="pb-3 pr-4">Date</th>
                        <th className="pb-3 pr-4">Client</th>

                        <th className="pb-3 pr-4 text-center">Showed</th>
                        <th className="pb-3 pr-4 text-center">Prepared</th>
                        <th className="pb-3 pr-4 text-center">Closed</th>
                        <th className="pb-3 pr-4 text-right">Cash</th>
                        <th className="pb-3 pr-4 text-right">Commission</th>
                        <th className="pb-3 pr-4 text-center">Paid</th>
                        <th className="pb-3">Notes</th>
                        <th className="pb-3 text-center">Delete</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deals.map((deal) => {
                        const isPaymentPlanEntry = deal.isPaymentPlan && deal.parentDealId && !deal.paymentCollected;
                        const monthlyAmount = parseFloat(deal.monthlyAmount || "0");
                        
                        return (
                        <tr key={deal.id} className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 ${isPaymentPlanEntry ? 'bg-blue-900/10' : ''}`}>
                          <td className="py-3 pr-4 text-sm text-zinc-300">
                            {format(new Date(deal.dealDate), "MMM d")}
                            {isPaymentPlanEntry && (
                              <Badge variant="outline" className="ml-2 text-xs border-blue-500/50 text-blue-400">
                                Payment {deal.paymentMonth}/{deal.totalMonths}
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-sm font-medium text-white">
                            {/* Click name → unified Client Profile (everything
                                we know about this client in one place). */}
                            <Link
                              href={`/clients/${deal.parentDealId ?? deal.id}`}
                              className="hover:text-[#c7ab77] hover:underline cursor-pointer text-left"
                            >
                              {deal.clientName}
                            </Link>
                          </td>
                          <td className="py-3 pr-4 text-sm text-zinc-400">

                          </td>
                          <td className="py-3 pr-4 text-center">
                            <Checkbox
                              checked={deal.showed}
                              onCheckedChange={() => handleToggleField(deal, "showed")}
                              className="border-[#c7ab77]/50 data-[state=checked]:bg-[#c7ab77] data-[state=checked]:border-[#c7ab77]"
                            />
                          </td>
                          <td className="py-3 pr-4 text-center">
                            <Checkbox
                              checked={deal.prepared}
                              onCheckedChange={() => handleToggleField(deal, "prepared")}
                              className="border-[#c7ab77]/50 data-[state=checked]:bg-[#c7ab77] data-[state=checked]:border-[#c7ab77]"
                            />
                          </td>
                          <td className="py-3 pr-4 text-center">
                            <Checkbox
                              checked={deal.closed}
                              onCheckedChange={() => handleToggleField(deal, "closed")}
                              className="border-[#c7ab77]/50 data-[state=checked]:bg-[#c7ab77] data-[state=checked]:border-[#c7ab77]"
                            />
                          </td>
                          <td className="py-3 pr-4 text-right text-sm text-[#c7ab77]">
                            {isPaymentPlanEntry ? (
                              <div className="flex flex-col items-end gap-1">
                                <span className="text-zinc-400">${monthlyAmount.toFixed(2)} due</span>
                                <Button
                                  size="sm"
                                  onClick={() => setCollectingPayment(deal)}
                                  className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 h-auto"
                                >
                                  Collect Payment
                                </Button>
                              </div>
                            ) : (
                              formatCurrency(parseFloat(deal.newCashCollected || "0"))
                            )}
                          </td>
                          <td className="py-3 pr-4 text-right text-sm font-medium">
                            {deal.closed && !deal.docusignSigned ? (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                Pending DocuSign
                              </span>
                            ) : (
                              <span className="text-green-400">{formatCurrency(deal.closerCommission)}</span>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-center">
                            <Checkbox
                              checked={deal.fullyPaid}
                              onCheckedChange={() => handleToggleField(deal, "fullyPaid")}
                              className="border-[#c7ab77]/50 data-[state=checked]:bg-[#c7ab77] data-[state=checked]:border-[#c7ab77]"
                            />
                          </td>
                          <td className="py-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditDeal(deal)}
                              className="text-zinc-400 hover:text-[#c7ab77]"
                            >
                              <Edit2 className="h-4 w-4 mr-1" />
                              {deal.notes ? "Edit" : "Add"}
                            </Button>
                          </td>
                          <td className="py-3 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingDeal(deal)}
                              className="text-zinc-500 hover:text-red-500"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        
        {/* Edit Deal Dialog — comprehensive (all editable fields) */}
        <Dialog open={!!editingDeal} onOpenChange={(open) => !open && setEditingDeal(null)}>
          <DialogContent className="bg-zinc-900 border-zinc-800 max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-white">
                Edit Deal — {editingDeal?.clientName}
              </DialogTitle>
              <DialogDescription>
                Changes here recalculate closer commission, setter commission (if attributed),
                and feed straight into Dashboard, Payroll, and Sales Tracker.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-2">
              {/* Client + date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-zinc-300">Client Name</Label>
                  <Input
                    value={editForm.clientName ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, clientName: e.target.value })}
                    className="border-zinc-700 bg-zinc-800 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-300">Deal Date</Label>
                  <Input
                    type="date"
                    value={editForm.dealDate ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, dealDate: e.target.value })}
                    className="border-zinc-700 bg-zinc-800 text-white"
                  />
                </div>
              </div>

              {/* Setter attribution */}
              <div className="space-y-2">
                <Label className="text-zinc-300">Setter (who booked this call)</Label>
                <Select
                  value={editForm.setterId || "none"}
                  onValueChange={(v) =>
                    setEditForm({ ...editForm, setterId: v === "none" ? "" : v })
                  }
                >
                  <SelectTrigger className="border-zinc-700 bg-zinc-800 text-white">
                    <SelectValue placeholder="Self-generated lead" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Self-generated lead (no setter)</SelectItem>
                    {(setters ?? []).map(s => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-zinc-500">
                  Changing this re-attributes the setter's 3% commission (capped at $6K cash) — payroll updates automatically.
                </p>
              </div>

              {/* Funnel checkboxes */}
              <div className="space-y-2">
                <Label className="text-zinc-300">Funnel</Label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {([
                    { key: "showed",   label: "Showed" },
                    { key: "prepared", label: "Prepared" },
                    { key: "offered",  label: "Offered" },
                    { key: "canceled", label: "Canceled" },
                    { key: "closed",   label: "Closed" },
                  ] as const).map(f => (
                    <label key={f.key} className="flex items-center gap-2 p-2 rounded bg-zinc-800/50 border border-zinc-800 cursor-pointer">
                      <Checkbox
                        checked={!!editForm[f.key]}
                        onCheckedChange={(c) => setEditForm({ ...editForm, [f.key]: !!c })}
                      />
                      <span className="text-sm text-white">{f.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Money fields — what's shown depends on payment type */}
              <div className="rounded-lg border border-[#c7ab77]/30 bg-[#c7ab77]/5 p-4 space-y-3">
                <p className="text-xs uppercase tracking-wider text-[#c7ab77] font-bold">
                  Money — payment type: {editForm.paymentType?.replace(/_/g, " ") || "—"}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-zinc-300">Amount Charged to Client</Label>
                    <Input
                      type="number" step="0.01" min="0"
                      value={editForm.totalDealAmount ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, totalDealAmount: e.target.value })}
                      className="border-zinc-700 bg-zinc-800 text-white"
                    />
                  </div>

                  {editForm.paymentType === "full_pay" && (
                    <div className="space-y-2">
                      <Label className="text-zinc-300">Cash Collected</Label>
                      <Input
                        type="number" step="0.01" min="0"
                        value={editForm.newCashCollected ?? ""}
                        onChange={(e) => setEditForm({ ...editForm, newCashCollected: e.target.value })}
                        className="border-zinc-700 bg-zinc-800 text-white"
                      />
                    </div>
                  )}

                  {editForm.paymentType === "in_house_payment_plan" && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-zinc-300">Down Payment (Collected Today)</Label>
                        <Input
                          type="number" step="0.01" min="0"
                          value={editForm.downPayment ?? ""}
                          onChange={(e) => setEditForm({ ...editForm, downPayment: e.target.value })}
                          className="border-zinc-700 bg-zinc-800 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-zinc-300">Monthly Payment Amount</Label>
                        <Input
                          type="number" step="0.01" min="0"
                          value={editForm.monthlyAmount ?? ""}
                          onChange={(e) => setEditForm({ ...editForm, monthlyAmount: e.target.value })}
                          className="border-zinc-700 bg-zinc-800 text-white"
                        />
                      </div>
                    </>
                  )}

                  {editForm.paymentType === "bnpl" && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-zinc-300">Charged via BNPL (gross)</Label>
                        <Input
                          type="number" step="0.01" min="0"
                          value={editForm.newCashCollected ?? ""}
                          onChange={(e) => setEditForm({ ...editForm, newCashCollected: e.target.value })}
                          className="border-zinc-700 bg-zinc-800 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-zinc-300">BNPL Fee</Label>
                        <Input
                          type="number" step="0.01" min="0"
                          value={editForm.bnplFee ?? ""}
                          onChange={(e) => setEditForm({ ...editForm, bnplFee: e.target.value })}
                          className="border-zinc-700 bg-zinc-800 text-white"
                        />
                      </div>
                    </>
                  )}

                </div>

                {/* Live recap of what will be saved as cash collected */}
                {editForm.paymentType === "bnpl" && (
                  <p className="text-xs text-zinc-400">
                    Cash that will be saved: <span className="text-[#c7ab77] font-semibold">
                      ${Math.max(0, (parseFloat(editForm.newCashCollected) || 0) - (parseFloat(editForm.bnplFee) || 0)).toFixed(2)}
                    </span> (gross − fee)
                  </p>
                )}
              </div>

              {/* DocuSign gate — closer flips this when contract is signed.
                  Until it's true, no commission is calculated for this deal. */}
              <div className="rounded-lg border-2 border-amber-500/40 bg-amber-500/5 p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox
                    checked={!!editForm.docusignSigned}
                    onCheckedChange={(c) => setEditForm({ ...editForm, docusignSigned: !!c })}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <p className="font-semibold text-white text-sm">DocuSign signed by the client</p>
                    <p className="text-xs text-zinc-400 mt-1">
                      Commission is only calculated once this is checked. If the
                      client never signs, the deal stays at $0 commission.
                    </p>
                  </div>
                </label>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label className="text-zinc-300">Notes</Label>
                <Textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="min-h-[80px] border-zinc-700 bg-zinc-800 text-white"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setEditingDeal(null)}
                className="border-zinc-700"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveDeal}
                disabled={updateDealMutation.isPending}
                className="bg-[#c7ab77] text-black hover:bg-[#b89a66]"
              >
                <Save className="h-4 w-4 mr-2" />
                {updateDealMutation.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Client Details Dialog */}
        <Dialog open={!!viewingDeal} onOpenChange={() => setViewingDeal(null)}>
          <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <User className="h-5 w-5 text-[#c7ab77]" />
                {viewingDeal?.clientName}
              </DialogTitle>
              <DialogDescription>
                Complete deal information and payment details
              </DialogDescription>
            </DialogHeader>
            
            {viewingDeal && (
              <div className="space-y-6 py-4">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-zinc-400 text-xs">Deal Date</Label>
                    <p className="text-white flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-[#c7ab77]" />
                      {format(new Date(viewingDeal.dealDate), "MMMM d, yyyy")}
                    </p>
                  </div>
                  <div className="space-y-1">

                  </div>
                </div>

                {/* Status Badges */}
                <div className="flex flex-wrap gap-2">
                  <Badge variant={viewingDeal.showed ? "default" : "outline"} className={viewingDeal.showed ? "bg-green-600" : ""}>
                    {viewingDeal.showed ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                    Showed
                  </Badge>
                  <Badge variant={viewingDeal.prepared ? "default" : "outline"} className={viewingDeal.prepared ? "bg-green-600" : ""}>
                    {viewingDeal.prepared ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                    Prepared
                  </Badge>
                  <Badge variant={viewingDeal.closed ? "default" : "outline"} className={viewingDeal.closed ? "bg-green-600" : ""}>
                    {viewingDeal.closed ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                    Closed
                  </Badge>
                  <Badge variant={viewingDeal.fullyPaid ? "default" : "outline"} className={viewingDeal.fullyPaid ? "bg-[#c7ab77] text-black" : ""}>
                    {viewingDeal.fullyPaid ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
                    {viewingDeal.fullyPaid ? "Fully Paid" : "Payment Pending"}
                  </Badge>
                </div>

                {/* Financial Details */}
                <div className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-4 space-y-4">
                  <h4 className="font-medium text-white flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-[#c7ab77]" />
                    Financial Details
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <Label className="text-zinc-400 text-xs">Total Deal Amount</Label>
                      <p className="text-white font-medium">{formatCurrency(viewingDeal.totalDealAmount)}</p>
                    </div>
                    <div>
                      <Label className="text-zinc-400 text-xs">Cash Collected</Label>
                      <p className="text-[#c7ab77] font-medium">{formatCurrency(viewingDeal.newCashCollected)}</p>
                    </div>
                    <div>
                      <Label className="text-zinc-400 text-xs">Closer Commission</Label>
                      <p className="text-green-400 font-medium">{formatCurrency(viewingDeal.closerCommission)}</p>
                    </div>
                    <div>

                    </div>
                  </div>
                </div>

                {/* Payment Type Details */}
                <div className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-4 space-y-4">
                  <h4 className="font-medium text-white flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-[#c7ab77]" />
                    Payment Information
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="text-zinc-400 text-xs">Payment Type</Label>
                      <p className="text-white font-medium capitalize">
                        {viewingDeal.paymentType?.replace("_", " ") || "Not specified"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-zinc-400 text-xs">Processor</Label>
                      <p className="text-white font-medium">
                        {viewingDeal.paymentProcessor || "N/A"}
                      </p>
                    </div>
                    {(viewingDeal.paymentType === "payment_plan" || viewingDeal.paymentType === "in_house_payment_plan") && (
                      <>
                        <div>
                          <Label className="text-zinc-400 text-xs">Down Payment</Label>
                          <p className="text-[#c7ab77] font-medium">{formatCurrency(viewingDeal.downPayment)}</p>
                        </div>
                        <div>
                          <Label className="text-zinc-400 text-xs">Monthly Amount</Label>
                          <p className="text-white font-medium">{formatCurrency(viewingDeal.monthlyAmount)}</p>
                        </div>
                        <div>
                          <Label className="text-zinc-400 text-xs">Payment Progress</Label>
                          <p className="text-white font-medium">
                            {viewingDeal.paymentMonth || 0} of {viewingDeal.totalMonths || 0} payments
                          </p>
                        </div>
                        <div>
                          <Label className="text-zinc-400 text-xs">Total Collected</Label>
                          <p className="text-green-400 font-medium">{formatCurrency(viewingDeal.totalCollected)}</p>
                        </div>
                      </>
                    )}
                    {viewingDeal.paymentType === "bnpl" && viewingDeal.bnplFee && (
                      <>
                        <div>
                          <Label className="text-zinc-400 text-xs">BNPL Fee</Label>
                          <p className="text-red-400 font-medium">{formatCurrency(viewingDeal.bnplFee)}</p>
                        </div>
                        <div>
                          <Label className="text-zinc-400 text-xs">Net Cash (After Fee)</Label>
                          <p className="text-[#c7ab77] font-medium">
                            {formatCurrency(
                              parseFloat(viewingDeal.newCashCollected || "0") -
                              parseFloat(viewingDeal.bnplFee || "0")
                            )}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Notes */}
                {viewingDeal.notes && (
                  <div className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-4 space-y-2">
                    <h4 className="font-medium text-white flex items-center gap-2">
                      <FileText className="h-4 w-4 text-[#c7ab77]" />
                      Notes
                    </h4>
                    <p className="text-zinc-300 text-sm whitespace-pre-wrap">{viewingDeal.notes}</p>
                  </div>
                )}
              </div>
            )}
            
            <DialogFooter className="flex justify-between sm:justify-between">
              <Button
                variant="destructive"
                onClick={() => setDeletingDeal(viewingDeal)}
                className="mr-auto"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setViewingDeal(null)}
                  className="border-zinc-700"
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setEditForm({
                      clientName: viewingDeal?.clientName || "",
                      dealDate: viewingDeal?.dealDate || "",
                      setterId: viewingDeal?.setterId,
                      totalDealAmount: viewingDeal?.totalDealAmount || "",
                      newCashCollected: viewingDeal?.newCashCollected || "",
                      notes: viewingDeal?.notes || "",
                    });
                    setIsEditMode(true);
                  }}
                  className="bg-[#c7ab77] text-black hover:bg-[#b89a66]"
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit Deal
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Deal Dialog */}
        <Dialog open={isEditMode} onOpenChange={() => setIsEditMode(false)}>
          <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-white">Edit Deal</DialogTitle>
              <DialogDescription>
                Update the deal information. Commission will be recalculated automatically.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-zinc-300">Client Name</Label>
                <Input
                  value={editForm.clientName || ""}
                  onChange={(e) => setEditForm({ ...editForm, clientName: e.target.value })}
                  className="border-zinc-700 bg-zinc-800 text-white"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-zinc-300">Deal Date</Label>
                <Input
                  type="date"
                  value={editForm.dealDate || ""}
                  onChange={(e) => setEditForm({ ...editForm, dealDate: e.target.value })}
                  className="border-zinc-700 bg-zinc-800 text-white"
                />
              </div>
              

              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-zinc-300">Total Deal Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editForm.totalDealAmount || ""}
                    onChange={(e) => setEditForm({ ...editForm, totalDealAmount: e.target.value })}
                    className="border-zinc-700 bg-zinc-800 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-300">New Cash Collected</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editForm.newCashCollected || ""}
                    onChange={(e) => setEditForm({ ...editForm, newCashCollected: e.target.value })}
                    className="border-zinc-700 bg-zinc-800 text-white"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-zinc-300">Notes</Label>
                <Textarea
                  value={editForm.notes || ""}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  placeholder="Add notes about this deal..."
                  className="min-h-[80px] border-zinc-700 bg-zinc-800 text-white"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsEditMode(false)}
                className="border-zinc-700"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!viewingDeal) return;
                  updateDealMutation.mutate({
                    id: viewingDeal.id,
                    clientName: editForm.clientName,
                    dealDate: editForm.dealDate,
                    setterId: editForm.setterId,
                    totalDealAmount: parseFloat(editForm.totalDealAmount) || 0,
                    newCashCollected: parseFloat(editForm.newCashCollected) || 0,
                    existingCashCollected: 0,
                    notes: editForm.notes,
                  });
                }}
                disabled={updateDealMutation.isPending}
                className="bg-[#c7ab77] text-black hover:bg-[#b89a66]"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deletingDeal} onOpenChange={() => setDeletingDeal(null)}>
          <AlertDialogContent className="bg-zinc-900 border-zinc-800">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Delete Deal
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the deal for <strong className="text-white">{deletingDeal?.clientName}</strong>?
                This will also remove any associated payment plan entries. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-zinc-700">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deletingDeal) {
                    deleteDealMutation.mutate({ id: deletingDeal.id });
                  }
                }}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete Deal
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Collect Payment Confirmation Dialog */}
        <AlertDialog open={!!collectingPayment} onOpenChange={() => setCollectingPayment(null)}>
          <AlertDialogContent className="bg-zinc-900 border-zinc-800">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-500" />
                Collect Payment
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>Confirm payment collection for <strong className="text-white">{collectingPayment?.clientName}</strong></p>
                <div className="bg-zinc-800 rounded-lg p-3 mt-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Payment Amount:</span>
                    <span className="text-green-400 font-medium">${parseFloat(collectingPayment?.monthlyAmount || "0").toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-zinc-400">Payment:</span>
                    <span className="text-white">{collectingPayment?.paymentMonth} of {collectingPayment?.totalMonths}</span>
                  </div>
                  {collectingPayment?.paymentMonth < collectingPayment?.totalMonths && (
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-zinc-400">Remaining:</span>
                      <span className="text-zinc-300">{collectingPayment?.totalMonths - collectingPayment?.paymentMonth} more payments</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                  This will mark the payment as collected and create the next month's entry (if applicable).
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-zinc-700">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (collectingPayment) {
                    collectPaymentMutation.mutate({
                      dealId: collectingPayment.id,
                      amountCollected: parseFloat(collectingPayment.monthlyAmount || "0"),
                    });
                  }
                }}
                disabled={collectPaymentMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {collectPaymentMutation.isPending ? "Processing..." : "Confirm Collection"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
