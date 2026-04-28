import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, Users, Percent, DollarSign, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function Settings() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const isAdmin = user?.role === "admin";

  // Fetch team members
  const { data: teamMembers, isLoading: teamLoading } = trpc.team.getAll.useQuery();

  // Add team member dialog
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [newMember, setNewMember] = useState({ name: "", role: "closer" as "closer" | "payroll" });

  // Commission rate dialog
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<{ id: number; name: string; role: string } | null>(null);
  const [newRate, setNewRate] = useState({
    rate: "",
    showRate: "20",
    startMonth: (new Date().getMonth() + 1).toString(),
    startYear: new Date().getFullYear().toString(),
  });

  // Mutations
  const createMember = trpc.team.create.useMutation({
    onSuccess: () => {
      toast.success("Team member added successfully");
      setAddMemberOpen(false);
      setNewMember({ name: "", role: "closer" });
      utils.team.getAll.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add team member");
    },
  });

  const setCommissionRate = trpc.team.setCommissionRate.useMutation({
    onSuccess: () => {
      toast.success("Commission rate updated");
      setRateDialogOpen(false);
      setSelectedMember(null);
      utils.team.getAll.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update commission rate");
    },
  });

  const seedData = trpc.team.seed.useMutation({
    onSuccess: () => {
      toast.success("Initial team data seeded successfully");
      utils.team.getAll.invalidate();
      utils.team.getByRole.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to seed data");
    },
  });

  const handleAddMember = () => {
    if (!newMember.name.trim()) {
      toast.error("Please enter a name");
      return;
    }
    createMember.mutate(newMember);
  };

  const handleSetRate = () => {
    if (!selectedMember) return;
    const rate = parseFloat(newRate.rate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      toast.error("Please enter a valid rate (0-100)");
      return;
    }
    setCommissionRate.mutate({
      memberId: selectedMember.id,
      rate: rate / 100, // Convert percentage to decimal
      showRate: parseFloat(newRate.showRate) || 0,
      startMonth: parseInt(newRate.startMonth),
      startYear: parseInt(newRate.startYear),
    });
  };

  const openRateDialog = (member: { id: number; name: string; role: string }) => {
    setSelectedMember(member);
    setNewRate({
      rate: member.role === "closer" ? "15" : "3",
      showRate: "0",
      startMonth: (new Date().getMonth() + 1).toString(),
      startYear: new Date().getFullYear().toString(),
    });
    setRateDialogOpen(true);
  };

  // Redirect non-admin users
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p className="text-muted-foreground mb-4">
          You don't have permission to access this page.
        </p>
        <Button onClick={() => setLocation("/")}>
          Go to Dashboard
        </Button>
      </div>
    );
  }

  const closers = teamMembers?.filter(m => m.role === "closer") || [];
  const setters = teamMembers?.filter(m => m.role === "setter") || [];
  const payroll = teamMembers?.filter(m => m.role === "payroll") || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="hidden md:block">
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage team members and commission rates</p>
        </div>
        {isAdmin && (!teamMembers || teamMembers.length === 0) && (
          <Button onClick={() => seedData.mutate()} disabled={seedData.isPending}>
            {seedData.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Seed Initial Data
          </Button>
        )}
      </div>

      {/* Team Members */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Team Members
            </CardTitle>
            <CardDescription>Manage closers, setters, and payroll staff</CardDescription>
          </div>
          {isAdmin && (
            <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Team Member</DialogTitle>
                  <DialogDescription>Add a new closer, setter, or payroll staff member</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={newMember.name}
                      onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                      placeholder="Enter name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select
                      value={newMember.role}
                      onValueChange={(value: "closer" | "payroll") => setNewMember({ ...newMember, role: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="closer">Closer</SelectItem>
                        <SelectItem value="setter">Setter</SelectItem>
                        <SelectItem value="payroll">Payroll</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddMemberOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddMember} disabled={createMember.isPending}>
                    {createMember.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Add Member
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          {teamLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : teamMembers && teamMembers.length > 0 ? (
            <div className="space-y-6">
              {/* Closers */}
              {closers.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Badge className="bg-primary">Closers</Badge>
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {closers.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">{member.name}</TableCell>
                          <TableCell>
                            <Badge variant={member.active ? "default" : "secondary"}>
                              {member.active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {isAdmin && (
                              <Button variant="outline" size="sm" onClick={() => openRateDialog(member)}>
                                <Percent className="h-4 w-4 mr-1" />
                                Set Rate
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Setters */}
              {setters.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Badge variant="secondary">Setters</Badge>
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {setters.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">{member.name}</TableCell>
                          <TableCell>
                            <Badge variant={member.active ? "default" : "secondary"}>
                              {member.active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {isAdmin && (
                              <Button variant="outline" size="sm" onClick={() => openRateDialog(member)}>
                                <Percent className="h-4 w-4 mr-1" />
                                Set Rate
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Payroll */}
              {payroll.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Badge variant="outline">Payroll</Badge>
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payroll.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">{member.name}</TableCell>
                          <TableCell>
                            <Badge variant={member.active ? "default" : "secondary"}>
                              {member.active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No team members yet</p>
              {isAdmin && (
                <Button className="mt-4" onClick={() => seedData.mutate()} disabled={seedData.isPending}>
                  Seed Initial Data
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Commission Rate Dialog */}
      <Dialog open={rateDialogOpen} onOpenChange={setRateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Commission Rate</DialogTitle>
            <DialogDescription>
              Set the commission rate for {selectedMember?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Commission Rate (%)</Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={newRate.rate}
                  onChange={(e) => setNewRate({ ...newRate, rate: e.target.value })}
                  placeholder="e.g., 15 for 15%"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
              </div>
            </div>
            {selectedMember?.role === "setter" && (
              <div className="space-y-2">
                <Label>Show Commission ($)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    value={newRate.showRate}
                    onChange={(e) => setNewRate({ ...newRate, showRate: e.target.value })}
                    placeholder="20"
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Amount paid per show (when prepared)</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Month</Label>
                <Select
                  value={newRate.startMonth}
                  onValueChange={(value) => setNewRate({ ...newRate, startMonth: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthNames.map((month, index) => (
                      <SelectItem key={index} value={(index + 1).toString()}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Start Year</Label>
                <Select
                  value={newRate.startYear}
                  onValueChange={(value) => setNewRate({ ...newRate, startYear: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026, 2027].map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSetRate} disabled={setCommissionRate.isPending}>
              {setCommissionRate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Rate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
