import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard, LogOut, PanelLeft, PlusCircle, Settings, Wallet,
  FileText, CreditCard, CalendarDays, BarChart3, Users,
  ChevronDown, TrendingUp, DollarSign, Megaphone, ShieldCheck, GraduationCap, KeyRound,
  PhoneIncoming, CalendarPlus, BookOpen, Network, FileSpreadsheet, UserCheck
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// Grouped navigation sections
// Full navigation for non-coach roles
const fullNavSections = [
  {
    label: "Sales",
    icon: TrendingUp,
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/", permPath: "/" },
      { icon: PlusCircle, label: "New Entry", path: "/deals/new", permPath: "/new-entry" },
      { icon: FileText, label: "My Deals", path: "/my-deals", permPath: "/my-deals" },
      { icon: Users, label: "Clients", path: "/clients", permPath: "/clients" },
      { icon: FileSpreadsheet, label: "Sales Tracker", path: "/sales-tracker", permPath: "/sales-tracker" },
      { icon: PhoneIncoming, label: "Setter Intel", path: "/setter-bookings", permPath: "/setter-bookings" },
      { icon: CalendarDays, label: "Payment Plans", path: "/payment-plans", permPath: "/payment-plans" },
    ],
  },
  {
    label: "Payroll",
    icon: DollarSign,
    items: [
      { icon: UserCheck, label: "Onboarding", path: "/onboarding", permPath: "/onboarding" },
      { icon: CreditCard, label: "Payroll Dashboard", path: "/payroll", permPath: "/payroll" },
      { icon: Wallet, label: "Commission Payouts", path: "/payouts", permPath: "/payouts" },
      { icon: GraduationCap, label: "Coaching Sessions", path: "/coaching-sessions", permPath: "/coaching-sessions" },
    ],
  },
  {
    label: "Marketing",
    icon: Megaphone,
    items: [
      { icon: BarChart3, label: "Reports", path: "/reports", permPath: "/reports" },
    ],
  },
  {
    label: "Role Previews",
    icon: LayoutDashboard,
    adminOnly: true,
    items: [
      { icon: TrendingUp, label: "Closer View", path: "/closer-dashboard", permPath: "/closer-dashboard" },
      { icon: CalendarPlus, label: "Setter View", path: "/setter-dashboard", permPath: "/setter-dashboard" },
      { icon: GraduationCap, label: "Coach View", path: "/coach-dashboard", permPath: "/coach-dashboard" },
      { icon: BookOpen, label: "Client View", path: "/client-dashboard", permPath: "/client-dashboard" },
    ],
  },
  {
    label: "Admin",
    icon: ShieldCheck,
    adminOnly: true,
    items: [
      { icon: BookOpen, label: "SOP", path: "/sop", permPath: "/sop" },
      { icon: Network, label: "Mind Map", path: "/mindmap", permPath: "/mindmap" },
      { icon: Settings, label: "Settings", path: "/settings", permPath: "/settings" },
      { icon: Users, label: "User Management", path: "/users", permPath: "/users", adminOnly: true },
    ],
  },
];

// Coach-only navigation
const coachNavSections = [
  {
    label: "Coaching",
    icon: GraduationCap,
    items: [
      { icon: LayoutDashboard, label: "My Dashboard", path: "/", permPath: "/" },
      { icon: Users, label: "Clients", path: "/clients", permPath: "/clients" },
      { icon: BookOpen, label: "How To (SOP)", path: "/sop", permPath: "/sop" },
    ],
  },
];

// Closer-only navigation
const closerNavSections = [
  {
    label: "Sales",
    icon: TrendingUp,
    items: [
      { icon: LayoutDashboard, label: "My Dashboard", path: "/", permPath: "/" },
      { icon: FileText, label: "My Deals", path: "/my-deals", permPath: "/my-deals" },
      { icon: PlusCircle, label: "New Entry", path: "/deals/new", permPath: "/new-entry" },
      { icon: Users, label: "Clients", path: "/clients", permPath: "/clients" },
      { icon: FileSpreadsheet, label: "Sales Tracker", path: "/sales-tracker", permPath: "/sales-tracker" },
      { icon: PhoneIncoming, label: "Setter Intel", path: "/setter-bookings", permPath: "/setter-bookings" },
      { icon: BookOpen, label: "How To (SOP)", path: "/sop", permPath: "/sop" },
    ],
  },
];

// Setter-only navigation
const setterNavSections = [
  {
    label: "Setter",
    icon: CalendarPlus,
    items: [
      { icon: LayoutDashboard, label: "My Dashboard", path: "/", permPath: "/" },
      { icon: Users, label: "Clients", path: "/clients", permPath: "/clients" },
      { icon: BookOpen, label: "How To (SOP)", path: "/sop", permPath: "/sop" },
    ],
  },
];

// Client-only navigation (the trader who paid for the program)
const clientNavSections = [
  {
    label: "Trader",
    icon: TrendingUp,
    items: [
      { icon: LayoutDashboard, label: "My Dashboard", path: "/", permPath: "/" },
    ],
  },
];

// Payroll-role navigation. Split into THREE function-scoped groups so each
// can be independently granted via permissions:
//   - "Onboarding" group  — gated by  /onboarding
//   - "Payroll" group     — gated by  /payroll-dashboard (and friends)
//   - "Help" group        — always visible
// Ariana currently has both groups. If we hire a dedicated onboarding
// specialist, give them /onboarding only and they'll see just that group.
// Same for a dedicated payroll specialist — only /payroll-dashboard etc.
const payrollNavSections = [
  {
    label: "Home",
    icon: LayoutDashboard,
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/", permPath: "/" },
    ],
  },
  {
    label: "Onboarding",
    icon: UserCheck,
    items: [
      { icon: UserCheck, label: "Client Onboarding", path: "/onboarding", permPath: "/onboarding" },
      { icon: Users, label: "Clients", path: "/clients", permPath: "/clients" },
    ],
  },
  {
    label: "Payroll",
    icon: DollarSign,
    items: [
      { icon: CreditCard, label: "Payroll Dashboard", path: "/payroll", permPath: "/payroll-dashboard" },
      { icon: Wallet, label: "Commission Payouts", path: "/payouts", permPath: "/payouts" },
      { icon: CalendarDays, label: "Payment Plans", path: "/payment-plans", permPath: "/payment-plans" },
      { icon: GraduationCap, label: "Coaching Sessions", path: "/coaching-sessions", permPath: "/coaching-sessions" },
    ],
  },
  {
    label: "Help",
    icon: BookOpen,
    items: [
      { icon: BookOpen, label: "How To (SOP)", path: "/sop", permPath: "/sop" },
    ],
  },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-4">
            <img 
              src="/logo.png" 
              alt="Trader Foundation" 
              className="h-24 w-24 object-contain"
            />
            <h1 className="text-2xl font-bold tracking-tight text-center text-primary">
              Trader Foundation
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Commission Tracking System
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all bg-primary hover:bg-primary/90"
          >
            Sign in to continue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  
  // Get the user's team member role for role-based navigation
  const { data: teamLinkData } = trpc.userTeam.getMyTeamMember.useQuery(undefined, {
    enabled: !!user,
  });
  const teamMemberRole = teamLinkData?.teamMember?.role || null;

  const isAdmin = user?.role === "admin";
  const isCoach = user?.role === "coach";
  const isCloser = user?.role === "closer";
  const isPayroll = user?.role === "payroll";
  const isSetter = user?.role === "setter";
  const isClient = user?.role === "client";

  // Role-specific navigation
  const activeNavSections = isCoach
    ? coachNavSections
    : isCloser
      ? closerNavSections
      : isPayroll
        ? payrollNavSections
        : isSetter
          ? setterNavSections
          : isClient
            ? clientNavSections
            : fullNavSections;

  // Track which sections are open (default all open)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {};
    activeNavSections.forEach(s => { defaults[s.label] = true; });
    return defaults;
  });
  
  const toggleSection = (label: string) => {
    setOpenSections(prev => ({ ...prev, [label]: !prev[label] }));
  };

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  // Check if user has permission for a given item
  const hasPermission = (permPath: string, itemAdminOnly?: boolean) => {
    if (isAdmin) return true;
    if (isCoach) return true;  // coach sees all their own nav items
    if (isSetter) return true; // setter sees all their own nav items
    if (itemAdminOnly) return false;
    
    let userPermissions: string[] = [];
    try {
      userPermissions = user?.permissions ? JSON.parse(user.permissions as string) : [];
    } catch {
      userPermissions = [];
    }
    return userPermissions.includes(permPath) || userPermissions.includes("*");
  };

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r border-border/50"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center border-b border-border/50">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-primary" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <img 
                    src="/logo.png" 
                    alt="Trader Foundation" 
                    className="h-8 w-8 object-contain"
                  />
                  <span className="font-bold tracking-tight truncate text-primary">
                    Trader Foundation
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 overflow-y-auto">
            <div className="px-2 py-3 space-y-1">
              {activeNavSections.map(section => {
                // Hide admin-only sections for non-admins
                if ((section as any).adminOnly && !isAdmin) return null;
                
                // Filter items by permission
                const visibleItems = section.items.filter(item => 
                  hasPermission(item.permPath, 'adminOnly' in item ? (item as any).adminOnly : false)
                );
                
                // Don't show section if no visible items
                if (visibleItems.length === 0) return null;
                
                const isOpen = openSections[section.label] ?? true;
                const SectionIcon = section.icon;
                
                // Check if any item in this section is active
                const sectionHasActive = visibleItems.some(item => item.path === location);
                
                if (isCollapsed) {
                  // When collapsed, just show the items as icons without section headers
                  return (
                    <SidebarMenu key={section.label}>
                      {visibleItems.map(item => {
                        const isActive = location === item.path;
                        return (
                          <SidebarMenuItem key={item.path}>
                            <SidebarMenuButton
                              isActive={isActive}
                              onClick={() => setLocation(item.path)}
                              tooltip={item.label}
                              className={`h-10 transition-all font-normal ${isActive ? 'bg-primary/10 text-primary' : ''}`}
                            >
                              <item.icon
                                className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`}
                              />
                              <span>{item.label}</span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  );
                }
                
                return (
                  <Collapsible key={section.label} open={isOpen} onOpenChange={() => toggleSection(section.label)}>
                    <CollapsibleTrigger className="w-full">
                      <div className={`flex items-center justify-between px-3 py-2 rounded-md text-xs font-semibold uppercase tracking-wider cursor-pointer transition-colors hover:bg-accent/50 ${sectionHasActive ? 'text-primary' : 'text-muted-foreground'}`}>
                        <div className="flex items-center gap-2">
                          <SectionIcon className="h-3.5 w-3.5" />
                          <span>{section.label}</span>
                        </div>
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`} />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenu className="mt-0.5">
                        {visibleItems.map(item => {
                          const isActive = location === item.path;
                          return (
                            <SidebarMenuItem key={item.path}>
                              <SidebarMenuButton
                                isActive={isActive}
                                onClick={() => setLocation(item.path)}
                                tooltip={item.label}
                                className={`h-9 transition-all font-normal pl-8 ${isActive ? 'bg-primary/10 text-primary' : ''}`}
                              >
                                <item.icon
                                  className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`}
                                />
                                <span>{item.label}</span>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          );
                        })}
                      </SidebarMenu>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-border/50">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border border-primary/30 shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.role === "admin" ? "Administrator"
                        : user?.role === "payroll" ? "Payroll Admin"
                        : user?.role === "coach" ? "Coach"
                        : user?.role === "setter" ? "Setter"
                        : user?.role === "client" ? "Trader"
                        : user?.role === "closer" ? "Closer"
                        : "—"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => setLocation("/change-password")}
                  className="cursor-pointer"
                >
                  <KeyRound className="mr-2 h-4 w-4" />
                  <span>Change Password</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b border-border/50 h-14 items-center bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <SidebarTrigger className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-colors flex items-center justify-center [&>svg]:h-5 [&>svg]:w-5 [&>svg]:text-primary" />
          </div>
        )}
        <main className="flex-1 p-4 md:p-6 bg-background min-h-screen">{children}</main>
      </SidebarInset>
    </>
  );
}
