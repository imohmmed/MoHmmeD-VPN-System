import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";

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
  const email = process.env.OWNER_EMAIL || "it.mohmmed@yahoo.com";
  const password = process.env.OWNER_PASSWORD || "ZVwas781)@@";
  const existing = await storage.getAccountByEmail(email);
  if (!existing) {
    await storage.createAccount({
      email,
      username: "owner",
      password,
      role: "owner",
    });
    console.log("Owner account seeded — change the password after first login");
  }
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  await seedOwner();

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { message: "Too many login attempts, try again after 15 minutes" },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { message: "Too many requests, slow down" },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use("/api/", apiLimiter);

  // ===== AUTH =====
  app.post("/api/auth/login", loginLimiter, async (req, res) => {
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
      const subs = await storage.getSubscribers(a.id);
      return { ...safe, balance, subscribersCount: subs.length };
    }));
    res.json(result);
  });

  app.get("/api/agents/:id", requireAuth(["owner"]), async (req, res) => {
    const agent = await storage.getAccount(req.params.id);
    if (!agent || agent.role !== "agent") return res.status(404).json({ message: "Agent not found" });

    const { passwordHash, ...safe } = agent;
    const balance = await storage.getAgentBalance(agent.id);
    const subs = await storage.getSubscribers(agent.id);
    const txs = await storage.getTransactions(agent.id);
    const logs = await storage.getLogs(agent.id);

    const totalPurchases = txs.filter(t => t.type === "purchase").reduce((s, t) => s + t.amount, 0);
    const totalPayments = txs.filter(t => t.type === "payment").reduce((s, t) => s + t.amount, 0);

    res.json({
      ...safe,
      balance,
      totalPurchases,
      totalPayments,
      subscribersCount: subs.length,
      activeSubscribers: subs.filter(s => s.isActive).length,
      subscribers: subs,
      transactions: txs,
      logs,
    });
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

  // ===== SUBSCRIBERS (merged users + codes) =====
  app.get("/api/subscribers", requireAuth(["owner", "agent"]), async (req, res) => {
    const agentId = req.session.role === "agent" ? req.session.accountId : undefined;
    const subs = await storage.getSubscribers(agentId);
    res.json(subs);
  });

  app.post("/api/subscribers", requireAuth(["owner", "agent"]), async (req, res) => {
    try {
      const { name, deviceId, notes, durationMonths } = req.body;
      if (!name) return res.status(400).json({ message: "Name is required" });

      const agentId = req.session.role === "agent" ? req.session.accountId : undefined;

      const sub = await storage.createSubscriber({
        name,
        deviceId: deviceId || undefined,
        notes: notes || undefined,
        durationMonths: durationMonths || 1,
        createdBy: req.session.accountId!,
        agentId: agentId || undefined,
      });

      if (agentId) {
        await storage.createTransaction({
          agentId,
          type: "purchase",
          amount: sub.pricePaid,
          description: `Subscriber: ${name} (${durationMonths || 1} month${(durationMonths || 1) > 1 ? "s" : ""}) - Code: ${sub.code}`,
          subscriberId: sub.id,
        });
      }

      await storage.createLog({
        accountId: req.session.accountId!,
        action: "create_user",
        details: `Created subscriber: ${name} - Code: ${sub.code}`,
        targetId: sub.id,
      });

      res.json(sub);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.patch("/api/subscribers/:id/toggle", requireAuth(["owner", "agent"]), async (req, res) => {
    const existing = await storage.getSubscriber(req.params.id);
    if (!existing) return res.status(404).json({ message: "Subscriber not found" });

    if (req.session.role === "agent" && existing.agentId !== req.session.accountId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const sub = await storage.updateSubscriber(req.params.id, { isActive: !existing.isActive });
    await storage.createLog({
      accountId: req.session.accountId!,
      action: "deactivate_code",
      details: `${sub.isActive ? "Activated" : "Deactivated"} subscriber: ${sub.name}`,
      targetId: sub.id,
    });
    res.json(sub);
  });

  app.delete("/api/subscribers/:id", requireAuth(["owner", "agent"]), async (req, res) => {
    const sub = await storage.getSubscriber(req.params.id);
    if (!sub) return res.status(404).json({ message: "Subscriber not found" });

    if (req.session.role === "agent" && sub.agentId !== req.session.accountId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await storage.createLog({
      accountId: req.session.accountId!,
      action: "delete_user",
      details: `Deleted subscriber: ${sub.name}`,
      targetId: sub.id,
    });

    await storage.deleteSubscriber(sub.id);
    res.json({ ok: true });
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
      const allSubs = await storage.getSubscribers();
      const allTxs = await storage.getTransactions();

      let totalOwed = 0;
      for (const agent of agents) {
        const balance = await storage.getAgentBalance(agent.id);
        totalOwed += balance;
      }
      let totalRevenue = 0;
      for (const tx of allTxs) {
        if (tx.type === "payment") totalRevenue += tx.amount;
      }

      res.json({
        agentsCount: agents.length,
        subscribersCount: allSubs.length,
        totalOwed,
        totalRevenue,
      });
    } else {
      const agentId = req.session.accountId!;
      const subs = await storage.getSubscribers(agentId);
      const txs = await storage.getTransactions(agentId);
      const balance = await storage.getAgentBalance(agentId);

      res.json({
        subscribersCount: subs.length,
        balance,
        transactionsCount: txs.length,
      });
    }
  });

  app.get("/api/agents/:id/balance", requireAuth(["owner"]), async (req, res) => {
    const balance = await storage.getAgentBalance(req.params.id);
    res.json({ balance });
  });

  app.get("/api/cloud-config/:code", async (req, res) => {
    try {
      const subscriber = await storage.getSubscriberByCode(req.params.code);
      if (!subscriber) return res.status(404).send("Config not found");
      if (!subscriber.isActive) return res.status(403).send("Config disabled");
      if (subscriber.expiresAt && new Date(subscriber.expiresAt) < new Date()) {
        return res.status(410).send("Config expired");
      }
      res.setHeader("Content-Type", "text/plain");
      res.send(subscriber.cloudConfigUrl);
    } catch (e) {
      res.status(500).send("Server error");
    }
  });

  return httpServer;
}
