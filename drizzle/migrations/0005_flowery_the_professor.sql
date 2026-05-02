DROP TABLE "subscriptionVerifications" CASCADE;--> statement-breakpoint
DROP TABLE "subscriptions" CASCADE;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "docusignSigned" boolean DEFAULT false NOT NULL;