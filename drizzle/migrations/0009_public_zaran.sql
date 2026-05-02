ALTER TYPE "public"."user_role" ADD VALUE 'client';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "clientDealId" integer;