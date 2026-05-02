CREATE TYPE "public"."extension_milestone" AS ENUM('window_open', 'one_week_left', 'program_ends', 'lapsed');--> statement-breakpoint
CREATE TYPE "public"."extension_status" AS ENUM('window_open', 'outreach_started', 'call_booked', 'extended', 'lapsed');--> statement-breakpoint
CREATE TABLE "extensionAlerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"dealId" integer NOT NULL,
	"milestone" "extension_milestone" NOT NULL,
	"firedAt" timestamp DEFAULT now() NOT NULL,
	"recipientUserId" integer NOT NULL,
	"recipientName" varchar(255) NOT NULL,
	"recipientRole" varchar(32) NOT NULL,
	"dayOffset" integer NOT NULL,
	"acknowledgedAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "dealOnboardings" ADD COLUMN "extensionStatus" "extension_status";--> statement-breakpoint
ALTER TABLE "dealOnboardings" ADD COLUMN "extensionStatusAt" timestamp;--> statement-breakpoint
ALTER TABLE "dealOnboardings" ADD COLUMN "extensionStatusBy" integer;--> statement-breakpoint
ALTER TABLE "dealOnboardings" ADD COLUMN "extensionNotes" text;