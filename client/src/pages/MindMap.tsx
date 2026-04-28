import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Network, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Trader Foundation — Ultimate Mind Map.
 *
 * One self-contained SVG. Six branches radiate from the center logo;
 * each carries a category color; leaves are clickable when they link to
 * an in-app route. The whole thing fits a 1600×1000 viewBox so it scales
 * cleanly on any monitor.
 */

type Leaf = {
  label: string;
  detail?: string;
  href?: string;     // optional in-app navigation target
};

type Branch = {
  label: string;
  color: string;      // hex
  bgFaint: string;    // hex with alpha — for leaf bg
  angle: number;      // degrees, 0 = right, 90 = up (mathematical), used radially
  leaves: Leaf[];
};

const BRANCHES: Branch[] = [
  {
    label: "ROLES",
    color: "#c7ab77",
    bgFaint: "rgba(199,171,119,0.10)",
    angle: 90,
    leaves: [
      { label: "Admin", detail: "Vlad Tayman" },
      { label: "Closer", detail: "Steve · Jhalil · Jake" },
      { label: "Setter", detail: "Kresha Koirala" },
      { label: "Coach", detail: "Leo · Elliot · Erin" },
      { label: "Payroll", detail: "Ariana Tayman" },
    ],
  },
  {
    label: "SALES FLOW",
    color: "#10b981",
    bgFaint: "rgba(16,185,129,0.10)",
    angle: 30,
    leaves: [
      { label: "1. Setter books call", detail: "from text outreach", href: "/setter-bookings" },
      { label: "2. Closer sees booking", detail: "Setter Bookings tab", href: "/setter-bookings" },
      { label: "3. Run the call", detail: "show / prepared / closed" },
      { label: "4. Save deal + setter", detail: "/deals/new", href: "/deals/new" },
      { label: "5. Commissions auto-compute", detail: "stored on deals row" },
    ],
  },
  {
    label: "COACHING",
    color: "#a855f7",
    bgFaint: "rgba(168,85,247,0.10)",
    angle: -30,
    leaves: [
      { label: "Leo (on-demand)", detail: "$0.90/min + $15/no-show" },
      { label: "Elliot (salaried)", detail: "$2,050 bi-weekly fixed" },
      { label: "Erin (W2)", detail: "$2,500 bi-weekly fixed" },
      { label: "Recording link", detail: "OPTIONAL — no penalty" },
      { label: "$2K monthly cap", detail: "Leo only" },
    ],
  },
  {
    label: "COMMISSIONS",
    color: "#f59e0b",
    bgFaint: "rgba(245,158,11,0.10)",
    angle: -90,
    leaves: [
      { label: "Closer 10%", detail: "15% Jan–Feb 2026" },
      { label: "Setter 3%", detail: "capped $6K cash / deal" },
      { label: "Subscription 25%", detail: "to closer, recurring" },
      { label: "No setter on subs", detail: "subs never pay setter" },
      { label: "BNPL net of fee", detail: "commission on net cash" },
    ],
  },
  {
    label: "DATABASE",
    color: "#3b82f6",
    bgFaint: "rgba(59,130,246,0.10)",
    angle: -150,
    leaves: [
      { label: "deals", detail: "closer + setter commissions" },
      { label: "subscriptions", detail: "no setterId — by design" },
      { label: "bookedCalls", detail: "setter → closer assignment" },
      { label: "coachingSessions", detail: "minutes, no-show, payee link" },
      { label: "subscriptionVerifications", detail: "monthly 25% gate" },
    ],
  },
  {
    label: "PAGES",
    color: "#ec4899",
    bgFaint: "rgba(236,72,153,0.10)",
    angle: 150,
    leaves: [
      { label: "Dashboard", detail: "home for each role", href: "/" },
      { label: "New Entry", detail: "sale + subscription forms", href: "/deals/new" },
      { label: "My Deals", detail: "closer's own entries", href: "/my-deals" },
      { label: "Payroll Dashboard", detail: "spend overview + tabs", href: "/payroll" },
      { label: "SOPs", detail: "per-role visual guides", href: "/sop" },
    ],
  },
];

const VIEWBOX_W = 1600;
const VIEWBOX_H = 1000;
const CX = VIEWBOX_W / 2;
const CY = VIEWBOX_H / 2;

const TRUNK_LEN = 240;     // distance from center to branch label
const LEAF_LEN = 360;      // distance from branch label center to first leaf row
const LEAF_GAP = 64;       // vertical gap between leaves on the same branch
const LEAF_BOX_W = 280;
const LEAF_BOX_H = 52;
const BRANCH_BOX_W = 220;
const BRANCH_BOX_H = 48;

function polar(angleDeg: number, r: number) {
  // Math angles: 0° = +X (right), 90° = +Y (up). SVG y is flipped.
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: CX + r * Math.cos(rad),
    y: CY - r * Math.sin(rad),
  };
}

/**
 * For a given branch, the leaves stack vertically beside the branch label.
 * Branches on the right half stack to the right; branches on the left
 * stack to the left. The label position is exactly at TRUNK_LEN out.
 */
function branchGeometry(angle: number, leafCount: number) {
  const labelPos = polar(angle, TRUNK_LEN);
  const isRight = Math.cos((angle * Math.PI) / 180) >= 0;
  const leafColumnX = isRight ? labelPos.x + 80 : labelPos.x - 80 - LEAF_BOX_W;
  // Center the leaf stack vertically relative to the branch label
  const totalH = leafCount * LEAF_GAP - (LEAF_GAP - LEAF_BOX_H);
  const firstLeafY = labelPos.y - totalH / 2;
  return { labelPos, isRight, leafColumnX, firstLeafY };
}

export default function MindMap() {
  const [, setLocation] = useLocation();
  const [hovered, setHovered] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <div className="space-y-4 max-w-[1800px]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Network className="h-3.5 w-3.5 text-primary" />
            Mind Map
          </p>
          <h1 className="text-3xl font-bold text-primary">The Whole System at a Glance</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Six branches: roles, sales flow, coaching, commissions, database, pages.
            Click any leaf with a route to jump there.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFullscreen(f => !f)}
        >
          {fullscreen ? (
            <>
              <Minimize2 className="h-4 w-4 mr-2" />
              Exit fullscreen
            </>
          ) : (
            <>
              <Maximize2 className="h-4 w-4 mr-2" />
              Fullscreen
            </>
          )}
        </Button>
      </div>

      <Card className={fullscreen ? "fixed inset-2 z-50 overflow-auto" : ""}>
        <CardContent className="p-2">
          <svg
            viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
            className="w-full h-auto"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* faint radial backdrop */}
            <defs>
              <radialGradient id="bg" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#c7ab77" stopOpacity="0.08" />
                <stop offset="60%" stopColor="#c7ab77" stopOpacity="0" />
              </radialGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              {BRANCHES.map(b => (
                <linearGradient
                  key={`grad-${b.label}`}
                  id={`grad-${b.label}`}
                  x1="0%" y1="0%" x2="100%" y2="0%"
                >
                  <stop offset="0%" stopColor={b.color} stopOpacity="0.7" />
                  <stop offset="100%" stopColor={b.color} stopOpacity="1" />
                </linearGradient>
              ))}
            </defs>
            <rect width={VIEWBOX_W} height={VIEWBOX_H} fill="url(#bg)" />

            {/* ─── Trunk lines from center to each branch label ──────────── */}
            {BRANCHES.map(b => {
              const { labelPos } = branchGeometry(b.angle, b.leaves.length);
              const ctrl = polar(b.angle, TRUNK_LEN * 0.55);
              return (
                <path
                  key={`trunk-${b.label}`}
                  d={`M ${CX} ${CY} Q ${ctrl.x} ${ctrl.y} ${labelPos.x} ${labelPos.y}`}
                  fill="none"
                  stroke={b.color}
                  strokeWidth={3}
                  strokeOpacity={0.7}
                />
              );
            })}

            {/* ─── Center node — Trader Foundation ───────────────────────── */}
            <g>
              <circle cx={CX} cy={CY} r={110} fill="#1a1a1a" stroke="#c7ab77" strokeWidth={3} />
              <circle cx={CX} cy={CY} r={92} fill="#0d0d0d" stroke="#c7ab77" strokeWidth={1} strokeOpacity={0.4} />
              {/* Logo placeholder — TF monogram if logo.png isn't drawn here */}
              <image
                href="/logo.png"
                x={CX - 60}
                y={CY - 60}
                width={120}
                height={120}
                preserveAspectRatio="xMidYMid meet"
              />
              <text
                x={CX}
                y={CY + 75}
                textAnchor="middle"
                fill="#c7ab77"
                fontSize={20}
                fontWeight={700}
                style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
              >
                Commission Tracker
              </text>
            </g>

            {/* ─── Branches: label + leaves ──────────────────────────────── */}
            {BRANCHES.map(b => {
              const { labelPos, isRight, leafColumnX, firstLeafY } = branchGeometry(
                b.angle,
                b.leaves.length
              );

              return (
                <g key={b.label}>
                  {/* Connecting lines from branch label to each leaf */}
                  {b.leaves.map((leaf, i) => {
                    const leafX = leafColumnX + (isRight ? 0 : LEAF_BOX_W);
                    const leafY = firstLeafY + i * LEAF_GAP + LEAF_BOX_H / 2;
                    const labelEdgeX = isRight
                      ? labelPos.x + BRANCH_BOX_W / 2
                      : labelPos.x - BRANCH_BOX_W / 2;
                    const ctrlX = (labelEdgeX + leafX) / 2;
                    return (
                      <path
                        key={`line-${b.label}-${i}`}
                        d={`M ${labelEdgeX} ${labelPos.y} C ${ctrlX} ${labelPos.y}, ${ctrlX} ${leafY}, ${leafX} ${leafY}`}
                        fill="none"
                        stroke={b.color}
                        strokeWidth={1.6}
                        strokeOpacity={0.6}
                      />
                    );
                  })}

                  {/* Branch label */}
                  <g>
                    <rect
                      x={labelPos.x - BRANCH_BOX_W / 2}
                      y={labelPos.y - BRANCH_BOX_H / 2}
                      width={BRANCH_BOX_W}
                      height={BRANCH_BOX_H}
                      rx={10}
                      fill={`url(#grad-${b.label})`}
                      stroke={b.color}
                      strokeWidth={2}
                    />
                    <text
                      x={labelPos.x}
                      y={labelPos.y + 6}
                      textAnchor="middle"
                      fill="#0a0a0a"
                      fontSize={18}
                      fontWeight={800}
                      style={{ fontFamily: "system-ui, -apple-system, sans-serif", letterSpacing: 1 }}
                    >
                      {b.label}
                    </text>
                  </g>

                  {/* Leaves */}
                  {b.leaves.map((leaf, i) => {
                    const x = leafColumnX;
                    const y = firstLeafY + i * LEAF_GAP;
                    const key = `${b.label}-${leaf.label}`;
                    const isHover = hovered === key;
                    const clickable = !!leaf.href;
                    return (
                      <g
                        key={key}
                        style={{ cursor: clickable ? "pointer" : "default" }}
                        onMouseEnter={() => setHovered(key)}
                        onMouseLeave={() => setHovered(null)}
                        onClick={() => {
                          if (leaf.href) setLocation(leaf.href);
                        }}
                      >
                        <rect
                          x={x}
                          y={y}
                          width={LEAF_BOX_W}
                          height={LEAF_BOX_H}
                          rx={8}
                          fill={isHover ? b.color : "#0d0d0d"}
                          fillOpacity={isHover ? 0.95 : 0.85}
                          stroke={b.color}
                          strokeWidth={isHover ? 2.5 : 1.5}
                          strokeOpacity={isHover ? 1 : 0.7}
                        />
                        <text
                          x={x + 14}
                          y={y + 22}
                          fill={isHover ? "#0a0a0a" : "#fafafa"}
                          fontSize={14}
                          fontWeight={700}
                          style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
                        >
                          {leaf.label}
                          {clickable && (
                            <tspan
                              fontSize={11}
                              fill={isHover ? "#0a0a0a" : b.color}
                              dx={6}
                            >
                              ↗
                            </tspan>
                          )}
                        </text>
                        {leaf.detail && (
                          <text
                            x={x + 14}
                            y={y + 40}
                            fill={isHover ? "#1a1a1a" : "#9aa0a6"}
                            fontSize={11}
                            style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
                          >
                            {leaf.detail}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              );
            })}

            {/* ─── Footer captions ───────────────────────────────────────── */}
            <text
              x={20}
              y={VIEWBOX_H - 20}
              fill="#9aa0a6"
              fontSize={11}
              style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
            >
              Trader Foundation Commission Tracker — All passwords: Trader · See /sop for per-role guides
            </text>
            <text
              x={VIEWBOX_W - 20}
              y={VIEWBOX_H - 20}
              fill="#c7ab77"
              fontSize={11}
              fontWeight={600}
              textAnchor="end"
              style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
            >
              click any leaf with ↗ to navigate
            </text>
          </svg>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">
            Legend
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {BRANCHES.map(b => (
              <div key={b.label} className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: b.color }}
                />
                <span className="text-sm">{b.label}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Hover any leaf to highlight it. Leaves marked with{" "}
            <span className="text-primary font-bold">↗</span> are clickable
            and navigate to that page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
