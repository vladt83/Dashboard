import {
  ShieldCheck, Settings, UserPlus, BarChart3, Lock, AlertOctagon, Workflow,
} from "lucide-react";
import {
  SOPHeader, Step, Why, Tip, Warning, MockScreen, MockField, MockButton,
  MockTable, CalloutList, DoDont,
} from "./_parts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminSOP() {
  return (
    <div className="space-y-6 max-w-5xl">
      <SOPHeader
        icon={ShieldCheck}
        role="Admin"
        who="Vlad Tayman"
        color="text-amber-400"
        mission="The only role with system-wide power. Set commission rates, create users, audit deals, resolve disputes. Keep the data clean — everyone else's pay depends on it."
      />

      <Card>
        <CardHeader>
          <CardTitle>What only you can do</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <PowerCard icon={UserPlus} title="Create / disable users" />
            <PowerCard icon={Lock} title="Change commission rates" />
            <PowerCard icon={AlertOctagon} title="Delete deals / sessions / bookings" />
            <PowerCard icon={BarChart3} title="See every closer's full data" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workflow — Daily, Weekly, Monthly</CardTitle>
        </CardHeader>
        <CardContent className="px-6">

          <Step n={1} title="Daily — scan the dashboard">
            <p>
              Your home screen has 3 tabs:{" "}
              <span className="text-foreground font-medium">Company Performance</span>,{" "}
              <span className="text-foreground font-medium">Sales Team</span>,{" "}
              <span className="text-foreground font-medium">Payroll</span>.
              30 seconds each tab is enough to know if anything's off.
            </p>

            <MockScreen title="Admin Dashboard" subtitle="Three-tab overview" badge="April 2026">
              <div className="flex gap-1.5 p-1 bg-secondary/40 rounded-md w-fit">
                <span className="px-3 py-1.5 rounded text-xs bg-background text-foreground font-medium">Company Performance</span>
                <span className="px-3 py-1.5 rounded text-xs text-muted-foreground">Sales Team</span>
                <span className="px-3 py-1.5 rounded text-xs text-muted-foreground">Payroll</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Cash Collected (Apr)" value="$93,420" />
                <Stat label="Total Commission Owed" value="$11,420" tone="primary" />
                <Stat label="Outstanding Payouts" value="$8,420" tone="warning" />
              </div>
            </MockScreen>

            <Why>
              Most days you're just confirming numbers look right. Anomalies
              (giant numbers, missing entries, weird outliers) catch your eye
              fastest from the dashboard rather than digging into individual deals.
            </Why>
          </Step>

          <Step n={2} title="Weekly — audit setter attribution">
            <p>
              Open <span className="text-foreground font-medium">Setter Bookings</span> as admin — you see every booking. Cross-reference against{" "}
              <span className="text-foreground font-medium">My Deals</span> (filtered to closed deals): is each closer attributing setters correctly?
            </p>
            <Tip>
              If a closer forgets the setter dropdown, Kresha doesn't get her
              3%. Catch it early — open the deal, edit it, pick the setter,
              save. Commission auto-recalculates.
            </Tip>
          </Step>

          <Step n={3} title="As needed — manage users">
            <p>
              <span className="text-foreground font-medium">User Management</span> lets you create accounts, change roles, reset
              permissions, or disable users who've left. Created here = bypasses
              the @traderfoundation domain check (so vendors with gmail like
              Kresha can be added).
            </p>

            <MockScreen title="Create User" subtitle="Admin → User Management → New User">
              <div className="grid grid-cols-2 gap-3">
                <MockField label="Name" value="Jane Smith" callout={1} />
                <MockField label="Email" value="jane@example.com" callout={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <MockField label="Role" value="Closer ▾" callout={3} />
                <MockField label="Initial Password" value="••••••••" callout={4} />
              </div>
              <div className="flex justify-end">
                <MockButton label="Create" callout={5} />
              </div>
            </MockScreen>

            <CalloutList items={[
              { n: 1, text: <>Full name. Shows up everywhere — make it match what they call themselves.</> },
              { n: 2, text: <>Any email domain works for admin-created users. (Self-registration still locked to @traderfoundation.com / .co.)</> },
              { n: 3, text: <>Pick the role: closer / setter / coach / payroll / admin. Permissions auto-set based on role.</> },
              { n: 4, text: <>Set a temporary password they can change after first login.</> },
              { n: 5, text: <>Save. They can log in immediately.</> },
            ]} />
          </Step>

          <Step n={4} title="Quarterly — review commission rates">
            <p>
              Settings → Commission Rates. The defaults: closers got 15%
              Jan–Feb 2026, dropped to 10% from March 2026 onward. Kresha
              Setters earn a flat 3% on closed one-time sales they're attributed
              to. Unless the business changes, leave them alone.
            </p>

            <Warning>
              Never change rates retroactively — it'll re-calculate every
              historic deal and break payouts that already went out. Always
              create a new rate row with a future startMonth/startYear.
            </Warning>
          </Step>

        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-primary" />
            How everything connects
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MockTable
            headers={["Trigger", "What the system does automatically"]}
            rows={[
              ["Setter books a call", "Creates row in bookedCalls. Visible to closer + admin."],
              ["Closer marks a deal closed", "Calculates closer commission (10% of cash) + setter commission (3% of cash, if a setter is attributed)."],
              ["Admin or closer edits a deal", "Re-calculates both commissions based on new amounts."],
              ["Coach logs a session (Leo)", "Adds minutes × $0.90 + $15 per no-show to monthly pay."],
              ["Coach logs a session (Elliot/Erin)", "Tracking only — no pay calculation."],
              ["Payroll marks a payout paid", "Updates payrollEntries.isPaid; appears as fulfilled in Payroll Dashboard."],
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Boundaries — what you should NOT do casually</CardTitle>
        </CardHeader>
        <CardContent>
          <DoDont
            dos={[
              "Audit weekly. Don't trust without verification.",
              "Document any rate changes in a Slack/email thread before applying.",
              "Use User Management to onboard new hires — never share passwords.",
              "Keep the SOP pages current as the business evolves.",
            ]}
            donts={[
              "Don't change historic commission rates.",
              "Don't delete deals to 'clean up' — edit instead. Deletion loses history.",
              "Don't share your admin login. Create a new admin user if needed.",
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>30-second cheat sheet</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm">
            <li className="flex gap-3"><span className="text-primary font-bold">1.</span><span>Daily → glance at Dashboard's 3 tabs.</span></li>
            <li className="flex gap-3"><span className="text-primary font-bold">2.</span><span>Weekly → audit setter attribution on closed deals.</span></li>
            <li className="flex gap-3"><span className="text-primary font-bold">4.</span><span>Quarterly → review whether commission rates still make sense.</span></li>
            <li className="flex gap-3"><span className="text-primary font-bold">5.</span><span>As needed → User Management for onboarding/offboarding.</span></li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function PowerCard({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex items-center gap-3">
      <Icon className="h-5 w-5 text-amber-400" />
      <p className="font-medium text-sm">{title}</p>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "primary" | "warning";
}) {
  const colorClass = tone === "primary" ? "text-primary" : tone === "warning" ? "text-amber-400" : "";
  return (
    <div className="rounded-md border border-border/40 bg-background/40 p-3">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${colorClass}`}>{value}</p>
    </div>
  );
}
