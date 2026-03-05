import { db } from "./db";
import { accounts, subscribers, transactions, activityLogs } from "@shared/schema";
import type { Account, Subscriber, Transaction, ActivityLog } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

export interface IStorage {
  getAccount(id: string): Promise<Account | undefined>;
  getAccountByEmail(email: string): Promise<Account | undefined>;
  getAccountByUsername(username: string): Promise<Account | undefined>;
  createAccount(data: {
    email: string; username: string; password: string;
    role: "owner" | "agent" | "user"; createdBy?: string; notes?: string; prefix?: string;
  }): Promise<Account>;
  updateAccount(id: string, data: Partial<Pick<Account, "isActive" | "notes" | "email" | "username">>): Promise<Account>;
  deleteAccount(id: string): Promise<void>;
  getAgents(): Promise<Account[]>;
  verifyPassword(account: Account, password: string): Promise<boolean>;

  getSubscribers(agentId?: string): Promise<Subscriber[]>;
  getSubscriber(id: string): Promise<Subscriber | undefined>;
  getSubscriberByCode(code: string): Promise<Subscriber | undefined>;
  createSubscriber(data: {
    name: string; deviceId?: string; notes?: string;
    durationMonths: number; createdBy: string; agentId?: string;
  }): Promise<Subscriber>;
  updateSubscriber(id: string, data: Partial<Pick<Subscriber, "isActive" | "name" | "deviceId" | "notes">>): Promise<Subscriber>;
  deleteSubscriber(id: string): Promise<void>;
  deactivateSubscriber(id: string): Promise<Subscriber>;

  getTransactions(agentId?: string): Promise<Transaction[]>;
  createTransaction(data: {
    agentId: string; type: "purchase" | "payment";
    amount: number; description?: string; subscriberId?: string;
  }): Promise<Transaction>;
  getAgentBalance(agentId: string): Promise<number>;

  getLogs(accountId?: string, limit?: number): Promise<ActivityLog[]>;
  createLog(data: {
    accountId: string; action: ActivityLog["action"];
    details?: string; targetId?: string;
  }): Promise<ActivityLog>;
}

export class DbStorage implements IStorage {
  async getAccount(id: string) {
    const [acc] = await db.select().from(accounts).where(eq(accounts.id, id));
    return acc;
  }

  async getAccountByEmail(email: string) {
    const [acc] = await db.select().from(accounts).where(eq(accounts.email, email));
    return acc;
  }

  async getAccountByUsername(username: string) {
    const [acc] = await db.select().from(accounts).where(eq(accounts.username, username));
    return acc;
  }

  async createAccount({ email, username, password, role, createdBy, notes, prefix }: {
    email: string; username: string; password: string;
    role: "owner" | "agent" | "user"; createdBy?: string; notes?: string; prefix?: string;
  }) {
    const passwordHash = await bcrypt.hash(password, 12);
    const [acc] = await db.insert(accounts).values({
      email, username, passwordHash, role,
      createdBy: createdBy || null,
      notes: notes || null,
      prefix: prefix || null,
    }).returning();
    return acc;
  }

  async updateAccount(id: string, data: Partial<Pick<Account, "isActive" | "notes" | "email" | "username">>) {
    const [acc] = await db.update(accounts).set(data).where(eq(accounts.id, id)).returning();
    return acc;
  }

  async deleteAccount(id: string) {
    await db.delete(subscribers).where(eq(subscribers.agentId, id));
    await db.delete(transactions).where(eq(transactions.agentId, id));
    await db.delete(activityLogs).where(eq(activityLogs.accountId, id));
    await db.delete(accounts).where(eq(accounts.id, id));
  }

  async verifyPassword(account: Account, password: string) {
    return bcrypt.compare(password, account.passwordHash);
  }

  async getAgents() {
    return db.select().from(accounts).where(eq(accounts.role, "agent")).orderBy(desc(accounts.createdAt));
  }

  // Subscribers
  async getSubscribers(agentId?: string) {
    if (agentId) {
      return db.select().from(subscribers).where(eq(subscribers.agentId, agentId)).orderBy(desc(subscribers.createdAt));
    }
    return db.select().from(subscribers).orderBy(desc(subscribers.createdAt));
  }

  async getSubscriber(id: string) {
    const [sub] = await db.select().from(subscribers).where(eq(subscribers.id, id));
    return sub;
  }

  async getSubscriberByCode(code: string) {
    const [sub] = await db.select().from(subscribers).where(eq(subscribers.code, code));
    return sub;
  }

  async createSubscriber({ name, deviceId, notes, durationMonths, createdBy, agentId, marzbanUsername, subscriptionUrl }: {
    name: string; deviceId?: string; notes?: string;
    durationMonths: number; createdBy: string; agentId?: string;
    marzbanUsername?: string; subscriptionUrl?: string;
  }) {
    const code = generateCode();
    const expiresAt = getExpiryDate(durationMonths);
    const pricePaid = 5000 * durationMonths;

    const [sub] = await db.insert(subscribers).values({
      name,
      deviceId: deviceId || null,
      notes: notes || null,
      code,
      configData: null,
      cloudConfigUrl: null,
      marzbanUsername: marzbanUsername || null,
      subscriptionUrl: subscriptionUrl || null,
      createdBy,
      agentId: agentId || null,
      durationMonths,
      expiresAt,
      pricePaid,
    }).returning();
    return sub;
  }

  async updateSubscriber(id: string, data: Partial<Pick<Subscriber, "isActive" | "name" | "deviceId" | "notes">>) {
    const [sub] = await db.update(subscribers).set(data).where(eq(subscribers.id, id)).returning();
    return sub;
  }

  async deleteSubscriber(id: string) {
    await db.delete(subscribers).where(eq(subscribers.id, id));
  }

  async deactivateSubscriber(id: string) {
    const [sub] = await db.update(subscribers).set({ isActive: false }).where(eq(subscribers.id, id)).returning();
    return sub;
  }

  async getTransactions(agentId?: string) {
    if (agentId) {
      return db.select().from(transactions).where(eq(transactions.agentId, agentId)).orderBy(desc(transactions.createdAt));
    }
    return db.select().from(transactions).orderBy(desc(transactions.createdAt));
  }

  async createTransaction({ agentId, type, amount, description, subscriberId }: {
    agentId: string; type: "purchase" | "payment";
    amount: number; description?: string; subscriberId?: string;
  }) {
    const [tx] = await db.insert(transactions).values({
      agentId, type, amount,
      description: description || null,
      subscriberId: subscriberId || null,
    }).returning();
    return tx;
  }

  async getAgentBalance(agentId: string) {
    const txs = await db.select().from(transactions).where(eq(transactions.agentId, agentId));
    let balance = 0;
    for (const tx of txs) {
      if (tx.type === "purchase") balance += tx.amount;
      else if (tx.type === "payment") balance -= tx.amount;
    }
    return balance;
  }

  async getLogs(accountId?: string, limit = 100) {
    if (accountId) {
      return db.select().from(activityLogs)
        .where(eq(activityLogs.accountId, accountId))
        .orderBy(desc(activityLogs.createdAt))
        .limit(limit);
    }
    return db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(limit);
  }

  async createLog({ accountId, action, details, targetId }: {
    accountId: string; action: ActivityLog["action"]; details?: string; targetId?: string;
  }) {
    const [log] = await db.insert(activityLogs).values({
      accountId, action, details: details || null, targetId: targetId || null,
    }).returning();
    return log;
  }
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "MVN-";
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    if (i < 3) code += "-";
  }
  return code;
}

function generateVpnConfig(deviceId?: string) {
  const uuid = randomUUID();
  return {
    v: "2",
    ps: "MoHmmeD VPN",
    add: "5.189.174.9",
    port: "443",
    id: uuid,
    aid: "0",
    scy: "auto",
    net: "ws",
    type: "none",
    host: "5.189.174.9",
    path: `/vpn/${deviceId || uuid.split("-")[0]}`,
    tls: "tls",
    sni: "5.189.174.9",
    alpn: "",
    fp: "",
    remark: `MoHmmeD VPN - ${deviceId ? deviceId.substring(0, 8) : uuid.substring(0, 8)}`,
  };
}

function generateCloudConfigUrl(code: string, deviceId?: string): string {
  const config = generateVpnConfig(deviceId);
  const base64 = Buffer.from(JSON.stringify(config)).toString("base64");
  return `vmess://${base64}`;
}

function getExpiryDate(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d;
}

export const storage = new DbStorage();
