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
  { name: "Steve Lapa",      email: "steve@traderfoundation.com",   role: "closer"  as const, permissions: ["/", "/new-deal", "/my-deals", "/sales-tracker", "/setter-bookings", "/sop"] },
  { name: "Jhalil Timazee",  email: "jhalil@traderfoundation.com",  role: "closer"  as const, permissions: ["/", "/new-deal", "/my-deals", "/sales-tracker", "/setter-bookings", "/sop"] },
  { name: "Jake Glass",      email: "jake@traderfoundation.com",    role: "closer"  as const, permissions: ["/", "/new-deal", "/my-deals", "/sales-tracker", "/setter-bookings", "/sop"] },
  { name: "Ariana Tayman",   email: "ariana@traderfoundation.com",  role: "payroll" as const, permissions: ["/", "/payment-plans", "/payroll-dashboard", "/payouts", "/subscriptions", "/sop"] },
  { name: "Leo Gonzalez",    email: "leo@traderfoundation.com",     role: "coach"   as const, permissions: ["/", "/coaching-sessions", "/sop"] },
  { name: "Elliot Gumbs",    email: "elliot@traderfoundation.com",  role: "coach"   as const, permissions: ["/", "/coaching-sessions", "/sop"] },
  { name: "Erin Chawla",     email: "erin@traderfoundation.com",    role: "coach"   as const, permissions: ["/", "/coaching-sessions", "/sop"] },
  { name: "Kresha Koirala",  email: "kresha.koirala@gmail.com",     role: "setter"  as const, permissions: ["/", "/setter-dashboard", "/sop"] },
];

const TEAM_MEMBERS: Array<{ name: string; role: "closer" | "setter" | "payroll"; email: string }> = [
  { name: "Steve Lapa",     role: "closer", email: "steve@traderfoundation.com" },
  { name: "Jhalil Timazee", role: "closer", email: "jhalil@traderfoundation.com" },
  { name: "Jake Glass",     role: "closer", email: "jake@traderfoundation.com" },
  { name: "Kresha Koirala", role: "setter", email: "kresha.koirala@gmail.com" },
];

// Commission rates:
//  - Closers: 15% Jan-Feb 2026, 10% March 2026 onward.
//  - Setters: 3% on cash collected per closed deal, capped at $6,000 cash per deal
//    (the cap is enforced in code; the rate row carries the 3%).
const COMMISSION_RATES: Array<{ memberName: string; rate: string; startMonth: number; startYear: number; endMonth: number | null; endYear: number | null }> = [
  { memberName: "Steve Lapa",     rate: "0.1500", startMonth: 1, startYear: 2026, endMonth: 2, endYear: 2026 },
  { memberName: "Steve Lapa",     rate: "0.1000", startMonth: 3, startYear: 2026, endMonth: null, endYear: null },
  { memberName: "Jhalil Timazee", rate: "0.1500", startMonth: 1, startYear: 2026, endMonth: 2, endYear: 2026 },
  { memberName: "Jhalil Timazee", rate: "0.1000", startMonth: 3, startYear: 2026, endMonth: null, endYear: null },
  { memberName: "Jake Glass",     rate: "0.1500", startMonth: 1, startYear: 2026, endMonth: 2, endYear: 2026 },
  { memberName: "Jake Glass",     rate: "0.1000", startMonth: 3, startYear: 2026, endMonth: null, endYear: null },
  { memberName: "Kresha Koirala", rate: "0.0300", startMonth: 1, startYear: 2026, endMonth: null, endYear: null },
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
    if (existing.length === 0) {
      await db.insert(teamMembers).values({ name: tm.name, role: tm.role, active: true });
      console.log(`  + ${tm.name} (${tm.role})`);
    } else {
      console.log(`  • ${tm.name} exists`);
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
