import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { accounts, vpnCodes, transactions, activityLogs } from "@shared/schema";
import { sql } from "drizzle-orm";

function requireAuth(roles?: Array<"owner" | "agent" | "user">) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.accountId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (roles && !roles.includes(req.session.role!)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}

async function seedOwner() {
  const existing = await storage.getAccountByEmail("it.mohmmed@yahoo.com");
  if (!existing) {
    await storage.createAccount({
      email: "it.mohmmed@yahoo.com",
      username: "owner",
      password: "ZVwas781)@@",
      role: "owner",
    });
    console.log("Owner account created");
  }
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  await seedOwner();

  // ===== AUTH =====
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ message: "Email and password required" });

      const account = await storage.getAccountByEmail(email);
      if (!account) return res.status(401).json({ message: "Invalid credentials" });
      if (!account.isActive) return res.status(403).json({ message: "Account suspended" });

      const valid = await storage.verifyPassword(account, password);
      if (!valid) return res.status(401).json({ message: "Invalid credentials" });

      req.session.accountId = account.id;
      req.session.role = account.role;

      await storage.createLog({ accountId: account.id, action: "login", details: `Login by ${account.email}` });

      const { passwordHash, ...safe } = account;
      res.json(safe);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/auth/logout", requireAuth(), async (req, res) => {
    const accountId = req.session.accountId!;
    await storage.createLog({ accountId, action: "logout" });
    req.session.destroy(() => {});
    res.json({ ok: true });
  });

  app.get("/api/auth/me", requireAuth(), async (req, res) => {
    const account = await storage.getAccount(req.session.accountId!);
    if (!account) return res.status(404).json({ message: "Not found" });
    const { passwordHash, ...safe } = account;
    res.json(safe);
  });

  // ===== AGENTS (owner only) =====
  app.get("/api/agents", requireAuth(["owner"]), async (req, res) => {
    const agents = await storage.getAgents();
    const result = await Promise.all(agents.map(async (a) => {
      const { passwordHash, ...safe } = a;
      const balance = await storage.getAgentBalance(a.id);
      const codes = await storage.getCodes(a.id);
      const users = await storage.getUsers(a.id);
      return { ...safe, balance, codesCount: codes.length, usersCount: users.length };
    }));
    res.json(result);
  });

  app.post("/api/agents", requireAuth(["owner"]), async (req, res) => {
    try {
      const { email, username, password, notes } = req.body;
      if (!email || !username || !password) return res.status(400).json({ message: "Missing fields" });

      const existing = await storage.getAccountByEmail(email);
      if (existing) return res.status(409).json({ message: "Email already exists" });

      const agent = await storage.createAccount({
        email, username, password, role: "agent",
        createdBy: req.session.accountId, notes,
      });

      await storage.createLog({
        accountId: req.session.accountId!,
        action: "create_agent",
        details: `Created agent: ${agent.username}`,
        targetId: agent.id,
      });

      const { passwordHash, ...safe } = agent;
      res.json(safe);
    } catch (err: any) {
      if (err.code === "23505") return res.status(409).json({ message: "Username or email already exists" });
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.patch("/api/agents/:id/suspend", requireAuth(["owner"]), async (req, res) => {
    const agent = await storage.getAccount(req.params.id);
    if (!agent || agent.role !== "agent") return res.status(404).json({ message: "Agent not found" });

    const updated = await storage.updateAccount(agent.id, { isActive: !agent.isActive });
    await storage.createLog({
      accountId: req.session.accountId!,
      action: "suspend_agent",
      details: `${updated.isActive ? "Activated" : "Suspended"} agent: ${agent.username}`,
      targetId: agent.id,
    });

    const { passwordHash, ...safe } = updated;
    res.json(safe);
  });

  app.delete("/api/agents/:id", requireAuth(["owner"]), async (req, res) => {
    const agent = await storage.getAccount(req.params.id);
    if (!agent || agent.role !== "agent") return res.status(404).json({ message: "Agent not found" });

    await storage.createLog({
      accountId: req.session.accountId!,
      action: "delete_agent",
      details: `Deleted agent: ${agent.username}`,
      targetId: agent.id,
    });

    await storage.deleteAccount(agent.id);
    res.json({ ok: true });
  });

  app.post("/api/agents/:id/payment", requireAuth(["owner"]), async (req, res) => {
    const { amount, description } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ message: "Invalid amount" });

    const agent = await storage.getAccount(req.params.id);
    if (!agent) return res.status(404).json({ message: "Agent not found" });

    const tx = await storage.createTransaction({
      agentId: req.params.id,
      type: "payment",
      amount: Number(amount),
      description: description || "Payment received",
    });

    await storage.createLog({
      accountId: req.session.accountId!,
      action: "record_payment",
      details: `Payment of ${amount} IQD for agent: ${agent.username}`,
      targetId: agent.id,
    });

    res.json(tx);
  });

  // ===== USERS =====
  app.get("/api/users", requireAuth(["owner", "agent"]), async (req, res) => {
    const agentId = req.session.role === "agent" ? req.session.accountId : undefined;
    const users = await storage.getUsers(agentId);
    const result = users.map(u => { const { passwordHash, ...safe } = u; return safe; });
    res.json(result);
  });

  app.post("/api/users", requireAuth(["owner", "agent"]), async (req, res) => {
    try {
      const { email, username, password, notes } = req.body;
      if (!email || !username || !password) return res.status(400).json({ message: "Missing fields" });

      const existing = await storage.getAccountByEmail(email);
      if (existing) return res.status(409).json({ message: "Email already exists" });

      const user = await storage.createAccount({
        email, username, password, role: "user",
        createdBy: req.session.accountId, notes,
      });

      await storage.createLog({
        accountId: req.session.accountId!,
        action: "create_user",
        details: `Created user: ${user.username}`,
        targetId: user.id,
      });

      const { passwordHash, ...safe } = user;
      res.json(safe);
    } catch (err: any) {
      if (err.code === "23505") return res.status(409).json({ message: "Username or email already exists" });
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/users/:id", requireAuth(["owner", "agent"]), async (req, res) => {
    const user = await storage.getAccount(req.params.id);
    if (!user || user.role !== "user") return res.status(404).json({ message: "User not found" });

    if (req.session.role === "agent" && user.createdBy !== req.session.accountId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await storage.createLog({
      accountId: req.session.accountId!,
      action: "delete_user",
      details: `Deleted user: ${user.username}`,
      targetId: user.id,
    });

    await storage.deleteAccount(user.id);
    res.json({ ok: true });
  });

  // ===== VPN CODES =====
  app.get("/api/codes", requireAuth(["owner", "agent"]), async (req, res) => {
    const agentId = req.session.role === "agent" ? req.session.accountId : undefined;
    const codes = await storage.getCodes(agentId);
    res.json(codes);
  });

  app.post("/api/codes", requireAuth(["owner", "agent"]), async (req, res) => {
    const { deviceId, assignedTo, planName, expiresAt } = req.body;
    const agentId = req.session.role === "agent" ? req.session.accountId : undefined;

    const code = await storage.createCode({
      deviceId: deviceId || undefined,
      createdBy: req.session.accountId!,
      agentId: agentId || undefined,
      assignedTo: assignedTo || undefined,
      planName: planName || "Monthly",
      pricePaid: 5000,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    if (agentId) {
      await storage.createTransaction({
        agentId,
        type: "purchase",
        amount: 5000,
        description: `Code generated: ${code.code}`,
        codeId: code.id,
      });
    }

    await storage.createLog({
      accountId: req.session.accountId!,
      action: "create_code",
      details: `Generated code: ${code.code}`,
      targetId: code.id,
    });

    res.json(code);
  });

  app.patch("/api/codes/:id/deactivate", requireAuth(["owner"]), async (req, res) => {
    const code = await storage.deactivateCode(req.params.id);
    await storage.createLog({
      accountId: req.session.accountId!,
      action: "deactivate_code",
      details: `Deactivated code: ${code.code}`,
      targetId: code.id,
    });
    res.json(code);
  });

  app.patch("/api/codes/:id/assign", requireAuth(["owner", "agent"]), async (req, res) => {
    const { userId } = req.body;
    const code = await storage.updateCode(req.params.id, { assignedTo: userId });
    await storage.createLog({
      accountId: req.session.accountId!,
      action: "assign_code",
      details: `Assigned code: ${code.code}`,
      targetId: code.id,
    });
    res.json(code);
  });

  // ===== TRANSACTIONS =====
  app.get("/api/transactions", requireAuth(["owner", "agent"]), async (req, res) => {
    const agentId = req.session.role === "agent" ? req.session.accountId : undefined;
    const txs = await storage.getTransactions(agentId);
    res.json(txs);
  });

  // ===== LOGS =====
  app.get("/api/logs", requireAuth(["owner"]), async (req, res) => {
    const logs = await storage.getLogs();
    res.json(logs);
  });

  // ===== STATS =====
  app.get("/api/stats", requireAuth(["owner", "agent"]), async (req, res) => {
    if (req.session.role === "owner") {
      const agents = await storage.getAgents();
      const allUsers = await storage.getUsers();
      const allCodes = await storage.getCodes();
      const allTxs = await storage.getTransactions();

      let totalRevenue = 0;
      let totalOwed = 0;
      for (const agent of agents) {
        const balance = await storage.getAgentBalance(agent.id);
        totalOwed += balance;
      }
      for (const tx of allTxs) {
        if (tx.type === "payment") totalRevenue += tx.amount;
      }

      res.json({
        agentsCount: agents.length,
        usersCount: allUsers.length,
        codesCount: allCodes.length,
        totalOwed,
        totalRevenue,
      });
    } else {
      const agentId = req.session.accountId!;
      const codes = await storage.getCodes(agentId);
      const users = await storage.getUsers(agentId);
      const txs = await storage.getTransactions(agentId);
      const balance = await storage.getAgentBalance(agentId);

      res.json({
        codesCount: codes.length,
        usersCount: users.length,
        balance,
        transactionsCount: txs.length,
      });
    }
  });

  app.get("/api/agents/:id/balance", requireAuth(["owner"]), async (req, res) => {
    const balance = await storage.getAgentBalance(req.params.id);
    res.json({ balance });
  });

  return httpServer;
}
