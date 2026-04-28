/**
 * Import historical 2026 sales metrics from the team's Google Sheet
 * (Steve2026 + Jhalil 2026 tabs) into the `dailyStats` table.
 *
 * Spreadsheet structure (per closer per year):
 *   Row 3:    column headers (Available, Booked, Showed, Canceled, No Show,
 *             Offer, Deposit, Closed, Cash Collected, Rev Generated, ...)
 *   Rows 5-16:  monthly summary formulas (skip — we re-compute from dailies)
 *   Rows 18-22: quarterly rollups (skip)
 *   Rows 24+:  daily entries grouped by month:
 *               JAN  rows 26-56
 *               FEB  rows 58-86
 *               MAR  rows 88-118
 *               APR  rows 120-149
 *               MAY  rows 151-181
 *               JUN  rows 183-212
 *               JUL  rows 214-244
 *               AUG  rows 246-276
 *               SEP  rows 278-307
 *               OCT  rows 309-339
 *               NOV  rows 341-370
 *               DEC  rows 372-402
 *
 * For each daily row, column A holds the date and columns B-K hold the
 * counts/dollar values. Empty rows are skipped.
 *
 * Usage: pnpm tsx scripts/import-sales-history.mjs /tmp/sales-workbook.xlsx
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and } from "drizzle-orm";
import { Pool } from "pg";
import ExcelJS from "exceljs";
import { dailyStats, teamMembers } from "../drizzle/schema.ts";

const WORKBOOK_PATH = process.argv[2] || "/tmp/sales-workbook.xlsx";

const TAB_TO_CLOSER = {
  Steve2026: "Steve Lapa",
  "Jhalil 2026": "Jhalil Timazee",
};

// Each month's daily-row block (start/end inclusive).
const MONTH_BLOCKS = [
  { month: 1,  start: 26,  end: 56 },
  { month: 2,  start: 58,  end: 86 },
  { month: 3,  start: 88,  end: 118 },
  { month: 4,  start: 120, end: 149 },
  { month: 5,  start: 151, end: 181 },
  { month: 6,  start: 183, end: 212 },
  { month: 7,  start: 214, end: 244 },
  { month: 8,  start: 246, end: 276 },
  { month: 9,  start: 278, end: 307 },
  { month: 10, start: 309, end: 339 },
  { month: 11, start: 341, end: 370 },
  { month: 12, start: 372, end: 402 },
];

function n(v) {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  const parsed = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return isFinite(parsed) ? parsed : 0;
}

function asISODate(cellValue) {
  if (!cellValue) return null;
  if (cellValue instanceof Date) {
    return cellValue.toISOString().slice(0, 10);
  }
  if (typeof cellValue === "string") {
    // Sheets often hand back dates already as date strings; try to parse
    const d = new Date(cellValue);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  if (typeof cellValue === "number") {
    // Excel serial date — base 1899-12-30
    const ms = (cellValue - 25569) * 86400 * 1000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  return null;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(WORKBOOK_PATH);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  for (const [tabName, closerName] of Object.entries(TAB_TO_CLOSER)) {
    const ws = wb.getWorksheet(tabName);
    if (!ws) {
      console.warn(`Tab "${tabName}" not found — skipping.`);
      continue;
    }
    const [member] = await db.select().from(teamMembers).where(eq(teamMembers.name, closerName));
    if (!member) {
      console.warn(`Team member "${closerName}" not found — skipping.`);
      continue;
    }

    console.log(`\n→ ${tabName} (closer #${member.id} — ${closerName})`);

    let imported = 0;
    let skipped = 0;
    let monthTotals = {};

    for (const block of MONTH_BLOCKS) {
      for (let r = block.start; r <= block.end; r++) {
        const row = ws.getRow(r);
        const dateCell = row.getCell(1).value;
        const isoDate = asISODate(dateCell);
        if (!isoDate) { skipped++; continue; }

        // The sheet doesn't store the year in column A — derive from the
        // month block. Year is 2026 since these tabs are *2026* tabs.
        const yyyy = 2026;
        // Re-stamp the date with the correct year + month from the block,
        // keeping just the day-of-month from the cell.
        const dayOfMonth = parseInt(isoDate.slice(8, 10), 10);
        const fixedDate = `${yyyy}-${String(block.month).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`;

        // Columns: A=date, B=Available, C=Booked, D=Showed, E=Canceled,
        //          F=No Show, G=Offer, H=Deposit, I=Closed, J=Cash, K=Rev
        const booked    = n(row.getCell(3).value);
        const showed    = n(row.getCell(4).value);
        const canceled  = n(row.getCell(5).value);
        const noShow    = n(row.getCell(6).value);
        const offered   = n(row.getCell(7).value);
        const closed    = n(row.getCell(9).value);
        const cash      = n(row.getCell(10).value);
        const rev       = n(row.getCell(11).value);

        // Skip rows with no real activity
        if (booked + showed + canceled + noShow + offered + closed + cash + rev === 0) {
          skipped++;
          continue;
        }

        // Upsert: if a row already exists for this closer+date, update; else insert.
        const [existing] = await db.select().from(dailyStats).where(and(
          eq(dailyStats.closerId, member.id),
          eq(dailyStats.statDate, fixedDate),
        ));
        const values = {
          closerId: member.id,
          statDate: fixedDate,
          booked, showed, canceled, noShow, offered, closed,
          cashCollected: cash.toFixed(2),
          revGenerated: rev.toFixed(2),
          source: "import",
        };
        if (existing) {
          await db.update(dailyStats).set(values).where(eq(dailyStats.id, existing.id));
        } else {
          await db.insert(dailyStats).values(values);
        }
        imported++;

        // Accumulate month totals for the verification report
        const mt = monthTotals[block.month] ?? { booked: 0, closed: 0, cash: 0, rev: 0 };
        mt.booked += booked; mt.closed += closed; mt.cash += cash; mt.rev += rev;
        monthTotals[block.month] = mt;
      }
    }

    console.log(`  imported ${imported} daily rows · skipped ${skipped} empty rows`);
    for (const [m, t] of Object.entries(monthTotals)) {
      const monthName = ["", "JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][m];
      console.log(`    ${monthName.padEnd(3)} 2026: booked=${t.booked.toString().padStart(3)} · closed=${t.closed.toString().padStart(2)} · cash=$${t.cash.toLocaleString().padStart(8)} · rev=$${t.rev.toLocaleString()}`);
    }
  }

  await pool.end();
  console.log("\n✅ Import complete.");
}

main().catch(err => { console.error("\n💥", err); process.exit(1); });
