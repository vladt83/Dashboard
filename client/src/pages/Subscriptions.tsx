import { useState, useMemo } from "react";
import { trpc } from "../lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Plus,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  DollarSign,
  Users,
  RefreshCw,
  ShieldCheck,
  Clock,
  Ban,
} from "lucide-react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export default function Subscriptions() {
  const { user } = useAuth();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newSub, setNewSub] = useState({
    clientName: "",
    monthlyAmount: "",
    closerId: "",
    notes: "",
  });

  const isAdmin = user?.role === "admin";
  const isPayroll = user?.role === "payroll" || isAdmin;

  // Queries
  const { data: allSubs, isLoading: subsLoading } = trpc.subscriptions.getAll.useQuery();
  const { data: teamMembers } = trpc.team.getAll.useQuery();
  const { data: verifications, isLoading: verifLoading, refetch: refetchVerifications } = trpc.subscriptions.getVerifications.useQuery({
    year: selectedYear,
    month: selectedMonth,
  });
  const { data: auditSubs } = trpc.subscriptions.getRandomForAudit.useQuery({ count: 5 });

  const closers = useMemo(() => teamMembers?.filter((m: any) => m.role === "closer") || [], [teamMembers]);

  // Mutations
  const utils = trpc.useUtils();
  const createMutation = trpc.subscriptions.create.useMutation({
    onSuccess: () => {
      toast.success("Subscription created");
      setShowAddDialog(false);
      setNewSub({ clientName: "", monthlyAmount: "", closerId: "", notes: "" });
      utils.subscriptions.getAll.invalidate();
      utils.subscriptions.getVerifications.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const verifyMutation = trpc.subscriptions.verify.useMutation({
    onSuccess: () => {
      toast.success("Subscriber confirmed in group. Commission added.");
      utils.subscriptions.getVerifications.invalidate();
    },
  });

  const unverifyMutation = trpc.subscriptions.unverify.useMutation({
    onSuccess: () => {
      toast.success("Verification removed.");
      utils.subscriptions.getVerifications.invalidate();
    },
  });

  const cancelMutation = trpc.subscriptions.markCancelled.useMutation({
    onSuccess: () => {
      toast.error("Subscription cancelled. Closer has been notified.");
      utils.subscriptions.getVerifications.invalidate();
      utils.subscriptions.getAll.invalidate();
    },
  });

  const reactivateMutation = trpc.subscriptions.reactivate.useMutation({
    onSuccess: () => {
      toast.success("Subscription reactivated.");
      utils.subscriptions.getAll.invalidate();
      utils.subscriptions.getVerifications.invalidate();
    },
  });

  // Build verification data with subscription info
  const verificationData = useMemo(() => {
    if (!verifications || !allSubs) return [];
    return verifications.map((v: any) => {
      const sub = allSubs.find((s: any) => s.id === v.subscriptionId);
      const closer = teamMembers?.find((m: any) => m.id === sub?.closerId);
      return { ...v, subscription: sub, closerName: closer?.name || "Unknown" };
    });
  }, [verifications, allSubs, teamMembers]);

  const verifiedCount = verificationData.filter((v: any) => v.isVerified).length;
  const pendingCount = verificationData.filter((v: any) => !v.isVerified && !v.isCancelled).length;
  const cancelledCount = verificationData.filter((v: any) => v.isCancelled).length;
  const totalCommission = verificationData
    .filter((v: any) => v.isVerified)
    .reduce((sum: number, v: any) => sum + parseFloat(v.commissionAmount || "0"), 0);

  const handleCreate = () => {
    if (!newSub.clientName || !newSub.monthlyAmount || !newSub.closerId) {
      toast.error("Please fill in all required fields.");
      return;
    }
    createMutation.mutate({
      clientName: newSub.clientName,
      monthlyAmount: parseFloat(newSub.monthlyAmount),
      closerId: parseInt(newSub.closerId),
      startDate: `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`,
      startMonth: selectedMonth,
      startYear: selectedYear,
      notes: newSub.notes || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gold-gradient">Subscriptions</h1>
          <p className="text-muted-foreground">Monthly recurring subscriptions — 25% closer commission</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2025, 2026, 2027].map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isAdmin && (
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-primary-foreground">
                  <Plus className="h-4 w-4 mr-2" /> Add Subscription
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Subscription</DialogTitle>
                  <DialogDescription>Add a new monthly subscriber. The closer who signed them up will earn 25% commission each month.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Client Name *</Label>
                    <Input
                      placeholder="e.g., John Smith"
                      value={newSub.clientName}
                      onChange={(e) => setNewSub({ ...newSub, clientName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Monthly Amount *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="e.g., 200"
                      value={newSub.monthlyAmount}
                      onChange={(e) => setNewSub({ ...newSub, monthlyAmount: e.target.value })}
                    />
                    {newSub.monthlyAmount && (
                      <p className="text-xs text-muted-foreground">
                        Closer earns {formatCurrency(parseFloat(newSub.monthlyAmount || "0") * 0.25)}/month (25%)
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Signed Up By (Closer) *</Label>
                    <Select value={newSub.closerId} onValueChange={(v) => setNewSub({ ...newSub, closerId: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select closer" />
                      </SelectTrigger>
                      <SelectContent>
                        {closers.map((c: any) => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Input
                      placeholder="Optional notes"
                      value={newSub.notes}
                      onChange={(e) => setNewSub({ ...newSub, notes: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
                  <Button onClick={handleCreate} disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Add Subscription"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="stat-card">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">Active Subscriptions</p>
                <p className="stat-value text-primary">{allSubs?.filter((s: any) => s.active).length || 0}</p>
              </div>
              <Users className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">Verified This Month</p>
                <p className="stat-value text-green-400">{verifiedCount}</p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">Pending Verification</p>
                <p className="stat-value text-yellow-400">{pendingCount}</p>
              </div>
              <Clock className="h-5 w-5 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">Commission This Month</p>
                <p className="stat-value text-primary">{formatCurrency(totalCommission)}</p>
              </div>
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="verify" className="space-y-4">
        <TabsList>
          <TabsTrigger value="verify">Monthly Verification</TabsTrigger>
          <TabsTrigger value="all">All Subscriptions</TabsTrigger>
          {isPayroll && <TabsTrigger value="audit">Integrity Audit</TabsTrigger>}
        </TabsList>

        {/* Monthly Verification Tab */}
        <TabsContent value="verify" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    {MONTHS[selectedMonth - 1]} {selectedYear} Verification
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Confirm each subscriber is still in the group. Verified = 25% commission paid to closer.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetchVerifications()}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {verifLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : verificationData.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No active subscriptions for this month.</p>
                  <p className="text-sm mt-1">Add subscriptions to start tracking.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Table Header */}
                  <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <div className="col-span-3">Subscriber</div>
                    <div className="col-span-2">Closer</div>
                    <div className="col-span-2 text-right">Monthly</div>
                    <div className="col-span-2 text-right">Commission (25%)</div>
                    <div className="col-span-3 text-right">Status / Actions</div>
                  </div>
                  {verificationData.map((v: any) => (
                    <div
                      key={v.id}
                      className={`grid grid-cols-12 gap-4 items-center px-4 py-3 rounded-lg transition-all ${
                        v.isVerified
                          ? "bg-green-900/20 border border-green-500/30"
                          : v.isCancelled
                          ? "bg-red-900/20 border border-red-500/30"
                          : "bg-secondary/50 border border-transparent hover:border-primary/30"
                      }`}
                    >
                      <div className="col-span-3">
                        <p className="font-medium">{v.subscription?.clientName || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">
                          Since {MONTHS[(v.subscription?.startMonth || 1) - 1]} {v.subscription?.startYear}
                        </p>
                      </div>
                      <div className="col-span-2 text-sm">{v.closerName}</div>
                      <div className="col-span-2 text-right font-medium">
                        {formatCurrency(parseFloat(v.subscription?.monthlyAmount || "0"))}
                      </div>
                      <div className="col-span-2 text-right font-bold text-primary">
                        {v.isVerified ? formatCurrency(parseFloat(v.commissionAmount || "0")) : "—"}
                      </div>
                      <div className="col-span-3 flex items-center justify-end gap-2">
                        {v.isCancelled ? (
                          <span className="flex items-center gap-1 text-sm text-red-400">
                            <Ban className="h-4 w-4" /> Cancelled
                          </span>
                        ) : v.isVerified ? (
                          <>
                            <span className="flex items-center gap-1 text-sm text-green-400">
                              <CheckCircle2 className="h-4 w-4" /> Verified
                            </span>
                            {isPayroll && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs text-muted-foreground"
                                onClick={() => unverifyMutation.mutate({ verificationId: v.id })}
                              >
                                Undo
                              </Button>
                            )}
                          </>
                        ) : isPayroll ? (
                          <>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => verifyMutation.mutate({ verificationId: v.id })}
                              disabled={verifyMutation.isPending}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" /> In Group
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                if (confirm(`Cancel ${v.subscription?.clientName}'s subscription? The closer will be notified.`)) {
                                  cancelMutation.mutate({ verificationId: v.id });
                                }
                              }}
                              disabled={cancelMutation.isPending}
                            >
                              <XCircle className="h-4 w-4 mr-1" /> Not In Group
                            </Button>
                          </>
                        ) : (
                          <span className="flex items-center gap-1 text-sm text-yellow-400">
                            <Clock className="h-4 w-4" /> Pending
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Subscriptions Tab */}
        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>All Subscriptions</CardTitle>
              <p className="text-sm text-muted-foreground">Complete list of all subscriptions (active and cancelled)</p>
            </CardHeader>
            <CardContent>
              {subsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : !allSubs || allSubs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No subscriptions yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <div className="col-span-3">Client</div>
                    <div className="col-span-2">Closer</div>
                    <div className="col-span-2 text-right">Monthly</div>
                    <div className="col-span-2 text-right">Commission</div>
                    <div className="col-span-1">Status</div>
                    <div className="col-span-2 text-right">Actions</div>
                  </div>
                  {allSubs.map((sub: any) => {
                    const closer = teamMembers?.find((m: any) => m.id === sub.closerId);
                    return (
                      <div
                        key={sub.id}
                        className={`grid grid-cols-12 gap-4 items-center px-4 py-3 rounded-lg ${
                          sub.active ? "bg-secondary/50" : "bg-red-900/10 opacity-60"
                        }`}
                      >
                        <div className="col-span-3">
                          <p className="font-medium">{sub.clientName}</p>
                          <p className="text-xs text-muted-foreground">Started {sub.startDate}</p>
                        </div>
                        <div className="col-span-2 text-sm">{closer?.name || "Unknown"}</div>
                        <div className="col-span-2 text-right font-medium">
                          {formatCurrency(parseFloat(sub.monthlyAmount || "0"))}
                        </div>
                        <div className="col-span-2 text-right text-primary font-bold">
                          {formatCurrency(parseFloat(sub.monthlyAmount || "0") * 0.25)}
                        </div>
                        <div className="col-span-1">
                          {sub.active ? (
                            <span className="text-xs bg-green-900/30 text-green-400 px-2 py-1 rounded-full">Active</span>
                          ) : (
                            <span className="text-xs bg-red-900/30 text-red-400 px-2 py-1 rounded-full">Cancelled</span>
                          )}
                        </div>
                        <div className="col-span-2 text-right">
                          {!sub.active && isAdmin && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => reactivateMutation.mutate({ id: sub.id })}
                              disabled={reactivateMutation.isPending}
                            >
                              <RefreshCw className="h-3 w-3 mr-1" /> Reactivate
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrity Audit Tab */}
        {isPayroll && (
          <TabsContent value="audit" className="space-y-4">
            <Card className="border-yellow-500/30">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-400" />
                  <CardTitle>Monthly Integrity Audit</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground">
                  Spot-check 5 random subscribers to verify salespeople are maintaining integrity.
                  Confirm these people are actually in the group.
                </p>
              </CardHeader>
              <CardContent>
                {!auditSubs || auditSubs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No active subscriptions to audit.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {auditSubs.map((sub: any, index: number) => {
                      const closer = teamMembers?.find((m: any) => m.id === sub.closerId);
                      return (
                        <div key={sub.id} className="flex items-center gap-4 p-4 bg-secondary/50 rounded-lg">
                          <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold text-sm">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{sub.clientName}</p>
                            <p className="text-xs text-muted-foreground">
                              Signed up by {closer?.name || "Unknown"} — {formatCurrency(parseFloat(sub.monthlyAmount || "0"))}/mo
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">Since {sub.startDate}</p>
                        </div>
                      );
                    })}
                    <p className="text-xs text-muted-foreground text-center mt-4">
                      Refresh the page to get a new random set of subscribers to audit.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
