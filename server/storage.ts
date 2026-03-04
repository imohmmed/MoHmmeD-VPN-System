import { db } from "./db";
import { accounts, vpnCodes, transactions, activityLogs } from "@shared/schema";
import type { Account, VpnCode, Transaction, ActivityLog } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

export interface IStorage {
  // Accounts
  getAccount(id: string): Promise<Account | undefined>;
  getAccountByEmail(email: string): Promise<Account | undefined>;
  getAccountByUsername(username: string): Promise<Account | undefined>;
  createAccount(data: {
    email: string; username: string; password: string;
    role: "owner" | "agent" | "user"; createdBy?: string; notes?: string;
  }): Promise<Account>;
  updateAccount(id: string, data: Partial<Pick<Account, "isActive" | "notes" | "email" | "username">>): Promise<Account>;
  deleteAccount(id: string): Promise<void>;
  getAgents(): Promise<Account[]>;
  getUsers(agentId?: string): Promise<Account[]>;
  verifyPassword(account: Account, password: string): Promise<boolean>;

  // VPN Codes
  getCode(id: string): Promise<VpnCode | undefined>;
  getCodeByCode(code: string): Promise<VpnCode | undefined>;
  getCodes(agentId?: string): Promise<VpnCode[]>;
  createCode(data: {
    deviceId?: string; createdBy: string; agentId?: string;
    assignedTo?: string; planName?: string; pricePaid?: number;
    expiresAt?: Date;
  }): Promise<VpnCode>;
  updateCode(id: string, data: Partial<Pick<VpnCode, "isActive" | "assignedTo" | "deviceId" | "configData" | "cloudConfigUrl">>): Promise<VpnCode>;
  deactivateCode(id: string): Promise<VpnCode>;

  // Transactions
  getTransactions(agentId?: string): Promise<Transaction[]>;
  createTransaction(data: {
    agentId: string; type: "purchase" | "payment";
    amount: number; description?: string; codeId?: string;
  }): Promise<Transaction>;
  getAgentBalance(agentId: string): Promise<number>;

  // Activity Logs
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

  async createAccount({ email, username, password, role, createdBy, notes }: {
    email: string; username: string; password: string;
    role: "owner" | "agent" | "user"; createdBy?: string; notes?: string;
  }) {
    const passwordHash = await bcrypt.hash(password, 12);
    const [acc] = await db.insert(accounts).values({
      email, username, passwordHash, role,
      createdBy: createdBy || null,
      notes: notes || null,
    }).returning();
    return acc;
  }

  async updateAccount(id: string, data: Partial<Pick<Account, "isActive" | "notes" | "email" | "username">>) {
    const [acc] = await db.update(accounts).set(data).where(eq(accounts.id, id)).returning();
    return acc;
  }

  async deleteAccount(id: string) {
    await db.delete(activityLogs).where(eq(activityLogs.accountId, id));
    await db.update(vpnCodes).set({ assignedTo: null }).where(eq(vpnCodes.assignedTo, id));
    await db.delete(accounts).where(eq(accounts.id, id));
  }

  async verifyPassword(account: Account, password: string) {
    return bcrypt.compare(password, account.passwordHash);
  }

  async getAgents() {
    return db.select().from(accounts).where(eq(accounts.role, "agent")).orderBy(desc(accounts.createdAt));
  }

  async getUsers(agentId?: string) {
    if (agentId) {
      return db.select().from(accounts).where(
        and(eq(accounts.role, "user"), eq(accounts.createdBy, agentId))
      ).orderBy(desc(accounts.createdAt));
    }
    return db.select().from(accounts).where(eq(accounts.role, "user")).orderBy(desc(accounts.createdAt));
  }

  async getCode(id: string) {
    const [code] = await db.select().from(vpnCodes).where(eq(vpnCodes.id, id));
    return code;
  }

  async getCodeByCode(code: string) {
    const [c] = await db.select().from(vpnCodes).where(eq(vpnCodes.code, code));
    return c;
  }

  async getCodes(agentId?: string) {
    if (agentId) {
      return db.select().from(vpnCodes).where(eq(vpnCodes.agentId, agentId)).orderBy(desc(vpnCodes.createdAt));
    }
    return db.select().from(vpnCodes).orderBy(desc(vpnCodes.createdAt));
  }

  async createCode({ deviceId, createdBy, agentId, assignedTo, planName, pricePaid, expiresAt }: {
    deviceId?: string; createdBy: string; agentId?: string;
    assignedTo?: string; planName?: string; pricePaid?: number; expiresAt?: Date;
  }) {
    const code = generateCode();
    const configData = generateVpnConfig(deviceId);
    const cloudConfigUrl = generateCloudConfigUrl(code, deviceId);

    const [vpnCode] = await db.insert(vpnCodes).values({
      code,
      deviceId: deviceId || null,
      configData: JSON.stringify(configData),
      cloudConfigUrl,
      createdBy,
      agentId: agentId || null,
      assignedTo: assignedTo || null,
      planName: planName || "Monthly",
      pricePaid: pricePaid || 5000,
      expiresAt: expiresAt || getMonthLater(),
    }).returning();
    return vpnCode;
  }

  async updateCode(id: string, data: Partial<Pick<VpnCode, "isActive" | "assignedTo" | "deviceId" | "configData" | "cloudConfigUrl">>) {
    const [code] = await db.update(vpnCodes).set(data).where(eq(vpnCodes.id, id)).returning();
    return code;
  }

  async deactivateCode(id: string) {
    const [code] = await db.update(vpnCodes).set({ isActive: false }).where(eq(vpnCodes.id, id)).returning();
    return code;
  }

  async getTransactions(agentId?: string) {
    if (agentId) {
      return db.select().from(transactions).where(eq(transactions.agentId, agentId)).orderBy(desc(transactions.createdAt));
    }
    return db.select().from(transactions).orderBy(desc(transactions.createdAt));
  }

  async createTransaction({ agentId, type, amount, description, codeId }: {
    agentId: string; type: "purchase" | "payment";
    amount: number; description?: string; codeId?: string;
  }) {
    const [tx] = await db.insert(transactions).values({
      agentId, type, amount,
      description: description || null,
      codeId: codeId || null,
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

function getMonthLater(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d;
}

export const storage = new DbStorage();
