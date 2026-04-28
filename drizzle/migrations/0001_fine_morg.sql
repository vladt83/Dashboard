ALTER TYPE "public"."user_role" ADD VALUE 'setter';--> statement-breakpoint
CREATE TABLE "bookedCalls" (
	"id" serial PRIMARY KEY NOT NULL,
	"setterId" integer NOT NULL,
	"closerId" integer NOT NULL,
	"clientFirstName" varchar(100) NOT NULL,
	"clientLastName" varchar(100) NOT NULL,
	"phoneNumber" varchar(32) NOT NULL,
	"bookedDate" date NOT NULL,
	"notes" text,
	"dealId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
