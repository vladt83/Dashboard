CREATE TYPE "public"."adjustment_type" AS ENUM('bonus', 'deduction');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('notes_updated', 'payment_received', 'bonus_added', 'deduction_added');--> statement-breakpoint
CREATE TYPE "public"."payee_type" AS ENUM('coach', 'on_demand_coach', 'w2', 'vendor', 'closer', 'setter');--> statement-breakpoint
CREATE TYPE "public"."payment_frequency" AS ENUM('biweekly', 'monthly', 'autopay');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('active', 'paid_early', 'cancelled', 'collected');--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('full_pay', 'in_house_payment_plan', 'bnpl');--> statement-breakpoint
CREATE TYPE "public"."team_member_role" AS ENUM('closer', 'setter', 'payroll');--> statement-breakpoint
CREATE TYPE "public"."trading_log" AS ENUM('yes', 'no', 'too_new');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('closer', 'payroll', 'admin', 'coach');--> statement-breakpoint
CREATE TABLE "adjustments" (
	"id" serial PRIMARY KEY NOT NULL,
	"memberId" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"type" "adjustment_type" NOT NULL,
	"reason" text NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"createdBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coachingSessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"coachPayeeId" integer NOT NULL,
	"sessionDate" date NOT NULL,
	"clientName" varchar(255) NOT NULL,
	"minutes" integer NOT NULL,
	"tradingLog" "trading_log" DEFAULT 'yes' NOT NULL,
	"fuSession" boolean DEFAULT false NOT NULL,
	"fuAssignments" text,
	"notes" text,
	"recordingLink" varchar(1000),
	"isNoShow" boolean DEFAULT false NOT NULL,
	"sessionPay" numeric(12, 2) DEFAULT '0',
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commissionRates" (
	"id" serial PRIMARY KEY NOT NULL,
	"memberId" integer NOT NULL,
	"rate" numeric(5, 4) NOT NULL,
	"showRate" numeric(8, 2) DEFAULT '0',
	"startMonth" integer NOT NULL,
	"startYear" integer NOT NULL,
	"endMonth" integer,
	"endYear" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commissionSettings" (
	"id" serial PRIMARY KEY NOT NULL,
	"commissionPercentage" numeric(5, 4) NOT NULL,
	"showCommissionAmount" numeric(8, 2) NOT NULL,
	"effectiveFrom" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedBy" integer
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" serial PRIMARY KEY NOT NULL,
	"clientName" varchar(255) NOT NULL,
	"dealDate" date NOT NULL,
	"showed" boolean DEFAULT false NOT NULL,
	"prepared" boolean DEFAULT false NOT NULL,
	"closed" boolean DEFAULT false NOT NULL,
	"isNewClient" boolean DEFAULT true NOT NULL,
	"fullyPaid" boolean DEFAULT false NOT NULL,
	"totalDealAmount" numeric(12, 2) DEFAULT '0',
	"newCashCollected" numeric(12, 2) DEFAULT '0',
	"existingCashCollected" numeric(12, 2) DEFAULT '0',
	"closerId" integer NOT NULL,
	"setterId" integer,
	"paymentType" "payment_type" DEFAULT 'full_pay',
	"paymentProcessor" varchar(100),
	"paymentProcessorOther" varchar(255),
	"bnplFee" numeric(12, 2) DEFAULT '0',
	"isPaymentPlan" boolean DEFAULT false NOT NULL,
	"downPayment" numeric(12, 2) DEFAULT '0',
	"totalMonths" integer DEFAULT 0,
	"monthlyAmount" numeric(12, 2) DEFAULT '0',
	"paymentMonth" integer DEFAULT 0,
	"paymentsCompleted" integer DEFAULT 0,
	"parentDealId" integer,
	"paymentCollected" boolean DEFAULT false NOT NULL,
	"paymentStatus" "payment_status" DEFAULT 'active',
	"notes" text,
	"closerCommission" numeric(12, 2) DEFAULT '0',
	"setterCashCommission" numeric(12, 2) DEFAULT '0',
	"setterShowCommission" numeric(12, 2) DEFAULT '0',
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketingCosts" (
	"id" serial PRIMARY KEY NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"platform" varchar(100) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"notes" text,
	"createdBy" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipientMemberId" integer NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"relatedDealId" integer,
	"relatedPayrollId" integer,
	"relatedAdjustmentId" integer,
	"amount" numeric(12, 2),
	"isRead" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payPeriods" (
	"id" serial PRIMARY KEY NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"periodNumber" integer NOT NULL,
	"startDate" date NOT NULL,
	"endDate" date NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payeePayments" (
	"id" serial PRIMARY KEY NOT NULL,
	"payeeId" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"dueDate" date NOT NULL,
	"isPaid" boolean DEFAULT false NOT NULL,
	"paidDate" date,
	"paidBy" integer,
	"notes" text,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"periodNumber" integer DEFAULT 1,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payees" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "payee_type" NOT NULL,
	"description" text,
	"paymentAmount" numeric(12, 2) NOT NULL,
	"paymentFrequency" "payment_frequency" NOT NULL,
	"isAutopay" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" serial PRIMARY KEY NOT NULL,
	"payoutDate" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"createdBy" integer
);
--> statement-breakpoint
CREATE TABLE "payrollEntries" (
	"id" serial PRIMARY KEY NOT NULL,
	"memberId" integer NOT NULL,
	"payPeriodId" integer NOT NULL,
	"amountOwed" numeric(12, 2) NOT NULL,
	"amountPaid" numeric(12, 2) DEFAULT '0',
	"isPaid" boolean DEFAULT false NOT NULL,
	"paidDate" date,
	"paidBy" integer,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptionVerifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscriptionId" integer NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"isVerified" boolean DEFAULT false NOT NULL,
	"isCancelled" boolean DEFAULT false NOT NULL,
	"verifiedBy" integer,
	"verifiedAt" timestamp,
	"commissionAmount" numeric(12, 2) DEFAULT '0',
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"clientName" varchar(255) NOT NULL,
	"monthlyAmount" numeric(12, 2) NOT NULL,
	"closerId" integer NOT NULL,
	"startDate" date NOT NULL,
	"startMonth" integer NOT NULL,
	"startYear" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"cancelledDate" date,
	"cancelledReason" text,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teamMembers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"role" "team_member_role" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "userTeamLinks" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"teamMemberId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "userTeamLinks_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64),
	"name" text,
	"email" varchar(320) NOT NULL,
	"passwordHash" varchar(255),
	"loginMethod" varchar(64) DEFAULT 'email',
	"role" "user_role" DEFAULT 'closer' NOT NULL,
	"permissions" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
