import { useLocation } from "wouter";
import {
  ShieldCheck, TrendingUp, PhoneIncoming, GraduationCap, DollarSign,
  ArrowRight, BookOpen,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type RoleEntry = {
  role: string;
  who: string;
  one_liner: string;
  href: string;
  icon: typeof ShieldCheck;
  color: string;
  borderColor: string;
};

const ROLES: RoleEntry[] = [
  {
    role: "Setter",
    who: "Kresha Koirala (Call Setting · 3%) · Jake Glass (Pre Call · 2%)",
    one_liner: "Setters fill the closer's calendar — Kresha sets calls from text outreach (3%), Jake runs 5-question pre calls right after VSL bookings (2%). Both earn on closed deals they're attributed to once DocuSign is signed.",
    href: "/sop/setter",
    icon: PhoneIncoming,
    color: "text-blue-400",
    borderColor: "border-blue-500/30 hover:border-blue-500/60",
  },
  {
    role: "Closer",
    who: "Steve Lapa · Jhalil Timazee",
    one_liner: "Reads setter intel, takes calls, closes deals, logs entries. Earns 10% on cash collected (9% on in-house plans, 15% Jan–Feb '26).",
    href: "/sop/closer",
    icon: TrendingUp,
    color: "text-green-400",
    borderColor: "border-green-500/30 hover:border-green-500/60",
  },
  {
    role: "Coach",
    who: "Leo · Elliot · Erin",
    one_liner: "Runs coaching sessions, logs every one. On-demand paid per minute; salaried sees tracking only.",
    href: "/sop/coach",
    icon: GraduationCap,
    color: "text-purple-400",
    borderColor: "border-purple-500/30 hover:border-purple-500/60",
  },
  {
    role: "Payroll",
    who: "Ariana Tayman",
    one_liner: "Processes payouts and applies adjustments. Source of truth on what's paid.",
    href: "/sop/payroll",
    icon: DollarSign,
    color: "text-pink-400",
    borderColor: "border-pink-500/30 hover:border-pink-500/60",
  },
  {
    role: "Admin",
    who: "Vlad Tayman",
    one_liner: "System-wide controls. Set rates, manage users, audit weekly. Keeper of the data.",
    href: "/sop/admin",
    icon: ShieldCheck,
    color: "text-amber-400",
    borderColor: "border-amber-500/30 hover:border-amber-500/60",
  },
];

export default function SOPHub() {
  const [, setLocation] = useLocation();

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="rounded-xl border border-border/40 bg-gradient-to-br from-card to-card/40 p-6 relative overflow-hidden">
        <img
          src="/logo.png"
          alt=""
          aria-hidden="true"
          className="absolute -right-8 -bottom-8 w-44 h-44 opacity-[0.06] pointer-events-none"
        />
        <div className="flex items-start gap-4 relative">
          <img
            src="/logo.png"
            alt="Trader Foundation"
            className="h-14 w-14 rounded-xl border border-border/60 bg-card p-1.5 object-contain"
          />
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <BookOpen className="h-3.5 w-3.5 text-primary" />
              SOPs
            </p>
            <h1 className="text-3xl font-bold text-primary">Standard Operating Procedures</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Visual, step-by-step guides for every role. Click into yours to bookmark — or send the link to anyone joining the team.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ROLES.map(r => {
          const Icon = r.icon;
          return (
            <Card
              key={r.role}
              onClick={() => setLocation(r.href)}
              className={`cursor-pointer transition-all hover:shadow-lg ${r.borderColor}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className={`h-12 w-12 rounded-lg bg-card border border-border/60 flex items-center justify-center shrink-0 ${r.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="font-semibold text-lg">{r.role}</h2>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{r.who}</p>
                    <p className="text-sm text-foreground/80 mt-2">{r.one_liner}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
            Quick reference — commission matrix
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b border-border/40">
                <tr>
                  <th className="text-left py-2 font-medium">Role</th>
                  <th className="text-left py-2 font-medium">Trigger</th>
                  <th className="text-left py-2 font-medium">Rate</th>
                  <th className="text-left py-2 font-medium">Cap</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/30">
                  <td className="py-2.5">Closer</td>
                  <td className="py-2.5">Cash collected (Jan–Feb '26)</td>
                  <td className="py-2.5 text-primary font-semibold">15%</td>
                  <td className="py-2.5 text-muted-foreground">none</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="py-2.5">Closer</td>
                  <td className="py-2.5">Cash collected (Mar '26+)</td>
                  <td className="py-2.5 text-primary font-semibold">10%</td>
                  <td className="py-2.5 text-muted-foreground">none</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="py-2.5">Closer</td>
                  <td className="py-2.5">
                    Cash collected on <span className="font-medium">in-house plan</span> deal
                    <span className="block text-xs text-muted-foreground">(Fanbasis / Denefits / Client Financing — overrides time-based rate)</span>
                  </td>
                  <td className="py-2.5 text-primary font-semibold">9%</td>
                  <td className="py-2.5 text-amber-400 font-semibold">offsets TF financing fees</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="py-2.5">Setter</td>
                  <td className="py-2.5">Closed deal they sourced</td>
                  <td className="py-2.5 text-primary font-semibold">3%</td>
                  <td className="py-2.5 text-muted-foreground">—</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="py-2.5">Coach (Leo)</td>
                  <td className="py-2.5">Per minute</td>
                  <td className="py-2.5 text-primary font-semibold">$0.90/min + $15/no-show</td>
                  <td className="py-2.5 text-muted-foreground">—</td>
                </tr>
                <tr>
                  <td className="py-2.5">Coach (Elliot, Erin)</td>
                  <td className="py-2.5">N/A — fixed</td>
                  <td className="py-2.5 text-muted-foreground">$2,050 / $2,500 bi-weekly</td>
                  <td className="py-2.5 text-muted-foreground">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
