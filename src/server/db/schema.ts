import {
  pgTable,
  serial,
  varchar,
  integer,
  timestamp,
  text,
} from "drizzle-orm/pg-core";

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  publicNumber: varchar("public_number", { length: 32 }).notNull().unique(),
  carCode: varchar("car_code", { length: 64 }).notNull(),
  scenario: varchar("scenario", { length: 32 }).notNull(),
  filmCode: varchar("film_code", { length: 64 }).notNull(),
  price: integer("price").notNull(),
  clientPrice: integer("client_price"),
  clientName: varchar("client_name", { length: 160 }).notNull(),
  clientPhone: varchar("client_phone", { length: 32 }).notNull(),
  comment: text("comment"),
  partnerId: integer("partner_id"),
  masterId: integer("master_id"),
  status: varchar("status", { length: 32 }).notNull().default("NEW"),
  pricingVersion: varchar("pricing_version", { length: 32 }),
  paymentStatus: varchar("payment_status", { length: 32 }).notNull().default("NOT_DUE"),
  idempotencyKey: varchar("idempotency_key", { length: 64 }).unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const partners = pgTable("partners", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  pinHash: varchar("pin_hash", { length: 255 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("ACTIVE"),
  partnerPriceMarkup: integer("partner_price_markup").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const masters = pgTable("masters", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  pinHash: varchar("pin_hash", { length: 255 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("ACTIVE"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});