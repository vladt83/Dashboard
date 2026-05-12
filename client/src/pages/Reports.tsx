import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, DollarSign, TrendingUp, Users, Target, PieChart, BarChart3, Percent, Calendar } from "lucide-react";

export default function Reports() {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  
  // Fetch data
  const { data: deals } = trpc.deals.getByMonth.useQuery({ year, month });
  const { data: stats } = trpc.stats.getMonthly.useQuery({ year, month });
  const { data: closerLeaderboard } = trpc.stats.getCloserLeaderboard.useQuery({ year, month });
  const { data: paymentPlans } = trpc.deals.getPaymentPlans.useQuery({ year, month });
  const { data: bookingsBySource } = trpc.bookedCalls.bySource.useQuery({ year, month });
  
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
  
  const formatCurrency = (value: number | string | null | undefined) => {
    const num = typeof value === "string" ? parseFloat(value) : (value || 0);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };
  
  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  // Headline numbers come from server-merged stats, which combines live `deals`
  // with imported `dailyStats` (the spreadsheet backfill). Payment-type splits
  // and projected recurring stay client-side off `deals` because dailyStats
  // doesn't carry payment-type detail — those buckets reflect live deals only.
  const calculateMetrics = () => {
    const dealList = deals ?? [];
    const dealsCount = stats?.dealCount ?? dealList.length;
    const closedDeals = stats?.closedCount ?? dealList.filter(d => d.closed).length;
    const showedDeals = stats?.showedCount ?? dealList.filter(d => d.showed).length;
    const preparedDeals = stats?.preparedCount ?? dealList.filter(d => d.prepared).length;
    const totalRevenue = stats?.totalRevenue ?? dealList.reduce((sum, d) => sum + parseFloat(d.totalDealAmount || "0"), 0);
    const totalCashCollected = stats?.totalCashCollected ?? dealList.reduce((sum, d) =>
      sum + parseFloat(d.newCashCollected || "0") + parseFloat(d.existingCashCollected || "0"), 0);
    const closerCommissionsTotal = stats?.totalCloserCommission ?? dealList.reduce((sum, d) =>
      sum + parseFloat(d.closerCommission || "0"), 0);

    const avgDealSize = closedDeals > 0 ? totalRevenue / closedDeals : 0;
    const closeRate = showedDeals > 0 ? (closedDeals / showedDeals) * 100 : 0;
    const showRate = dealsCount > 0 ? (showedDeals / dealsCount) * 100 : 0;
    const preparedRate = showedDeals > 0 ? (preparedDeals / showedDeals) * 100 : 0;

    // Payment-type splits: live deals only (dailyStats has no paymentType).
    const payInFullDeals = dealList.filter(d => d.paymentType === "full_pay" && d.closed);
    const paymentPlanDeals = dealList.filter(d => d.paymentType === "in_house_payment_plan" && d.closed);
    const bnplDeals = dealList.filter(d => d.paymentType === "bnpl" && d.closed);

    const payInFullRevenue = payInFullDeals.reduce((sum, d) =>
      sum + parseFloat(d.newCashCollected || "0") + parseFloat(d.existingCashCollected || "0"), 0);
    const paymentPlanRevenue = paymentPlanDeals.reduce((sum, d) =>
      sum + parseFloat(d.newCashCollected || "0") + parseFloat(d.existingCashCollected || "0"), 0);
    const bnplRevenue = bnplDeals.reduce((sum, d) =>
      sum + parseFloat(d.newCashCollected || "0") + parseFloat(d.existingCashCollected || "0"), 0);

    // Setter commissions only exist on live deal rows; closer commissions come
    // from the merged stats so historical imports contribute.
    const setterCommissions = dealList.reduce((sum, d) =>
      sum + parseFloat(d.setterCashCommission || "0") + parseFloat(d.setterShowCommission || "0"), 0);
    const totalCommissions = closerCommissionsTotal + setterCommissions;
    const commissionRatio = totalCashCollected > 0 ? (totalCommissions / totalCashCollected) * 100 : 0;

    const projectedRecurring = paymentPlanDeals.reduce((sum, d) => {
      const monthlyAmount = parseFloat(d.monthlyAmount || "0");
      const totalMonths = d.totalMonths || 0;
      const paidMonths = d.paymentMonth || 0;
      const remainingMonths = Math.max(0, totalMonths - paidMonths);
      return sum + (monthlyAmount * remainingMonths);
    }, 0);

    return {
      totalRevenue,
      totalCashCollected,
      avgDealSize,
      closeRate,
      showRate,
      preparedRate,
      payInFullRevenue,
      paymentPlanRevenue,
      bnplRevenue,
      payInFullCount: payInFullDeals.length,
      paymentPlanCount: paymentPlanDeals.length,
      bnplCount: bnplDeals.length,
      totalCommissions,
      commissionRatio,
      projectedRecurring,
      dealsCount,
      closedDeals,
      showedDeals,
      preparedDeals,
    };
  };
  
  const metrics = calculateMetrics();
  
  // Calculate payment type percentages
  const totalClosedDeals = metrics.payInFullCount + metrics.paymentPlanCount + metrics.bnplCount;
  const payInFullPercent = totalClosedDeals > 0 ? (metrics.payInFullCount / totalClosedDeals) * 100 : 0;
  const paymentPlanPercent = totalClosedDeals > 0 ? (metrics.paymentPlanCount / totalClosedDeals) * 100 : 0;
  const bnplPercent = totalClosedDeals > 0 ? (metrics.bnplCount / totalClosedDeals) * 100 : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="hidden md:block">
            <h1 className="text-2xl font-bold text-white">Sales Reports</h1>
            <p className="text-zinc-400">High-ticket sales performance metrics</p>
          </div>
          
          {/* Month Navigation */}
          <div className="flex items-center gap-2 bg-zinc-800/50 rounded-lg p-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateMonth("prev")}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-white font-medium px-3 min-w-[140px] text-center">
              {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateMonth("next")}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Key Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-[#c7ab77]/20 to-transparent border-[#c7ab77]/30">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-400 uppercase tracking-wider">Total Revenue</p>
                  <p className="text-2xl font-bold text-[#c7ab77]">{formatCurrency(metrics.totalRevenue)}</p>
                  <p className="text-xs text-zinc-500 mt-1">{metrics.closedDeals} closed deals</p>
                </div>
                <DollarSign className="h-8 w-8 text-[#c7ab77]/50" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-500/20 to-transparent border-green-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-400 uppercase tracking-wider">Cash Collected</p>
                  <p className="text-2xl font-bold text-green-400">{formatCurrency(metrics.totalCashCollected)}</p>
                  <p className="text-xs text-zinc-500 mt-1">This month</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500/50" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-blue-500/20 to-transparent border-blue-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-400 uppercase tracking-wider">Avg Deal Size</p>
                  <p className="text-2xl font-bold text-blue-400">{formatCurrency(metrics.avgDealSize)}</p>
                  <p className="text-xs text-zinc-500 mt-1">Per closed deal</p>
                </div>
                <Target className="h-8 w-8 text-blue-500/50" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-500/20 to-transparent border-purple-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-400 uppercase tracking-wider">Close Rate</p>
                  <p className="text-2xl font-bold text-purple-400">{formatPercent(metrics.closeRate)}</p>
                  <p className="text-xs text-zinc-500 mt-1">{metrics.closedDeals} of {metrics.showedDeals} showed</p>
                </div>
                <Percent className="h-8 w-8 text-purple-500/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sales Funnel & Payment Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales Funnel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-[#c7ab77]" />
                Sales Funnel
              </CardTitle>
              <CardDescription>Conversion through each stage</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Total Entries */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Total Entries</span>
                  <span className="text-white font-medium">{metrics.dealsCount}</span>
                </div>
                <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-zinc-500 rounded-full" style={{ width: "100%" }} />
                </div>
              </div>
              
              {/* Showed */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Showed Up</span>
                  <span className="text-white font-medium">{metrics.showedDeals} ({formatPercent(metrics.showRate)})</span>
                </div>
                <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${metrics.showRate}%` }} />
                </div>
              </div>
              
              {/* Prepared */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Was Prepared</span>
                  <span className="text-white font-medium">{metrics.preparedDeals} ({formatPercent(metrics.preparedRate)} of showed)</span>
                </div>
                <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${metrics.preparedRate}%` }} />
                </div>
              </div>
              
              {/* Closed */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Closed</span>
                  <span className="text-white font-medium">{metrics.closedDeals} ({formatPercent(metrics.closeRate)} of showed)</span>
                </div>
                <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${metrics.closeRate}%` }} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Type Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-[#c7ab77]" />
                Payment Type Distribution
              </CardTitle>
              <CardDescription>How clients are paying — live deal entries only</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Pay In Full */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Pay In Full</span>
                  <span className="text-white font-medium">
                    {metrics.payInFullCount} deals • {formatCurrency(metrics.payInFullRevenue)}
                  </span>
                </div>
                <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${payInFullPercent}%` }} />
                </div>
                <p className="text-xs text-zinc-500">{formatPercent(payInFullPercent)} of closed deals</p>
              </div>
              
              {/* Payment Plan */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Payment Plan</span>
                  <span className="text-white font-medium">
                    {metrics.paymentPlanCount} deals • {formatCurrency(metrics.paymentPlanRevenue)}
                  </span>
                </div>
                <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${paymentPlanPercent}%` }} />
                </div>
                <p className="text-xs text-zinc-500">{formatPercent(paymentPlanPercent)} of closed deals</p>
              </div>
              
              {/* BNPL */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Buy Now Pay Later</span>
                  <span className="text-white font-medium">
                    {metrics.bnplCount} deals • {formatCurrency(metrics.bnplRevenue)}
                  </span>
                </div>
                <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: `${bnplPercent}%` }} />
                </div>
                <p className="text-xs text-zinc-500">{formatPercent(bnplPercent)} of closed deals</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bookings by Source — Meta paid traffic vs existing-client upsells/referrals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-[#c7ab77]" />
              Bookings by Source
            </CardTitle>
            <CardDescription>
              Setter-tagged origin of each booked call. Meta = paid ad / cold prospect. Existing Client = upsell / referral / renewal. Drives ad ROI math.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              const buckets = [
                { key: "meta" as const, label: "Meta (paid ad)", color: "bg-blue-500" },
                { key: "existingClient" as const, label: "Existing client", color: "bg-amber-500" },
                { key: "unset" as const, label: "Unset (legacy / not tagged)", color: "bg-zinc-600" },
              ];
              const totals = bookingsBySource ?? { meta: { booked:0, closed:0, cash:0, revenue:0 }, existingClient: { booked:0, closed:0, cash:0, revenue:0 }, unset: { booked:0, closed:0, cash:0, revenue:0 } };
              const totalBooked = totals.meta.booked + totals.existingClient.booked + totals.unset.booked;
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {buckets.map(b => {
                    const v = totals[b.key];
                    const closeRate = v.booked > 0 ? (v.closed / v.booked) * 100 : 0;
                    const shareOfBookings = totalBooked > 0 ? (v.booked / totalBooked) * 100 : 0;
                    if (b.key === "unset" && v.booked === 0) return null;
                    return (
                      <div key={b.key} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-white">{b.label}</span>
                          <span className="text-xs text-zinc-500">{formatPercent(shareOfBookings)} of bookings</span>
                        </div>
                        <div className={`h-1.5 ${b.color} rounded-full`} style={{ width: `${Math.max(shareOfBookings, 2)}%` }} />
                        <div className="grid grid-cols-2 gap-2 text-sm pt-1">
                          <div>
                            <p className="text-xs text-zinc-500">Booked</p>
                            <p className="font-semibold text-white">{v.booked}</p>
                          </div>
                          <div>
                            <p className="text-xs text-zinc-500">Closed</p>
                            <p className="font-semibold text-white">{v.closed} <span className="text-xs text-zinc-500">({formatPercent(closeRate)})</span></p>
                          </div>
                          <div>
                            <p className="text-xs text-zinc-500">Cash</p>
                            <p className="font-semibold text-green-400">{formatCurrency(v.cash)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-zinc-500">Revenue</p>
                            <p className="font-semibold text-white">{formatCurrency(v.revenue)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {totalBooked === 0 && (
                    <p className="col-span-full text-sm text-zinc-500 py-4 text-center">No bookings recorded for this month yet.</p>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Financial Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-xs text-zinc-400 uppercase tracking-wider mb-2">Total Commissions</p>
                <p className="text-3xl font-bold text-green-400">{formatCurrency(metrics.totalCommissions)}</p>
                <p className="text-sm text-zinc-500 mt-2">
                  {formatPercent(metrics.commissionRatio)} of cash collected
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-xs text-zinc-400 uppercase tracking-wider mb-2">Projected Recurring</p>
                <p className="text-3xl font-bold text-blue-400">{formatCurrency(metrics.projectedRecurring)}</p>
                <p className="text-sm text-zinc-500 mt-2">
                  From {metrics.paymentPlanCount} payment plans
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-xs text-zinc-400 uppercase tracking-wider mb-2">Net After Commissions</p>
                <p className="text-3xl font-bold text-[#c7ab77]">
                  {formatCurrency(metrics.totalCashCollected - metrics.totalCommissions)}
                </p>
                <p className="text-sm text-zinc-500 mt-2">
                  {formatPercent(100 - metrics.commissionRatio)} retained
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Performers */}
        {closerLeaderboard && closerLeaderboard.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-[#c7ab77]" />
                Top Performers
              </CardTitle>
              <CardDescription>Revenue leaders this month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {closerLeaderboard.slice(0, 5).map((closer, index) => {
                  const totalCash = closer.totalCashCollected || 0;
                  const maxCash = closerLeaderboard[0]?.totalCashCollected || 1;
                  const percentage = (totalCash / maxCash) * 100;
                  
                  return (
                    <div key={closer.id} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            index === 0 ? "bg-[#c7ab77] text-black" :
                            index === 1 ? "bg-zinc-400 text-black" :
                            index === 2 ? "bg-amber-700 text-white" :
                            "bg-zinc-700 text-white"
                          }`}>
                            {index + 1}
                          </span>
                          <span className="text-white font-medium">{closer.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[#c7ab77] font-bold">{formatCurrency(totalCash)}</span>
                          <span className="text-zinc-500 text-sm ml-2">({closer.closedCount} deals)</span>
                        </div>
                      </div>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            index === 0 ? "bg-[#c7ab77]" :
                            index === 1 ? "bg-zinc-400" :
                            index === 2 ? "bg-amber-700" :
                            "bg-zinc-600"
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
