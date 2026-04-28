import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { 
  ChevronLeft, 
  ChevronRight, 
  DollarSign, 
  Loader2,
  Wallet,
  Users,
  CheckCircle,
  AlertCircle,
  Plus,
  Minus,
  Gift,
  Trash2
} from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useLocation } from "wouter";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

interface PayrollMember {
  id: number;
  name: string;
  role: string;
  baseCommission: number;
  bonuses: number;
  deductions: number;
  totalCommission: number;
  paid: number;
  owed: number;
  adjustments: Array<{
    id: number;
    amount: string;
    type: "bonus" | "deduction";
    reason: string;
    createdAt: Date;
  }>;
}

export default function Payouts() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const isAdmin = user?.role === "admin";
  const isPayroll = user?.role === "payroll";
  const hasPayrollAccess = isAdmin || isPayroll;
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<PayrollMember | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(format(new Date(), "yyyy-MM-dd"));
  
  // Adjustment form state
  const [adjustmentType, setAdjustmentType] = useState<"bonus" | "deduction">("bonus");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [adjustmentMemberId, setAdjustmentMemberId] = useState<number | null>(null);

  const utils = trpc.useUtils();

  // Fetch team members
  const { data: allTeamMembers } = trpc.team.getAll.useQuery();

  // Fetch stats
  const { data: monthlyStats, isLoading: statsLoading } = trpc.stats.getMonthly.useQuery({
    year: selectedYear,
    month: selectedMonth,
  });

  const { data: closerLeaderboard } = trpc.stats.getCloserLeaderboard.useQuery({
    year: selectedYear,
    month: selectedMonth,
  });


  // Fetch adjustments for the month
  const { data: monthAdjustments } = trpc.adjustments.getByMonth.useQuery({
    year: selectedYear,
    month: selectedMonth,
  });

  // Mutations
  const createAdjustment = trpc.adjustments.create.useMutation({
    onSuccess: () => {
      toast.success("Adjustment added successfully");
      utils.adjustments.getByMonth.invalidate();
      utils.stats.getCloserLeaderboard.invalidate();
      setAdjustmentDialogOpen(false);
      resetAdjustmentForm();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add adjustment");
    },
  });

  const deleteAdjustment = trpc.adjustments.delete.useMutation({
    onSuccess: () => {
      toast.success("Adjustment removed");
      utils.adjustments.getByMonth.invalidate();
      utils.stats.getCloserLeaderboard.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to remove adjustment");
    },
  });

  // Navigation handlers
  const goToPreviousMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const resetAdjustmentForm = () => {
    setAdjustmentType("bonus");
    setAdjustmentAmount("");
    setAdjustmentReason("");
    setAdjustmentMemberId(null);
  };

  // Redirect users without payroll access
  if (!hasPayrollAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p className="text-muted-foreground mb-4">
          Only payroll administrators can access this page.
        </p>
        <Button onClick={() => setLocation("/")}>
          Go to Dashboard
        </Button>
      </div>
    );
  }

  // Calculate adjustments per member
  const getMemberAdjustments = (memberId: number) => {
    const memberAdj = monthAdjustments?.filter(a => a.memberId === memberId) || [];
    let bonuses = 0;
    let deductions = 0;
    
    for (const adj of memberAdj) {
      const amount = parseFloat(adj.amount || "0");
      if (adj.type === "bonus") {
        bonuses += amount;
      } else {
        deductions += amount;
      }
    }
    
    return { bonuses, deductions, adjustments: memberAdj };
  };

  // Build payroll data from leaderboards with adjustments
  const closerPayroll: PayrollMember[] = closerLeaderboard?.map(c => {
    const { bonuses, deductions, adjustments } = getMemberAdjustments(c.id);
    const totalCommission = c.closerCommission + bonuses - deductions;
    return {
      id: c.id,
      name: c.name,
      role: "closer",
      baseCommission: c.closerCommission,
      bonuses,
      deductions,
      totalCommission,
      paid: 0, // TODO: Track actual paid amounts
      owed: totalCommission,
      adjustments: adjustments as any,
    };
  }) || [];



  // Calculate totals
  const totalCloserCommission = closerPayroll.reduce((sum, c) => sum + c.totalCommission, 0);
  const totalCommission = totalCloserCommission;
  const totalBonuses = closerPayroll.reduce((sum, m) => sum + m.bonuses, 0);
  const totalDeductions = closerPayroll.reduce((sum, m) => sum + m.deductions, 0);

  const openPayDialog = (member: PayrollMember) => {
    setSelectedMember(member);
    setPayAmount(member.owed.toFixed(2));
    setPayDate(format(new Date(), "yyyy-MM-dd"));
    setPayDialogOpen(true);
  };

  const openAdjustmentDialog = (memberId?: number) => {
    if (memberId) {
      setAdjustmentMemberId(memberId);
    }
    setAdjustmentDialogOpen(true);
  };

  const handleMarkPaid = () => {
    // TODO: Implement actual payment recording
    toast.success(`Payment recorded for ${selectedMember?.name}`);
    setPayDialogOpen(false);
    setSelectedMember(null);
  };

  const handleAddAdjustment = () => {
    if (!adjustmentMemberId || !adjustmentAmount || !adjustmentReason) {
      toast.error("Please fill in all fields");
      return;
    }

    createAdjustment.mutate({
      memberId: adjustmentMemberId,
      amount: parseFloat(adjustmentAmount),
      type: adjustmentType,
      reason: adjustmentReason,
      month: selectedMonth,
      year: selectedYear,
    });
  };

  const handleDeleteAdjustment = (id: number) => {
    if (confirm("Are you sure you want to remove this adjustment?")) {
      deleteAdjustment.mutate({ id });
    }
  };

  const isLoading = statsLoading;

  // Get all team members for the dropdown
  const allMembers = [...(closerPayroll || [])];

  return (
    <div className="space-y-6">
      {/* Header with month navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="hidden md:block">
          <h1 className="text-2xl font-bold tracking-tight">Payroll</h1>
          <p className="text-muted-foreground">
            Manage commission payments for the team
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button onClick={() => openAdjustmentDialog()} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Bonus/Deduction
          </Button>
          
          <div className="flex items-center gap-2 bg-card border rounded-lg p-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={goToPreviousMonth}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="px-3 py-1 min-w-[140px] text-center font-medium">
              {MONTHS[selectedMonth - 1]} {selectedYear}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={goToNextMonth}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="stat-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payroll</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="stat-value text-primary">
              {isLoading ? "..." : formatCurrency(totalCommission)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Including adjustments
            </p>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bonuses</CardTitle>
            <Gift className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="stat-value text-green-500">
              {isLoading ? "..." : formatCurrency(totalBonuses)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Added this month
            </p>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deductions</CardTitle>
            <Minus className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="stat-value text-red-500">
              {isLoading ? "..." : formatCurrency(totalDeductions)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Subtracted this month
            </p>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="stat-value">
              {closerPayroll.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {closerPayroll.length} closers
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Closer Payroll */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Badge className="bg-primary">Closers</Badge>
            Commission Payroll
          </CardTitle>
          <CardDescription>
            {MONTHS[selectedMonth - 1]} {selectedYear} closer commissions with adjustments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {closerPayroll.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Base Commission</TableHead>
                    <TableHead className="text-right">Bonuses</TableHead>
                    <TableHead className="text-right">Deductions</TableHead>
                    <TableHead className="text-right">Total Owed</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {closerPayroll.map((member) => (
                    <>
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">{member.name}</TableCell>
                        <TableCell className="text-right">{formatCurrency(member.baseCommission)}</TableCell>
                        <TableCell className="text-right text-green-500">
                          {member.bonuses > 0 ? `+${formatCurrency(member.bonuses)}` : "-"}
                        </TableCell>
                        <TableCell className="text-right text-red-500">
                          {member.deductions > 0 ? `-${formatCurrency(member.deductions)}` : "-"}
                        </TableCell>
                        <TableCell className="text-right font-bold text-primary">
                          {formatCurrency(member.totalCommission)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => openAdjustmentDialog(member.id)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            {member.owed > 0 ? (
                              <Button size="sm" onClick={() => openPayDialog(member)}>
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Pay
                              </Button>
                            ) : (
                              <Badge variant="secondary">Paid</Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {/* Show adjustments for this member */}
                      {member.adjustments.length > 0 && member.adjustments.map((adj) => (
                        <TableRow key={`adj-${adj.id}`} className="bg-muted/30">
                          <TableCell colSpan={2} className="pl-8 text-sm text-muted-foreground">
                            <span className={adj.type === "bonus" ? "text-green-500" : "text-red-500"}>
                              {adj.type === "bonus" ? "↑ Bonus" : "↓ Deduction"}
                            </span>
                            : {adj.reason}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {adj.type === "bonus" && (
                              <span className="text-green-500">+{formatCurrency(parseFloat(adj.amount))}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {adj.type === "deduction" && (
                              <span className="text-red-500">-{formatCurrency(parseFloat(adj.amount))}</span>
                            )}
                          </TableCell>
                          <TableCell></TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteAdjustment(adj.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No closer commissions for this month</p>
            </div>
          )}
        </CardContent>
      </Card>



      {/* Pay Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record a payment for {selectedMember?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Payment Date</Label>
              <Input
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="pl-9"
                />
              </div>
              {selectedMember && (
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-xs"
                  onClick={() => setPayAmount(selectedMember.owed.toFixed(2))}
                >
                  Pay full amount: {formatCurrency(selectedMember.owed)}
                </Button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleMarkPaid}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjustment Dialog */}
      <Dialog open={adjustmentDialogOpen} onOpenChange={setAdjustmentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Bonus or Deduction</DialogTitle>
            <DialogDescription>
              Add a bonus or deduction for a team member. This will appear on their dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Team Member</Label>
              <Select
                value={adjustmentMemberId?.toString() || ""}
                onValueChange={(v) => setAdjustmentMemberId(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  {allMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id.toString()}>
                      {member.name} ({member.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={adjustmentType}
                onValueChange={(v) => setAdjustmentType(v as "bonus" | "deduction")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bonus">
                    <span className="flex items-center gap-2">
                      <Gift className="h-4 w-4 text-green-500" />
                      Bonus (Add)
                    </span>
                  </SelectItem>
                  <SelectItem value="deduction">
                    <span className="flex items-center gap-2">
                      <Minus className="h-4 w-4 text-red-500" />
                      Deduction (Subtract)
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={adjustmentAmount}
                  onChange={(e) => setAdjustmentAmount(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Reason (Required)</Label>
              <Textarea
                placeholder="Explain the reason for this adjustment..."
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                This explanation will be visible to the team member on their dashboard.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAdjustmentDialogOpen(false);
              resetAdjustmentForm();
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddAdjustment}
              disabled={createAdjustment.isPending}
            >
              {createAdjustment.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : adjustmentType === "bonus" ? (
                <Gift className="h-4 w-4 mr-2" />
              ) : (
                <Minus className="h-4 w-4 mr-2" />
              )}
              Add {adjustmentType === "bonus" ? "Bonus" : "Deduction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
