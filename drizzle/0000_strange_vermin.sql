-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_number" varchar(32) NOT NULL,
	"car_code" varchar(64) NOT NULL,
	"scenario" varchar(32) NOT NULL,
	"film_code" varchar(64) NOT NULL,
	"price" integer NOT NULL,
	"client_name" varchar(160) NOT NULL,
	"client_phone" varchar(32) NOT NULL,
	"comment" text,
	"status" varchar(32) DEFAULT 'NEW' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"partner_id" integer,
	"master_id" integer,
	"client_price" integer,
	"idempotency_key" varchar(64),
	"pricing_version" varchar(32),
	"payment_status" varchar(32) DEFAULT 'NOT_DUE' NOT NULL,
	CONSTRAINT "orders_public_number_unique" UNIQUE("public_number"),
	CONSTRAINT "orders_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"slug" varchar(80) NOT NULL,
	"pin_hash" varchar(255) NOT NULL,
	"status" varchar(32) DEFAULT 'ACTIVE' NOT NULL,
	"partner_price_markup" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "partners_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "masters" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"slug" varchar(80) NOT NULL,
	"pin_hash" varchar(255) NOT NULL,
	"status" varchar(32) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "masters_slug_unique" UNIQUE("slug")
);

*/