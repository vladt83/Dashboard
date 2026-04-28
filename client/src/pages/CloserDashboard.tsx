import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ChevronLeft, 
  ChevronRight, 
  DollarSign, 
  Trophy,
  Target,
  TrendingUp,
  FileText,
  Users,
  Calendar,
  ArrowUp,
  CreditCard,
  Medal,
  BarChart3,
  Flame,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useState, useMemo } from "react";

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const REVENUE_GOAL = 100000;

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

// Payment processor display names
const processorLabels: Record<string, string> = {
  fanbasis: "Fanbasis",
  climb: "Climb",
  claritypay: "ClarityPay",
  hfd: "HFD",
  elective: "Elective",
  split_it: "Split-It",
  other: "Other",
};

// Payment type categories
const paymentTypeLabels: Record<string, string> = {
  full_pay: "Full Pay",
  in_house_payment_plan: "In-House (Fanbasis)",
  bnpl: "BNPL",
};

export default function CloserDashboard() {
  const { user } = useAuth();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  // Get the closer's team member link
  const { data: teamLink, isLoading: teamLinkLoading } = trpc.userTeam.getMyTeamMember.useQuery();
  const teamMemberId = teamLink?.teamMember?.id;

  // Get closer's stats for the selected month
  const { data: closerStats, isLoading: statsLoading } = trpc.stats.getCloserStats.useQuery(
    { closerId: teamMemberId!, year: selectedYear, month: selectedMonth },
    { enabled: !!teamMemberId }
  );

  // Get closer's deals for the selected month
  const { data: closerDeals, isLoading: dealsLoading } = trpc.deals.getByCloser.useQuery(
    { closerId: teamMemberId!, year: selectedYear, month: selectedMonth },
    { enabled: !!teamMemberId }
  );

  // Get closer's subscriptions
  const { data: subscriptions } = trpc.subscriptions.getByCloser.useQuery(
    { closerId: teamMemberId! },
    { enabled: !!teamMemberId }
  );

  // Get leaderboard
  const { data: leaderboard, isLoading: leaderboardLoading } = trpc.stats.getCloserLeaderboard.useQuery(
    { year: selectedYear, month: selectedMonth }
  );

  const goToPreviousMonth = () => {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(selectedYear - 1); }
    else { setSelectedMonth(selectedMonth - 1); }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(selectedYear + 1); }
    else { setSelectedMonth(selectedMonth + 1); }
  };

  // Calculate stats
  const totalRevenue = closerStats?.totalRevenue || 0;
  const totalCollected = closerStats?.totalCashCollected || 0;
  const closedCount = closerStats?.closedCount || 0;
  const showedCount = closerStats?.showedCount || 0;
  const totalDeals = closerStats?.totalDeals || 0;
  const commission = closerStats?.closerCommission || 0;
  const closeRate = showedCount > 0 ? (closedCount / showedCount) * 100 : 0;
  const showRate = totalDeals > 0 ? (showedCount / totalDeals) * 100 : 0;

  // Revenue goal progress
  const revenueProgress = Math.min((totalRevenue / REVENUE_GOAL) * 100, 100);
  const revenueRemaining = Math.max(REVENUE_GOAL - totalRevenue, 0);

  // Active subscriptions
  const activeSubscriptions = subscriptions?.filter((s: any) => s.active) || [];
  const monthlySubRevenue = activeSubscriptions.reduce((sum: number, s: any) => sum + parseFloat(s.monthlyAmount || "0"), 0);
  const monthlySubCommission = monthlySubRevenue * 0.25;

  // Payment method breakdown
  const paymentBreakdown = useMemo(() => {
    if (!closerDeals) return { byType: {}, byProcessor: {} };
    
    const byType: Record<string, { count: number; amount: number }> = {};
    const byProcessor: Record<string, { count: number; amount: number }> = {};
    
    for (const deal of closerDeals) {
      if (!deal.closed) continue;
      
      const type = deal.paymentType || "unknown";
      const processor = deal.paymentProcessor || "unknown";
      const amount = parseFloat(deal.totalDealAmount || "0");
      
      if (!byType[type]) byType[type] = { count: 0, amount: 0 };
      byType[type].count++;
      byType[type].amount += amount;
      
      if (processor !== "unknown") {
        if (!byProcessor[processor]) byProcessor[processor] = { count: 0, amount: 0 };
        byProcessor[processor].count++;
        byProcessor[processor].amount += amount;
      }
    }
    
    return { byType, byProcessor };
  }, [closerDeals]);

  // Recent deals
  const recentDeals = useMemo(() => {
    if (!closerDeals) return [];
    return [...closerDeals].sort((a: any, b: any) => 
      new Date(b.dealDate).getTime() - new Date(a.dealDate).getTime()
    ).slice(0, 5);
  }, [closerDeals]);

  // Leaderboard position
  const myRank = useMemo(() => {
    if (!leaderboard || !teamMemberId) return null;
    const idx = leaderboard.findIndex((l: any) => l.id === teamMemberId);
    return idx >= 0 ? idx + 1 : null;
  }, [leaderboard, teamMemberId]);

  if (teamLinkLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (!teamMemberId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <Users className="h-16 w-16 text-muted-foreground mb-4 opacity-30" />
        <h2 className="text-xl font-bold mb-2">Account Not Linked</h2>
        <p className="text-muted-foreground max-w-md">
          Your account hasn't been linked to a team member profile yet. Please contact your admin to link your account.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gold-gradient">
            Welcome, {user?.name?.split(" ")[0] || "Closer"}
          </h1>
          <p className="text-muted-foreground mt-1">Your performance overview</p>
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

      {/* $100K Revenue Goal */}
      <Card className="border-primary/30 gold-glow overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />
        <CardContent className="pt-6 pb-6 relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-primary/20">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Revenue Goal</h2>
                <p className="text-muted-foreground text-sm">Your personal $100K target</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-gold-gradient">
                {statsLoading ? <Skeleton className="h-10 w-32" /> : formatCurrency(totalRevenue)}
              </div>
              <p className="text-sm text-muted-foreground">of {formatCurrency(REVENUE_GOAL)}</p>
            </div>
          </div>
          <Progress value={revenueProgress} className="h-4 bg-zinc-800" />
          <div className="flex justify-between mt-2 text-sm">
            <span className={revenueProgress >= 100 ? "text-green-400 font-bold" : "text-muted-foreground"}>
              {revenueProgress >= 100 ? "Goal Reached!" : `${formatPercent(revenueProgress)} complete`}
            </span>
            {revenueRemaining > 0 && (
              <span className="text-muted-foreground">{formatCurrency(revenueRemaining)} to go</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="stat-card">
          <CardContent className="pt-4 pb-4">
            <p className="stat-label text-xs">Total Calls</p>
            <div className="stat-value text-lg text-white">
              {statsLoading ? <Skeleton className="h-6 w-10" /> : totalDeals}
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="pt-4 pb-4">
            <p className="stat-label text-xs">Shows</p>
            <div className="stat-value text-lg text-blue-400">
              {statsLoading ? <Skeleton className="h-6 w-10" /> : (
                <span>{showedCount} <span className="text-xs text-muted-foreground">({formatPercent(showRate)})</span></span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="pt-4 pb-4">
            <p className="stat-label text-xs">Deals Closed</p>
            <div className="stat-value text-lg text-green-400">
              {statsLoading ? <Skeleton className="h-6 w-10" /> : closedCount}
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="pt-4 pb-4">
            <p className="stat-label text-xs">Close Rate</p>
            <div className={`stat-value text-lg ${closeRate >= 30 ? 'text-green-400' : closeRate >= 20 ? 'text-yellow-400' : 'text-red-400'}`}>
              {statsLoading ? <Skeleton className="h-6 w-10" /> : formatPercent(closeRate)}
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="pt-4 pb-4">
            <p className="stat-label text-xs">Cash Collected</p>
            <div className="stat-value text-lg text-primary">
              {statsLoading ? <Skeleton className="h-6 w-16" /> : formatCurrency(totalCollected)}
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="pt-4 pb-4">
            <p className="stat-label text-xs">Revenue</p>
            <div className="stat-value text-lg text-white">
              {statsLoading ? <Skeleton className="h-6 w-16" /> : formatCurrency(totalRevenue)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Earnings + Subscriptions Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Total Earnings Card */}
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" /> Earnings Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gold-gradient mb-4">
              {statsLoading ? <Skeleton className="h-9 w-32" /> : formatCurrency(commission + monthlySubCommission)}
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-sm">Deal Commissions</span>
                </div>
                <span className="font-bold text-primary">{formatCurrency(commission)}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <ArrowUp className="h-4 w-4 text-green-400" />
                  <span className="text-sm">Subscription Commissions (25%)</span>
                </div>
                <span className="font-bold text-green-400">{formatCurrency(monthlySubCommission)}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-400" />
                  <span className="text-sm">Active Subscriptions</span>
                </div>
                <span className="font-bold text-blue-400">{activeSubscriptions.length} ({formatCurrency(monthlySubRevenue)}/mo)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Method Breakdown */}
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" /> Payment Method Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dealsLoading ? (
              <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (
              <div className="space-y-4">
                {/* By Type */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">By Category</p>
                  {Object.entries(paymentBreakdown.byType).length > 0 ? (
                    Object.entries(paymentBreakdown.byType).map(([type, data]) => (
                      <div key={type} className="flex items-center justify-between p-2 bg-secondary/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            type === "full_pay" ? "bg-green-400" : 
                            type === "in_house_payment_plan" ? "bg-blue-400" : 
                            type === "bnpl" ? "bg-yellow-400" : "bg-zinc-400"
                          }`} />
                          <span className="text-sm">{paymentTypeLabels[type] || type}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-sm">{data.count} deals</span>
                          <span className="text-xs text-muted-foreground ml-2">{formatCurrency(data.amount)}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No closed deals yet</p>
                  )}
                </div>
                {/* By Processor */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">By Processor</p>
                  {Object.entries(paymentBreakdown.byProcessor).length > 0 ? (
                    Object.entries(paymentBreakdown.byProcessor).map(([proc, data]) => (
                      <div key={proc} className="flex items-center justify-between p-2 bg-secondary/50 rounded-lg">
                        <span className="text-sm">{processorLabels[proc] || proc}</span>
                        <div className="text-right">
                          <span className="font-bold text-sm">{data.count}</span>
                          <span className="text-xs text-muted-foreground ml-2">{formatCurrency(data.amount)}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No processor data yet</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Leaderboard */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Medal className="h-5 w-5 text-primary" /> Closer Standings
            {myRank && (
              <span className="ml-auto text-sm font-normal text-muted-foreground">
                You are #{myRank} of {leaderboard?.length || 0}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {leaderboardLoading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : leaderboard && leaderboard.length > 0 ? (
            <div className="space-y-2">
              {leaderboard.map((closer: any, index: number) => {
                const isMe = closer.id === teamMemberId;
                const rank = index + 1;
                const rankColor = rank === 1 ? "text-yellow-400" : rank === 2 ? "text-zinc-300" : rank === 3 ? "text-amber-600" : "text-muted-foreground";
                const closerCloseRate = closer.showedCount > 0 ? (closer.closedCount / closer.showedCount) * 100 : 0;
                
                return (
                  <div 
                    key={closer.id} 
                    className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${
                      isMe ? "bg-primary/10 border border-primary/30" : "bg-secondary/50"
                    }`}
                  >
                    <div className={`text-2xl font-bold w-8 text-center ${rankColor}`}>
                      {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`font-semibold truncate ${isMe ? "text-primary" : "text-white"}`}>
                          {closer.name} {isMe && <span className="text-xs text-primary">(You)</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{closer.closedCount} closes</span>
                        <span>·</span>
                        <span>{formatPercent(closerCloseRate)} close rate</span>
                        <span>·</span>
                        <span>{closer.totalDeals} calls</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">{formatCurrency(closer.totalRevenue)}</p>
                      <p className="text-xs text-muted-foreground">
                        Collected: {formatCurrency(closer.totalCashCollected)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <Trophy className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>No leaderboard data yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Deals + Subscriptions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Deals */}
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Recent Deals
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dealsLoading ? (
              <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : recentDeals.length > 0 ? (
              <div className="space-y-3">
                {recentDeals.map((deal: any) => {
                  const dealAmount = parseFloat(deal.totalDealAmount || "0");
                  const cashCollected = parseFloat(deal.newCashCollected || "0") + parseFloat(deal.existingCashCollected || "0");
                  return (
                    <div key={deal.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                      <div>
                        <p className="font-medium">{deal.clientName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(deal.dealDate).toLocaleDateString()}
                          </span>
                          {deal.closed ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Closed
                            </span>
                          ) : deal.showed ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">
                              Showed
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 flex items-center gap-1">
                              <XCircle className="h-3 w-3" /> No Show
                            </span>
                          )}
                          {deal.paymentType && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-300">
                              {paymentTypeLabels[deal.paymentType] || deal.paymentType}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        {deal.closed && (
                          <>
                            <p className="font-bold text-primary">{formatCurrency(dealAmount)}</p>
                            <p className="text-xs text-muted-foreground">
                              Collected: {formatCurrency(cashCollected)}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>No deals this month yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Subscriptions */}
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <ArrowUp className="h-5 w-5 text-primary" /> My Subscriptions
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {activeSubscriptions.length} active · {formatCurrency(monthlySubRevenue)}/mo total · You earn 25%
            </p>
          </CardHeader>
          <CardContent>
            {activeSubscriptions.length > 0 ? (
              <div className="space-y-3">
                {activeSubscriptions.map((sub: any) => (
                  <div key={sub.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                    <div>
                      <p className="font-medium">{sub.clientName}</p>
                      <p className="text-xs text-muted-foreground">
                        Since {new Date(sub.startDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatCurrency(parseFloat(sub.monthlyAmount || "0"))}/mo</p>
                      <p className="text-xs text-green-400">
                        You earn {formatCurrency(parseFloat(sub.monthlyAmount || "0") * 0.25)}/mo
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>No active subscriptions yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
