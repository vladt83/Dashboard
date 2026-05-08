import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const ALLOWED_DOMAINS = ["traderfoundation.com", "traderfoundation.co"];

const ROLE_OPTIONS = [
  { value: "closer", label: "Closer", description: "Sales closer - access to deals and commissions" },
  { value: "payroll", label: "Payroll", description: "Payroll manager - access to payroll dashboard" },
  { value: "coach", label: "Coach", description: "On-demand coach - access to coaching sessions" },
  { value: "admin", label: "Admin", description: "Full access to all features" },
];

// Permissions based on role
const ROLE_PERMISSIONS: Record<string, string[]> = {
  closer: ["/", "/new-entry", "/my-deals"],
  coach: ["/", "/coaching-sessions"],
  payroll: ["/", "/payment-plans", "/payroll", "/payouts"],
  admin: ["*"],
};

export default function Login() {
  const [, navigate] = useLocation();
  const [isLoading, setIsLoading] = useState(false);

  // Sign-in form state — email + password. New users (and existing
  // accounts that never had a password set) sign in with the default
  // password "trader" the first time, then change it from Settings.
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register form state
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [registerRole, setRegisterRole] = useState("");

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      toast.success("Signed in.");
      navigate("/");
      window.location.reload();
    },
    onError: (error) => {
      toast.error(error.message || "Sign-in failed");
      setIsLoading(false);
    },
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginEmail.includes("@")) {
      toast.error("Enter your email.");
      return;
    }
    if (!loginPassword) {
      toast.error("Enter your password.");
      return;
    }
    setIsLoading(true);
    loginMutation.mutate({
      email: loginEmail.toLowerCase().trim(),
      password: loginPassword,
    });
  };
  
  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: () => {
      toast.success("Account created! You can now log in.");
      navigate("/");
      window.location.reload();
    },
    onError: (error) => {
      toast.error(error.message || "Registration failed");
      setIsLoading(false);
    },
  });
  
  const validateEmailDomain = (email: string): boolean => {
    const domain = email.split("@")[1]?.toLowerCase();
    return ALLOWED_DOMAINS.includes(domain);
  };
  
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerName || !registerEmail || !registerPassword || !registerRole) {
      toast.error("Please fill in all fields including your role");
      return;
    }
    if (!validateEmailDomain(registerEmail)) {
      toast.error("Only @traderfoundation.com and @traderfoundation.co emails are allowed");
      return;
    }
    if (registerPassword !== registerConfirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (registerPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setIsLoading(true);
    
    const permissions = ROLE_PERMISSIONS[registerRole] || ["/"];
    
    registerMutation.mutate({
      name: registerName,
      email: registerEmail,
      password: registerPassword,
      role: registerRole as "closer" | "payroll" | "coach" | "admin",
      permissions,
    });
  };
  
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card border-border">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img
              src="/logo.png"
              alt="Trader Foundation"
              className="w-20 h-20 object-contain drop-shadow-[0_0_20px_rgba(199,171,119,0.25)]"
            />
          </div>
          <CardTitle className="text-2xl text-primary tracking-tight">Trader Foundation</CardTitle>
          <CardDescription>Commission Tracker</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign In</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              {/* Email + password sign-in. Same flow for every role. */}
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  {/* type="text" + inputMode="email" gives the email
                      keyboard on iOS but bypasses Safari's "string did
                      not match the expected pattern" form-validation
                      block, which is overzealous about autofilled
                      values. Server-side z.string().email() still
                      validates. */}
                  <Input
                    id="login-email"
                    type="text"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="you@traderfoundation.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    disabled={isLoading}
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="register-name">Full Name</Label>
                  <Input
                    id="register-name"
                    type="text"
                    placeholder="John Doe"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email">Email</Label>
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="you@traderfoundation.com"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Only @traderfoundation.com and @traderfoundation.co emails allowed
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-role">Your Role</Label>
                  <Select value={registerRole} onValueChange={setRegisterRole} disabled={isLoading}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your role" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          <div className="flex flex-col">
                            <span className="font-medium">{role.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {registerRole && (
                    <p className="text-xs text-muted-foreground">
                      {ROLE_OPTIONS.find(r => r.value === registerRole)?.description}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">Password</Label>
                  <Input
                    id="register-password"
                    type="password"
                    placeholder="••••••••"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-confirm">Confirm Password</Label>
                  <Input
                    id="register-confirm"
                    type="password"
                    placeholder="••••••••"
                    value={registerConfirmPassword}
                    onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
