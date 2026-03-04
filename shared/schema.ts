import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const roleEnum = pgEnum("role", ["owner", "agent", "user"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["purchase", "payment"]);
export const logActionEnum = pgEnum("log_action", [
  "login", "logout", "create_agent", "create_user", "create_code",
  "assign_code", "deactivate_code", "suspend_agent", "delete_agent",
  "record_payment", "delete_user"
]);

export const accounts = pgTable("accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("user"),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  notes: text("notes"),
});

export const vpnCodes = pgTable("vpn_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  deviceId: text("device_id"),
  configData: text("config_data"),
  cloudConfigUrl: text("cloud_config_url"),
  createdBy: varchar("created_by").notNull(),
  assignedTo: varchar("assigned_to"),
  agentId: varchar("agent_id"),
  isActive: boolean("is_active").notNull().default(true),
  expiresAt: timestamp("expires_at"),
  planName: text("plan_name").notNull().default("Monthly"),
  pricePaid: integer("price_paid").notNull().default(5000),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull(),
  type: transactionTypeEnum("type").notNull(),
  amount: integer("amount").notNull(),
  description: text("description"),
  codeId: varchar("code_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull(),
  action: logActionEnum("action").notNull(),
  details: text("details"),
  targetId: varchar("target_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAccountSchema = createInsertSchema(accounts).omit({
  id: true,
  createdAt: true,
  passwordHash: true,
}).extend({
  password: z.string().min(6),
});

export const insertVpnCodeSchema = createInsertSchema(vpnCodes).omit({
  id: true,
  createdAt: true,
  code: true,
  configData: true,
  cloudConfigUrl: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

export type Account = typeof accounts.$inferSelect;
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type VpnCode = typeof vpnCodes.$inferSelect;
export type InsertVpnCode = z.infer<typeof insertVpnCodeSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;

export type User = Account;
export type InsertUser = InsertAccount;
