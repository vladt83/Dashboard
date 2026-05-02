CREATE TABLE "emailLog" (
	"id" serial PRIMARY KEY NOT NULL,
	"toEmail" varchar(320) NOT NULL,
	"toName" varchar(255),
	"fromEmail" varchar(320) NOT NULL,
	"fromName" varchar(255),
	"replyTo" varchar(320),
	"subject" varchar(500) NOT NULL,
	"bodyHtml" text,
	"bodyText" text,
	"status" varchar(32) DEFAULT 'queued' NOT NULL,
	"providerId" varchar(255),
	"errorMessage" text,
	"dedupeKey" varchar(255),
	"relatedDealId" integer,
	"relatedUserId" integer,
	"triggeredByUserId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dealOnboardings" ADD COLUMN "sessionsBookedComplete" boolean DEFAULT false NOT NULL;