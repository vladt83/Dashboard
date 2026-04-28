import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone, User as UserIcon, CalendarDays } from "lucide-react";

/**
 * Closer-facing list of calls booked for them by setters.
 * For admins, this shows all bookings across the team.
 */
export default function SetterBookings() {
  const { data: me } = trpc.auth.me.useQuery();
  const isAdmin = me?.role === "admin";

  const myAssigned = trpc.bookedCalls.listAssignedToMe.useQuery(undefined, {
    enabled: !isAdmin,
  });
  const all = trpc.bookedCalls.listAll.useQuery(undefined, {
    enabled: isAdmin,
  });

  const setters = trpc.team.getByRole.useQuery({ role: "setter" });
  const closers = trpc.team.getByRole.useQuery({ role: "closer" });

  const settersById = useMemo(() => {
    const m = new Map<number, string>();
    (setters.data ?? []).forEach(s => m.set(s.id, s.name));
    return m;
  }, [setters.data]);
  const closersById = useMemo(() => {
    const m = new Map<number, string>();
    (closers.data ?? []).forEach(c => m.set(c.id, c.name));
    return m;
  }, [closers.data]);

  const list = isAdmin ? all.data : myAssigned.data;
  const isLoading = isAdmin ? all.isLoading : myAssigned.isLoading;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Setter Bookings</h1>
        <p className="text-muted-foreground mt-1">
          {isAdmin
            ? "All calls booked by setters across the team."
            : "Calls booked for you by setters."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (list ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No bookings yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground border-b border-border/50">
                  <tr>
                    <th className="text-left py-2 font-medium">
                      <CalendarDays className="h-3.5 w-3.5 inline-block mr-1" />
                      Date
                    </th>
                    <th className="text-left py-2 font-medium">Client</th>
                    <th className="text-left py-2 font-medium">Phone</th>
                    {isAdmin && <th className="text-left py-2 font-medium">Setter</th>}
                    <th className="text-left py-2 font-medium">Closer</th>
                    <th className="text-left py-2 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {(list ?? []).map(b => (
                    <tr key={b.id} className="border-b border-border/30">
                      <td className="py-3">{b.bookedDate}</td>
                      <td className="py-3 flex items-center gap-2">
                        <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        {b.clientFirstName} {b.clientLastName}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5" />
                          {b.phoneNumber}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="py-3">
                          {settersById.get(b.setterId) ?? `Setter #${b.setterId}`}
                        </td>
                      )}
                      <td className="py-3">
                        {closersById.get(b.closerId) ?? `Closer #${b.closerId}`}
                      </td>
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
    </div>
  );
}
