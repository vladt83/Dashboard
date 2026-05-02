import {
  PhoneIncoming, ListChecks, DollarSign, Lock, BookOpen, Calculator,
} from "lucide-react";
import {
  SOPHeader, Step, Why, Tip, Warning, MockScreen, MockField, MockButton,
  MockTable, CalloutList, DoDont,
} from "./_parts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SetterSOP() {
  return (
    <div className="space-y-6 max-w-5xl">
      <SOPHeader
        icon={PhoneIncoming}
        role="Setter"
        who="Kresha Koirala (Call Setting · 3%) · Jake Glass (Pre Call · 2%)"
        color="text-blue-400"
        mission="Setters fill the closer's calendar with qualified, prepared prospects. Every call you set is one shot at a sale — and your commission lane (2% Pre Call · 3% Call Setting) earns on every closed deal you're attributed to."
      />

      {/* Two flavors of setter — explain which you are */}
      <Card>
        <CardHeader>
          <CardTitle>Two lanes of setter at TF</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
              <p className="text-xs uppercase tracking-wider text-blue-400 font-bold mb-2">
                Call Setting · Kresha (3%)
              </p>
              <p className="text-sm text-foreground/90">
                Sets calls from text outreach. Logs each call with client
                name, phone, and assigned closer. Tabs: <span className="text-foreground font-medium">Call Setting</span> + <span className="text-foreground font-medium">My Bookings</span>.
              </p>
            </div>
            <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-4">
              <p className="text-xs uppercase tracking-wider text-purple-400 font-bold mb-2">
                Pre Call · Jake (2%)
              </p>
              <p className="text-sm text-foreground/90">
                Calls every prospect within 5 minutes of their VSL booking.
                Runs the 5-question script, captures answers, and{" "}
                <span className="text-foreground font-medium">mentions</span>{" "}
                the Stock Predator show-up incentive — the closer presents
                the course access on the next call. Tabs:{" "}
                <span className="text-foreground font-medium">Pre Call</span>{" "}
                + <span className="text-foreground font-medium">My Preps</span>.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* What this dashboard looks like overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Your Dashboard at a Glance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            When you log in, you land on the lane that matches you. Call Setters
            see three tabs — <span className="text-foreground font-medium">Call Setting</span>,{" "}
            <span className="text-foreground font-medium">My Bookings</span>, and{" "}
            <span className="text-foreground font-medium">My Payouts</span>.
            Pre Call setters see <span className="text-foreground font-medium">Pre Call</span>,{" "}
            <span className="text-foreground font-medium">My Preps</span>, and{" "}
            <span className="text-foreground font-medium">My Payouts</span>. The
            other lane's tabs are hidden so you don't accidentally use the wrong one.
          </p>
          <MockScreen title="Setter Dashboard" subtitle="Top of the page after login (Call Setting lane shown)">
            <div className="flex gap-1.5 p-1 bg-secondary/40 rounded-md w-fit">
              <span className="px-3 py-1.5 rounded text-xs bg-background text-foreground font-medium flex items-center gap-1.5">
                <PhoneIncoming className="h-3 w-3" />
                Call Setting
              </span>
              <span className="px-3 py-1.5 rounded text-xs text-muted-foreground flex items-center gap-1.5">
                <ListChecks className="h-3 w-3" />
                My Bookings
              </span>
              <span className="px-3 py-1.5 rounded text-xs text-muted-foreground flex items-center gap-1.5">
                <DollarSign className="h-3 w-3" />
                My Payouts
              </span>
            </div>
          </MockScreen>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workflow — From Text Lead to Paycheck</CardTitle>
        </CardHeader>
        <CardContent className="px-6">

          <Step n={1} title="Open the “Call Setting” tab and fill the form">
            <p>
              When a lead from your texting outreach agrees to a call, capture
              their info immediately. Don't wait until end of day — names get
              mixed up, phone numbers get lost, and the closer needs the info{" "}
              <em>before</em> they pick up the phone.
            </p>

            <MockScreen title="Set a New Call" subtitle="Setter Dashboard → Call Setting tab">
              <div className="grid grid-cols-2 gap-3">
                <MockField label="Client First Name" value="Marcus" callout={1} />
                <MockField label="Client Last Name" value="Johnson" callout={2} />
                <MockField label="Phone Number" value="(555) 123-4567" callout={3} />
                <MockField label="Assigned Closer" value="Steve Lapa ▾" callout={4} highlight />
              </div>
              <MockField label="Notes (optional)" value="Lead from yesterday's text blast — wants to hear about the small-account program. Available after 2pm EST." />
              <div className="flex justify-end pt-1">
                <MockButton label="Set Call" callout={5} />
              </div>
            </MockScreen>

            <CalloutList items={[
              { n: 1, text: <><span className="font-medium text-foreground">First name.</span> Required. The closer greets them by it on the call.</> },
              { n: 2, text: <><span className="font-medium text-foreground">Last name.</span> Required. We use first+last to match a deal back to your booking when commission is calculated.</> },
              { n: 3, text: <><span className="font-medium text-foreground">Phone number.</span> Required. Critical — the closer needs this to actually call them. Type it however the client gave it to you; the system stores it as-is.</> },
              { n: 4, text: <><span className="font-medium text-foreground">Assigned Closer.</span> The big one. Pick which closer is taking this call. Use the rotation/assignment rules Vlad gives you.</> },
              { n: 5, text: <><span className="font-medium text-foreground">Set Call.</span> Click it. The call is now logged — visible to you, that closer, and admin.</> },
            ]} />

            <Why>
              The form is the team's source of truth for every call. The
              closer's "Setter Bookings" tab pulls directly from what you
              enter here — if you skip a field, they walk into the call blind.
              And come payout time, the system attributes commission to whichever
              setter set the deal that closed.
            </Why>

            <Warning>
              If you're not sure which closer to assign, ask Vlad before
              clicking "Set Call." Re-assigning later is possible but messy —
              better to get it right the first time.
            </Warning>
          </Step>

          <Step n={2} title="Check “My Bookings” to see everything you've logged">
            <p>
              The middle tab is your record. Every call you've booked — past,
              present, today — sorted newest first. Use this to verify
              you didn't double-book, to recall a phone number, or to confirm
              that yes, you did book that call last Tuesday.
            </p>

            <MockScreen title="My Bookings" subtitle="Setter Dashboard → My Bookings tab">
              <MockTable
                headers={["Date", "Client", "Phone", "Closer", "Notes"]}
                rows={[
                  ["2026-04-26", "Marcus Johnson", "(555) 123-4567", "Steve Lapa", "Wants small-account program"],
                  ["2026-04-26", "Sarah Williams", "(555) 987-2341", "Jhalil Timazee", "Referred by sister"],
                  ["2026-04-25", "Tony Ramirez",   "(555) 442-9078", "Jake Glass",     "—"],
                ]}
              />
            </MockScreen>

            <Why>
              You'll have weeks where you book 30+ calls. Without a list,
              you'd lose track of which client is which closer's, and double-book
              someone by accident. This tab is your memory.
            </Why>
          </Step>

          <Step n={3} title="Watch “My Payouts” for your commission">
            <p>
              When a closer marks a deal closed and selects you as the setter,
              you earn your lane's rate of the cash collected —{" "}
              <span className="text-foreground font-medium">3% if you're on the Call Setting lane</span>,{" "}
              <span className="text-foreground font-medium">2% if you're on the Pre Call lane</span>.
              That commission shows up here under the month the deal closed.
              Commission only releases once DocuSign is signed.
            </p>

            <MockScreen title="My Payouts" subtitle="Setter Dashboard → My Payouts tab (Call Setting lane example)" badge="April 2026">
              <div className="grid grid-cols-3 gap-3">
                <SummaryStat label="Closed Deals" value="3" />
                <SummaryStat label="Rate" value="3%" sub="of cash collected per deal" />
                <SummaryStat label="Total Commission" value="$405.00" tone="primary" />
              </div>
              <MockTable
                headers={["Deal Date", "Cash Collected", "Your Commission (3%)"]}
                rows={[
                  ["2026-04-12", "$4,500.00", { value: "$135.00", tone: "primary", bold: true }],
                  ["2026-04-19", "$5,200.00", { value: "$156.00", tone: "primary", bold: true }],
                  ["2026-04-23", "$3,800.00", { value: "$114.00", tone: "primary", bold: true }],
                ]}
              />
            </MockScreen>

            <Why>
              Numbers update live as closers mark deals closed and attribute
              you. There's no waiting on a manual report — the moment a closer
              picks your name on a deal, your payouts page reflects it.
            </Why>

            <Tip>
              Use the prev/next month buttons at the top of the tab to look at
              past months. Your historical earnings live there forever.
            </Tip>
          </Step>

          <Step n={4} title="Get paid">
            <p>
              At the end of each pay period, Ariana reviews payouts in the
              Payroll Dashboard. Your lane rate (3% Call Setting · 2% Pre Call)
              on each closed deal is automatically calculated — you don't need
              to submit anything separately. Your "My Payouts" total = what
              you'll be paid.
            </p>

            <Tip>
              If a deal you sourced doesn't show up in your payouts, it's
              because the closer didn't pick you in the setter dropdown — or
              DocuSign isn't signed yet. Tell Vlad — he can fix the attribution.
            </Tip>
          </Step>

        </CardContent>
      </Card>

      {/* Pay deep dive */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            How your pay is calculated
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border/50 bg-secondary/20 p-4 font-mono text-sm">
            <p className="text-muted-foreground text-xs uppercase tracking-wider mb-2">
              The formula (depends on your lane)
            </p>
            <p>
              <span className="text-primary">your commission</span> ={" "}
              cash collected on the deal × <span className="text-primary">your lane rate</span>
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Call Setting (Kresha): 3% · Pre Call (Jake): 2% · cap applies on Call Setting only.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ExampleCard
              label="Small deal · Call Setting (3%)"
              cash="$2,500"
              commission="$75.00"
              rate="3%"
            />
            <ExampleCard
              label="Mid-size · Call Setting (3%)"
              cash="$5,000"
              commission="$150.00"
              rate="3%"
            />
            <ExampleCard
              label="Bigger deal · Pre Call (2%)"
              cash="$8,000"
              commission="$160.00"
              rate="2%"
              hot
            />
          </div>

          <Why>
            Focus on volume. More closed deals = more commission, full stop.
            Your job is to fill the calendar with qualified calls; the closer's
            job is to convert them. Each role gets paid for what they brought.
          </Why>
        </CardContent>
      </Card>

      {/* Privacy section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-500" />
            What you can and can't see
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DoDont
            dos={[
              "See every call you've set or pre-called — names, phones, assigned closer.",
              "See your own commission per deal (cash collected × your lane rate, capped if you're on Call Setting).",
              "Edit your own bookings or pre-call notes if you typoed something.",
            ]}
            donts={[
              "Cannot see other setters' bookings, preps, or payouts.",
              "Cannot see the closer's commission on the deal you sourced.",
              "Cannot edit a deal directly — only the closer or admin can.",
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>The 30-second cheat sheet</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm">
            <li className="flex gap-3">
              <span className="text-primary font-bold">1.</span>
              <span><strong>Call Setting lane:</strong> lead says yes → <span className="text-foreground font-medium">Call Setting</span> tab → fill form → <span className="text-foreground font-medium">Set Call</span>.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-primary font-bold">2.</span>
              <span><strong>Pre Call lane:</strong> right after every 5–8 min discovery → <span className="text-foreground font-medium">Pre Call</span> tab → fill the 5 questions → <span className="text-foreground font-medium">Save Pre Call</span>.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-primary font-bold">3.</span>
              <span>Need to look up a past one? → <span className="text-foreground font-medium">My Bookings</span> (Call Setting) or <span className="text-foreground font-medium">My Preps</span> (Pre Call).</span>
            </li>
            <li className="flex gap-3">
              <span className="text-primary font-bold">4.</span>
              <span>Want to know what you earned this month? → <span className="text-foreground font-medium">My Payouts</span> tab.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-primary font-bold">5.</span>
              <span>Closer didn't pick you on a deal you sourced? → tell Vlad.</span>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── small inline cards ─────────────────────────────────────────────────

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
  cash,
  commission,
  rate,
  hot,
}: {
  label: string;
  cash: string;
  commission: string;
  rate?: string;
  hot?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-4 ${hot ? "border-primary/40 bg-primary/5" : "border-border/40 bg-card"}`}>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-2 space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Cash collected:</span>
          <span>{cash}</span>
        </div>
        <div className="flex justify-between font-semibold pt-1.5 border-t border-border/30">
          <span>Your {rate ?? "3%"}:</span>
          <span className="text-primary">{commission}</span>
        </div>
      </div>
    </div>
  );
}
