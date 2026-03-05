import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";
import { createMarzbanUser, toggleMarzbanUser, deleteMarzbanUser, testMarzbanConnection, getMarzbanUserLinks, getMarzbanUsers } from "./marzban";

function sanitize(input: string): string {
  return input
    .replace(/[<>&"']/g, (c) => {
      const map: Record<string, string> = { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#x27;" };
      return map[c] || c;
    })
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .replace(/data:/gi, "")
    .trim()
    .substring(0, 500);
}

function validateCode(code: string): boolean {
  return /^MVN-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code);
}

function validateUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

async function getConfigPrefix(subscriber: any): Promise<string> {
  if (subscriber.agentId) {
    const agent = await storage.getAccount(subscriber.agentId);
    if (agent?.prefix) return agent.prefix;
    if (agent?.username) return agent.username;
  }
  return "MoHmmeD VPN";
}

function parseVlessLink(link: string): {
  uuid: string; address: string; port: number;
  type?: string; security?: string; path?: string;
  host?: string; sni?: string; flow?: string; encryption?: string;
} | null {
  try {
    const match = link.match(/^vless:\/\/([^@]+)@([^:]+):(\d+)\??(.*)#?.*/);
    if (!match) return null;
    const [, uuid, address, portStr, paramsStr] = match;
    const params = new URLSearchParams(paramsStr.split("#")[0]);
    return {
      uuid, address, port: parseInt(portStr),
      type: params.get("type") || "ws",
      security: params.get("security") || "none",
      path: params.get("path") || "/",
      host: params.get("host") || undefined,
      sni: params.get("sni") || undefined,
      flow: params.get("flow") || undefined,
      encryption: params.get("encryption") || "none",
    };
  } catch { return null; }
}

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
  const password = process.env.OWNER_PASSWORD;
  if (!password) {
    console.error("WARNING: OWNER_PASSWORD not set in environment variables");
    return;
  }
  const existing = await storage.getAccountByEmail(email);
  if (!existing) {
    await storage.createAccount({
      email,
      username: "owner",
      password,
      role: "owner",
    });
    console.log("Owner account seeded");
  }
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  await seedOwner();

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
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

  const configLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    message: { error: "Too many config requests, try again later" },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use("/configs/", configLimiter);
  app.use("/sub/", configLimiter);

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
    if (!validateUUID(req.params.id)) return res.status(400).json({ message: "Invalid ID" });
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
      const { email, username, password, notes, prefix } = req.body;
      if (!email || !username || !password) return res.status(400).json({ message: "Missing fields" });

      const cleanEmail = sanitize(email).toLowerCase();
      const cleanUsername = sanitize(username);
      const cleanPrefix = prefix ? sanitize(prefix) : cleanUsername;

      const existing = await storage.getAccountByEmail(cleanEmail);
      if (existing) return res.status(409).json({ message: "Email already exists" });

      const agent = await storage.createAccount({
        email: cleanEmail, username: cleanUsername, password, role: "agent",
        createdBy: req.session.accountId, notes: notes ? sanitize(notes) : undefined, prefix: cleanPrefix,
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
    if (!validateUUID(req.params.id)) return res.status(400).json({ message: "Invalid ID" });
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
    if (!validateUUID(req.params.id)) return res.status(400).json({ message: "Invalid ID" });
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
    if (!validateUUID(req.params.id)) return res.status(400).json({ message: "Invalid ID" });
    const { amount, description } = req.body;
    if (!amount || typeof amount !== "number" || amount <= 0 || amount > 99999999) return res.status(400).json({ message: "Invalid amount" });

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
  let lastSyncTime = 0;
  const SYNC_INTERVAL = 60 * 1000;

  async function syncWithMarzban(subs: any[]): Promise<any[]> {
    try {
      if (Date.now() - lastSyncTime < SYNC_INTERVAL) return subs;
      lastSyncTime = Date.now();

      const marzbanUsers = await getMarzbanUsers();
      if (marzbanUsers.size === 0) return subs;

      const updatedSubs = [];
      for (const sub of subs) {
        if (!sub.marzbanUsername) {
          updatedSubs.push(sub);
          continue;
        }

        const mUser = marzbanUsers.get(sub.marzbanUsername);

        if (!mUser) {
          await storage.deleteSubscriber(sub.id);
          console.log(`Sync: deleted subscriber ${sub.name} (${sub.marzbanUsername}) - not found in Marzban`);
          continue;
        }

        const marzbanActive = mUser.status === "active";
        if (sub.isActive !== marzbanActive) {
          await storage.updateSubscriber(sub.id, { isActive: marzbanActive });
          sub.isActive = marzbanActive;
          console.log(`Sync: ${marzbanActive ? "activated" : "deactivated"} subscriber ${sub.name} (${sub.marzbanUsername})`);
        }

        updatedSubs.push(sub);
      }

      return updatedSubs;
    } catch (e) {
      console.error("Marzban sync error:", e);
      return subs;
    }
  }

  app.get("/api/subscribers", requireAuth(["owner", "agent"]), async (req, res) => {
    const agentId = req.session.role === "agent" ? req.session.accountId : undefined;
    let subs = await storage.getSubscribers(agentId);

    subs = await syncWithMarzban(subs);

    if (req.session.role === "owner") {
      const agents = await storage.getAgents();
      const agentMap = new Map(agents.map(a => [a.id, a.prefix || a.username]));
      const subsWithAgent = subs.map(s => ({
        ...s,
        agentName: s.agentId ? agentMap.get(s.agentId) || "Unknown" : "Owner",
      }));
      return res.json(subsWithAgent);
    }

    res.json(subs);
  });

  app.post("/api/subscribers", requireAuth(["owner", "agent"]), async (req, res) => {
    try {
      const { name: rawName, deviceId, notes, durationMonths } = req.body;
      if (!rawName) return res.status(400).json({ message: "Name is required" });
      const name = sanitize(rawName);

      const months = durationMonths || 1;
      const agentId = req.session.role === "agent" ? req.session.accountId : undefined;

      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + months);
      const expireTimestamp = Math.floor(expiryDate.getTime() / 1000);

      const account = await storage.getAccount(req.session.accountId!);
      const prefix = account?.prefix || (req.session.role === "owner" ? "mvpn" : account?.username || "user");
      const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, "");
      const marzbanUsername = `${prefix}_${cleanName}_${Date.now().toString(36)}`;

      let subscriptionUrl = "";
      try {
        const marzbanResult = await createMarzbanUser(marzbanUsername, expireTimestamp);
        const subPath = marzbanResult.subscription_url || "";
        const siteUrl = process.env.SITE_URL || "https://mohmmedvpn.com";
        subscriptionUrl = subPath.startsWith("http") ? subPath : `${siteUrl}${subPath}`;
      } catch (mErr: any) {
        console.error("Marzban error:", mErr.message);
        return res.status(500).json({ message: "Failed to create VPN user: " + mErr.message });
      }

      const sub = await storage.createSubscriber({
        name,
        deviceId: deviceId ? sanitize(deviceId) : undefined,
        notes: notes ? sanitize(notes) : undefined,
        durationMonths: months,
        createdBy: req.session.accountId!,
        agentId: agentId || undefined,
        marzbanUsername,
        subscriptionUrl,
      });

      if (agentId) {
        await storage.createTransaction({
          agentId,
          type: "purchase",
          amount: sub.pricePaid,
          description: `Subscriber: ${name} (${months} month${months > 1 ? "s" : ""}) - Code: ${sub.code}`,
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
    if (!validateUUID(req.params.id)) return res.status(400).json({ message: "Invalid ID" });
    const existing = await storage.getSubscriber(req.params.id);
    if (!existing) return res.status(404).json({ message: "Subscriber not found" });

    if (req.session.role === "agent" && existing.agentId !== req.session.accountId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const newActive = !existing.isActive;
    if (existing.marzbanUsername) {
      try { await toggleMarzbanUser(existing.marzbanUsername, newActive); } catch (e) { console.error(e); }
    }

    const sub = await storage.updateSubscriber(req.params.id, { isActive: newActive });
    await storage.createLog({
      accountId: req.session.accountId!,
      action: "deactivate_code",
      details: `${sub.isActive ? "Activated" : "Deactivated"} subscriber: ${sub.name}`,
      targetId: sub.id,
    });
    res.json(sub);
  });

  app.delete("/api/subscribers/:id", requireAuth(["owner", "agent"]), async (req, res) => {
    if (!validateUUID(req.params.id)) return res.status(400).json({ message: "Invalid ID" });
    const sub = await storage.getSubscriber(req.params.id);
    if (!sub) return res.status(404).json({ message: "Subscriber not found" });

    if (req.session.role === "agent" && sub.agentId !== req.session.accountId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (sub.marzbanUsername) {
      try { await deleteMarzbanUser(sub.marzbanUsername); } catch (e) { console.error(e); }
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
    if (!validateUUID(req.params.id)) return res.status(400).json({ message: "Invalid ID" });
    const balance = await storage.getAgentBalance(req.params.id);
    res.json({ balance });
  });

  app.get("/configs/:code.json", async (req, res) => {
    try {
      const code = req.params.code;
      if (!validateCode(code)) return res.status(400).json({ error: "Invalid code format" });
      const subscriber = await storage.getSubscriberByCode(code);
      if (!subscriber) return res.status(404).json({ error: "Config not found" });
      if (!subscriber.isActive) return res.status(403).json({ error: "Config disabled" });
      if (subscriber.expiresAt && new Date(subscriber.expiresAt) < new Date()) {
        return res.status(410).json({ error: "Config expired" });
      }
      if (!subscriber.marzbanUsername) return res.status(404).json({ error: "No VPN config" });

      const links = await getMarzbanUserLinks(subscriber.marzbanUsername);
      if (!links.length) return res.status(404).json({ error: "No configs available" });

      const vlessLink = links[0];
      const parsed = parseVlessLink(vlessLink);
      if (!parsed) return res.status(500).json({ error: "Failed to parse config" });

      const realityPubKey = process.env.REALITY_PUBLIC_KEY || "";
      const realityShortId = process.env.REALITY_SHORT_ID || "";
      const serverDomain = process.env.VPN_SERVER_DOMAIN || "mohmmedvpn.com";
      const serverPort = parseInt(process.env.VPN_SERVER_PORT || "8443");
      const realityServerName = process.env.REALITY_SERVER_NAME || "yahoo.com";

      const configType = req.query.type === "ws" ? "ws" : "reality";
      const configPrefix = await getConfigPrefix(subscriber);
      const remarkName = `${configPrefix} - ${subscriber.name}`;

      let v2rayConfig;

      if (configType === "ws") {
        const wsSNI = process.env.WS_SNI || "m.facebook.com";
        const wsPort = parseInt(process.env.WS_PORT || "443");
        const wsPath = process.env.WS_PATH || "/vlessws";

        v2rayConfig = {
          dns: {
            hosts: { "domain:googleapis.cn": "googleapis.com" },
            servers: ["1.1.1.1"]
          },
          inbounds: [{
            listen: "127.0.0.1",
            port: 10808,
            protocol: "socks",
            settings: { auth: "noauth", udp: true, userLevel: 8 },
            sniffing: { destOverride: ["http", "tls"], enabled: true },
            tag: "socks"
          }, {
            listen: "127.0.0.1",
            port: 10809,
            protocol: "http",
            settings: { userLevel: 8 },
            tag: "http"
          }],
          log: { loglevel: "warning" },
          outbounds: [{
            mux: { concurrency: 8, enabled: false },
            protocol: "vless",
            settings: {
              vnext: [{
                address: serverDomain,
                port: wsPort,
                users: [{
                  encryption: "none",
                  id: parsed.uuid,
                  level: 8,
                  security: "auto"
                }]
              }]
            },
            streamSettings: {
              network: "ws",
              security: "tls",
              tlsSettings: {
                allowInsecure: true,
                serverName: wsSNI
              },
              wsSettings: {
                path: wsPath,
                headers: { Host: wsSNI }
              }
            },
            tag: "proxy"
          }, {
            protocol: "freedom",
            settings: {},
            tag: "direct"
          }, {
            protocol: "blackhole",
            settings: { response: { type: "http" } },
            tag: "block"
          }],
          remarks: remarkName,
          routing: {
            domainStrategy: "IPIfNonMatch",
            rules: [{
              ip: ["1.1.1.1"],
              outboundTag: "proxy",
              port: "53",
              type: "field"
            }]
          }
        };
      } else {
        v2rayConfig = {
          dns: {
            hosts: { "domain:googleapis.cn": "googleapis.com" },
            servers: ["1.1.1.1"]
          },
          inbounds: [{
            listen: "127.0.0.1",
            port: 10808,
            protocol: "socks",
            settings: { auth: "noauth", udp: true, userLevel: 8 },
            sniffing: { destOverride: ["http", "tls"], enabled: true },
            tag: "socks"
          }, {
            listen: "127.0.0.1",
            port: 10809,
            protocol: "http",
            settings: { userLevel: 8 },
            tag: "http"
          }],
          log: { loglevel: "warning" },
          outbounds: [{
            mux: { concurrency: 8, enabled: false },
            protocol: "vless",
            settings: {
              vnext: [{
                address: serverDomain,
                port: serverPort,
                users: [{
                  encryption: "none",
                  flow: "xtls-rprx-vision",
                  id: parsed.uuid,
                  level: 8,
                  security: "auto"
                }]
              }]
            },
            streamSettings: {
              network: "tcp",
              security: "reality",
              realitySettings: {
                publicKey: realityPubKey,
                fingerprint: "chrome",
                serverName: realityServerName,
                shortId: realityShortId,
                spiderX: ""
              }
            },
            tag: "proxy"
          }, {
            protocol: "freedom",
            settings: {},
            tag: "direct"
          }, {
            protocol: "blackhole",
            settings: { response: { type: "http" } },
            tag: "block"
          }],
          remarks: remarkName,
          routing: {
            domainStrategy: "IPIfNonMatch",
            rules: [{
              ip: ["1.1.1.1"],
              outboundTag: "proxy",
              port: "53",
              type: "field"
            }]
          }
        };
      }

      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "no-cache, no-store");
      res.send(JSON.stringify(v2rayConfig));
    } catch (e) {
      console.error("Config endpoint error:", e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/sub/:code", async (req, res) => {
    try {
      const code = req.params.code;
      let subscriber;
      if (validateCode(code)) {
        subscriber = await storage.getSubscriberByCode(code);
      } else {
        subscriber = await storage.getSubscriberBySubToken(code);
      }
      if (!subscriber) return res.status(404).send("Config not found");
      if (!subscriber.isActive) return res.status(403).send("Config disabled");
      if (subscriber.expiresAt && new Date(subscriber.expiresAt) < new Date()) {
        return res.status(410).send("Config expired");
      }
      if (!subscriber.marzbanUsername) return res.status(404).send("No VPN config");

      const rawLinks = await getMarzbanUserLinks(subscriber.marzbanUsername);
      if (!rawLinks.length) return res.status(404).send("No configs available");

      const serverDomain = process.env.VPN_SERVER_DOMAIN || "mohmmedvpn.com";
      const realityPubKey = process.env.REALITY_PUBLIC_KEY || "";
      const realityShortId = process.env.REALITY_SHORT_ID || "";
      const realitySNI = process.env.REALITY_SERVER_NAME || "yahoo.com";
      const serverPort = process.env.VPN_SERVER_PORT || "8443";

      const configPrefix = await getConfigPrefix(subscriber);
      const links = rawLinks.map(link => {
        let modified = link
          .replace(/5\.189\.174\.9/g, serverDomain)
          .replace(/security=none/g, "security=reality")
          .replace(/security=tls/g, "security=reality")
          .replace(/:8443/g, `:${serverPort}`);
        if (!modified.includes("sni=")) {
          modified = modified.replace("#", `&sni=${realitySNI}#`);
        } else {
          modified = modified.replace(/sni=[^&]*/g, `sni=${realitySNI}`);
        }
        if (modified.includes("type=ws")) {
          modified = modified.replace(/type=ws/g, "type=tcp");
        }
        if (!modified.includes("fp=")) {
          modified = modified.replace("#", "&fp=chrome#");
        }
        if (!modified.includes("pbk=")) {
          modified = modified.replace("#", `&pbk=${realityPubKey}#`);
        }
        if (!modified.includes("sid=")) {
          modified = modified.replace("#", `&sid=${realityShortId}#`);
        }
        if (!modified.includes("flow=")) {
          modified = modified.replace("?", "?flow=xtls-rprx-vision&");
        }
        const hashIndex = modified.indexOf("#");
        if (hashIndex !== -1) {
          const cleanName = encodeURIComponent(`${configPrefix} - ${subscriber.name}`);
          modified = modified.substring(0, hashIndex) + "#" + cleanName;
        }
        return modified;
      });

      const subContent = Buffer.from(links.join("\n")).toString("base64");
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-store");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET");
      res.setHeader("Access-Control-Allow-Headers", "*");
      res.setHeader("Content-Disposition", `attachment; filename="${subscriber.name}.txt"`);
      if (subscriber.expiresAt) {
        res.setHeader("Subscription-Userinfo", `expire=${Math.floor(new Date(subscriber.expiresAt).getTime() / 1000)}`);
      }
      res.setHeader("Profile-Title", `MoHmmeD VPN - ${subscriber.name}`);
      res.send(subContent);
    } catch (e) {
      console.error("Sub endpoint error:", e);
      res.status(500).send("Server error");
    }
  });

  return httpServer;
}
