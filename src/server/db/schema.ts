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
    clientName: varchar("client_name", { length: 160 }).notNull(),
    clientPhone: varchar("client_phone", { length: 32 }).notNull(),
    comment: text("comment"),
    status: varchar("status", { length: 32 }).notNull().default("NEW"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  });