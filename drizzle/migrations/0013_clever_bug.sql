CREATE TABLE "loginTokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" varchar(64) NOT NULL,
	"userId" integer NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"usedAt" timestamp,
	"reason" varchar(64) DEFAULT 'login_request' NOT NULL,
	"triggeredByUserId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "loginTokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "dealOnboardings" ADD COLUMN "introCallBooked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "dealOnboardings" ADD COLUMN "introCallBookedAt" timestamp;