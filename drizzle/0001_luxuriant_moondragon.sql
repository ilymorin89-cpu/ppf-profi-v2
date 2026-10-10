CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_number" varchar(32) NOT NULL,
	"car_code" varchar(64) NOT NULL,
	"scenario" varchar(32) NOT NULL,
	"film_code" varchar(64) NOT NULL,
	"price" integer,
	"client_name" varchar(160) NOT NULL,
	"client_phone" varchar(32) NOT NULL,
	"comment" text,
	"consent" boolean DEFAULT false NOT NULL,
	"status" varchar(32) DEFAULT 'NEW' NOT NULL,
	"ip_hash" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "leads_public_number_unique" UNIQUE("public_number")
);
