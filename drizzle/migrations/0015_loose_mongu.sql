CREATE TYPE "public"."call_source" AS ENUM('meta', 'existing_client');--> statement-breakpoint
ALTER TABLE "bookedCalls" ADD COLUMN "callSource" "call_source";