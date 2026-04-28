import {
  DollarSign, ClipboardCheck, Wallet, CalendarDays, Users, ShieldAlert,
} from "lucide-react";
import {
  SOPHeader, Step, Why, Tip, Warning, MockScreen, MockField, MockButton,
  MockTable, CalloutList, DoDont,
} from "./_parts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PayrollSOP() {
  return (
    <div className="space-y-6 max-w-5xl">
      <SOPHeader
        icon={DollarSign}
        role="Payroll"
        who="Ariana Tayman"
        color="text-pink-400"
        mission="Process every payout on time. Verify subscriptions monthly. Be the source of truth for what's been paid out and what's owed. Quiet, accurate, on schedule."
      />

      <Card>
        <CardHeader>
          <CardTitle>Your Domain — 4 Pages</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <PageCard icon={ClipboardCheck} title="Payroll Dashboard" desc="Bird's-eye view of who's owed what, by category." />
            <PageCard icon={Wallet} title="Commission Payouts" desc="Mark closer + setter commissions paid." />
            <PageCard icon={CalendarDays} title="Payment Plans" desc="Collect monthly payments from clients on plans." />
            <PageCard icon={Users} title="Subscriptions" desc="Monthly verification + integrity audit of active subscribers." />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workflow — Twice-Monthly Pay Cycle</CardTitle>
        </CardHeader>
        <CardContent className="px-6">

          <Step n={1} title="At the start of each pay period — open Payroll Dashboard">
            <p>
              Twice a month (1st–15th and 16th–end), the cycle resets. Open
              the Payroll Dashboard. It groups every payment owed into four
              categories.
            </p>

            <MockScreen title="Payroll Dashboard" subtitle="Twice-monthly view" badge="April 2026 — Period 2">
              <MockTable
                headers={["Category", "Owed", "Paid", "Outstanding"]}
                rows={[
                  ["Sales Commission (closers + setter)", { value: "$8,420.00", bold: true }, "$0.00", { value: "$8,420.00", tone: "warning", bold: true }],
                  ["Coaching", "$3,750.00", "$0.00", "$3,750.00"],
                  ["Operations (W2)", "$2,500.00", "$0.00", "$2,500.00"],
                  ["Marketing (vendors)", "$2,300.00", { value: "$2,300.00", tone: "primary" }, "$0.00"],
                ]}
              />
            </MockScreen>

            <Why>
              The dashboard is your daily orientation. The "Outstanding"
              column tells you what still needs to be paid out before the
              period closes.
            </Why>
          </Step>

          <Step n={2} title="Process Sales Commissions — closers + setter">
            <p>
              Open <span className="text-foreground font-medium">Commission Payouts</span>. You'll see every closer and Kresha (the setter), each with what they're owed for this period. Pay them, then mark each row paid in the system.
            </p>

            <MockScreen title="Commission Payouts" subtitle="Sales Commission detail">
              <MockTable
                headers={["Person", "Owed", "Status", "Action"]}
                rows={[
                  ["Steve Lapa",      { value: "$3,142.00", bold: true }, "Pending", "Mark Paid"],
                  ["Jhalil Timazee",  { value: "$2,818.00", bold: true }, "Pending", "Mark Paid"],
                  ["Jake Glass",      { value: "$2,250.00", bold: true }, "Pending", "Mark Paid"],
                  ["Kresha Koirala (setter)", { value: "$210.00", tone: "primary", bold: true }, "Pending", "Mark Paid"],
                ]}
              />
            </MockScreen>

            <CalloutList items={[
              { n: 1, text: <>Closer commissions are auto-calculated using each closer's rate (15% Jan–Feb, 10% from March) on cash collected. Closers also earn 25% on each verified subscription month.</> },
              { n: 2, text: <>Kresha's setter commission is 3% × min(deal cash, $6,000), summed across her attributed <span className="font-medium">one-time sales only</span>. Subscriptions don't pay setter commission.</> },
              { n: 3, text: <>Send the actual money via your normal channel (bank transfer / Wise / etc.), then click "Mark Paid" so the row reflects reality.</> },
            ]} />

            <Warning>
              Don't mark paid before the money actually moves. Once marked, the
              row shows up as fulfilled forever — reversing it requires admin.
            </Warning>
          </Step>

          <Step n={3} title="Process Coaching + Operations + Marketing">
            <p>
              Same pattern — but these are flat-rate. Elliot ($2,050 bi-weekly),
              Erin ($2,500 bi-weekly), Leo (variable, capped at $2K/month).
              Vendors (Shyft Filming $1,800/mo, Shyft Ads $500/mo) are autopay
              — no action needed.
            </p>

            <Tip>
              Autopay vendors show as paid automatically the day they hit. You
              don't need to mark them. They appear in the dashboard so you can
              <em> verify</em> they hit, not so you process them.
            </Tip>
          </Step>

          <Step n={4} title="Collect monthly payment-plan payments">
            <p>
              Open <span className="text-foreground font-medium">Payment Plans</span>. This page shows every active plan with the next month due. As clients pay you (Fanbasis), click "Collect Payment" to log it.
            </p>

            <MockScreen title="Payment Plans" subtitle="Active plans">
              <MockTable
                headers={["Client", "Plan", "Next Due", "Status", "Action"]}
                rows={[
                  ["Marcus Johnson",  "$1,000/mo × 6", "May 12",  "On track",   "Collect Payment"],
                  ["Tony Ramirez",    "$500/mo × 12",  "May 03",  "On track",   "Collect Payment"],
                  ["Alicia Chen",     "$750/mo × 4",   "Apr 28",  { value: "Overdue", tone: "warning", bold: true }, "Collect Payment"],
                ]}
              />
            </MockScreen>

            <Why>
              The plan only generates the next entry when you click "Collect
              Payment" — so if a client stops paying, no future entries get
              created. That's by design: it keeps the books clean and the
              "Outstanding" line accurate.
            </Why>
          </Step>

          <Step n={5} title="Verify subscriptions every month">
            <p>
              Open <span className="text-foreground font-medium">Subscriptions</span>. Each month the system generates a verification list for every active subscriber. Walk through them — confirm they're still in the group, then click verify (or mark cancelled).
            </p>

            <MockScreen title="Subscriptions — Monthly Verification" badge="April 2026">
              <MockTable
                headers={["Client", "Closer", "Monthly", "Status", "Action"]}
                rows={[
                  ["Marcus Johnson", "Steve Lapa",     "$300", "Active",    "Verify"],
                  ["Sarah Williams", "Jhalil Timazee", "$300", "Active",    "Verify"],
                  ["Tony Ramirez",   "Jake Glass",     "$300", { value: "Cancelled?", tone: "warning" }, "Mark Cancelled"],
                ]}
              />
            </MockScreen>

            <Why>
              Verified subscribers generate 25% commission for the closer who
              signed them up. Cancelled subscribers stop earning commission and
              the closer gets an automatic notification. This is how the
              recurring side of the business stays honest — your monthly
              verification is the integrity gate.
            </Why>

            <Tip>
              The Integrity Audit tab shows 5 random subscribers each month —
              spot-check them by actually opening the group/Discord and
              confirming the person is still there. Catches both fraud and
              honest mistakes.
            </Tip>
          </Step>

        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            Adjustments — bonuses & deductions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-foreground/90">
            When Vlad approves a bonus or a deduction for someone, you log it
            in the team member's profile. Every adjustment requires a written
            reason — that's not a UX nicety, it's protection if it ever gets
            questioned.
          </p>

          <MockScreen title="Add Adjustment" subtitle="Member profile → Adjustments tab">
            <div className="grid grid-cols-2 gap-3">
              <MockField label="Type" value="Bonus ▾" />
              <MockField label="Amount" value="$250.00" />
            </div>
            <MockField label="Reason (required)" value="Closing bonus for hitting weekly quota — approved by Vlad on 2026-04-22" />
            <div className="flex justify-end pt-1">
              <MockButton label="Apply Adjustment" />
            </div>
          </MockScreen>

          <Warning>
            Never apply an adjustment without a Slack/email/text from Vlad
            authorizing it. The reason field should reference the
            authorization — date, channel, exactly what was approved.
          </Warning>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Boundaries</CardTitle>
        </CardHeader>
        <CardContent>
          <DoDont
            dos={[
              "Mark items paid only after the money has actually moved.",
              "Verify subscriptions every single month — don't skip.",
              "Always include a written reason on adjustments.",
              "Use the integrity audit to catch fraud or mistakes.",
            ]}
            donts={[
              "Cannot change commission rates (that's admin).",
              "Cannot delete deals or sessions (that's admin).",
              "Don't apply adjustments without Vlad's written approval.",
              "Don't process payouts before the period closes — wait for the cycle.",
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
            <li className="flex gap-3"><span className="text-primary font-bold">1.</span><span>Each pay period → <span className="text-foreground font-medium">Payroll Dashboard</span>.</span></li>
            <li className="flex gap-3"><span className="text-primary font-bold">2.</span><span>Pay closers + setter → mark paid in <span className="text-foreground font-medium">Commission Payouts</span>.</span></li>
            <li className="flex gap-3"><span className="text-primary font-bold">3.</span><span>Pay coaches + W2 → same dashboard.</span></li>
            <li className="flex gap-3"><span className="text-primary font-bold">4.</span><span>Collect payment plan installments in <span className="text-foreground font-medium">Payment Plans</span> as money hits.</span></li>
            <li className="flex gap-3"><span className="text-primary font-bold">5.</span><span>Verify subscriptions monthly + run the audit.</span></li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function PageCard({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-card p-4 hover:border-primary/40 transition-colors">
      <Icon className="h-5 w-5 text-primary mb-2" />
      <p className="font-semibold text-sm">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">{desc}</p>
    </div>
  );
}
