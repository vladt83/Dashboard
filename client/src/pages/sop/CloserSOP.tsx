import {
  TrendingUp, Target, FileText, Phone, Calculator, Users,
} from "lucide-react";
import {
  SOPHeader, Step, Why, Tip, Warning, MockScreen, MockField, MockButton,
  MockTable, CalloutList, DoDont,
} from "./_parts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CloserSOP() {
  return (
    <div className="space-y-6 max-w-5xl">
      <SOPHeader
        icon={TrendingUp}
        role="Closer"
        who="Steve Lapa · Jhalil Timazee · Jake Glass"
        color="text-green-400"
        mission="Take calls (booked or self-generated), close deals, and log them accurately. Every closed deal must be entered the same day. Accuracy here is your paycheck."
      />

      {/* Daily workflow */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            Your day at a glance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Two main sources of calls: <span className="text-foreground font-medium">setter bookings</span> (Kresha
            books from text outreach) and <span className="text-foreground font-medium">self-generated leads</span> (your
            own DMs, referrals, etc.). Workflow is the same — only the
            attribution differs.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workflow — Pre-Call to Paid</CardTitle>
        </CardHeader>
        <CardContent className="px-6">

          <Step n={1} title="Check “Setter Bookings” at the start of every day">
            <p>
              Kresha books calls in real time. Open the{" "}
              <span className="text-foreground font-medium">Setter Bookings</span> tab
              first thing — it shows every call set for you, sorted newest
              first. This is your pipeline.
            </p>

            <MockScreen title="Setter Bookings" subtitle="Sales → Setter Bookings">
              <MockTable
                headers={["Date", "Client", "Phone", "Closer", "Notes"]}
                rows={[
                  ["2026-04-26", "Marcus Johnson", "(555) 123-4567", "Steve Lapa", "Wants small-account program"],
                  ["2026-04-26", "Sarah Williams", "(555) 987-2341", "Steve Lapa", "Referred by sister"],
                ]}
              />
            </MockScreen>

            <Why>
              Every booking has client name, phone, and any notes Kresha left.
              You walk into the call already knowing who the lead is and
              what they're looking for — same prep a setter expects from you.
            </Why>
          </Step>

          <Step n={2} title="Run the call">
            <p>
              Take the call. Whether it shows, prepares, and closes — those
              three flags get logged in the entry form.
            </p>
            <ul className="list-disc list-inside space-y-1 text-foreground/90 ml-2">
              <li><span className="font-medium">Showed:</span> client actually got on the call.</li>
              <li><span className="font-medium">Prepared:</span> they watched the content / were ready.</li>
              <li><span className="font-medium">Closed:</span> sale was made.</li>
            </ul>
            <Tip>
              Even calls that don't close need to be entered (showed only,
              showed+prepared, etc.). The data drives leaderboards and lets
              the team measure show-rates by closer.
            </Tip>
          </Step>

          <Step n={3} title="Open “New Entry” and fill the form — every time">
            <p>
              Same day, while it's fresh. Click <span className="text-foreground font-medium">New Entry</span> in
              the sidebar.
            </p>

            <MockScreen title="New Sale Entry" subtitle="Sales → New Entry">
              <MockField label="Client Name" value="Marcus Johnson" callout={1} />

              <div className="grid grid-cols-2 gap-3 mt-3">
                <MockField label="Closer" value="Steve Lapa (you)" callout={2} />
                <MockField label="Setter (who booked this call)" value="Kresha Koirala ▾" highlight callout={3} />
              </div>

              <div className="grid grid-cols-3 gap-3 mt-3">
                <MockField label="Showed" value="✓ Yes" />
                <MockField label="Prepared" value="✓ Yes" />
                <MockField label="Closed" value="✓ Yes" />
              </div>

              <div className="grid grid-cols-2 gap-3 mt-3">
                <MockField label="Total Deal Amount" value="$8,000.00" callout={4} />
                <MockField label="New Cash Collected" value="$8,000.00" callout={5} />
              </div>

              <div className="flex justify-end pt-2">
                <MockButton label="Save Deal" callout={6} />
              </div>
            </MockScreen>

            <CalloutList items={[
              { n: 1, text: <><span className="text-foreground font-medium">Client name.</span> Use the same name on the booking — keeps Kresha's records and yours aligned.</> },
              { n: 2, text: <><span className="text-foreground font-medium">Closer.</span> Auto-filled to you; you can't change it (admin can).</> },
              { n: 3, text: <><span className="text-foreground font-medium">Setter dropdown — IMPORTANT.</span> If Kresha booked this call, pick her here. If it was your own lead, leave it on "Self-generated lead." Without this, Kresha won't get her 3%. <span className="text-muted-foreground">(Note: setters earn only on one-time sales — they don't appear on the subscription form.)</span></> },
              { n: 4, text: <><span className="text-foreground font-medium">Total deal amount.</span> Whole contract value — including future payment-plan months.</> },
              { n: 5, text: <><span className="text-foreground font-medium">New cash collected.</span> What hit the account today. For BNPL, this is net after the BNPL fee. For payment plans, this is the down payment.</> },
              { n: 6, text: <><span className="text-foreground font-medium">Save Deal.</span> The system instantly calculates your commission and Kresha's (if she was attributed).</> },
            ]} />

            <Warning>
              Forget to pick the setter and your teammate doesn't get paid.
              This is the single most important new step in the post-Manus
              workflow. Make it muscle memory.
            </Warning>
          </Step>

          <Step n={4} title="Watch your “My Dashboard” for goal + commission tracking">
            <p>
              Your dashboard is the home screen — it shows your $100K annual
              goal progress, the leaderboard against the other closers, and
              your monthly cash collected.
            </p>

            <MockScreen title="My Dashboard" subtitle="The home screen">
              <div className="grid grid-cols-3 gap-3">
                <SummaryStat label="Cash Collected (April)" value="$31,420" />
                <SummaryStat label="Commission Earned" value="$3,142.00" tone="primary" />
                <SummaryStat label="Goal Progress" value="34%" sub="of $100K annual" />
              </div>
              <div className="mt-4 space-y-1.5">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Leaderboard</p>
                <MockTable
                  headers={["Closer", "Cash Collected", "Commission"]}
                  rows={[
                    [{ value: "Steve Lapa (you)", bold: true, tone: "primary" }, "$31,420", "$3,142.00"],
                    ["Jhalil Timazee", "$28,180", "$2,818.00"],
                    ["Jake Glass", "$22,500", "$2,250.00"],
                  ]}
                />
              </div>
            </MockScreen>

            <Why>
              Numbers update in real time. You'll know within minutes of
              hitting "Save Deal" whether the math added up.
            </Why>
          </Step>

          <Step n={5} title="Use “My Deals” to review or edit anything">
            <p>
              Made a typo? Forgot the setter? Click any past deal in{" "}
              <span className="text-foreground font-medium">My Deals</span> → "Edit"
              → fix the setter dropdown / amounts → save. Commissions
              recalculate automatically.
            </p>
            <Tip>
              You can edit deals from any month. Your commission gets re-attributed
              based on the dealDate's pay period.
            </Tip>
          </Step>

        </CardContent>
      </Card>

      {/* Pay structure */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            How you get paid
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <MockTable
            headers={["When", "Rate", "Calculated on"]}
            rows={[
              ["Jan–Feb 2026 deals", { value: "15%", tone: "primary", bold: true }, "Total cash collected (new + existing)"],
              ["March 2026 onward", { value: "10%", tone: "primary", bold: true }, "Total cash collected (new + existing)"],
              ["Subscriptions (active)", { value: "25%", tone: "primary", bold: true }, "Monthly subscription amount, recurring"],
            ]}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <ExampleCard
              label="Full Pay deal"
              breakdown={[
                ["Cash collected", "$8,000"],
                ["Rate (April)", "10%"],
              ]}
              total="$800.00"
            />
            <ExampleCard
              label="BNPL — net of fee"
              breakdown={[
                ["Total deal", "$10,000"],
                ["BNPL fee", "−$500"],
                ["Net cash", "$9,500"],
                ["Rate", "10%"],
              ]}
              total="$950.00"
            />
            <ExampleCard
              label="Payment plan"
              breakdown={[
                ["Down payment", "$1,500"],
                ["Rate", "10%"],
                ["First month", "$150"],
                ["+ each month collected", "$50/mo × 6"],
              ]}
              total="$450.00 over 6 mo"
            />
          </div>
        </CardContent>
      </Card>

      {/* Privacy + dos/donts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Boundaries
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DoDont
            dos={[
              "Enter every call — closed or not.",
              "Pick Kresha as the setter when she sourced the lead.",
              "Edit your own deals if you spot a mistake.",
              "Use My Deals to look up old entries.",
            ]}
            donts={[
              "Cannot see other closers' deal-level data.",
              "Cannot delete deals — only admin can.",
              "Cannot mark someone else's deal closed.",
              "Don't enter deals without all required fields — incomplete entries break leaderboards.",
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
            <li className="flex gap-3"><span className="text-primary font-bold">1.</span><span>Morning → check <span className="text-foreground font-medium">Setter Bookings</span>.</span></li>
            <li className="flex gap-3"><span className="text-primary font-bold">2.</span><span>Run the call.</span></li>
            <li className="flex gap-3"><span className="text-primary font-bold">3.</span><span>Open <span className="text-foreground font-medium">New Entry</span> → fill it out → <span className="text-amber-400 font-medium">pick the setter if there was one</span> → save.</span></li>
            <li className="flex gap-3"><span className="text-primary font-bold">4.</span><span>Watch <span className="text-foreground font-medium">My Dashboard</span> for goal + leaderboard.</span></li>
            <li className="flex gap-3"><span className="text-primary font-bold">5.</span><span>Edit anything in <span className="text-foreground font-medium">My Deals</span> if needed.</span></li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────

function SummaryStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "primary";
}) {
  return (
    <div className="rounded-md border border-border/40 bg-background/40 p-3">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${tone === "primary" ? "text-primary" : ""}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function ExampleCard({
  label,
  breakdown,
  total,
}: {
  label: string;
  breakdown: [string, string][];
  total: string;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
      <div className="space-y-1 text-sm">
        {breakdown.map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <span className="text-muted-foreground">{k}</span>
            <span>{v}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-between pt-2 mt-2 border-t border-border/30">
        <span className="font-semibold">Commission:</span>
        <span className="text-primary font-semibold">{total}</span>
      </div>
    </div>
  );
}
