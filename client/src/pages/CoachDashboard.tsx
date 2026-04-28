import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Clock, DollarSign, AlertTriangle, Plus, Trash2, CheckCircle, XCircle, Link2, Briefcase, CalendarCheck } from "lucide-react";

const MONTHLY_CAP = 2000;

export default function CoachDashboard() {

  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    sessionDate: format(new Date(), "yyyy-MM-dd"),
    clientName: "",
    minutes: "",
    tradingLog: "" as string,
    fuSession: "" as string,
    fuAssignments: "",
    notes: "",
    recordingLink: "",
    isNoShow: false,
  });

  // Get coach type (salaried vs on-demand)
  const { data: coachInfo, isLoading: coachLoading } = trpc.coachingSessions.getMyCoachType.useQuery();
  const isOnDemand = coachInfo?.type === "on_demand_coach";
  const isSalaried = !isOnDemand; // coach, w2, or default

  const { data: sessions, refetch } = trpc.coachingSessions.getMyMonth.useQuery({ year, month });

  const createSession = trpc.coachingSessions.createMy.useMutation({
    onSuccess: () => {
      toast.success("Session logged! Your session has been recorded.");
      refetch();
      setShowForm(false);
      setForm({
        sessionDate: format(new Date(), "yyyy-MM-dd"),
        clientName: "",
        minutes: "",
        tradingLog: "",
        fuSession: "",
        fuAssignments: "",
        notes: "",
        recordingLink: "",
        isNoShow: false,
      });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const deleteSession = trpc.coachingSessions.delete.useMutation({
    onSuccess: () => {
      toast.success("Session deleted");
      refetch();
    },
  });

  // Calculate pay (only relevant for on-demand coaches)
  const payStats = useMemo(() => {
    if (!sessions) return { totalMinutes: 0, sessionPay: 0, noShows: 0, noShowPay: 0, totalPay: 0, cappedPay: 0, sessionsCount: 0 };
    const completedSessions = sessions.filter((s: any) => !s.isNoShow);
    const noShowSessions = sessions.filter((s: any) => s.isNoShow);
    const totalMinutes = completedSessions.reduce((sum: number, s: any) => sum + (s.minutes || 0), 0);
    const sessionPay = totalMinutes * 0.90;
    // On-demand coaches get $15 for no-shows, salaried coaches get nothing for no-shows
    const noShowPay = isOnDemand ? noShowSessions.length * 15 : 0;
    const totalPay = sessionPay + noShowPay;
    const cappedPay = Math.min(totalPay, MONTHLY_CAP);
    return {
      totalMinutes,
      sessionPay,
      noShows: noShowSessions.length,
      noShowPay,
      totalPay,
      cappedPay,
      sessionsCount: completedSessions.length,
    };
  }, [sessions, isOnDemand]);

  const capPercentage = Math.min((payStats.totalPay / MONTHLY_CAP) * 100, 100);
  const isAtCap = payStats.totalPay >= MONTHLY_CAP;

  const handleSubmit = () => {
    if (!form.clientName.trim()) {
      toast.error("Client name is required");
      return;
    }
    if (!form.isNoShow && (!form.minutes || parseInt(form.minutes) <= 0)) {
      toast.error("Session duration is required");
      return;
    }

    const tradingLogMap: Record<string, "yes" | "no" | "too_new"> = {
      "Yes": "yes", "No": "no", "Too New": "too_new"
    };
    createSession.mutate({
      sessionDate: form.sessionDate,
      clientName: form.clientName.trim(),
      minutes: form.isNoShow ? 0 : parseInt(form.minutes),
      tradingLog: form.tradingLog ? tradingLogMap[form.tradingLog] : undefined,
      fuSession: form.fuSession ? form.fuSession === "Yes" : undefined,
      fuAssignments: form.fuAssignments.trim() || undefined,
      notes: form.notes.trim() || undefined,
      recordingLink: form.recordingLink.trim() || undefined,
      isNoShow: form.isNoShow,
    });
  };

  const navigateMonth = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const monthLabel = format(currentDate, "MMMM yyyy");

  if (coachLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Coaching Dashboard</h1>
          <p className="text-zinc-400 text-sm">
            {isSalaried 
              ? "Log your coaching sessions for tracking" 
              : "Log your sessions and track your earnings"
            }
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-zinc-900 rounded-lg px-4 py-2 border border-zinc-800">
            <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-white font-medium min-w-[140px] text-center">{monthLabel}</span>
            <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards - Different for salaried vs on-demand */}
      {isSalaried ? (
        /* SALARIED COACH VIEW - tracking only, no pay calculations */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-sm">Sessions This Month</p>
                  <div className="text-2xl font-bold text-white">{payStats.sessionsCount}</div>
                  <p className="text-zinc-500 text-xs">{payStats.totalMinutes} total minutes</p>
                </div>
                <CalendarCheck className="h-8 w-8 text-[#c7ab77]" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-sm">No-Shows</p>
                  <div className="text-2xl font-bold text-amber-400">{payStats.noShows}</div>
                  <p className="text-zinc-500 text-xs">Clients who didn't show up</p>
                </div>
                <XCircle className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-sm">Avg Session Length</p>
                  <div className="text-2xl font-bold text-white">
                    {payStats.sessionsCount > 0 ? Math.round(payStats.totalMinutes / payStats.sessionsCount) : 0} min
                  </div>
                  <p className="text-zinc-500 text-xs">Per completed session</p>
                </div>
                <Clock className="h-8 w-8 text-[#c7ab77]" />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* ON-DEMAND COACH VIEW - pay tracking with $2K cap */
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-zinc-400 text-sm">Sessions</p>
                    <div className="text-2xl font-bold text-white">{payStats.sessionsCount}</div>
                    <p className="text-zinc-500 text-xs">{payStats.totalMinutes} total minutes</p>
                  </div>
                  <Clock className="h-8 w-8 text-[#c7ab77]" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-zinc-400 text-sm">Session Pay</p>
                    <div className="text-2xl font-bold text-green-400">${payStats.sessionPay.toFixed(2)}</div>
                    <p className="text-zinc-500 text-xs">$0.90/min × {payStats.totalMinutes} min</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-zinc-400 text-sm">No-Show Pay</p>
                    <div className="text-2xl font-bold text-amber-400">${payStats.noShowPay.toFixed(2)}</div>
                    <p className="text-zinc-500 text-xs">{payStats.noShows} no-shows × $15</p>
                  </div>
                  <XCircle className="h-8 w-8 text-amber-500" />
                </div>
              </CardContent>
            </Card>

            <Card className={`border ${isAtCap ? 'bg-red-950/30 border-red-800' : 'bg-zinc-900 border-zinc-800'}`}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-zinc-400 text-sm">Total Earnings</p>
                    <div className={`text-2xl font-bold ${isAtCap ? 'text-red-400' : 'text-[#c7ab77]'}`}>
                      ${payStats.cappedPay.toFixed(2)}
                    </div>
                    <p className="text-zinc-500 text-xs">
                      {isAtCap ? 'Monthly cap reached!' : `$${(MONTHLY_CAP - payStats.totalPay).toFixed(2)} until cap`}
                    </p>
                  </div>
                  {isAtCap ? <AlertTriangle className="h-8 w-8 text-red-500" /> : <DollarSign className="h-8 w-8 text-[#c7ab77]" />}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Cap Progress - only for on-demand */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-zinc-400 text-sm font-medium">Monthly Cap Progress</span>
                <span className={`text-sm font-bold ${isAtCap ? 'text-red-400' : 'text-[#c7ab77]'}`}>
                  ${payStats.cappedPay.toFixed(2)} / ${MONTHLY_CAP.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-4 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${isAtCap ? 'bg-red-500' : 'bg-gradient-to-r from-[#c7ab77] to-[#e0c992]'}`}
                  style={{ width: `${capPercentage}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-zinc-600 text-xs">$0</span>
                <span className="text-zinc-600 text-xs">${(MONTHLY_CAP / 2).toLocaleString()}</span>
                <span className="text-zinc-600 text-xs">${MONTHLY_CAP.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Add Session Button */}
      {!showForm && (
        <Button
          onClick={() => setShowForm(true)}
          className="bg-[#c7ab77] text-black hover:bg-[#b89a66] font-medium"
        >
          <Plus className="h-4 w-4 mr-2" /> Log New Session
        </Button>
      )}

      {/* Session Entry Form */}
      {showForm && (
        <Card className="bg-zinc-900 border-[#c7ab77]/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Plus className="h-5 w-5 text-[#c7ab77]" />
              Log New Session
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* No Show Toggle */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800 border border-zinc-700">
              <input
                type="checkbox"
                checked={form.isNoShow}
                onChange={(e) => setForm({ ...form, isNoShow: e.target.checked })}
                className="h-5 w-5 accent-amber-500"
              />
              <div>
                <p className="text-white text-sm font-medium">No Show</p>
                <p className="text-zinc-400 text-xs">
                  {isOnDemand 
                    ? "Check if the client didn't show up ($15 fee)" 
                    : "Check if the client didn't show up"
                  }
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-zinc-300">Session Date</Label>
                <Input
                  type="date"
                  value={form.sessionDate}
                  onChange={(e) => setForm({ ...form, sessionDate: e.target.value })}
                  className="border-zinc-700 bg-zinc-800 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300">Client Name</Label>
                <Input
                  value={form.clientName}
                  onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                  placeholder="Enter client name"
                  className="border-zinc-700 bg-zinc-800 text-white"
                />
              </div>
              {!form.isNoShow && (
                <div className="space-y-2">
                  <Label className="text-zinc-300">Time (minutes)</Label>
                  <Input
                    type="number"
                    value={form.minutes}
                    onChange={(e) => setForm({ ...form, minutes: e.target.value })}
                    placeholder="e.g., 30"
                    className="border-zinc-700 bg-zinc-800 text-white"
                  />
                </div>
              )}
            </div>

            {!form.isNoShow && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-zinc-300">Trading Log</Label>
                    <Select value={form.tradingLog} onValueChange={(v) => setForm({ ...form, tradingLog: v })}>
                      <SelectTrigger className="border-zinc-700 bg-zinc-800 text-white">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-800 border-zinc-700">
                        <SelectItem value="Yes">Yes</SelectItem>
                        <SelectItem value="No">No</SelectItem>
                        <SelectItem value="Too New">Too New</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-300">Follow-Up Session?</Label>
                    <Select value={form.fuSession} onValueChange={(v) => setForm({ ...form, fuSession: v })}>
                      <SelectTrigger className="border-zinc-700 bg-zinc-800 text-white">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-800 border-zinc-700">
                        <SelectItem value="Yes">Yes</SelectItem>
                        <SelectItem value="No">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-300">FU Assignments</Label>
                    <Input
                      value={form.fuAssignments}
                      onChange={(e) => setForm({ ...form, fuAssignments: e.target.value })}
                      placeholder="Assignments given..."
                      className="border-zinc-700 bg-zinc-800 text-white"
                    />
                  </div>
                </div>

                {/* Recording Link - Optional */}
                <div className="space-y-2">
                  <Label className="text-zinc-300 flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-zinc-400" />
                    Recording Link <span className="text-zinc-500 text-xs">(optional)</span>
                  </Label>
                  <Input
                    value={form.recordingLink}
                    onChange={(e) => setForm({ ...form, recordingLink: e.target.value })}
                    placeholder="Paste recording link here (optional)"
                    className="border-zinc-700 bg-zinc-800 text-white"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label className="text-zinc-300">Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Session notes..."
                className="border-zinc-700 bg-zinc-800 text-white"
                rows={2}
              />
            </div>

            {/* Pay Preview - only for on-demand coaches */}
            {isOnDemand && (
              <div className="p-3 rounded-lg bg-[#c7ab77]/10 border border-[#c7ab77]/20">
                <p className="text-[#c7ab77] text-sm font-medium">
                  {form.isNoShow
                    ? "No-Show: $15.00 will be added"
                    : form.minutes
                      ? `Session Pay: ${parseInt(form.minutes)} min × $0.90 = $${(parseInt(form.minutes) * 0.90).toFixed(2)}`
                      : "Enter minutes to see pay calculation"
                  }
                </p>
              </div>
            )}

            {/* Salaried coach info */}
            {isSalaried && (
              <div className="p-3 rounded-lg bg-zinc-800 border border-zinc-700">
                <p className="text-zinc-400 text-sm">
                  This session will be logged for tracking purposes. Your pay is based on your salary.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={handleSubmit}
                disabled={createSession.isPending}
                className="bg-[#c7ab77] text-black hover:bg-[#b89a66] font-medium"
              >
                {createSession.isPending ? "Saving..." : "Log Session"}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)} className="border-zinc-700 text-zinc-300">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sessions Table */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white">Sessions — {monthLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          {!sessions || sessions.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No sessions logged for {monthLabel}</p>
              <p className="text-sm mt-1">Click "Log New Session" to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800 text-left text-sm text-zinc-400">
                    <th className="pb-3 pr-3">Date</th>
                    <th className="pb-3 pr-3">Client</th>
                    <th className="pb-3 pr-3 text-center">Time</th>
                    <th className="pb-3 pr-3 text-center">Trading Log</th>
                    <th className="pb-3 pr-3 text-center">FU Session</th>
                    <th className="pb-3 pr-3">Notes</th>
                    <th className="pb-3 pr-3 text-center">Recording</th>
                    {isOnDemand && <th className="pb-3 pr-3 text-right">Pay</th>}
                    <th className="pb-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session: any) => (
                    <tr key={session.id} className={`border-b border-zinc-800/50 ${session.isNoShow ? 'bg-amber-950/10' : ''}`}>
                      <td className="py-3 pr-3 text-sm text-zinc-300">
                        {format(new Date(session.sessionDate), "M/d/yy")}
                      </td>
                      <td className="py-3 pr-3 text-sm text-white font-medium">
                        {session.clientName}
                        {session.isNoShow && (
                          <Badge variant="outline" className="ml-2 text-amber-400 border-amber-400/30 text-xs">
                            No Show
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-center text-sm text-zinc-300">
                        {session.isNoShow ? "—" : `${session.minutes} min`}
                      </td>
                      <td className="py-3 pr-3 text-center">
                        {session.tradingLog ? (
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              session.tradingLog === "Yes"
                                ? "text-green-400 border-green-400/30"
                                : session.tradingLog === "No"
                                  ? "text-red-400 border-red-400/30"
                                  : "text-amber-400 border-amber-400/30"
                            }`}
                          >
                            {session.tradingLog}
                          </Badge>
                        ) : "—"}
                      </td>
                      <td className="py-3 pr-3 text-center">
                        {session.fuSession ? (
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              session.fuSession === "Yes"
                                ? "text-green-400 border-green-400/30"
                                : "text-red-400 border-red-400/30"
                            }`}
                          >
                            {session.fuSession}
                          </Badge>
                        ) : "—"}
                      </td>
                      <td className="py-3 pr-3 text-sm text-zinc-400 max-w-[200px] truncate">
                        {session.notes || "—"}
                      </td>
                      <td className="py-3 pr-3 text-center">
                        {session.recordingLink ? (
                          <a
                            href={session.recordingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#c7ab77] hover:text-[#e0c992]"
                          >
                            <CheckCircle className="h-4 w-4 mx-auto" />
                          </a>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      {isOnDemand && (
                        <td className="py-3 pr-3 text-right text-sm font-medium">
                          {session.isNoShow ? (
                            <span className="text-amber-400">$15.00</span>
                          ) : (
                            <span className="text-green-400">${((session.minutes || 0) * 0.90).toFixed(2)}</span>
                          )}
                        </td>
                      )}
                      <td className="py-3 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-950/30"
                          onClick={() => {
                            if (confirm("Delete this session?")) {
                              deleteSession.mutate({ id: session.id });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-zinc-700">
                    <td colSpan={2} className="py-3 text-sm font-bold text-white">
                      Totals
                    </td>
                    <td className="py-3 text-center text-sm font-bold text-white">
                      {payStats.totalMinutes} min
                    </td>
                    <td colSpan={isOnDemand ? 4 : 3} />
                    {isOnDemand && (
                      <td className="py-3 text-right text-sm font-bold text-[#c7ab77]">
                        ${payStats.cappedPay.toFixed(2)}
                      </td>
                    )}
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
