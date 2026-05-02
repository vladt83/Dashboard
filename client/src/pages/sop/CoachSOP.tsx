import {
  GraduationCap, Clock, Briefcase, AlertCircle, FileVideo,
} from "lucide-react";
import {
  SOPHeader, Step, Why, Tip, Warning, MockScreen, MockField, MockButton,
  CalloutList, DoDont,
} from "./_parts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CoachSOP() {
  return (
    <div className="space-y-6 max-w-5xl">
      <SOPHeader
        icon={GraduationCap}
        role="Coach"
        who="Leo Gonzalez (on-demand) · Elliot Gumbs (salaried) · Erin Chawla (W2)"
        color="text-purple-400"
        mission="Run coaching sessions and log every one. The dashboard tracks attendance and content quality; for on-demand coaches it also calculates pay. For salaried coaches it's tracking only — no pay math is shown."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            Two coach types — what you see depends on which you are
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
              <p className="text-xs uppercase tracking-wider text-blue-400 font-semibold mb-2">
                On-demand (Leo)
              </p>
              <p className="text-sm text-foreground/90">
                Paid per minute. Dashboard shows minute counter, monthly pay,
                and no-show count. Recording link is optional.
              </p>
            </div>
            <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-4">
              <p className="text-xs uppercase tracking-wider text-purple-400 font-semibold mb-2">
                Salaried / W2 (Elliot, Erin)
              </p>
              <p className="text-sm text-foreground/90">
                Fixed bi-weekly pay. Dashboard shows session counts only — no
                pay calculator, no warnings. Sessions are tracked purely for
                content quality and attendance.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workflow — Every Session</CardTitle>
        </CardHeader>
        <CardContent className="px-6">

          <Step n={1} title="Log every session immediately after it ends">
            <p>
              Don't batch. Log each session right after it wraps so the details
              are accurate (minute count, what was covered, any follow-ups).
            </p>

            <MockScreen title="Log a Session" subtitle="Coach Dashboard → New Session form">
              <div className="grid grid-cols-2 gap-3">
                <MockField label="Session Date" value="2026-04-26" callout={1} />
                <MockField label="Client Name" value="Marcus Johnson" callout={2} />
              </div>

              <div className="grid grid-cols-2 gap-3 mt-3">
                <MockField label="Minutes" value="45" callout={3} />
                <MockField label="No-show?" value="No" callout={4} />
              </div>

              <div className="grid grid-cols-2 gap-3 mt-3">
                <MockField label="Trading Log Submitted?" value="Yes ▾" callout={5} />
                <MockField label="Follow-Up Session?" value="Yes ▾" callout={6} />
              </div>

              <MockField
                label="Recording Link (optional)"
                placeholder="Paste the Zoom/recording URL here, or leave blank"
                callout={7}
              />

              <div className="flex justify-end pt-1">
                <MockButton label="Log Session" callout={8} />
              </div>
            </MockScreen>

            <CalloutList items={[
              { n: 1, text: <><span className="text-foreground font-medium">Session date.</span> Defaults to today. Change it if you're back-logging a session from a previous day.</> },
              { n: 2, text: <><span className="text-foreground font-medium">Client name.</span> Required. Used to track which clients are getting consistent attention.</> },
              { n: 3, text: <><span className="text-foreground font-medium">Minutes.</span> Required for non-no-show sessions. <span className="text-foreground font-medium">For Leo:</span> this drives your pay ($0.90 × minutes).</> },
              { n: 4, text: <><span className="text-foreground font-medium">No-show toggle.</span> Flip on if the client didn't show. <span className="text-foreground font-medium">For Leo:</span> earns $15. For salaried coaches: tracking only.</> },
              { n: 5, text: <><span className="text-foreground font-medium">Trading log.</span> Yes / No / Too New. Tracks whether the client did the homework.</> },
              { n: 6, text: <><span className="text-foreground font-medium">Follow-up session.</span> Whether this session was a follow-up to a prior coaching call.</> },
              { n: 7, text: <><span className="text-foreground font-medium">Recording link — OPTIONAL.</span> Zero penalty for skipping. Add it if you have it; move on if you don't.</> },
              { n: 8, text: <><span className="text-foreground font-medium">Log Session.</span> Saved. <span className="text-foreground font-medium">For Leo:</span> pay total updates immediately.</> },
            ]} />

            <Why>
              The recording link used to be required. It isn't anymore — Vlad
              decided the friction wasn't worth the upside. Add it when easy,
              skip when not. Don't wait to log a session because you can't find
              the recording.
            </Why>
          </Step>

          <Step n={2} title="Watch your monthly view">
            <p>
              Your dashboard always defaults to the current month. Use prev/next
              to look at past months. The list shows every session you've logged
              — date, client, minutes, no-show flag.
            </p>

            <MockScreen title="My Sessions" subtitle="Coach Dashboard, monthly view" badge="April 2026">
              <div className="flex justify-between text-sm border-b border-border/40 pb-2 mb-2">
                <span className="text-muted-foreground">Sessions logged:</span>
                <span className="font-semibold">23</span>
              </div>
              {/* ON-DEMAND ONLY blocks */}
              <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-3 space-y-1">
                <p className="text-xs uppercase tracking-wider text-blue-400 font-semibold">
                  Leo only — pay tracking
                </p>
                <div className="flex justify-between text-sm"><span>Total minutes:</span><span>1,420</span></div>
                <div className="flex justify-between text-sm"><span>No-shows:</span><span>4</span></div>
                <div className="flex justify-between text-sm"><span>Earned this month:</span><span className="text-primary font-semibold">$1,338.00</span></div>
                <div className="flex justify-between text-sm"><span>Sessions logged:</span><span>23</span></div>
              </div>
            </MockScreen>

            <Tip>
              <span className="font-medium text-foreground">Salaried coaches:</span> you'll
              see the session list but none of the pay tracking blocks above. Don't
              worry — your pay is on a fixed bi-weekly schedule, separate from this dashboard.
            </Tip>
          </Step>

          <Step n={3} title="Edit or delete if needed">
            <p>
              Each row in the session list has a small action menu. You can
              edit the minutes, the no-show flag, or anything else. Or delete
              if it was a duplicate. Pay totals re-calculate instantly.
            </p>
          </Step>

        </CardContent>
      </Card>

      {/* On-demand pay deep dive */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Pay structure — On-demand (Leo only)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border border-border/50 bg-secondary/20 p-4 font-mono text-sm">
            <p className="text-muted-foreground text-xs uppercase tracking-wider mb-2">
              Formula
            </p>
            <p className="leading-relaxed">
              <span className="text-primary">monthly pay</span> ={" "}
              (total minutes × $0.90) + (no-shows × $15)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ExampleCard
              label="Slow week"
              lines={[
                ["Minutes", "320"],
                ["× $0.90", "$288.00"],
                ["No-shows", "1 ($15)"],
              ]}
              total="$303.00"
            />
            <ExampleCard
              label="Mid month"
              lines={[
                ["Minutes", "1,200"],
                ["× $0.90", "$1,080.00"],
                ["No-shows", "3 ($45)"],
              ]}
              total="$1,125.00"
            />
            <ExampleCard
              label="Solid month"
              lines={[
                ["Minutes", "1,800"],
                ["× $0.90", "$1,620.00"],
                ["No-shows", "5 ($75)"],
              ]}
              total="$1,695.00"
              hot
            />
          </div>

          <Why>
            Volume drives your monthly pay. Watch the dashboard in real time —
            it updates the moment you log a session.
          </Why>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileVideo className="h-5 w-5 text-primary" />
            Recording link — clarification
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground/90">
            The recording link field on the form is <span className="text-foreground font-bold">optional</span> for
            every coach. There's no withholding, no warning, no penalty if
            it's blank. If you have a recording handy when logging the session,
            add it. If not, leave it empty and move on.
          </p>
          <Warning>
            If a previous SOP told you the recording was required, ignore that.
            That rule was reversed in the post-Manus rollout.
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
              "Log every session, including no-shows.",
              "Edit a session if you typoed the minutes.",
              "Use prev/next to review past months for your records.",
            ]}
            donts={[
              "Don't add fake sessions to inflate pay (Vlad audits monthly).",
              "Don't worry about the recording link — optional always.",
              "Salaried coaches: don't expect to see pay totals — there's nothing wrong.",
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
            <li className="flex gap-3"><span className="text-primary font-bold">1.</span><span>Session ends → open dashboard → fill form → save.</span></li>
            <li className="flex gap-3"><span className="text-primary font-bold">2.</span><span>Recording link is optional. Always.</span></li>
            <li className="flex gap-3"><span className="text-primary font-bold">3.</span><span>Leo only: monthly pay updates live as you log sessions.</span></li>
            <li className="flex gap-3"><span className="text-primary font-bold">4.</span><span>Salaried: no pay shown is correct — your salary is fixed.</span></li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function ExampleCard({
  label,
  lines,
  total,
  hot,
}: {
  label: string;
  lines: [string, string][];
  total: string;
  hot?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-4 ${hot ? "border-amber-500/40 bg-amber-500/5" : "border-border/40 bg-card"}`}>
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
      <div className="space-y-1 text-sm">
        {lines.map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <span className="text-muted-foreground">{k}</span>
            <span>{v}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-between pt-2 mt-2 border-t border-border/30">
        <span className="font-semibold">Pay:</span>
        <span className={`font-semibold ${hot ? "text-amber-400" : "text-primary"}`}>{total}</span>
      </div>
    </div>
  );
}
