import { pgTable, unique, serial, varchar, integer, text, timestamp } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const orders = pgTable("orders", {
	id: serial().primaryKey().notNull(),
	publicNumber: varchar("public_number", { length: 32 }).notNull(),
	carCode: varchar("car_code", { length: 64 }).notNull(),
	scenario: varchar({ length: 32 }).notNull(),
	filmCode: varchar("film_code", { length: 64 }).notNull(),
	price: integer().notNull(),
	clientName: varchar("client_name", { length: 160 }).notNull(),
	clientPhone: varchar("client_phone", { length: 32 }).notNull(),
	comment: text(),
	status: varchar({ length: 32 }).default('NEW').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	partnerId: integer("partner_id"),
	masterId: integer("master_id"),
	clientPrice: integer("client_price"),
	idempotencyKey: varchar("idempotency_key", { length: 64 }),
	pricingVersion: varchar("pricing_version", { length: 32 }),
	paymentStatus: varchar("payment_status", { length: 32 }).default('NOT_DUE').notNull(),
}, (table) => [
	unique("orders_public_number_unique").on(table.publicNumber),
	unique("orders_idempotency_key_unique").on(table.idempotencyKey),
]);

export const partners = pgTable("partners", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 160 }).notNull(),
	slug: varchar({ length: 80 }).notNull(),
	pinHash: varchar("pin_hash", { length: 255 }).notNull(),
	status: varchar({ length: 32 }).default('ACTIVE').notNull(),
	partnerPriceMarkup: integer("partner_price_markup").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("partners_slug_unique").on(table.slug),
]);

export const masters = pgTable("masters", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 160 }).notNull(),
	slug: varchar({ length: 80 }).notNull(),
	pinHash: varchar("pin_hash", { length: 255 }).notNull(),
	status: varchar({ length: 32 }).default('ACTIVE').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("masters_slug_unique").on(table.slug),
]);
