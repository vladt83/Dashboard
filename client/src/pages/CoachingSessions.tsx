import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  Plus, Trash2, ChevronLeft, ChevronRight, GraduationCap, 
  Clock, DollarSign, AlertTriangle, Link2, ExternalLink 
} from "lucide-react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const RATE_PER_MINUTE = 0.90;
const NO_SHOW_RATE = 15.00;

export default function CoachingSessions() {
  const { user } = useAuth();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteSessionId, setDeleteSessionId] = useState<number | null>(null);
  const [isNoShow, setIsNoShow] = useState(false);
  const [recordingWarning, setRecordingWarning] = useState(false);

  // Form state
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split("T")[0]);
  const [clientName, setClientName] = useState("");
  const [minutes, setMinutes] = useState("");
  const [tradingLog, setTradingLog] = useState<"yes" | "no" | "too_new">("yes");
  const [fuSession, setFuSession] = useState(false);
  const [fuAssignments, setFuAssignments] = useState("");
  const [notes, setNotes] = useState("");
  const [recordingLink, setRecordingLink] = useState("");

  // Get on-demand coach payees
  const { data: payees } = trpc.payees.getAll.useQuery();
  const coachPayees = useMemo(() => 
    payees?.filter((p: any) => p.type === "on_demand_coach" || p.type === "coach") || [],
    [payees]
  );

  // For now, use the first on-demand coach payee or allow selection
  const [selectedCoachId, setSelectedCoachId] = useState<number | null>(null);
  const activeCoachId = selectedCoachId || coachPayees[0]?.id || null;

  // Get sessions for selected month
  const { data: sessions, isLoading } = trpc.coachingSessions.getAllByMonth.useQuery(
    { year: selectedYear, month: selectedMonth },
    { enabled: true }
  );

  // Get summary
  const { data: summary } = trpc.coachingSessions.getSummary.useQuery(
    { coachPayeeId: activeCoachId!, year: selectedYear, month: selectedMonth },
    { enabled: !!activeCoachId }
  );

  const utils = trpc.useUtils();

  const createMutation = trpc.coachingSessions.create.useMutation({
    onSuccess: () => {
      utils.coachingSessions.getAllByMonth.invalidate();
      utils.coachingSessions.getSummary.invalidate();
      toast.success("Session added successfully");
      resetForm();
      setShowAddDialog(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.coachingSessions.delete.useMutation({
    onSuccess: () => {
      utils.coachingSessions.getAllByMonth.invalidate();
      utils.coachingSessions.getSummary.invalidate();
      toast.success("Session deleted");
      setShowDeleteDialog(false);
      setDeleteSessionId(null);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setSessionDate(new Date().toISOString().split("T")[0]);
    setClientName("");
    setMinutes("");
    setTradingLog("yes");
    setFuSession(false);
    setFuAssignments("");
    setNotes("");
    setRecordingLink("");
    setIsNoShow(false);
    setRecordingWarning(false);
  };

  const handleSubmit = () => {
    if (!activeCoachId) {
      toast.error("No coach payee found. Please add an on-demand coach in the Payroll Dashboard first.");
      return;
    }
    if (!clientName.trim()) {
      toast.error("Client name is required");
      return;
    }
    if (!isNoShow && (!minutes || parseInt(minutes) <= 0)) {
      toast.error("Session time (minutes) is required");
      return;
    }
    
    // Check recording link for non-no-show sessions
    if (!isNoShow && !recordingLink.trim()) {
      setRecordingWarning(true);
      return;
    }

    createMutation.mutate({
      coachPayeeId: activeCoachId,
      sessionDate,
      clientName: clientName.trim(),
      minutes: isNoShow ? 0 : parseInt(minutes),
      tradingLog,
      fuSession,
      fuAssignments: fuAssignments.trim() || undefined,
      notes: notes.trim() || undefined,
      recordingLink: recordingLink.trim() || undefined,
      isNoShow,
      month: selectedMonth,
      year: selectedYear,
    });
  };

  const prevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const nextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const completedSessions = sessions?.filter((s: any) => !s.isNoShow) || [];
  const noShowSessions = sessions?.filter((s: any) => s.isNoShow) || [];

  const totalMinutes = completedSessions.reduce((sum: number, s: any) => sum + s.minutes, 0);
  const sessionPay = totalMinutes * RATE_PER_MINUTE;
  const noShowPay = noShowSessions.length * NO_SHOW_RATE;
  const totalPay = sessionPay + noShowPay;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            Coaching Sessions
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track coaching sessions, calculate pay, and manage no-shows
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowAddDialog(true); }} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Session
        </Button>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-center gap-4">
        <Button variant="outline" size="icon" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold min-w-[200px] text-center">
          {MONTHS[selectedMonth - 1]} {selectedYear}
        </h2>
        <Button variant="outline" size="icon" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <GraduationCap className="h-4 w-4" />
              Sessions
            </div>
            <p className="text-2xl font-bold mt-1">{completedSessions.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Clock className="h-4 w-4" />
              Total Minutes
            </div>
            <p className="text-2xl font-bold mt-1">{totalMinutes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <AlertTriangle className="h-4 w-4" />
              No Shows
            </div>
            <p className="text-2xl font-bold mt-1">{noShowSessions.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <DollarSign className="h-4 w-4" />
              Total Pay
            </div>
            <p className="text-2xl font-bold mt-1 text-green-500">
              ${totalPay.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sessions: ${sessionPay.toFixed(2)} + No Shows: ${noShowPay.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Completed Sessions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Completed Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading sessions...</div>
          ) : completedSessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No completed sessions for {MONTHS[selectedMonth - 1]} {selectedYear}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Date</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Client Name</th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground">Time (min)</th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground">Trading Log</th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground">FU Session</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">FU Assignments</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Notes</th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground">Recording</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Pay</th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {completedSessions.map((session: any) => (
                    <tr key={session.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                      <td className="py-2 px-3">
                        {new Date(session.sessionDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </td>
                      <td className="py-2 px-3 font-medium">{session.clientName}</td>
                      <td className="py-2 px-3 text-center">{session.minutes}</td>
                      <td className="py-2 px-3 text-center">
                        <Badge variant={
                          session.tradingLog === "yes" ? "default" : 
                          session.tradingLog === "no" ? "destructive" : "secondary"
                        } className="text-xs">
                          {session.tradingLog === "too_new" ? "Too New" : session.tradingLog === "yes" ? "Yes" : "No"}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Badge variant={session.fuSession ? "default" : "destructive"} className="text-xs">
                          {session.fuSession ? "Yes" : "No"}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-muted-foreground max-w-[150px] truncate">
                        {session.fuAssignments || "—"}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground max-w-[200px] truncate">
                        {session.notes || "—"}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {session.recordingLink ? (
                          <a 
                            href={session.recordingLink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary/80 inline-flex items-center gap-1"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <span className="text-destructive text-xs">Missing</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-medium text-green-500">
                        ${(session.minutes * RATE_PER_MINUTE).toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            setDeleteSessionId(session.id);
                            setShowDeleteDialog(true);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border font-semibold">
                    <td className="py-2 px-3" colSpan={2}>Total</td>
                    <td className="py-2 px-3 text-center">{totalMinutes} min</td>
                    <td colSpan={5}></td>
                    <td className="py-2 px-3 text-right text-green-500">${sessionPay.toFixed(2)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* No Show Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            No Show Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {noShowSessions.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              No no-show sessions for {MONTHS[selectedMonth - 1]} {selectedYear}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Date</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Client Name</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Notes</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Pay</th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {noShowSessions.map((session: any) => (
                    <tr key={session.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                      <td className="py-2 px-3">
                        {new Date(session.sessionDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </td>
                      <td className="py-2 px-3 font-medium">{session.clientName}</td>
                      <td className="py-2 px-3 text-muted-foreground">{session.notes || "—"}</td>
                      <td className="py-2 px-3 text-right font-medium text-amber-500">${NO_SHOW_RATE.toFixed(2)}</td>
                      <td className="py-2 px-3 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            setDeleteSessionId(session.id);
                            setShowDeleteDialog(true);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border font-semibold">
                    <td className="py-2 px-3" colSpan={2}>Total ({noShowSessions.length} no-shows)</td>
                    <td></td>
                    <td className="py-2 px-3 text-right text-amber-500">${noShowPay.toFixed(2)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Session Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isNoShow ? "Log No-Show" : "Add Coaching Session"}</DialogTitle>
            <DialogDescription>
              {isNoShow 
                ? "Record a no-show session ($15 flat rate)" 
                : "Record a completed coaching session ($0.90/min)"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Toggle between session and no-show */}
            <div className="flex gap-2">
              <Button
                variant={!isNoShow ? "default" : "outline"}
                size="sm"
                onClick={() => setIsNoShow(false)}
                className="flex-1"
              >
                Completed Session
              </Button>
              <Button
                variant={isNoShow ? "default" : "outline"}
                size="sm"
                onClick={() => setIsNoShow(true)}
                className="flex-1"
              >
                No Show
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Session Date</Label>
                <Input
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Client Name</Label>
                <Input
                  placeholder="Enter client name"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
              </div>
            </div>

            {!isNoShow && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Time (minutes)</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 35"
                      value={minutes}
                      onChange={(e) => setMinutes(e.target.value)}
                    />
                    {minutes && parseInt(minutes) > 0 && (
                      <p className="text-xs text-green-500 mt-1">
                        Pay: ${(parseInt(minutes) * RATE_PER_MINUTE).toFixed(2)}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Trading Log</Label>
                    <Select value={tradingLog} onValueChange={(v: any) => setTradingLog(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="too_new">Too New</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Follow-Up Session?</Label>
                    <Select value={fuSession ? "yes" : "no"} onValueChange={(v) => setFuSession(v === "yes")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>FU Assignments</Label>
                    <Input
                      placeholder="Optional"
                      value={fuAssignments}
                      onChange={(e) => setFuAssignments(e.target.value)}
                    />
                  </div>
                </div>

                {/* Recording Link - REQUIRED */}
                <div>
                  <Label className="flex items-center gap-1">
                    <Link2 className="h-3.5 w-3.5" />
                    Recording Link
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="Paste recording URL here"
                    value={recordingLink}
                    onChange={(e) => {
                      setRecordingLink(e.target.value);
                      if (e.target.value.trim()) setRecordingWarning(false);
                    }}
                    className={recordingWarning ? "border-destructive" : ""}
                  />
                  {recordingWarning && (
                    <div className="flex items-center gap-2 mt-2 p-2 bg-destructive/10 border border-destructive/30 rounded-md">
                      <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                      <p className="text-xs text-destructive font-medium">
                        Recording link is required. You will NOT get paid for this session without attaching the recording link.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            <div>
              <Label>Notes</Label>
              <Textarea
                placeholder="Session notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Adding..." : isNoShow ? "Log No-Show" : "Add Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recording Warning Dialog */}
      {/* This is handled inline in the form above */}

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Session</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this session? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteSessionId && deleteMutation.mutate({ id: deleteSessionId })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
