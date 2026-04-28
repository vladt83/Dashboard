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
        who="Kresha Koirala"
        color="text-blue-400"
        mission="Book qualified calls from text outreach and assign each to the right closer. Every call you book is one shot at a one-time sale — and 3% of each one you generate is yours. (Subscriptions don't pay setter commission.)"
      />

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
            When you log in, you land here. Three tabs across the top —{" "}
            <span className="text-foreground font-medium">Book Call</span>,{" "}
            <span className="text-foreground font-medium">My Bookings</span>, and{" "}
            <span className="text-foreground font-medium">My Payouts</span>.
            Pick the tab for whatever you're doing right now.
          </p>
          <MockScreen title="Setter Dashboard" subtitle="Top of the page after login">
            <div className="flex gap-1.5 p-1 bg-secondary/40 rounded-md w-fit">
              <span className="px-3 py-1.5 rounded text-xs bg-background text-foreground font-medium flex items-center gap-1.5">
                <PhoneIncoming className="h-3 w-3" />
                Book Call
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

          <Step n={1} title="Open the “Book Call” tab and fill the form">
            <p>
              When a lead from your texting outreach agrees to a call, capture
              their info immediately. Don't wait until end of day — names get
              mixed up, phone numbers get lost, and the closer needs the info{" "}
              <em>before</em> they pick up the phone.
            </p>

            <MockScreen title="Book a New Call" subtitle="Setter Dashboard → Book Call tab">
              <div className="grid grid-cols-2 gap-3">
                <MockField label="Client First Name" value="Marcus" callout={1} />
                <MockField label="Client Last Name" value="Johnson" callout={2} />
                <MockField label="Phone Number" value="(555) 123-4567" callout={3} />
                <MockField label="Assigned Closer" value="Steve Lapa ▾" callout={4} highlight />
              </div>
              <MockField label="Notes (optional)" value="Lead from yesterday's text blast — wants to hear about the small-account program. Available after 2pm EST." />
              <div className="flex justify-end pt-1">
                <MockButton label="Book Call" callout={5} />
              </div>
            </MockScreen>

            <CalloutList items={[
              { n: 1, text: <><span className="font-medium text-foreground">First name.</span> Required. The closer greets them by it on the call.</> },
              { n: 2, text: <><span className="font-medium text-foreground">Last name.</span> Required. We use first+last to match a deal back to your booking when commission is calculated.</> },
              { n: 3, text: <><span className="font-medium text-foreground">Phone number.</span> Required. Critical — the closer needs this to actually call them. Type it however the client gave it to you; the system stores it as-is.</> },
              { n: 4, text: <><span className="font-medium text-foreground">Assigned Closer.</span> The big one. Pick which closer is taking this call. Use the rotation/assignment rules Vlad gives you.</> },
              { n: 5, text: <><span className="font-medium text-foreground">Book Call.</span> Click it. The booking is now logged — visible to you, that closer, and admin.</> },
            ]} />

            <Why>
              The form is the team's source of truth for every call. The
              closer's "Setter Bookings" tab pulls directly from what you
              enter here — if you skip a field, they walk into the call blind.
              And come payout time, the system attributes commission to whichever
              setter booked the deal that closed.
            </Why>

            <Warning>
              If you're not sure which closer to assign, ask Vlad before
              clicking "Book Call." Re-assigning later is possible but messy —
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
              When a closer marks a <span className="text-foreground font-medium">one-time sale</span> closed
              and selects you as the setter, you earn 3% of the cash collected
              — up to a $6,000 cap per deal. That commission shows up here under
              the month the deal closed.
            </p>

            <Warning>
              <span className="font-semibold">Subscriptions do not pay setter commission.</span>{" "}
              The closer earns 25% recurring on subscriptions, but you don't.
              Your 3% applies only to one-time sales / deals.
            </Warning>

            <MockScreen title="My Payouts" subtitle="Setter Dashboard → My Payouts tab" badge="April 2026">
              <div className="grid grid-cols-3 gap-3">
                <SummaryStat label="Closed Deals" value="3" />
                <SummaryStat label="Rate" value="3%" sub="capped $6K cash / deal" />
                <SummaryStat label="Total Commission" value="$540.00" tone="primary" />
              </div>
              <MockTable
                headers={["Deal Date", "Cash Collected (capped)", "Your Commission (3%)"]}
                rows={[
                  ["2026-04-12", "$6,000.00", { value: "$180.00", tone: "primary", bold: true }],
                  ["2026-04-19", "$6,000.00", { value: "$180.00", tone: "primary", bold: true }],
                  ["2026-04-23", "$6,000.00", { value: "$180.00", tone: "primary", bold: true }],
                ]}
              />
            </MockScreen>

            <Why>
              The cash column is intentionally capped at $6,000 — even if
              the actual deal was $20K. Your commission is calculated on the
              capped amount. This protects deal economics; it isn't a glitch.
            </Why>

            <Tip>
              Use the prev/next month buttons at the top of the tab to look at
              past months. Your historical earnings live there forever.
            </Tip>
          </Step>

          <Step n={4} title="Get paid">
            <p>
              At the end of each pay period, Ariana reviews payouts in the
              Payroll Dashboard. Your 3% on each closed deal is automatically
              calculated — you don't need to submit anything separately.
              Your "My Payouts" total = what you'll be paid.
            </p>

            <Tip>
              If a deal you sourced doesn't show up in your payouts, it's
              because the closer didn't pick you in the setter dropdown. Tell
              Vlad — he can edit the deal to attribute it correctly.
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
              The formula
            </p>
            <p>
              <span className="text-primary">your commission</span> ={" "}
              <span className="text-amber-400">min</span>(deal cash collected,{" "}
              <span className="text-amber-400">$6,000</span>) × <span className="text-primary">3%</span>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ExampleCard
              label="Small deal"
              cash="$2,000"
              capped="$2,000"
              commission="$60.00"
            />
            <ExampleCard
              label="At the cap"
              cash="$6,000"
              capped="$6,000"
              commission="$180.00"
              hot
            />
            <ExampleCard
              label="Big deal — still capped"
              cash="$20,000"
              capped="$6,000"
              commission="$180.00"
            />
          </div>

          <Why>
            The cap means: a setter and closer working together each
            see "fair share" for their role without the setter knowing
            the full size of the deal. It also means you're paid the same
            on a $6K deal and a $20K deal — focus on volume, not deal size.
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
              "See every booking you've made — names, phones, assigned closer.",
              "See your own commission per deal (capped cash + your 3%).",
              "Edit your own bookings if you typoed something.",
            ]}
            donts={[
              "Cannot see the actual deal totals above $6,000 (intentional).",
              "Cannot see other setters' bookings or payouts.",
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
              <span>Lead says yes to a call → open <span className="text-foreground font-medium">Book Call</span> → fill form → click <span className="text-foreground font-medium">Book Call</span>.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-primary font-bold">2.</span>
              <span>Need to look up a past booking? → <span className="text-foreground font-medium">My Bookings</span> tab.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-primary font-bold">3.</span>
              <span>Want to know what you earned this month? → <span className="text-foreground font-medium">My Payouts</span> tab.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-primary font-bold">4.</span>
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
  capped,
  commission,
  hot,
}: {
  label: string;
  cash: string;
  capped: string;
  commission: string;
  hot?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-4 ${hot ? "border-primary/40 bg-primary/5" : "border-border/40 bg-card"}`}>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-2 space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Actual cash:</span>
          <span>{cash}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">After cap:</span>
          <span>{capped}</span>
        </div>
        <div className="flex justify-between font-semibold pt-1.5 border-t border-border/30">
          <span>Your 3%:</span>
          <span className="text-primary">{commission}</span>
        </div>
      </div>
    </div>
  );
}
