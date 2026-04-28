import { useState, Fragment } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  DollarSign,
  Users,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Minus,
  Building2,
  Briefcase,
  Megaphone,
  GraduationCap,
  CreditCard,
  AlertCircle,
  HelpCircle,
  Trash2,
  FileDown,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function PayrollDashboard() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();
  
  const [adjustmentDialog, setAdjustmentDialog] = useState<{
    open: boolean;
    memberId: number | null;
    memberName: string;
    type: "bonus" | "deduction";
  }>({ open: false, memberId: null, memberName: "", type: "bonus" });
  
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  
  // Add Employee Dialog State
  const [addEmployeeDialog, setAddEmployeeDialog] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    name: "",
    type: "closer" as "closer" | "setter" | "coach" | "on_demand_coach" | "w2" | "vendor",
    amount: "",
    paymentFrequency: "biweekly" as "biweekly" | "monthly",
    description: "",
    isAutopay: false
  });

  // Queries
  const { data: payrollSummary, refetch: refetchSummary } = trpc.payeePayments.getSummary.useQuery({ year, month });
  const { data: teamMembers } = trpc.team.getAll.useQuery();
  const { data: payees } = trpc.payees.getAll.useQuery();
  const { data: payeePayments, refetch: refetchPayeePayments } = trpc.payeePayments.getByMonth.useQuery({ year, month });
  const { data: adjustments } = trpc.adjustments.getByMonth.useQuery({ year, month });

  // Mutations
  const generatePayments = trpc.payeePayments.generate.useMutation({
    onSuccess: () => {
      toast.success("Payments generated for the month");
      refetchPayeePayments();
      refetchSummary();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const markPayeePaid = trpc.payeePayments.markPaid.useMutation({
    onSuccess: () => {
      toast.success("Payment marked as paid");
      refetchPayeePayments();
      refetchSummary();
    }
  });

  // Add employee/payee mutation
  const createPayee = trpc.payees.create.useMutation({
    onSuccess: () => {
      toast.success("Employee added successfully");
      setAddEmployeeDialog(false);
      setNewEmployee({ name: "", type: "closer", amount: "", paymentFrequency: "biweekly", description: "", isAutopay: false });
      refetchSummary();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  // Delete/deactivate payee state
  const [deletingPayee, setDeletingPayee] = useState<{ id: number; name: string } | null>(null);

  // Deactivate payee mutation
  const deactivatePayee = trpc.payees.deactivate.useMutation({
    onSuccess: () => {
      toast.success("Payee removed successfully");
      setDeletingPayee(null);
      refetchPayeePayments();
      refetchSummary();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to remove payee");
    }
  });

  // Toggle autopay mutation
  const toggleAutopay = trpc.paymentPlans.toggleAutopay.useMutation({
    onSuccess: () => {
      toast.success("Autopay setting updated");
      refetchPayeePayments();
    }
  });

  const createAdjustment = trpc.adjustments.create.useMutation({
    onSuccess: () => {
      toast.success(`${adjustmentDialog.type === "bonus" ? "Bonus" : "Deduction"} added successfully`);
      setAdjustmentDialog({ open: false, memberId: null, memberName: "", type: "bonus" });
      setAdjustmentAmount("");
      setAdjustmentReason("");
      refetchSummary();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const navigateMonth = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Calculate totals by category
  const salesPayroll = payrollSummary?.commissionBased?.reduce((sum, m) => sum + m.totalOwed, 0) || 0;
  const coachingPayroll = payeePayments?.filter(p => p.payee.type === "coach")
    .reduce((sum, p) => sum + parseFloat(p.amount?.toString() || "0"), 0) || 0;
  const marketingPayroll = payeePayments?.filter(p => p.payee.type === "vendor")
    .reduce((sum, p) => sum + parseFloat(p.amount?.toString() || "0"), 0) || 0;
  const operationsPayroll = payeePayments?.filter(p => p.payee.type === "w2")
    .reduce((sum, p) => sum + parseFloat(p.amount?.toString() || "0"), 0) || 0;
  
  const totalPayroll = salesPayroll + coachingPayroll + marketingPayroll + operationsPayroll;
  const totalPaid = (payrollSummary?.totalPaid || 0);
  const totalOwed = totalPayroll - totalPaid;

  const handleAddAdjustment = (memberId: number, memberName: string, type: "bonus" | "deduction") => {
    setAdjustmentDialog({ open: true, memberId, memberName, type });
  };

  const submitAdjustment = () => {
    if (!adjustmentDialog.memberId || !adjustmentAmount || !adjustmentReason) {
      toast.error("Please fill in all fields");
      return;
    }
    
    createAdjustment.mutate({
      memberId: adjustmentDialog.memberId,
      amount: parseFloat(adjustmentAmount),
      type: adjustmentDialog.type,
      reason: adjustmentReason,
      month,
      year
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header - hidden on mobile */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="hidden md:block">
            <h1 className="text-3xl font-bold text-white">Payroll Dashboard</h1>
            <p className="text-gray-400 mt-1">Manage all payments and compensation</p>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-lg font-semibold text-white min-w-[180px] text-center">{monthName}</span>
            <Button variant="outline" size="icon" onClick={() => navigateMonth(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ── Simple "what we are spending" overview ───────────────────── */}
        <Card className="bg-[#1a1a1a] border-[#c7ab77]/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-[#c7ab77]" />
                Monthly Spend Overview
              </CardTitle>
              <CardDescription className="text-gray-400">
                {monthName} — what we're paying out, by person
              </CardDescription>
            </div>
            <a
              href="/payroll-flow.pdf"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-md border border-[#c7ab77]/40 text-[#c7ab77] hover:bg-[#c7ab77]/10 transition-colors"
            >
              <FileDown className="h-3.5 w-3.5" />
              Download PDF
            </a>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border border-[#c7ab77]/20">
              <table className="w-full text-sm">
                <thead className="bg-[#0d0d0d]">
                  <tr>
                    <th className="text-left px-3 py-2.5 text-xs uppercase tracking-wider text-gray-400 font-medium">Person / Vendor</th>
                    <th className="text-left px-3 py-2.5 text-xs uppercase tracking-wider text-gray-400 font-medium">Role</th>
                    <th className="text-left px-3 py-2.5 text-xs uppercase tracking-wider text-gray-400 font-medium">Pay basis</th>
                    <th className="text-right px-3 py-2.5 text-xs uppercase tracking-wider text-gray-400 font-medium">{monthName.split(" ")[0]} cost</th>
                  </tr>
                </thead>
                <tbody>
                  {/* SALES — variable, per-person */}
                  <tr className="bg-[#c7ab77]/10">
                    <td colSpan={4} className="px-3 py-1.5 text-xs uppercase tracking-wider text-[#c7ab77] font-bold">
                      Sales — variable
                    </td>
                  </tr>
                  {payrollSummary?.commissionBased
                    ?.filter(m => m.role !== "payroll")
                    .map(m => (
                      <tr key={`sales-${m.memberId}`} className="border-t border-[#c7ab77]/10">
                        <td className="px-3 py-2.5 text-white font-medium">{m.name}</td>
                        <td className="px-3 py-2.5 text-gray-400 capitalize">{m.role}</td>
                        <td className="px-3 py-2.5 text-gray-400">
                          {m.role === "setter"
                            ? "3% × min(deal cash, $6,000) per one-time sale (no commission on subscriptions)"
                            : "10% of cash collected (15% Jan–Feb '26) + 25% on active subscriptions"}
                        </td>
                        <td className="px-3 py-2.5 text-right text-white font-semibold">
                          ${m.totalOwed.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}

                  {/* COACHING + W2 + VENDORS — comes from payeePayments */}
                  {[
                    { type: "coach" as const, label: "Coaching", basis: (p: any) =>
                        p.payee.type === "on_demand_coach"
                          ? "$0.90/min + $15/no-show, cap $2,000/mo"
                          : `$${parseFloat(p.amount).toLocaleString()} ${p.payee.paymentFrequency}` },
                    { type: "w2" as const, label: "Operations (W2)", basis: (p: any) =>
                        `$${parseFloat(p.amount).toLocaleString()} ${p.payee.paymentFrequency}` },
                    { type: "vendor" as const, label: "Marketing — vendors (autopay)", basis: (p: any) =>
                        `${p.payee.paymentFrequency} retainer (autopay)` },
                  ].map(group => {
                    const rows = (payeePayments ?? []).filter(p =>
                      group.type === "coach"
                        ? p.payee.type === "coach" || p.payee.type === "on_demand_coach"
                        : p.payee.type === group.type
                    );
                    if (rows.length === 0) return null;
                    return (
                      <Fragment key={group.type}>
                        <tr className="bg-[#c7ab77]/10">
                          <td colSpan={4} className="px-3 py-1.5 text-xs uppercase tracking-wider text-[#c7ab77] font-bold">
                            {group.label}
                          </td>
                        </tr>
                        {rows.map(p => (
                          <tr key={`${group.type}-${p.id}`} className="border-t border-[#c7ab77]/10">
                            <td className="px-3 py-2.5 text-white font-medium">{p.payee.name}</td>
                            <td className="px-3 py-2.5 text-gray-400 capitalize">{p.payee.type.replace(/_/g, " ")}</td>
                            <td className="px-3 py-2.5 text-gray-400">{group.basis(p)}</td>
                            <td className="px-3 py-2.5 text-right text-white font-semibold">
                              ${parseFloat(p.amount?.toString() || "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-[#c7ab77] text-black">
                    <td colSpan={3} className="px-3 py-3 font-bold uppercase tracking-wider text-sm">
                      Total spend — {monthName}
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-lg">
                      ${totalPayroll.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Sales commissions update in real time as deals close. Fixed costs (coaches, W2, vendors) are predictable. Click any row's tab below to mark a payment paid.
            </p>
          </CardContent>
        </Card>

        {/* Instructions Card - Collapsible */}
        <Collapsible>
          <Card className="bg-[#c7ab77]/10 border-[#c7ab77]/30">
            <CollapsibleTrigger className="w-full">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <HelpCircle className="h-5 w-5 text-[#c7ab77]" />
                    <span className="font-medium text-[#c7ab77]">Payroll Instructions</span>
                  </div>
                  <ChevronDown className="h-5 w-5 text-[#c7ab77] transition-transform duration-200" />
                </div>
              </CardContent>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 pb-4">
                <ul className="space-y-1 text-gray-400 text-sm ml-8">
                  <li>• Review all payments due for the pay period before processing</li>
                  <li>• Click "Generate Payments" at the start of each month to create payment entries</li>
                  <li>• Use the checkbox to mark payments as completed</li>
                  <li>• Add bonuses or deductions using the +/- buttons next to each team member</li>
                  <li>• Autopay items are automatically marked but still tracked here</li>
                </ul>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border-[#c7ab77]/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-[#c7ab77]" />
                Total Payroll
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">${totalPayroll.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              <p className="text-xs text-gray-500 mt-1">This month</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border-[#c7ab77]/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Paid Out
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              <p className="text-xs text-gray-500 mt-1">Completed</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border-[#c7ab77]/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                Remaining
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">${totalOwed.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              <p className="text-xs text-gray-500 mt-1">To be paid</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border-[#c7ab77]/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <Users className="h-4 w-4 text-[#c7ab77]" />
                People to Pay
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {(payrollSummary?.commissionBased?.length || 0) + (payees?.length || 0)}
              </div>
              <p className="text-xs text-gray-500 mt-1">Team members & vendors</p>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button 
            onClick={() => setAddEmployeeDialog(true)}
            className="bg-[#c7ab77] hover:bg-[#b89a66] text-black"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Employee/Vendor
          </Button>
        </div>

        {/* Generate Payments Button */}
        {(!payeePayments || payeePayments.length === 0) && (
          <Card className="bg-[#1a1a1a] border-[#c7ab77]/20">
            <CardContent className="py-6 text-center">
              <p className="text-gray-400 mb-4">No payments generated for {monthName} yet.</p>
              <Button 
                onClick={() => generatePayments.mutate({ year, month })}
                className="bg-[#c7ab77] hover:bg-[#b89a66] text-black"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Generate Payments for {monthName}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Payment Tabs */}
        <Tabs defaultValue="sales" className="space-y-4">
          <TabsList className="bg-[#1a1a1a] border border-[#c7ab77]/20">
            <TabsTrigger value="sales" className="data-[state=active]:bg-[#c7ab77] data-[state=active]:text-black">
              <Briefcase className="h-4 w-4 mr-2" />
              Sales (${salesPayroll.toLocaleString()})
            </TabsTrigger>
            <TabsTrigger value="coaching" className="data-[state=active]:bg-[#c7ab77] data-[state=active]:text-black">
              <GraduationCap className="h-4 w-4 mr-2" />
              Coaching (${coachingPayroll.toLocaleString()})
            </TabsTrigger>
            <TabsTrigger value="marketing" className="data-[state=active]:bg-[#c7ab77] data-[state=active]:text-black">
              <Megaphone className="h-4 w-4 mr-2" />
              Marketing (${marketingPayroll.toLocaleString()})
            </TabsTrigger>
            <TabsTrigger value="operations" className="data-[state=active]:bg-[#c7ab77] data-[state=active]:text-black">
              <Building2 className="h-4 w-4 mr-2" />
              Operations (${operationsPayroll.toLocaleString()})
            </TabsTrigger>
          </TabsList>

          {/* Sales Tab - Commission Based */}
          <TabsContent value="sales">
            <Card className="bg-[#1a1a1a] border-[#c7ab77]/20">
              <CardHeader>
                <CardTitle className="text-white">Sales Team Commissions</CardTitle>
                <CardDescription>Closers and setters paid based on performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {payrollSummary?.commissionBased?.map((member) => (
                    <div key={member.memberId} className="flex items-center justify-between p-4 bg-[#0d0d0d] rounded-lg border border-[#c7ab77]/10">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#c7ab77]/20 flex items-center justify-center">
                          <span className="text-[#c7ab77] font-semibold">{member.name.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="font-medium text-white">{member.name}</p>
                          <Badge variant="outline" className="text-xs capitalize border-[#c7ab77]/30 text-[#c7ab77]">
                            {member.role}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-sm text-gray-400">Owed</p>
                          <p className="font-semibold text-white">${member.totalOwed.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-400">Paid</p>
                          <p className="font-semibold text-green-500">${member.totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-green-500/30 text-green-500 hover:bg-green-500/10"
                            onClick={() => handleAddAdjustment(member.memberId, member.name, "bonus")}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-500/30 text-red-500 hover:bg-red-500/10"
                            onClick={() => handleAddAdjustment(member.memberId, member.name, "deduction")}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                        </div>
                        {member.isPaid ? (
                          <Badge className="bg-green-500/20 text-green-500">Paid</Badge>
                        ) : (
                          <Button size="sm" className="bg-[#c7ab77] hover:bg-[#b89a66] text-black">
                            Mark Paid
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  {(!payrollSummary?.commissionBased || payrollSummary.commissionBased.length === 0) && (
                    <p className="text-center text-gray-500 py-8">No sales commissions for this month</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Coaching Tab */}
          <TabsContent value="coaching">
            <div className="space-y-4">
              {/* Fixed Salary Coaches */}
              <Card className="bg-[#1a1a1a] border-[#c7ab77]/20">
                <CardHeader>
                  <CardTitle className="text-white">Fixed Salary Coaches</CardTitle>
                  <CardDescription>Coaches paid bi-weekly on a fixed salary</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {payeePayments?.filter(p => p.payee.type === "coach").map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between p-4 bg-[#0d0d0d] rounded-lg border border-[#c7ab77]/10">
                        <div className="flex items-center gap-4">
                          <Checkbox 
                            checked={payment.isPaid}
                            onCheckedChange={() => !payment.isPaid && markPayeePaid.mutate({ id: payment.id })}
                            className="border-[#c7ab77] data-[state=checked]:bg-[#c7ab77] data-[state=checked]:text-black"
                          />
                          <div>
                            <p className="font-medium text-white">{payment.payee.name}</p>
                            <p className="text-sm text-gray-400">{payment.payee.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm text-gray-400">Due: {payment.dueDate}</p>
                            <p className="font-semibold text-white">${parseFloat(payment.amount?.toString() || "0").toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                          </div>
                          {payment.isPaid ? (
                            <Badge className="bg-green-500/20 text-green-500">Paid</Badge>
                          ) : (
                            <Badge className="bg-yellow-500/20 text-yellow-500">Pending</Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingPayee({ id: payment.payee.id, name: payment.payee.name })}
                            className="text-zinc-500 hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {payeePayments?.filter(p => p.payee.type === "coach").length === 0 && (
                      <p className="text-center text-gray-500 py-8">No fixed salary coaching payments for this month</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* On-Demand Coaches - Session Based */}
              <OnDemandCoachPayroll year={year} month={month} monthName={monthName} />
            </div>
          </TabsContent>

          {/* Marketing Tab */}
          <TabsContent value="marketing">
            <Card className="bg-[#1a1a1a] border-[#c7ab77]/20">
              <CardHeader>
                <CardTitle className="text-white">Marketing & Vendors</CardTitle>
                <CardDescription>External vendors and marketing services</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {payeePayments?.filter(p => p.payee.type === "vendor").map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-4 bg-[#0d0d0d] rounded-lg border border-[#c7ab77]/10">
                      <div className="flex items-center gap-4">
                        <Checkbox 
                          checked={payment.isPaid}
                          onCheckedChange={() => !payment.isPaid && markPayeePaid.mutate({ id: payment.id })}
                          disabled={payment.payee.isAutopay}
                          className="border-[#c7ab77] data-[state=checked]:bg-[#c7ab77] data-[state=checked]:text-black"
                        />
                        <div>
                          <p className="font-medium text-white">{payment.payee.name}</p>
                          <p className="text-sm text-gray-400">{payment.payee.description}</p>
                        </div>
                        {payment.payee.isAutopay && (
                          <Badge variant="outline" className="border-blue-500/30 text-blue-500">Autopay</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-gray-400">Due: {payment.dueDate}</p>
                          <p className="font-semibold text-white">${parseFloat(payment.amount?.toString() || "0").toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                        </div>
                        {payment.isPaid ? (
                          <Badge className="bg-green-500/20 text-green-500">Paid</Badge>
                        ) : (
                          <Badge className="bg-yellow-500/20 text-yellow-500">Pending</Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingPayee({ id: payment.payee.id, name: payment.payee.name })}
                          className="text-zinc-500 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {payeePayments?.filter(p => p.payee.type === "vendor").length === 0 && (
                    <p className="text-center text-gray-500 py-8">No marketing payments for this month</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Operations Tab */}
          <TabsContent value="operations">
            <Card className="bg-[#1a1a1a] border-[#c7ab77]/20">
              <CardHeader>
                <CardTitle className="text-white">Operations Staff</CardTitle>
                <CardDescription>W2 employees paid bi-weekly</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {payeePayments?.filter(p => p.payee.type === "w2").map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-4 bg-[#0d0d0d] rounded-lg border border-[#c7ab77]/10">
                      <div className="flex items-center gap-4">
                        <Checkbox 
                          checked={payment.isPaid}
                          onCheckedChange={() => !payment.isPaid && markPayeePaid.mutate({ id: payment.id })}
                          className="border-[#c7ab77] data-[state=checked]:bg-[#c7ab77] data-[state=checked]:text-black"
                        />
                        <div>
                          <p className="font-medium text-white">{payment.payee.name}</p>
                          <p className="text-sm text-gray-400">W2 Employee</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-gray-400">Due: {payment.dueDate}</p>
                          <p className="font-semibold text-white">${parseFloat(payment.amount?.toString() || "0").toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                        </div>
                        {payment.isPaid ? (
                          <Badge className="bg-green-500/20 text-green-500">Paid</Badge>
                        ) : (
                          <Badge className="bg-yellow-500/20 text-yellow-500">Pending</Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingPayee({ id: payment.payee.id, name: payment.payee.name })}
                          className="text-zinc-500 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {payeePayments?.filter(p => p.payee.type === "w2").length === 0 && (
                    <p className="text-center text-gray-500 py-8">No operations payments for this month</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Adjustment Dialog */}
        <Dialog open={adjustmentDialog.open} onOpenChange={(open) => setAdjustmentDialog({ ...adjustmentDialog, open })}>
          <DialogContent className="bg-[#1a1a1a] border-[#c7ab77]/20">
            <DialogHeader>
              <DialogTitle className="text-white">
                Add {adjustmentDialog.type === "bonus" ? "Bonus" : "Deduction"} for {adjustmentDialog.memberName}
              </DialogTitle>
              <DialogDescription>
                This will {adjustmentDialog.type === "bonus" ? "add to" : "subtract from"} their commission for {monthName}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-gray-300">Amount ($)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={adjustmentAmount}
                  onChange={(e) => setAdjustmentAmount(e.target.value)}
                  placeholder="0.00"
                  className="bg-[#0d0d0d] border-[#c7ab77]/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason" className="text-gray-300">Reason (Required)</Label>
                <Textarea
                  id="reason"
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  placeholder="Explain the reason for this adjustment..."
                  className="bg-[#0d0d0d] border-[#c7ab77]/20 text-white min-h-[100px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAdjustmentDialog({ ...adjustmentDialog, open: false })}>
                Cancel
              </Button>
              <Button 
                onClick={submitAdjustment}
                className={adjustmentDialog.type === "bonus" 
                  ? "bg-green-600 hover:bg-green-700" 
                  : "bg-red-600 hover:bg-red-700"
                }
              >
                Add {adjustmentDialog.type === "bonus" ? "Bonus" : "Deduction"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Payee Confirmation Dialog */}
        <AlertDialog open={!!deletingPayee} onOpenChange={() => setDeletingPayee(null)}>
          <AlertDialogContent className="bg-zinc-900 border-zinc-800">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-red-500" />
                Remove Payee
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove <strong className="text-white">{deletingPayee?.name}</strong> from the payroll? They will be deactivated and won't appear in future months.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-zinc-700">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deletingPayee) {
                    deactivatePayee.mutate({ id: deletingPayee.id });
                  }
                }}
                className="bg-red-600 hover:bg-red-700"
              >
                Remove Payee
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Add Employee Dialog */}
        <Dialog open={addEmployeeDialog} onOpenChange={setAddEmployeeDialog}>
          <DialogContent className="bg-[#1a1a1a] border-[#c7ab77]/20 max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-white">Add New Employee/Vendor</DialogTitle>
              <DialogDescription>
                Add a new team member or vendor to the payroll system.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="empName" className="text-gray-300">Name</Label>
                <Input
                  id="empName"
                  value={newEmployee.name}
                  onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                  placeholder="Full name"
                  className="bg-[#0d0d0d] border-[#c7ab77]/20 text-white"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="empType" className="text-gray-300">Type</Label>
                <Select 
                  value={newEmployee.type} 
                  onValueChange={(value: typeof newEmployee.type) => setNewEmployee({ ...newEmployee, type: value })}
                >
                  <SelectTrigger className="bg-[#0d0d0d] border-[#c7ab77]/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-[#c7ab77]/20">
                    <SelectItem value="closer">Closer (Commission-based)</SelectItem>
                    <SelectItem value="setter">Setter (Commission-based)</SelectItem>
                    <SelectItem value="coach">Coach (Fixed Salary)</SelectItem>
                    <SelectItem value="on_demand_coach">On-Demand Coach</SelectItem>
                    <SelectItem value="w2">W2 Employee</SelectItem>
                    <SelectItem value="vendor">Vendor/Contractor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {(newEmployee.type !== "closer" && newEmployee.type !== "setter") && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="empAmount" className="text-gray-300">Payment Amount ($)</Label>
                    <Input
                      id="empAmount"
                      type="number"
                      step="0.01"
                      value={newEmployee.amount}
                      onChange={(e) => setNewEmployee({ ...newEmployee, amount: e.target.value })}
                      placeholder="0.00"
                      className="bg-[#0d0d0d] border-[#c7ab77]/20 text-white"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="empFreq" className="text-gray-300">Payment Frequency</Label>
                    <Select 
                      value={newEmployee.paymentFrequency} 
                      onValueChange={(value: "biweekly" | "monthly") => setNewEmployee({ ...newEmployee, paymentFrequency: value })}
                    >
                      <SelectTrigger className="bg-[#0d0d0d] border-[#c7ab77]/20 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1a1a] border-[#c7ab77]/20">
                        <SelectItem value="biweekly">Bi-weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="empDesc" className="text-gray-300">Description (Optional)</Label>
                    <Input
                      id="empDesc"
                      value={newEmployee.description}
                      onChange={(e) => setNewEmployee({ ...newEmployee, description: e.target.value })}
                      placeholder="e.g., Filming, Ads, Coaching"
                      className="bg-[#0d0d0d] border-[#c7ab77]/20 text-white"
                    />
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="empAutopay"
                      checked={newEmployee.isAutopay}
                      onCheckedChange={(checked) => setNewEmployee({ ...newEmployee, isAutopay: checked === true })}
                      className="border-[#c7ab77] data-[state=checked]:bg-[#c7ab77] data-[state=checked]:text-black"
                    />
                    <Label htmlFor="empAutopay" className="text-gray-300">Autopay (automatically marked as paid)</Label>
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddEmployeeDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  if (!newEmployee.name) {
                    toast.error("Please enter a name");
                    return;
                  }
                  if (newEmployee.type === "closer" || newEmployee.type === "setter") {
                    // For commission-based, create a team member instead
                    toast.error("For closers/setters, please use Settings > Team Management");
                    return;
                  }
                  if (!newEmployee.amount) {
                    toast.error("Please enter a payment amount");
                    return;
                  }
                  createPayee.mutate({
                    name: newEmployee.name,
                    type: newEmployee.type,
                    paymentAmount: parseFloat(newEmployee.amount),
                    paymentFrequency: newEmployee.paymentFrequency,
                    description: newEmployee.description || undefined,
                    isAutopay: newEmployee.isAutopay
                  });
                }}
                className="bg-[#c7ab77] hover:bg-[#b89a66] text-black"
              >
                Add Employee
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

// On-Demand Coach Payroll Sub-component
function OnDemandCoachPayroll({ year, month, monthName }: { year: number; month: number; monthName: string }) {
  const { data: payees } = trpc.payees.getAll.useQuery();
  const onDemandCoaches = payees?.filter((p: any) => p.type === "on_demand_coach") || [];
  
  const { data: sessions } = trpc.coachingSessions.getAllByMonth.useQuery(
    { year, month },
    { enabled: true }
  );

  const RATE_PER_MINUTE = 0.90;
  const NO_SHOW_RATE = 15.00;

  // Group sessions by coach
  const coachSummaries = onDemandCoaches.map((coach: any) => {
    const coachSessions = sessions?.filter((s: any) => s.coachPayeeId === coach.id) || [];
    const completed = coachSessions.filter((s: any) => !s.isNoShow);
    const noShows = coachSessions.filter((s: any) => s.isNoShow);
    const totalMinutes = completed.reduce((sum: number, s: any) => sum + s.minutes, 0);
    const sessionPay = totalMinutes * RATE_PER_MINUTE;
    const noShowPay = noShows.length * NO_SHOW_RATE;
    const totalPay = sessionPay + noShowPay;

    return {
      coach,
      totalSessions: coachSessions.length,
      completedSessions: completed.length,
      noShowCount: noShows.length,
      totalMinutes,
      sessionPay,
      noShowPay,
      totalPay,
    };
  });

  const grandTotal = coachSummaries.reduce((sum, c) => sum + c.totalPay, 0);

  return (
    <Card className="bg-[#1a1a1a] border-[#c7ab77]/20">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Clock className="h-5 w-5 text-[#c7ab77]" />
          On-Demand Coaches
        </CardTitle>
        <CardDescription>Session-based pay at $0.90/min + $15 per no-show</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {coachSummaries.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No on-demand coaches set up. Add one via the "Add Employee" button above.
            </p>
          ) : (
            coachSummaries.map((item) => (
              <div key={item.coach.id} className="p-4 bg-[#0d0d0d] rounded-lg border border-[#c7ab77]/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-[#c7ab77]/20 flex items-center justify-center">
                      <span className="text-[#c7ab77] font-semibold">{item.coach.name.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-medium text-white">{item.coach.name}</p>
                      <p className="text-sm text-gray-400">
                        {item.completedSessions} sessions ({item.totalMinutes} min) | {item.noShowCount} no-shows
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm text-gray-400">Session Pay</p>
                      <p className="font-semibold text-white">${item.sessionPay.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-400">No-Show Pay</p>
                      <p className="font-semibold text-amber-500">${item.noShowPay.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-400">Total</p>
                      <p className="font-bold text-green-500">${item.totalPay.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          {coachSummaries.length > 0 && (
            <div className="flex items-center justify-between p-3 bg-[#c7ab77]/10 rounded-lg border border-[#c7ab77]/20">
              <span className="font-semibold text-[#c7ab77]">On-Demand Coach Total</span>
              <span className="font-bold text-[#c7ab77] text-lg">${grandTotal.toFixed(2)}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
