CREATE TABLE "dailyStats" (
	"id" serial PRIMARY KEY NOT NULL,
	"closerId" integer NOT NULL,
	"statDate" date NOT NULL,
	"booked" integer DEFAULT 0 NOT NULL,
	"showed" integer DEFAULT 0 NOT NULL,
	"canceled" integer DEFAULT 0 NOT NULL,
	"noShow" integer DEFAULT 0 NOT NULL,
	"offered" integer DEFAULT 0 NOT NULL,
	"closed" integer DEFAULT 0 NOT NULL,
	"cashCollected" numeric(12, 2) DEFAULT '0' NOT NULL,
	"revGenerated" numeric(12, 2) DEFAULT '0' NOT NULL,
	"source" varchar(32) DEFAULT 'import' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "offered" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "canceled" boolean DEFAULT false NOT NULL;