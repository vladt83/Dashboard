CREATE TYPE "public"."setter_motion" AS ENUM('vsl', 'text');--> statement-breakpoint
ALTER TABLE "teamMembers" ADD COLUMN "setterMotion" "setter_motion";--> statement-breakpoint
ALTER TABLE "teamMembers" ADD COLUMN "setterRate" numeric(5, 4);