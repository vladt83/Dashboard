import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, CheckCircle, DollarSign, User, AlertCircle } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

export default function PaymentPlans() {
  const { user } = useAuth();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedCloserId, setSelectedCloserId] = useState<string>("all");
  
  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    dealId: number | null;
    clientName: string;
    amount: number;
    paymentMonth: number;
    totalMonths: number;
  }>({
    open: false,
    dealId: null,
    clientName: "",
    amount: 0,
    paymentMonth: 0,
    totalMonths: 0,
  });

  const utils = trpc.useUtils();

  // Get all team members for filter
  const { data: teamMembers } = trpc.team.getAll.useQuery();
  const closers = useMemo(() => 
    teamMembers?.filter((m: { role: string }) => m.role === "closer") || [],
    [teamMembers]
  );

  // Get pending payment plan entries
  const { data: pendingPayments, isLoading } = trpc.deals.getPendingPaymentPlans.useQuery({
    year: selectedYear,
    month: selectedMonth,
    closerId: selectedCloserId === "all" ? undefined : parseInt(selectedCloserId),
  });

  // Collect payment mutation
  const collectMutation = trpc.deals.collectPaymentPlanPayment.useMutation({
    onSuccess: () => {
      toast.success("Payment marked as collected");
      utils.deals.getPendingPaymentPlans.invalidate();
      setConfirmDialog({ ...confirmDialog, open: false });
    },
    onError: (error) => {
      toast.error("Failed to collect payment: " + error.message);
    },
  });

  const handleCollectClick = (deal: {
    id: number;
    clientName: string;
    monthlyAmount: string;
    paymentMonth: number;
    totalMonths: number;
  }) => {
    setConfirmDialog({
      open: true,
      dealId: deal.id,
      clientName: deal.clientName,
      amount: parseFloat(deal.monthlyAmount || "0"),
      paymentMonth: deal.paymentMonth || 0,
      totalMonths: deal.totalMonths || 0,
    });
  };

  const handleConfirmCollect = () => {
    if (!confirmDialog.dealId) return;
    collectMutation.mutate({
      dealId: confirmDialog.dealId,
      amountCollected: confirmDialog.amount,
    });
  };

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const isAdmin = user?.role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="hidden md:block">
          <h1 className="text-3xl font-bold tracking-tight text-primary">Payment Plans</h1>
          <p className="text-muted-foreground">Track and collect recurring payment plan payments</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((month, idx) => (
                <SelectItem key={idx + 1} value={(idx + 1).toString()}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2025, 2026, 2027].map(year => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isAdmin && (
            <Select value={selectedCloserId} onValueChange={setSelectedCloserId}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Closers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Closers</SelectItem>
                {closers.map((closer: { id: number; name: string }) => (
                  <SelectItem key={closer.id} value={closer.id.toString()}>
                    {closer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {pendingPayments?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Due this month</p>
          </CardContent>
        </Card>
        
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expected Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              ${pendingPayments?.reduce((sum, p) => sum + parseFloat(p.monthlyAmount || "0"), 0).toLocaleString() || "0"}
            </div>
            <p className="text-xs text-muted-foreground">If all payments collected</p>
          </CardContent>
        </Card>
        
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unique Clients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {new Set(pendingPayments?.map(p => p.clientName)).size || 0}
            </div>
            <p className="text-xs text-muted-foreground">With active payment plans</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Payments List */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Pending Payments for {months[selectedMonth - 1]} {selectedYear}
          </CardTitle>
          <CardDescription>
            Click "Mark Paid" to collect a payment and generate the next month's entry
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : !pendingPayments?.length ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No pending payment plan payments for this month</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg border border-border/50 bg-background/50 gap-4"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{payment.clientName}</span>
                      <Badge variant="outline" className="text-xs">
                        Payment {payment.paymentMonth} of {payment.totalMonths}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        ${parseFloat(payment.monthlyAmount || "0").toLocaleString()}
                      </span>
                      <span>Due: {payment.dealDate}</span>
                      {payment.closerName && (
                        <span>Closer: {payment.closerName}</span>
                      )}
                    </div>
                  </div>
                  
                  <Button
                    onClick={() => handleCollectClick({
                      id: payment.id,
                      clientName: payment.clientName,
                      monthlyAmount: payment.monthlyAmount || "0",
                      paymentMonth: payment.paymentMonth || 0,
                      totalMonths: payment.totalMonths || 0,
                    })}
                    className="bg-green-600 hover:bg-green-700"
                    disabled={collectMutation.isPending}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark Paid
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Payment Collection</DialogTitle>
            <DialogDescription>
              Are you sure you want to mark this payment as collected?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Client:</span>
                <p className="font-medium">{confirmDialog.clientName}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Amount:</span>
                <p className="font-medium text-green-500">${confirmDialog.amount.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Payment:</span>
                <p className="font-medium">{confirmDialog.paymentMonth} of {confirmDialog.totalMonths}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Remaining:</span>
                <p className="font-medium">{confirmDialog.totalMonths - confirmDialog.paymentMonth} payments</p>
              </div>
            </div>
            
            <div className="p-3 bg-muted/50 rounded-lg text-sm">
              <p className="text-muted-foreground">
                This will mark the payment as collected, calculate commissions, and 
                {confirmDialog.paymentMonth < confirmDialog.totalMonths 
                  ? " create the next month's payment entry."
                  : " mark the payment plan as fully paid."}
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}
              disabled={collectMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmCollect}
              className="bg-green-600 hover:bg-green-700"
              disabled={collectMutation.isPending}
            >
              {collectMutation.isPending ? "Processing..." : "Confirm Collection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
