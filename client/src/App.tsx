import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import NewDeal from "./pages/NewDeal";
import Payouts from "./pages/Payouts";
import Settings from "./pages/Settings";
import MyDeals from "./pages/MyDeals";
import PayrollDashboard from "./pages/PayrollDashboard";
import PaymentPlans from "./pages/PaymentPlans";
import Reports from "./pages/Reports";
import Login from "./pages/Login";
import UserManagement from "./pages/UserManagement";
import CoachingSessions from "./pages/CoachingSessions";
import CoachDashboard from "./pages/CoachDashboard";
import CloserDashboard from "./pages/CloserDashboard";
import SetterDashboard from "./pages/SetterDashboard";
import SetterBookings from "./pages/SetterBookings";
import SOPHub from "./pages/sop/SOPHub";
import SetterSOP from "./pages/sop/SetterSOP";
import CloserSOP from "./pages/sop/CloserSOP";
import CoachSOP from "./pages/sop/CoachSOP";
import PayrollSOP from "./pages/sop/PayrollSOP";
import AdminSOP from "./pages/sop/AdminSOP";
import MindMap from "./pages/MindMap";
import SalesTracker from "./pages/SalesTracker";
import ChangePassword from "./pages/ChangePassword";
import Onboarding from "./pages/Onboarding";
import ClientProfile from "./pages/ClientProfile";
import ClientDashboard from "./pages/ClientDashboard";
import ClientDirectory from "./pages/ClientDirectory";
import MagicLogin from "./pages/MagicLogin";
import { trpc } from "./lib/trpc";
import { Loader2 } from "lucide-react";

function AuthenticatedRouter() {
  const { data: user, isLoading } = trpc.auth.me.useQuery();
  const [location] = useLocation();
  
  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }
  
  // If not logged in, show the login page UNLESS they're hitting the magic
  // link consumer route (/login/magic?token=...) — that needs to render even
  // without a session so we can sign them in.
  if (!user) {
    if (location.startsWith("/login/magic")) {
      return <MagicLogin />;
    }
    return <Login />;
  }
  
  // Check if user has permission to access current route
  const userPermissions: string[] = (() => {
    try {
      // Admin has access to everything
      if (user.role === "admin") {
        return ["*"];
      }
      const perms = user.permissions ? JSON.parse(user.permissions as string) : ["/"];
      return Array.isArray(perms) ? perms : ["/"];
    } catch {
      return ["/"];
    }
  })();
  
  const hasAccess = userPermissions.includes("*") || userPermissions.includes(location);
  
  // Map route paths to their base paths for permission checking. Dynamic
  // segments (e.g. /clients/:id) collapse to their parent so the permissions
  // list only needs the static prefix.
  const getBasePath = (path: string): string => {
    if (path === "/deals/new") return "/new-entry";
    if (path.startsWith("/clients/")) return "/clients";
    return path;
  };
  
  const basePath = getBasePath(location);
  const hasBaseAccess = userPermissions.includes("*") || userPermissions.includes(basePath);
  
  // Coach role gets their own dashboard
  if (user.role === "coach") {
    return (
      <DashboardLayout>
        <Switch>
          <Route path="/" component={CoachDashboard} />
          <Route path="/coaching-sessions" component={CoachDashboard} />
          <Route path="/clients" component={ClientDirectory} />
          <Route path="/clients/:dealId" component={ClientProfile} />
          <Route path="/sop" component={CoachSOP} />
          <Route path="/change-password" component={ChangePassword} />
          <Route component={CoachDashboard} />
        </Switch>
      </DashboardLayout>
    );
  }

  // Closer role gets limited view - only their own data
  if (user.role === "closer") {
    return (
      <DashboardLayout>
        <Switch>
          <Route path="/" component={CloserDashboard} />
          <Route path="/my-deals" component={MyDeals} />
          <Route path="/deals/new" component={NewDeal} />
          <Route path="/new-entry" component={NewDeal} />
          <Route path="/sales-tracker" component={SalesTracker} />
          <Route path="/setter-bookings" component={SetterBookings} />
          <Route path="/clients" component={ClientDirectory} />
          <Route path="/clients/:dealId" component={ClientProfile} />
          <Route path="/sop" component={CloserSOP} />
          <Route path="/change-password" component={ChangePassword} />
          <Route component={CloserDashboard} />
        </Switch>
      </DashboardLayout>
    );
  }

  // Client role — the trader who paid for the program. Trading log + coach
  // card + Skool link. This dashboard grows over time.
  if (user.role === "client") {
    return (
      <DashboardLayout>
        <Switch>
          <Route path="/" component={ClientDashboard} />
          <Route path="/trading-log" component={ClientDashboard} />
          <Route path="/change-password" component={ChangePassword} />
          <Route component={ClientDashboard} />
        </Switch>
      </DashboardLayout>
    );
  }

  // Setter role: book calls + see her own bookings + her capped payouts.
  // Setters now also see the full Client Directory — they need to follow
  // a prospect through the funnel they helped fill.
  if (user.role === "setter") {
    return (
      <DashboardLayout>
        <Switch>
          <Route path="/" component={SetterDashboard} />
          <Route path="/setter-dashboard" component={SetterDashboard} />
          <Route path="/clients" component={ClientDirectory} />
          <Route path="/clients/:dealId" component={ClientProfile} />
          <Route path="/sop" component={SetterSOP} />
          <Route path="/change-password" component={ChangePassword} />
          <Route component={SetterDashboard} />
        </Switch>
      </DashboardLayout>
    );
  }

  // Payroll role (Ariana — onboarding + payroll)
  if (user.role === "payroll") {
    return (
      <DashboardLayout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/onboarding" component={Onboarding} />
          <Route path="/clients" component={ClientDirectory} />
          <Route path="/clients/:dealId" component={ClientProfile} />
          <Route path="/payroll" component={PayrollDashboard} />
          <Route path="/payouts" component={Payouts} />
          <Route path="/payment-plans" component={PaymentPlans} />
          <Route path="/coaching-sessions" component={CoachingSessions} />
          <Route path="/sop" component={PayrollSOP} />
          <Route path="/change-password" component={ChangePassword} />
          <Route component={Dashboard} />
        </Switch>
      </DashboardLayout>
    );
  }

  // Admin gets everything
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/deals/new" component={NewDeal} />
        <Route path="/new-entry" component={NewDeal} />
        <Route path="/payouts" component={Payouts} />
        <Route path="/payroll" component={PayrollDashboard} />
        <Route path="/payment-plans" component={PaymentPlans} />
        <Route path="/onboarding" component={Onboarding} />
        <Route path="/clients/:dealId" component={ClientProfile} />
        <Route path="/reports" component={Reports} />
        <Route path="/my-deals" component={MyDeals} />
        <Route path="/setter-bookings" component={SetterBookings} />
        <Route path="/setter-dashboard" component={SetterDashboard} />
        <Route path="/sales-tracker" component={SalesTracker} />
        <Route path="/sop" component={SOPHub} />
        <Route path="/sop/setter" component={SetterSOP} />
        <Route path="/sop/closer" component={CloserSOP} />
        <Route path="/sop/coach" component={CoachSOP} />
        <Route path="/sop/payroll" component={PayrollSOP} />
        <Route path="/sop/admin" component={AdminSOP} />
        <Route path="/mindmap" component={MindMap} />
        <Route path="/settings" component={Settings} />
        <Route path="/users" component={UserManagement} />
        <Route path="/coaching-sessions" component={CoachingSessions} />
        <Route path="/coach-dashboard" component={CoachDashboard} />
        <Route path="/closer-dashboard" component={CloserDashboard} />
        <Route path="/client-dashboard" component={ClientDashboard} />
          <Route path="/change-password" component={ChangePassword} />
          <Route path="/login" component={Login} />
          <Route path="/404" component={NotFound} />
          <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <AuthenticatedRouter />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
