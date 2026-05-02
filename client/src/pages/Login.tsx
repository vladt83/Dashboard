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

  // Login form state — email only, no password. Magic link does the rest.
  const [loginEmail, setLoginEmail] = useState("");
  // Set when the server returns a clickable dev link (only when email
  // sending is stubbed because RESEND_API_KEY isn't configured). In prod
  // this is always null and the user uses the email instead.
  const [devLink, setDevLink] = useState<string | null>(null);
  const [linkSent, setLinkSent] = useState(false);

  // Register form state
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [registerRole, setRegisterRole] = useState("");

  // Magic-link request — the only sign-in path. Server always returns
  // success even for unknown emails (don't leak account existence).
  const magicLinkMutation = trpc.auth.requestMagicLink.useMutation({
    onSuccess: (r) => {
      toast.success(r.message ?? "Check your email for a sign-in link.");
      setLinkSent(true);
      setIsLoading(false);
      if (r.devLink) setDevLink(r.devLink);
    },
    onError: (error) => {
      toast.error(error.message || "Couldn't send sign-in link");
      setIsLoading(false);
    },
  });

  const handleMagicLink = () => {
    if (!loginEmail || !loginEmail.includes("@")) {
      toast.error("Enter your email first.");
      return;
    }
    setLinkSent(false);
    setDevLink(null);
    setIsLoading(true);
    magicLinkMutation.mutate({ email: loginEmail.toLowerCase().trim() });
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
              {/* The whole login flow: enter email → press send → check inbox.
                  No passwords. Same flow for clients and staff — one button. */}
              <form
                onSubmit={(e) => { e.preventDefault(); handleMagicLink(); }}
                className="space-y-4 mt-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@traderfoundation.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    disabled={isLoading}
                    autoFocus
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
                      Sending…
                    </>
                  ) : (
                    "Send sign-in link"
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center pt-2">
                  We'll email you a one-click link. No password to remember.
                </p>

                {linkSent && (
                  <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 mt-2 space-y-2">
                    <p className="text-xs font-semibold text-primary">
                      ✓ Sign-in link sent to {loginEmail}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Check your inbox (and spam) — click the link to sign in.
                    </p>
                    {devLink && (
                      <div className="pt-2 border-t border-border/30">
                        <p className="text-[10px] uppercase tracking-wider text-amber-400 font-bold mb-1">
                          Dev mode — email not actually sent
                        </p>
                        <a
                          href={devLink}
                          className="text-xs text-primary hover:underline break-all"
                        >
                          Click here to sign in →
                        </a>
                      </div>
                    )}
                  </div>
                )}
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
