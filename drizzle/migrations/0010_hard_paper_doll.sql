CREATE TYPE "public"."trade_direction" AS ENUM('directional_bullish', 'directional_bearish');--> statement-breakpoint
CREATE TYPE "public"."trade_result" AS ENUM('win', 'loss');--> statement-breakpoint
CREATE TYPE "public"."trade_strategy" AS ENUM('bounce_profit', 'ready_set_explode', 'paycheck_collector');--> statement-breakpoint
CREATE TABLE "tradeEntries" (
	"id" serial PRIMARY KEY NOT NULL,
	"tradingLogId" integer NOT NULL,
	"ticker" varchar(16) NOT NULL,
	"strategy" "trade_strategy" NOT NULL,
	"direction" "trade_direction" NOT NULL,
	"result" "trade_result",
	"entryDate" date NOT NULL,
	"entryTime" varchar(16),
	"exitDate" date,
	"strikePrices" varchar(64),
	"expirationDate" date,
	"contractCount" integer DEFAULT 1 NOT NULL,
	"askPrice" numeric(12, 4) DEFAULT '0' NOT NULL,
	"bidPrice" numeric(12, 4) DEFAULT '0' NOT NULL,
	"bidAskDifference" numeric(14, 4) DEFAULT '0' NOT NULL,
	"totalInvestment" numeric(14, 2) DEFAULT '0' NOT NULL,
	"profitLoss" numeric(14, 2) DEFAULT '0' NOT NULL,
	"profitPct" numeric(8, 4) DEFAULT '0' NOT NULL,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tradingLogs" (
	"id" serial PRIMARY KEY NOT NULL,
	"clientUserId" integer NOT NULL,
	"dealId" integer NOT NULL,
	"startingBalance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"brokerNote" text,
	"createdById" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tradingLogs_clientUserId_unique" UNIQUE("clientUserId")
);
