CREATE TABLE "vslCallPreps" (
	"id" serial PRIMARY KEY NOT NULL,
	"setterId" integer NOT NULL,
	"closerId" integer NOT NULL,
	"clientFirstName" varchar(100) NOT NULL,
	"clientLastName" varchar(100) NOT NULL,
	"phoneNumber" varchar(32) NOT NULL,
	"email" varchar(320),
	"vslBookedAt" timestamp,
	"vslWatched" boolean DEFAULT false NOT NULL,
	"q1Motivation" text,
	"q2TradingExperience" text,
	"q3DayToDay" text,
	"q4Coachability" text,
	"q5SpecificQuestions" text,
	"stockPredatorDelivered" boolean DEFAULT false NOT NULL,
	"redFlags" text,
	"notes" text,
	"reviewedByCloser" boolean DEFAULT false NOT NULL,
	"dealId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "teamMembers" ADD COLUMN "commissionCap" numeric(12, 2);