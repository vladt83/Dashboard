/**
 * Email sending — small wrapper that:
 *   - logs every send attempt to `emailLog` (for audit + dedupe)
 *   - sends via Resend if RESEND_API_KEY is configured
 *   - falls back to console-log + DB row in dev (status='stubbed')
 *   - is idempotent on `dedupeKey` (unique index in DB)
 *
 * Wire RESEND_API_KEY + EMAIL_FROM in .env to flip from stub to real send.
 *
 * Usage:
 *   await sendEmail({
 *     to: { email: "elliot@traderfoundation.com", name: "Elliot Gumbs" },
 *     subject: "New client assigned",
 *     html: "<p>Marcus Johnson is now your client...</p>",
 *     text: "Marcus Johnson is now your client...",
 *     dedupeKey: `coach_assignment:25:1`,   // (dealId:coachPayeeId)
 *     relatedDealId: 25,
 *     relatedUserId: 17,                    // coach's user id
 *     triggeredByUserId: 4,                 // Ariana
 *   });
 */
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { emailLog, type InsertEmailLog } from "../drizzle/schema";

const FROM_EMAIL =
  process.env.EMAIL_FROM_ADDRESS || "noreply@traderfoundation.com";
const FROM_NAME = process.env.EMAIL_FROM_NAME || "Trader Foundation";
const REPLY_TO = process.env.EMAIL_REPLY_TO || undefined;

export type SendEmailInput = {
  to: { email: string; name?: string };
  from?: { email: string; name?: string };
  replyTo?: string;
  subject: string;
  html?: string;
  text?: string;
  dedupeKey?: string;
  relatedDealId?: number;
  relatedUserId?: number;
  triggeredByUserId?: number;
};

export type SendEmailResult = {
  status: "sent" | "stubbed" | "skipped_duplicate" | "failed";
  emailLogId?: number;
  providerId?: string;
  error?: string;
};

/**
 * Send an email — idempotent on dedupeKey. Returns status; never throws.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const db = await getDb();
  if (!db) return { status: "failed", error: "Database not available" };

  // Idempotency: if a row with this dedupeKey exists, don't re-send.
  if (input.dedupeKey) {
    const [existing] = await db.select({ id: emailLog.id, status: emailLog.status })
      .from(emailLog)
      .where(eq(emailLog.dedupeKey, input.dedupeKey));
    if (existing) {
      return {
        status: "skipped_duplicate",
        emailLogId: existing.id,
      };
    }
  }

  const fromEmail = input.from?.email || FROM_EMAIL;
  const fromName = input.from?.name || FROM_NAME;
  const replyTo = input.replyTo || REPLY_TO;

  // Always log first so we have an audit trail even if the provider call fails.
  const logRow: InsertEmailLog = {
    toEmail: input.to.email.toLowerCase(),
    toName: input.to.name ?? null,
    fromEmail,
    fromName,
    replyTo: replyTo ?? null,
    subject: input.subject,
    bodyHtml: input.html ?? null,
    bodyText: input.text ?? null,
    status: "queued",
    dedupeKey: input.dedupeKey ?? null,
    relatedDealId: input.relatedDealId ?? null,
    relatedUserId: input.relatedUserId ?? null,
    triggeredByUserId: input.triggeredByUserId ?? null,
  };

  let inserted: { id: number } | undefined;
  try {
    const result = await db.insert(emailLog).values(logRow).returning({ id: emailLog.id });
    inserted = result[0];
  } catch (err) {
    // Likely a dedupe-key collision from a concurrent send — treat as duplicate.
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("emailLog_dedupeKey_unique")) {
      return { status: "skipped_duplicate" };
    }
    return { status: "failed", error: message };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Dev mode — log a clear preview to stdout and mark the row stubbed.
    console.log(`[email:stubbed] To: ${input.to.email} · Subject: ${input.subject}`);
    if (input.text) console.log(`[email:stubbed] Body:\n${input.text}\n`);
    if (inserted) {
      await db.update(emailLog)
        .set({ status: "stubbed" })
        .where(eq(emailLog.id, inserted.id));
    }
    return { status: "stubbed", emailLogId: inserted?.id };
  }

  // Real send via Resend (https://resend.com/docs/api-reference/emails/send-email)
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
        to: [input.to.name ? `${input.to.name} <${input.to.email}>` : input.to.email],
        reply_to: replyTo,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });
    const json: unknown = await res.json();
    if (!res.ok) {
      const errMsg = (json as { message?: string })?.message ?? `HTTP ${res.status}`;
      if (inserted) {
        await db.update(emailLog)
          .set({ status: "failed", errorMessage: errMsg })
          .where(eq(emailLog.id, inserted.id));
      }
      return { status: "failed", error: errMsg, emailLogId: inserted?.id };
    }
    const providerId = (json as { id?: string })?.id;
    if (inserted) {
      await db.update(emailLog)
        .set({ status: "sent", providerId: providerId ?? null })
        .where(eq(emailLog.id, inserted.id));
    }
    return { status: "sent", emailLogId: inserted?.id, providerId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (inserted) {
      await db.update(emailLog)
        .set({ status: "failed", errorMessage: message })
        .where(eq(emailLog.id, inserted.id));
    }
    return { status: "failed", error: message, emailLogId: inserted?.id };
  }
}
