/**
 * Shared building blocks for the per-role visual SOPs.
 *
 *   <Step n title="Click 'Book Call'"> ...explanation... </Step>
 *   <MockScreen title="Setter Dashboard">  <MockField .../>  </MockScreen>
 *   <Why>Because the closer needs the phone number...</Why>
 *
 * The mock screens are intentionally hand-built (not real screenshots) so
 * they don't break when the real UI changes. They visually match the app's
 * dark/gold theme so readers can map them onto what they'll actually see.
 */

import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Lightbulb, AlertTriangle, Info, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────── Step container ─────────────────────────────

export function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[60px_1fr] gap-4 py-6 border-b border-border/30 last:border-0">
      <div className="flex md:flex-col items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold shadow-md shadow-primary/20">
          {n}
        </div>
        <div className="hidden md:block w-px flex-1 bg-border/50" />
      </div>
      <div className="space-y-4 pt-1.5">
        <h3 className="text-xl font-semibold text-foreground">{title}</h3>
        <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          {children}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── Why / Tip / Warning callouts ─────────────────

export function Why({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex gap-3">
      <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">
          Why
        </p>
        <p className="text-sm text-foreground/90">{children}</p>
      </div>
    </div>
  );
}

export function Tip({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-blue-400/30 bg-blue-400/5 p-4 flex gap-3">
      <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1">
          Tip
        </p>
        <p className="text-sm text-foreground/90">{children}</p>
      </div>
    </div>
  );
}

export function Warning({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 flex gap-3">
      <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-500 mb-1">
          Watch out
        </p>
        <p className="text-sm text-foreground/90">{children}</p>
      </div>
    </div>
  );
}

// ─────────────────────────── Mock screen "screenshot" ─────────────────────

export function MockScreen({
  title,
  subtitle,
  badge,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("border-border/60 bg-card overflow-hidden shadow-lg", className)}>
      <div className="border-b border-border/60 px-4 py-3 bg-card/90 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            What you'll see
          </p>
          <p className="font-semibold">{title}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {badge && (
          <span className="text-xs px-2 py-1 rounded-md bg-primary/15 text-primary font-medium">
            {badge}
          </span>
        )}
      </div>
      <CardContent className="p-4 space-y-3">{children}</CardContent>
    </Card>
  );
}

// Visual representation of an input/select/button so SOP pages look real.
export function MockField({
  label,
  value,
  placeholder,
  callout,
  highlight,
}: {
  label: string;
  value?: string;
  placeholder?: string;
  callout?: number;
  highlight?: boolean;
}) {
  return (
    <div className="space-y-1.5 relative">
      <label className="text-xs font-medium text-foreground/80">{label}</label>
      <div
        className={cn(
          "h-9 px-3 rounded-md border flex items-center text-sm",
          highlight
            ? "border-primary bg-primary/10 text-foreground"
            : "border-border/60 bg-background/50",
          !value && "text-muted-foreground"
        )}
      >
        {value ?? placeholder ?? "—"}
      </div>
      {callout !== undefined && <Callout n={callout} />}
    </div>
  );
}

export function MockButton({
  label,
  callout,
  variant = "primary",
}: {
  label: string;
  callout?: number;
  variant?: "primary" | "ghost";
}) {
  return (
    <div className="relative inline-block">
      <button
        className={cn(
          "h-9 px-4 rounded-md text-sm font-medium",
          variant === "primary"
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-foreground"
        )}
        type="button"
      >
        {label}
      </button>
      {callout !== undefined && <Callout n={callout} />}
    </div>
  );
}

export function MockTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | { value: string; bold?: boolean; tone?: "primary" | "warning" })[][];
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-border/40">
      <table className="w-full text-sm">
        <thead className="bg-secondary/40">
          <tr>
            {headers.map(h => (
              <th
                key={h}
                className="text-left px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border/30">
              {row.map((cell, j) => {
                if (typeof cell === "string") {
                  return (
                    <td key={j} className="px-3 py-2.5 text-foreground/90">
                      {cell}
                    </td>
                  );
                }
                const tone =
                  cell.tone === "primary"
                    ? "text-primary"
                    : cell.tone === "warning"
                      ? "text-amber-400"
                      : "text-foreground/90";
                return (
                  <td
                    key={j}
                    className={cn("px-3 py-2.5", tone, cell.bold && "font-semibold")}
                  >
                    {cell.value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Callout({ n }: { n: number }) {
  // Floating numbered marker — matches the explanation list below the mock screen.
  return (
    <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow-md ring-2 ring-background">
      {n}
    </span>
  );
}

export function CalloutList({
  items,
}: {
  items: { n: number; text: ReactNode }[];
}) {
  return (
    <ol className="space-y-2.5 mt-3">
      {items.map(it => (
        <li key={it.n} className="flex items-start gap-3 text-sm">
          <span className="h-6 w-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
            {it.n}
          </span>
          <span className="text-foreground/90">{it.text}</span>
        </li>
      ))}
    </ol>
  );
}

// ─────────────────────────── Do / Don't pair ─────────────────────────────

export function DoDont({
  dos,
  donts,
}: {
  dos: string[];
  donts: string[];
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="border-green-500/30 bg-green-500/5">
        <CardContent className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-green-400 mb-3 flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5" />
            Do
          </p>
          <ul className="space-y-2 text-sm">
            {dos.map((d, i) => (
              <li key={i} className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                <span className="text-foreground/90">{d}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card className="border-red-500/30 bg-red-500/5">
        <CardContent className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-3 flex items-center gap-1.5">
            <X className="h-3.5 w-3.5" />
            Don't
          </p>
          <ul className="space-y-2 text-sm">
            {donts.map((d, i) => (
              <li key={i} className="flex items-start gap-2">
                <X className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                <span className="text-foreground/90">{d}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────── Page header ──────────────────────────────────

export function SOPHeader({
  icon: Icon,
  role,
  who,
  mission,
  color,
}: {
  icon: any;
  role: string;
  who: string;
  mission: string;
  color: string; // tailwind text-* class
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-gradient-to-br from-card to-card/40 p-6 relative overflow-hidden">
      {/* Watermarked logo for branding */}
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
        <div className="flex-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Icon className={cn("h-3.5 w-3.5", color)} />
            SOP for
          </p>
          <h1 className="text-3xl font-bold text-primary">{role}</h1>
          <p className="text-sm text-muted-foreground mt-1">{who}</p>
          <p className="mt-3 text-foreground/90">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mr-2">
              Mission:
            </span>
            {mission}
          </p>
        </div>
      </div>
    </div>
  );
}
