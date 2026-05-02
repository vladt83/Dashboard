import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import {
  users,
  teamMembers,
  commissionRates,
  payees,
  userTeamLinks,
} from "../drizzle/schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set. Put it in .env first.");
  process.exit(1);
}

const DEFAULT_PASSWORD = "Trader";

const EMPLOYEES = [
  { name: "Vlad Tayman",     email: "vlad@traderfoundation.com",    role: "admin"   as const, permissions: ["*"] },
  { name: "Steve Lapa",      email: "steve@traderfoundation.com",   role: "closer"  as const, permissions: ["/", "/new-entry", "/my-deals", "/sales-tracker", "/setter-bookings", "/clients", "/sop"] },
  { name: "Jhalil Timazee",  email: "jhalil@traderfoundation.com",  role: "closer"  as const, permissions: ["/", "/new-entry", "/my-deals", "/sales-tracker", "/setter-bookings", "/clients", "/sop"] },
  // Jake moved from closer to VSL setter per the OCE Sales Process Diagnostic
  // (April 2026). He runs the 5-question discovery call right after VSL booking.
  { name: "Jake Glass",      email: "jake@traderfoundation.com",    role: "setter"  as const, permissions: ["/", "/setter-dashboard", "/clients", "/sop"] },
  { name: "Ariana Tayman",   email: "ariana@traderfoundation.com",  role: "payroll" as const, permissions: ["/", "/onboarding", "/clients", "/payment-plans", "/payroll-dashboard", "/payouts", "/coaching-sessions", "/sop"] },
  { name: "Leo Gonzalez",    email: "leo@traderfoundation.com",     role: "coach"   as const, permissions: ["/", "/coaching-sessions", "/clients", "/sop"] },
  { name: "Elliot Gumbs",    email: "elliot@traderfoundation.com",  role: "coach"   as const, permissions: ["/", "/coaching-sessions", "/clients", "/sop"] },
  { name: "Erin Chawla",     email: "erin@traderfoundation.com",    role: "coach"   as const, permissions: ["/", "/coaching-sessions", "/clients", "/sop"] },
  { name: "Kresha Koirala",  email: "kresha.koirala@gmail.com",     role: "setter"  as const, permissions: ["/", "/setter-dashboard", "/clients", "/sop"] },
];

// Team-member rows. Setter-only fields:
//   `commissionCap` — per-deal cash cap (Kresha $6K, Jake uncapped/null).
//   `setterMotion`  — which sales lane (drives the role-aware Setter Dashboard):
//                       "vsl"  = Pre Call discovery setter (Jake)
//                       "text" = Call Setting / text outreach setter (Kresha)
//   `setterRate`    — commission rate as decimal (Kresha 3%, Jake 2%).
//   Closers ignore all three.
const TEAM_MEMBERS: Array<{
  name: string;
  role: "closer" | "setter" | "payroll";
  email: string;
  commissionCap?: string | null;
  setterMotion?: "vsl" | "text" | null;
  setterRate?: string | null;
}> = [
  { name: "Steve Lapa",     role: "closer", email: "steve@traderfoundation.com" },
  { name: "Jhalil Timazee", role: "closer", email: "jhalil@traderfoundation.com" },
  { name: "Jake Glass",     role: "setter", email: "jake@traderfoundation.com",   commissionCap: null,   setterMotion: "vsl",  setterRate: "0.0200" },
  { name: "Kresha Koirala", role: "setter", email: "kresha.koirala@gmail.com",    commissionCap: "6000", setterMotion: "text", setterRate: "0.0300" },
];

// Commission rates (closers only — setter rates live on `teamMembers.setterRate`):
//  - Steve / Jhalil: 15% Jan-Feb 2026, 10% March 2026 onward.
const COMMISSION_RATES: Array<{ memberName: string; rate: string; startMonth: number; startYear: number; endMonth: number | null; endYear: number | null }> = [
  { memberName: "Steve Lapa",     rate: "0.1500", startMonth: 1, startYear: 2026, endMonth: 2, endYear: 2026 },
  { memberName: "Steve Lapa",     rate: "0.1000", startMonth: 3, startYear: 2026, endMonth: null, endYear: null },
  { memberName: "Jhalil Timazee", rate: "0.1500", startMonth: 1, startYear: 2026, endMonth: 2, endYear: 2026 },
  { memberName: "Jhalil Timazee", rate: "0.1000", startMonth: 3, startYear: 2026, endMonth: null, endYear: null },
];

const PAYEES = [
  { name: "Elliot Gumbs",           type: "coach"           as const, paymentAmount: "2050", paymentFrequency: "biweekly" as const, isAutopay: false, description: "Salaried coach" },
  { name: "Erin Chawla",            type: "w2"              as const, paymentAmount: "2500", paymentFrequency: "biweekly" as const, isAutopay: false, description: "W2, head of organic" },
  { name: "Leo Gonzalez",           type: "on_demand_coach" as const, paymentAmount: "0.90", paymentFrequency: "biweekly" as const, isAutopay: false, description: "On-demand coach: $0.90/min, $15 no-show, $2K monthly cap" },
  { name: "Shyft Media (Filming)",  type: "vendor"          as const, paymentAmount: "1800", paymentFrequency: "monthly"  as const, isAutopay: true,  description: "Monthly filming retainer (autopay)" },
  { name: "Shyft Media (Ads)",      type: "vendor"          as const, paymentAmount: "500",  paymentFrequency: "monthly"  as const, isAutopay: true,  description: "Monthly ad management retainer (autopay)" },
];

async function main() {
  const pool = new Pool({
    connectionString: DATABASE_URL!,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });
  const db = drizzle(pool);

  console.log("→ Seeding users…");
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  for (const emp of EMPLOYEES) {
    const existing = await db.select().from(users).where(eq(users.email, emp.email));
    if (existing.length > 0) {
      console.log(`  • ${emp.email} exists, updating role/permissions`);
      await db.update(users)
        .set({
          name: emp.name,
          role: emp.role,
          permissions: JSON.stringify(emp.permissions),
          passwordHash,
          loginMethod: "email",
        })
        .where(eq(users.email, emp.email));
    } else {
      await db.insert(users).values({
        openId: `user-${emp.email}`,
        name: emp.name,
        email: emp.email,
        passwordHash,
        loginMethod: "email",
        role: emp.role,
        permissions: JSON.stringify(emp.permissions),
        lastSignedIn: new Date(),
      });
      console.log(`  + ${emp.email} (${emp.role})`);
    }
  }

  console.log("→ Seeding team members…");
  for (const tm of TEAM_MEMBERS) {
    const existing = await db.select().from(teamMembers).where(eq(teamMembers.name, tm.name));
    const cap = tm.commissionCap ?? null;
    const motion = tm.setterMotion ?? null;
    const setterRateValue = tm.setterRate ?? null;
    const motionLabel =
      motion === "vsl" ? ", Pre Call lane" :
      motion === "text" ? ", Call Setting lane" : "";
    const rateLabel = setterRateValue ? `, rate=${(parseFloat(setterRateValue) * 100).toFixed(0)}%` : "";

    if (existing.length === 0) {
      await db.insert(teamMembers).values({
        name: tm.name,
        role: tm.role,
        active: true,
        commissionCap: cap,
        setterMotion: motion,
        setterRate: setterRateValue,
      });
      console.log(`  + ${tm.name} (${tm.role}${cap ? `, cap=$${cap}` : tm.role === "setter" ? ", uncapped" : ""}${motionLabel}${rateLabel})`);
    } else {
      // Upsert role + cap + motion + rate so rerunning the seed flips Jake
      // closer→setter, sets Kresha's cap, splits VSL vs text rates, etc.,
      // without a manual SQL step.
      await db.update(teamMembers)
        .set({ role: tm.role, commissionCap: cap, setterMotion: motion, setterRate: setterRateValue })
        .where(eq(teamMembers.id, existing[0].id));
      console.log(`  • ${tm.name} updated → role=${tm.role}${cap ? `, cap=$${cap}` : tm.role === "setter" ? ", uncapped" : ""}${motionLabel}${rateLabel}`);
    }
  }

  console.log("→ Linking user accounts ↔ team members…");
  for (const tm of TEAM_MEMBERS) {
    const [user] = await db.select().from(users).where(eq(users.email, tm.email));
    const [member] = await db.select().from(teamMembers).where(eq(teamMembers.name, tm.name));
    if (!user || !member) continue;
    const link = await db.select().from(userTeamLinks).where(eq(userTeamLinks.userId, user.id));
    if (link.length === 0) {
      await db.insert(userTeamLinks).values({ userId: user.id, teamMemberId: member.id });
      console.log(`  + ${user.email} → team member #${member.id} (${tm.role})`);
    }
  }

  console.log("→ Seeding commission rates…");
  for (const rate of COMMISSION_RATES) {
    const [member] = await db.select().from(teamMembers).where(eq(teamMembers.name, rate.memberName));
    if (!member) continue;
    const existing = await db.select().from(commissionRates).where(eq(commissionRates.memberId, member.id));
    const exists = existing.some(r =>
      r.startMonth === rate.startMonth && r.startYear === rate.startYear
    );
    if (!exists) {
      await db.insert(commissionRates).values({
        memberId: member.id,
        rate: rate.rate,
        showRate: "0",
        startMonth: rate.startMonth,
        startYear: rate.startYear,
        endMonth: rate.endMonth,
        endYear: rate.endYear,
      });
      console.log(`  + ${rate.memberName} ${rate.rate} ${rate.startMonth}/${rate.startYear}–${rate.endMonth ?? "ongoing"}/${rate.endYear ?? ""}`);
    }
  }

  console.log("→ Seeding payees…");
  for (const p of PAYEES) {
    const existing = await db.select().from(payees).where(eq(payees.name, p.name));
    if (existing.length === 0) {
      await db.insert(payees).values(p);
      console.log(`  + ${p.name} (${p.type}, $${p.paymentAmount} ${p.paymentFrequency})`);
    } else {
      console.log(`  • ${p.name} exists`);
    }
  }

  await pool.end();
  console.log("\nSeed complete. All logins use password: Trader");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
