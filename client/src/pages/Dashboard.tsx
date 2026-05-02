import { trpc } from "../lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  ChevronLeft, 
  ChevronRight, 
  TrendingUp, 
  DollarSign, 
  Users, 
  Target,
  Trophy,
  Flame,
  Star,
  ArrowUp,
  Zap,
  Briefcase,
  GraduationCap,
  Megaphone,
  Building2,
  CheckCircle2,
  Clock,
  BarChart3,
  Phone,
  Percent,
} from "lucide-react";
import { useState, useMemo } from "react";

const MONTHLY_GOAL = 250000;

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

// ==================== PAYMENT PLAN SECTION ====================
function PaymentPlanSection({ year, month }: { year: number; month: number }) {
  const { data: paymentPlans, isLoading } = trpc.deals.getPaymentPlans.useQuery({ year, month });
  const utils = trpc.useUtils();
  const [confirmingPayment, setConfirmingPayment] = useState<number | null>(null);
  
  const collectPaymentMutation = trpc.deals.collectPayment.useMutation({
    onSuccess: () => {
      utils.deals.getPaymentPlans.invalidate();
      utils.stats.getMonthly.invalidate();
      setConfirmingPayment(null);
    },
  });

  if (isLoading) {
    return (
      <Card className="border-primary/20">
        <CardHeader><CardTitle>Payment Plan Collections</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        </CardContent>
      </Card>
    );
  }

  if (!paymentPlans || paymentPlans.length === 0) return null;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          <CardTitle>Payment Plan Collections</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">Payments due this month - mark as collected to add to payroll</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {paymentPlans.map((plan) => (
            <div key={plan.id} className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg border border-border">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{plan.clientName}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                    {plan.paymentMonth} of {plan.totalMonths} payments
                  </span>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Monthly: {formatCurrency(parseFloat(plan.monthlyAmount || "0"))} | Provider: {plan.paymentProcessor || "N/A"}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {plan.paymentCollected ? (
                  <span className="text-sm text-green-400 flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" /> Collected
                  </span>
                ) : confirmingPayment === plan.id ? (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => collectPaymentMutation.mutate({ dealId: plan.id })}
                      disabled={collectPaymentMutation.isPending} className="bg-green-600 hover:bg-green-700">
                      Confirm
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setConfirmingPayment(null)}>Cancel</Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setConfirmingPayment(plan.id)}>
                    Mark Collected
                  </Button>
                )}
                <span className="font-bold text-lg text-primary">{formatCurrency(parseFloat(plan.monthlyAmount || "0"))}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== TAB 1: COMPANY PERFORMANCE ====================
function CompanyPerformanceTab({ year, month, statsLoading, monthlyStats }: any) {
  const { data: marketingCosts } = trpc.marketingCosts.getByMonth.useQuery({ year, month });
  const { data: pendingPaymentPlans } = trpc.deals.getPendingPaymentPlans.useQuery({ year, month });

  const totalRevenue = monthlyStats?.totalRevenue || 0;
  const totalCollected = monthlyStats?.totalCashCollected || 0;
  const newCash = monthlyStats?.newCashCollected || 0;
  const existingCash = monthlyStats?.existingCashCollected || 0;
  const closedCount = monthlyStats?.closedCount || 0;
  const dealCount = monthlyStats?.dealCount || 0;

  const totalAdSpend = useMemo(() => {
    if (!marketingCosts) return 0;
    return marketingCosts.reduce((sum: number, c: any) => sum + parseFloat(c.amount || "0"), 0);
  }, [marketingCosts]);

  const roas = totalAdSpend > 0 ? totalCollected / totalAdSpend : 0;

  // New monthly revenue = sum of payment plan monthly amounts from deals closed this month
  const newMonthlyRevenue = useMemo(() => {
    if (!pendingPaymentPlans) return 0;
    return pendingPaymentPlans.reduce((sum: number, plan: any) => sum + parseFloat(plan.monthlyAmount || "0"), 0);
  }, [pendingPaymentPlans]);

  const goalProgress = Math.min((totalCollected / MONTHLY_GOAL) * 100, 100);

  return (
    <div className="space-y-6">
      {/* Monthly Goal Hero */}
      <Card className="border-primary/30 gold-glow overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />
        <CardContent className="pt-6 pb-8 relative">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-primary/20">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Monthly Goal</h2>
                <p className="text-muted-foreground text-sm">
                  {goalProgress >= 100 ? "Goal achieved!" : goalProgress >= 75 ? "Almost there!" : "Keep pushing!"}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-gold-gradient">
                {statsLoading ? <Skeleton className="h-10 w-32" /> : formatCurrency(totalCollected)}
              </div>
              <div className="text-muted-foreground">of {formatCurrency(MONTHLY_GOAL)} goal</div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-semibold text-primary">{formatPercent(goalProgress)}</span>
            </div>
            <div className="h-4 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary to-[#e8d5a3] transition-all duration-1000 ease-out rounded-full"
                style={{ width: `${goalProgress}%` }} />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>$0</span>
              <span className={goalProgress >= 25 ? "text-primary font-medium" : ""}>$62.5K</span>
              <span className={goalProgress >= 50 ? "text-primary font-medium" : ""}>$125K</span>
              <span className={goalProgress >= 75 ? "text-primary font-medium" : ""}>$187.5K</span>
              <span className={goalProgress >= 100 ? "text-primary font-medium" : ""}>$250K</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="stat-card">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">Total Revenue</p>
                <div className="stat-value text-primary">
                  {statsLoading ? <Skeleton className="h-8 w-24" /> : formatCurrency(totalRevenue)}
                </div>
              </div>
              <div className="p-3 rounded-full bg-primary/10"><DollarSign className="h-5 w-5 text-primary" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">Cash Collected</p>
                <div className="stat-value text-green-400">
                  {statsLoading ? <Skeleton className="h-8 w-24" /> : formatCurrency(totalCollected)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  New: {formatCurrency(newCash)} | Existing: {formatCurrency(existingCash)}
                </p>
              </div>
              <div className="p-3 rounded-full bg-green-500/10"><TrendingUp className="h-5 w-5 text-green-400" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">Ad Spend (Facebook)</p>
                <p className="stat-value text-blue-400">
                  {formatCurrency(totalAdSpend)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  ROAS: {roas > 0 ? `${roas.toFixed(2)}x` : "N/A"}
                </p>
              </div>
              <div className="p-3 rounded-full bg-blue-500/10"><Megaphone className="h-5 w-5 text-blue-400" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">New Monthly Revenue</p>
                <p className="stat-value text-purple-400">
                  {formatCurrency(newMonthlyRevenue)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Payment plans
                </p>
              </div>
              <div className="p-3 rounded-full bg-purple-500/10"><ArrowUp className="h-5 w-5 text-purple-400" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" /> Revenue Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-secondary/50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">Total Deal Value</span>
                  <span className="font-bold text-lg">{formatCurrency(totalRevenue)}</span>
                </div>
                <Progress value={totalRevenue > 0 ? 100 : 0} className="h-2" />
              </div>
              <div className="p-4 bg-secondary/50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">Cash Collected</span>
                  <span className="font-bold text-lg text-green-400">{formatCurrency(totalCollected)}</span>
                </div>
                <Progress value={totalRevenue > 0 ? (totalCollected / totalRevenue) * 100 : 0} className="h-2" />
              </div>
              <div className="p-4 bg-secondary/50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">Outstanding</span>
                  <span className="font-bold text-lg text-yellow-400">{formatCurrency(totalRevenue - totalCollected)}</span>
                </div>
                <Progress value={totalRevenue > 0 ? ((totalRevenue - totalCollected) / totalRevenue) * 100 : 0} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" /> Deals Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-secondary/50 rounded-lg text-center">
                <p className="text-3xl font-bold text-primary">{closedCount}</p>
                <p className="text-sm text-muted-foreground">Deals Closed</p>
              </div>
              <div className="p-4 bg-secondary/50 rounded-lg text-center">
                <p className="text-3xl font-bold">{dealCount}</p>
                <p className="text-sm text-muted-foreground">Total Entries</p>
              </div>
              <div className="p-4 bg-secondary/50 rounded-lg text-center">
                <p className="text-3xl font-bold text-green-400">
                  {dealCount > 0 ? formatPercent((closedCount / dealCount) * 100) : "0%"}
                </p>
                <p className="text-sm text-muted-foreground">Close Rate</p>
              </div>
              <div className="p-4 bg-secondary/50 rounded-lg text-center">
                <p className="text-3xl font-bold text-blue-400">
                  {roas > 0 ? `${roas.toFixed(2)}x` : "N/A"}
                </p>
                <p className="text-sm text-muted-foreground">ROAS</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Plans */}
      <PaymentPlanSection year={year} month={month} />
    </div>
  );
}

// ==================== TAB 2: SALES TEAM BREAKDOWN ====================
function SalesTeamTab({ year, month }: { year: number; month: number }) {
  const { data: closerLeaderboard, isLoading: closerLoading } = trpc.stats.getCloserLeaderboard.useQuery({ year, month });
  const { data: monthlyStats } = trpc.stats.getMonthly.useQuery({ year, month });

  // Build comparison chart data — three buckets per closer:
  //   1. Cash Collected      — money in the bank now
  //   2. Financed (Future)   — outstanding in-house payment plan balance
  //                            (Fanbasis / Denefits — we collect later)
  //   3. BNPL Fees           — fees absorbed across BNPL deals
  const closerChartData = useMemo(() => {
    if (!closerLeaderboard) return [];
    return closerLeaderboard.map((c: any) => ({
      name: c.name.split(" ")[0],
      collected: c.totalCashCollected,
      financed: c.financedFuture || 0,
      bnplFees: c.bnplFees || 0,
      deals: c.closedCount,
      liveCalls: c.totalDeals || 0,
      showRate: c.showPercentage || 0,
      closeRate: c.totalDeals > 0 ? (c.closedCount / c.totalDeals) * 100 : 0,
    }));
  }, [closerLeaderboard]);

  return (
    <div className="space-y-6">
      {/* Closer Comparison Bar Chart */}
      {closerChartData.length > 0 && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" /> Closer Revenue Comparison
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Cash now vs financed-future (Fanbasis / Denefits) vs BNPL fees
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={closerChartData} barGap={6}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(199,171,119,0.1)" />
                  <XAxis dataKey="name" stroke="#999" fontSize={12} />
                  <YAxis stroke="#999" fontSize={12} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #c7ab77', borderRadius: '8px' }}
                    formatter={(value: number, name: string) => {
                      const labels: Record<string, string> = {
                        collected: "Cash Collected",
                        financed: "Financed (future)",
                        bnplFees: "BNPL Fees",
                      };
                      return [formatCurrency(value), labels[name] ?? name];
                    }}
                  />
                  <Bar dataKey="collected" fill="#c7ab77" radius={[4, 4, 0, 0]} name="collected" />
                  <Bar dataKey="financed"  fill="#3b82f6" radius={[4, 4, 0, 0]} name="financed" />
                  <Bar dataKey="bnplFees"  fill="#ef4444" radius={[4, 4, 0, 0]} name="bnplFees" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <span className="h-3 w-3 rounded-sm bg-[#c7ab77] mt-0.5 shrink-0" />
                <span><span className="text-foreground font-semibold">Cash Collected</span> — money in hand right now (full pay + down payments + BNPL net)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="h-3 w-3 rounded-sm bg-[#3b82f6] mt-0.5 shrink-0" />
                <span><span className="text-foreground font-semibold">Financed (Future)</span> — outstanding balance on in-house payment plans (Fanbasis / Denefits) we'll collect over time</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="h-3 w-3 rounded-sm bg-[#ef4444] mt-0.5 shrink-0" />
                <span><span className="text-foreground font-semibold">BNPL Fees</span> — fees absorbed across BNPL-financed deals (Climb, ClarityPay, HFD, etc.)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Closer Detail Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {closerLoading ? (
          [1, 2, 3].map((i) => <Skeleton key={i} className="h-64 w-full" />)
        ) : closerLeaderboard && closerLeaderboard.length > 0 ? (
          closerLeaderboard.map((closer: any, index: number) => {
            const liveCalls = closer.totalDeals || 0;
            const showCount = closer.showedCount || 0;
            const closedCount = closer.closedCount || 0;
            const showRate = liveCalls > 0 ? (showCount / liveCalls) * 100 : 0;
            const closeRate = liveCalls > 0 ? (closedCount / liveCalls) * 100 : 0;

            return (
              <Card key={closer.id} className={`border-primary/20 ${index === 0 ? 'ring-2 ring-primary/30' : ''}`}>
                <CardContent className="pt-5">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                      index === 0 ? 'badge-gold' : index === 1 ? 'badge-silver' : index === 2 ? 'badge-bronze' : 'bg-muted text-muted-foreground'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">{closer.name}</span>
                        {index === 0 && <Star className="h-4 w-4 text-primary fill-primary" />}
                      </div>
                      <span className="text-xs text-muted-foreground">Closer</span>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">{formatCurrency(closer.totalCashCollected)}</p>
                      <p className="text-xs text-muted-foreground">collected</p>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-3 bg-secondary/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Live Calls</span>
                      </div>
                      <p className="text-xl font-bold">{liveCalls}</p>
                    </div>
                    <div className="p-3 bg-secondary/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Trophy className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Deals Closed</span>
                      </div>
                      <p className="text-xl font-bold text-green-400">{closedCount}</p>
                    </div>
                  </div>

                  {/* Performance Bars */}
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Users className="h-3 w-3" /> Show Rate
                        </span>
                        <span className={`font-bold ${showRate >= 70 ? 'text-green-400' : showRate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {formatPercent(showRate)}
                        </span>
                      </div>
                      <Progress value={showRate} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Percent className="h-3 w-3" /> Close Rate
                        </span>
                        <span className={`font-bold ${closeRate >= 30 ? 'text-green-400' : closeRate >= 20 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {formatPercent(closeRate)}
                        </span>
                      </div>
                      <Progress value={closeRate} className="h-2" />
                    </div>
                  </div>

                  {/* Commission */}
                  <div className="mt-4 p-3 bg-primary/10 rounded-lg flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Commission Earned</span>
                    <span className="font-bold text-primary">{formatCurrency(closer.closerCommission)}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No closer data yet this month</p>
            </CardContent>
          </Card>
        )}
      </div>


    </div>
  );
}

// ==================== TAB 3: PAYROLL OVERVIEW ====================
function PayrollTab({ year, month }: { year: number; month: number }) {
  const { data: payrollSummary } = trpc.payeePayments.getSummary.useQuery({ year, month });
  const { data: payeePayments } = trpc.payeePayments.getByMonth.useQuery({ year, month });
  const { data: monthlyStats } = trpc.stats.getMonthly.useQuery({ year, month });

  const salesPayroll = payrollSummary?.commissionBased?.reduce((sum: number, m: any) => sum + m.totalOwed, 0) || 0;
  const coachingPayroll = payeePayments?.filter((p: any) => p.payee.type === "coach")
    .reduce((sum: number, p: any) => sum + parseFloat(p.amount?.toString() || "0"), 0) || 0;
  const marketingPayroll = payeePayments?.filter((p: any) => p.payee.type === "vendor")
    .reduce((sum: number, p: any) => sum + parseFloat(p.amount?.toString() || "0"), 0) || 0;
  const operationsPayroll = payeePayments?.filter((p: any) => p.payee.type === "w2")
    .reduce((sum: number, p: any) => sum + parseFloat(p.amount?.toString() || "0"), 0) || 0;
  const totalPayroll = salesPayroll + coachingPayroll + marketingPayroll + operationsPayroll;

  // Paid vs owed
  const paidPayments = payeePayments?.filter((p: any) => p.isPaid) || [];
  const unpaidPayments = payeePayments?.filter((p: any) => !p.isPaid) || [];
  const totalPaid = paidPayments.reduce((sum: number, p: any) => sum + parseFloat(p.amount?.toString() || "0"), 0);
  const totalUnpaid = unpaidPayments.reduce((sum: number, p: any) => sum + parseFloat(p.amount?.toString() || "0"), 0);

  const payrollData = [
    { name: 'Sales', value: salesPayroll, color: '#c7ab77' },
    { name: 'Coaching', value: coachingPayroll, color: '#4ade80' },
    { name: 'Marketing', value: marketingPayroll, color: '#60a5fa' },
    { name: 'Operations', value: operationsPayroll, color: '#f472b6' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="stat-card">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">Total Payroll</p>
                <p className="stat-value text-primary">{formatCurrency(totalPayroll)}</p>
              </div>
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">Already Paid</p>
                <p className="stat-value text-green-400">{formatCurrency(totalPaid)}</p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">Still Outstanding</p>
                <p className="stat-value text-yellow-400">{formatCurrency(totalUnpaid + salesPayroll)}</p>
              </div>
              <Clock className="h-5 w-5 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payroll Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle>Payroll Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {payrollData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={payrollData} cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                      paddingAngle={5} dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {payrollData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #c7ab77' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <p>No payroll data yet</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle>By Category</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-secondary/50 rounded-lg border-l-4 border-[#c7ab77]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Briefcase className="h-5 w-5 text-[#c7ab77]" />
                  <div>
                    <p className="font-medium">Sales Commissions</p>
                    <p className="text-xs text-muted-foreground">Closers</p>
                  </div>
                </div>
                <p className="font-bold text-lg text-[#c7ab77]">{formatCurrency(salesPayroll)}</p>
              </div>
            </div>
            <div className="p-4 bg-secondary/50 rounded-lg border-l-4 border-[#4ade80]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <GraduationCap className="h-5 w-5 text-[#4ade80]" />
                  <div>
                    <p className="font-medium">Coaching</p>
                    <p className="text-xs text-muted-foreground">1-on-1 Coaches</p>
                  </div>
                </div>
                <p className="font-bold text-lg text-[#4ade80]">{formatCurrency(coachingPayroll)}</p>
              </div>
            </div>
            <div className="p-4 bg-secondary/50 rounded-lg border-l-4 border-[#60a5fa]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Megaphone className="h-5 w-5 text-[#60a5fa]" />
                  <div>
                    <p className="font-medium">Marketing</p>
                    <p className="text-xs text-muted-foreground">Filming & Ads</p>
                  </div>
                </div>
                <p className="font-bold text-lg text-[#60a5fa]">{formatCurrency(marketingPayroll)}</p>
              </div>
            </div>
            <div className="p-4 bg-secondary/50 rounded-lg border-l-4 border-[#f472b6]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-[#f472b6]" />
                  <div>
                    <p className="font-medium">Operations</p>
                    <p className="text-xs text-muted-foreground">W2 Employees</p>
                  </div>
                </div>
                <p className="font-bold text-lg text-[#f472b6]">{formatCurrency(operationsPayroll)}</p>
              </div>
            </div>
            <div className="p-4 bg-primary/10 rounded-lg border border-primary/30">
              <div className="flex items-center justify-between">
                <p className="font-medium">Total Monthly Payroll</p>
                <p className="font-bold text-xl text-primary">{formatCurrency(totalPayroll)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Commission Breakdown by Person */}
      {payrollSummary?.commissionBased && payrollSummary.commissionBased.length > 0 && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Sales Commission Breakdown
            </CardTitle>
            <p className="text-sm text-muted-foreground">What each salesperson is owed this month</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <div className="col-span-3">Name</div>
                <div className="col-span-2">Role</div>
                <div className="col-span-2 text-right">Deals</div>
                <div className="col-span-2 text-right">Cash Collected</div>
                <div className="col-span-3 text-right">Commission Owed</div>
              </div>
              {payrollSummary.commissionBased.map((member: any) => (
                <div key={member.memberId} className="grid grid-cols-12 gap-4 items-center px-4 py-3 bg-secondary/50 rounded-lg">
                  <div className="col-span-3 font-medium">{member.name}</div>
                  <div className="col-span-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary capitalize">{member.role}</span>
                  </div>
                  <div className="col-span-2 text-right">{member.closedCount || member.setCount || 0}</div>
                  <div className="col-span-2 text-right">{formatCurrency(member.totalCashCollected || 0)}</div>
                  <div className="col-span-3 text-right font-bold text-primary">{formatCurrency(member.totalOwed)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ==================== MAIN DASHBOARD ====================
export default function Dashboard() {
  const { user } = useAuth();
  const isOwner = user?.role === 'admin';
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const { data: monthlyStats, isLoading: statsLoading } = trpc.stats.getMonthly.useQuery({
    year: selectedYear,
    month: selectedMonth,
  });

  const goToPreviousMonth = () => {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(selectedYear - 1); }
    else { setSelectedMonth(selectedMonth - 1); }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(selectedYear + 1); }
    else { setSelectedMonth(selectedMonth + 1); }
  };

  return (
    <div className="space-y-6">
      {/* Header with Month Navigation */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="hidden md:block">
          <h1 className="text-3xl font-bold text-gold-gradient">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Track company performance, team stats, and payroll</p>
        </div>
        <div className="flex items-center gap-2 bg-card rounded-lg border p-1">
          <Button variant="ghost" size="icon" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-4 py-2 font-semibold min-w-[160px] text-center">
            {monthNames[selectedMonth - 1]} {selectedYear}
          </span>
          <Button variant="ghost" size="icon" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="performance" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-[500px]">
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Company
          </TabsTrigger>
          <TabsTrigger value="team" className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Sales Team
          </TabsTrigger>
          {isOwner && (
            <TabsTrigger value="payroll" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Payroll
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="performance">
          <CompanyPerformanceTab year={selectedYear} month={selectedMonth} statsLoading={statsLoading} monthlyStats={monthlyStats} />
        </TabsContent>

        <TabsContent value="team">
          <SalesTeamTab year={selectedYear} month={selectedMonth} />
        </TabsContent>

        {isOwner && (
          <TabsContent value="payroll">
            <PayrollTab year={selectedYear} month={selectedMonth} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
