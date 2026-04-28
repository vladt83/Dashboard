import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Shield, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const AVAILABLE_PAGES = [
  { path: "/", label: "Dashboard", description: "Main performance dashboard" },
  { path: "/new-entry", label: "New Entry", description: "Create new deals" },
  { path: "/my-deals", label: "My Deals", description: "View and manage deals" },
  { path: "/payment-plans", label: "Payment Plans", description: "Track payment plan collections" },
  { path: "/payroll", label: "Payroll Dashboard", description: "Manage payroll and payees" },
  { path: "/payouts", label: "Commission Payouts", description: "View commission payouts" },
  { path: "/reports", label: "Reports", description: "Analytics and reports" },
  { path: "/settings", label: "Settings", description: "App settings" },
  { path: "/users", label: "User Management", description: "Manage users (admin only)" },
];

type UserRole = "closer" | "payroll" | "admin" | "coach";

const ROLE_LABELS: Record<UserRole, string> = {
  closer: "Closer",
  payroll: "Payroll",
  admin: "Admin",
  coach: "Coach",
};

const ROLE_COLORS: Record<UserRole, string> = {
  closer: "bg-blue-500/20 text-blue-400",
  payroll: "bg-purple-500/20 text-purple-400",
  admin: "bg-amber-500/20 text-amber-400",
  coach: "bg-green-500/20 text-green-400",
};

export default function UserManagement() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{
    id: number;
    email: string;
    name: string | null;
    role: string;
    permissions: string | null;
  } | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  
  // New user form
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("closer");
  const [newPermissions, setNewPermissions] = useState<string[]>(["/"]);
  
  const utils = trpc.useUtils();
  
  const { data: users, isLoading } = trpc.users.getAll.useQuery();
  
  const createUserMutation = trpc.users.create.useMutation({
    onSuccess: () => {
      toast.success("User created successfully");
      setIsAddDialogOpen(false);
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("closer");
      setNewPermissions(["/"]);
      utils.users.getAll.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create user");
    },
  });
  
  const updatePermissionsMutation = trpc.users.updatePermissions.useMutation({
    onSuccess: () => {
      toast.success("Permissions updated");
      setIsEditDialogOpen(false);
      setSelectedUser(null);
      utils.users.getAll.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update permissions");
    },
  });
  
  const updateRoleMutation = trpc.users.updateRole.useMutation({
    onSuccess: () => {
      toast.success("Role updated");
      utils.users.getAll.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update role");
    },
  });
  
  const deleteUserMutation = trpc.users.delete.useMutation({
    onSuccess: () => {
      toast.success("User deleted");
      utils.users.getAll.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete user");
    },
  });
  
  const handleEditPermissions = (user: typeof selectedUser) => {
    setSelectedUser(user);
    setSelectedPermissions(getUserPermissions(user?.permissions ?? null));
    setIsEditDialogOpen(true);
  };
  
  const handleSavePermissions = () => {
    if (!selectedUser) return;
    updatePermissionsMutation.mutate({
      userId: selectedUser.id,
      permissions: selectedPermissions,
    });
  };
  
  const handleCreateUser = () => {
    if (!newName || !newEmail || !newPassword) {
      toast.error("Please fill in all fields");
      return;
    }
    createUserMutation.mutate({
      name: newName,
      email: newEmail,
      password: newPassword,
      role: newRole,
      permissions: newPermissions,
    });
  };
  
  const togglePermission = (path: string, permissions: string[], setPermissions: (p: string[]) => void) => {
    if (permissions.includes(path)) {
      setPermissions(permissions.filter(p => p !== path));
    } else {
      setPermissions([...permissions, path]);
    }
  };
  
  const getUserPermissions = (permissionsJson: string | null): string[] => {
    try {
      const perms = permissionsJson ? JSON.parse(permissionsJson) : [];
      return Array.isArray(perms) ? perms : [];
    } catch {
      return [];
    }
  };
  
  // Set default permissions when role changes
  const handleRoleChange = (role: UserRole) => {
    setNewRole(role);
    switch (role) {
      case 'admin':
        setNewPermissions(['/', '/new-entry', '/my-deals', '/payment-plans', '/payroll', '/payouts', '/reports', '/settings', '/users']);
        break;
      case 'payroll':
        setNewPermissions(['/', '/payment-plans', '/payroll', '/payouts']);
        break;
      case 'coach':
        setNewPermissions(['/', '/coaching-sessions']);
        break;
      case 'closer':
      default:
        setNewPermissions(['/', '/new-entry', '/my-deals']);
        break;
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">User Management</h1>
          <p className="text-zinc-400">Manage user accounts and permissions</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-amber-500 hover:bg-amber-600 text-black">
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-zinc-800">
            <DialogHeader>
              <DialogTitle className="text-white">Add New User</DialogTitle>
              <DialogDescription className="text-zinc-400">
                Create a new user account with specific permissions
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-zinc-300">Name</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="John Doe"
                  className="bg-zinc-800 border-zinc-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300">Email</Label>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="john@traderfoundation.com"
                  className="bg-zinc-800 border-zinc-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300">Password</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-zinc-800 border-zinc-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300">Role</Label>
                <Select value={newRole} onValueChange={(v) => handleRoleChange(v as UserRole)}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    <SelectItem value="closer">Closer</SelectItem>
                    <SelectItem value="coach">Coach</SelectItem>
                    <SelectItem value="payroll">Payroll</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-zinc-500">
                  {newRole === 'closer' && "Closers can create deals and view their own performance"}
                  {newRole === 'coach' && "Coaches can log coaching sessions and view their pay"}
                  {newRole === 'payroll' && "Payroll can manage payments and commissions"}
                  {newRole === 'admin' && "Admins have full access to all features"}
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300">Page Access</Label>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_PAGES.map((page) => (
                    <div key={page.path} className="flex items-center space-x-2">
                      <Checkbox
                        id={`new-${page.path}`}
                        checked={newPermissions.includes(page.path)}
                        onCheckedChange={() => togglePermission(page.path, newPermissions, setNewPermissions)}
                        className="border-amber-500/50 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                      />
                      <label htmlFor={`new-${page.path}`} className="text-sm text-zinc-300">
                        {page.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="border-zinc-700 text-zinc-300">
                Cancel
              </Button>
              <Button 
                onClick={handleCreateUser} 
                className="bg-amber-500 hover:bg-amber-600 text-black"
                disabled={createUserMutation.isPending}
              >
                {createUserMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create User"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="h-5 w-5 text-amber-500" />
            All Users
          </CardTitle>
          <CardDescription className="text-zinc-400">
            {users?.length || 0} registered users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users?.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg border border-zinc-700"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <span className="text-amber-500 font-semibold">
                      {(user.name || user.email)[0].toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-white">{user.name || "Unnamed"}</p>
                      <Badge className={ROLE_COLORS[user.role as UserRole] || "bg-zinc-500/20 text-zinc-400"}>
                        {ROLE_LABELS[user.role as UserRole] || user.role}
                      </Badge>
                    </div>
                    <p className="text-sm text-zinc-400">{user.email}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-1">
                    {getUserPermissions(user.permissions).map((perm) => {
                      const page = AVAILABLE_PAGES.find(p => p.path === perm);
                      return (
                        <Badge key={perm} variant="outline" className="text-xs border-zinc-600 text-zinc-400">
                          {page?.label || perm}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditPermissions(user)}
                  >
                    Edit Access
                  </Button>
                  <Select
                    value={user.role}
                    onValueChange={(v) => updateRoleMutation.mutate({ userId: user.id, role: v as UserRole })}
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="closer">Closer</SelectItem>
                      <SelectItem value="coach">Coach</SelectItem>
                      <SelectItem value="payroll">Payroll</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                    onClick={() => {
                      if (confirm(`Delete user ${user.name || user.email}?`)) {
                        deleteUserMutation.mutate({ userId: user.id });
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Edit Permissions Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Permissions</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Update page access for {selectedUser?.name || selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-3">
              {AVAILABLE_PAGES.map((page) => (
                <div key={page.path} className="flex items-start space-x-3 p-2 rounded hover:bg-zinc-800/50">
                  <Checkbox
                    id={`edit-${page.path}`}
                    checked={selectedPermissions.includes(page.path)}
                    onCheckedChange={() => togglePermission(page.path, selectedPermissions, setSelectedPermissions)}
                    className="mt-0.5 border-amber-500/50 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                  />
                  <div>
                    <label htmlFor={`edit-${page.path}`} className="text-sm font-medium text-white cursor-pointer">
                      {page.label}
                    </label>
                    <p className="text-xs text-zinc-500">{page.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="border-zinc-700 text-zinc-300">
              Cancel
            </Button>
            <Button 
              onClick={handleSavePermissions} 
              className="bg-amber-500 hover:bg-amber-600 text-black"
              disabled={updatePermissionsMutation.isPending}
            >
              {updatePermissionsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
