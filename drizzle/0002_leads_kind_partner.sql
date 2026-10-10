ALTER TABLE "leads" ADD COLUMN "kind" text DEFAULT 'client' NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "company" varchar(160);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "company_type" varchar(32);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "city" varchar(120);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "cars_per_month" integer;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "referral" varchar(160);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "utm_source" varchar(120);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "utm_medium" varchar(120);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "utm_campaign" varchar(120);--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_kind_check" CHECK ("leads"."kind" in ('client', 'partner'));