import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  CalendarPlus,
  ListChecks,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Phone,
  User as UserIcon,
} from "lucide-react";

export default function SetterDashboard() {
  const [tab, setTab] = useState<"book" | "bookings" | "payouts">("book");

  // Month selector state for the Payouts tab.
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  // Form state for booking a new call.
  const [form, setForm] = useState({
    clientFirstName: "",
    clientLastName: "",
    phoneNumber: "",
    closerId: "",
    notes: "",
  });

  const closersQuery = trpc.team.getByRole.useQuery({ role: "closer" });
  const myBookingsQuery = trpc.bookedCalls.listMine.useQuery();
  const payoutsQuery = trpc.setter.payouts.useQuery({ year, month });

  const bookCall = trpc.bookedCalls.create.useMutation({
    onSuccess: () => {
      toast.success("Call booked.");
      setForm({
        clientFirstName: "",
        clientLastName: "",
        phoneNumber: "",
        closerId: "",
        notes: "",
      });
      myBookingsQuery.refetch();
      setTab("bookings");
    },
    onError: err => toast.error(err.message),
  });

  const closersById = useMemo(() => {
    const map = new Map<number, string>();
    (closersQuery.data ?? []).forEach(c => map.set(c.id, c.name));
    return map;
  }, [closersQuery.data]);

  const handleBook = () => {
    if (!form.clientFirstName.trim() || !form.clientLastName.trim()) {
      toast.error("First and last name are required.");
      return;
    }
    if (!form.phoneNumber.trim() || form.phoneNumber.replace(/\D/g, "").length < 7) {
      toast.error("Phone number is required.");
      return;
    }
    if (!form.closerId) {
      toast.error("Pick the closer this call is assigned to.");
      return;
    }
    bookCall.mutate({
      clientFirstName: form.clientFirstName.trim(),
      clientLastName: form.clientLastName.trim(),
      phoneNumber: form.phoneNumber.trim(),
      closerId: parseInt(form.closerId),
      notes: form.notes.trim() || undefined,
    });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Setter Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Book calls, see your assignments, and track your payouts.
        </p>
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as typeof tab)} className="space-y-4">
        <TabsList className="grid grid-cols-3 max-w-xl">
          <TabsTrigger value="book" className="gap-2">
            <CalendarPlus className="h-4 w-4" />
            Book Call
          </TabsTrigger>
          <TabsTrigger value="bookings" className="gap-2">
            <ListChecks className="h-4 w-4" />
            My Bookings
          </TabsTrigger>
          <TabsTrigger value="payouts" className="gap-2">
            <DollarSign className="h-4 w-4" />
            My Payouts
          </TabsTrigger>
        </TabsList>

        {/* ─────────── Book Call ─────────── */}
        <TabsContent value="book">
          <Card>
            <CardHeader>
              <CardTitle>Book a New Call</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Client First Name</Label>
                  <Input
                    id="firstName"
                    value={form.clientFirstName}
                    onChange={e => setForm(f => ({ ...f, clientFirstName: e.target.value }))}
                    placeholder="Jane"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Client Last Name</Label>
                  <Input
                    id="lastName"
                    value={form.clientLastName}
                    onChange={e => setForm(f => ({ ...f, clientLastName: e.target.value }))}
                    placeholder="Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={form.phoneNumber}
                    onChange={e => setForm(f => ({ ...f, phoneNumber: e.target.value }))}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="closer">Assigned Closer</Label>
                  <Select
                    value={form.closerId}
                    onValueChange={v => setForm(f => ({ ...f, closerId: v }))}
                  >
                    <SelectTrigger id="closer">
                      <SelectValue placeholder="Select closer" />
                    </SelectTrigger>
                    <SelectContent>
                      {(closersQuery.data ?? []).map(c => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Anything the closer should know — context from the text thread, urgency, etc."
                  rows={3}
                />
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleBook}
                  disabled={bookCall.isPending}
                  className="bg-primary hover:bg-primary/90"
                >
                  {bookCall.isPending ? "Booking…" : "Book Call"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─────────── My Bookings ─────────── */}
        <TabsContent value="bookings">
          <Card>
            <CardHeader>
              <CardTitle>My Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              {myBookingsQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (myBookingsQuery.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No bookings yet. Book your first call from the “Book Call” tab.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-muted-foreground border-b border-border/50">
                      <tr>
                        <th className="text-left py-2 font-medium">Date</th>
                        <th className="text-left py-2 font-medium">Client</th>
                        <th className="text-left py-2 font-medium">Phone</th>
                        <th className="text-left py-2 font-medium">Closer</th>
                        <th className="text-left py-2 font-medium">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(myBookingsQuery.data ?? []).map(b => (
                        <tr key={b.id} className="border-b border-border/30">
                          <td className="py-3">{b.bookedDate}</td>
                          <td className="py-3 flex items-center gap-2">
                            <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            {b.clientFirstName} {b.clientLastName}
                          </td>
                          <td className="py-3">
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <Phone className="h-3.5 w-3.5" />
                              {b.phoneNumber}
                            </span>
                          </td>
                          <td className="py-3">{closersById.get(b.closerId) ?? `Closer #${b.closerId}`}</td>
                          <td className="py-3 text-muted-foreground max-w-xs truncate">
                            {b.notes || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─────────── My Payouts ─────────── */}
        <TabsContent value="payouts" className="space-y-4">
          {/* Month selector */}
          <Card>
            <CardContent className="flex items-center justify-between py-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentDate(new Date(year, month - 2, 1))}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Prev
              </Button>
              <span className="font-semibold">
                {format(currentDate, "MMMM yyyy")}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentDate(new Date(year, month, 1))}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </CardContent>
          </Card>

          {/* Summary card */}
          <Card>
            <CardHeader>
              <CardTitle>Commission Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs uppercase text-muted-foreground tracking-wider">
                    Closed Deals This Month
                  </p>
                  <p className="text-2xl font-bold mt-1">
                    {payoutsQuery.data?.lines.length ?? 0}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground tracking-wider">
                    Commission Rate
                  </p>
                  <p className="text-2xl font-bold mt-1">
                    {((payoutsQuery.data?.rate ?? 0.03) * 100).toFixed(0)}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Capped at $
                    {(payoutsQuery.data?.cap ?? 6000).toLocaleString()} cash per deal
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground tracking-wider">
                    Total Commission
                  </p>
                  <p className="text-2xl font-bold mt-1 text-primary">
                    $
                    {(payoutsQuery.data?.totalCommission ?? 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Per-deal breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Deal Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {payoutsQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (payoutsQuery.data?.lines.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No closed deals attributed to you in {format(currentDate, "MMMM yyyy")}.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-muted-foreground border-b border-border/50">
                      <tr>
                        <th className="text-left py-2 font-medium">Deal Date</th>
                        <th className="text-right py-2 font-medium">Cash Collected (capped)</th>
                        <th className="text-right py-2 font-medium">Your Commission (3%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(payoutsQuery.data?.lines ?? []).map(line => (
                        <tr key={line.dealId} className="border-b border-border/30">
                          <td className="py-3">{line.dealDate}</td>
                          <td className="py-3 text-right">
                            $
                            {line.cappedCashCollected.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="py-3 text-right text-primary font-semibold">
                            $
                            {line.commission.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                <p>
                  Cash collected is shown capped at $
                  {(payoutsQuery.data?.cap ?? 6000).toLocaleString()} per deal.
                </p>
                <p>
                  <span className="text-amber-500 font-medium">Note:</span> setter
                  commission applies to one-time sales only. Subscriptions
                  (monthly recurring) are paid to the closer at 25% — they do
                  not appear in your payouts.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
