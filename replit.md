# AlAliPlus VPN - VPN Subscription Management System

## Overview
A full-stack VPN subscription management platform built for selling NPV Tunnel VPN configurations. Supports three user roles: Owner, Agent (reseller), and Subscriber (merged user+code concept).

## Architecture
- **Frontend**: React + TypeScript + Vite + TailwindCSS + shadcn/ui
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Session-based authentication with bcryptjs

## User Roles & Hierarchy
1. **Owner** (it.mohmmed@yahoo.com): Full admin access — manages sub-owners, agents, subscribers, transactions, activity logs, config tester
2. **Sub-Owner**: Mini-owner created by the main owner — has their own agents and can create subscribers directly (using their own prefix and serverAddress domain). Has a `serverAddress` field (domain used in VPN configs instead of default server domain). NO config tester access. Sub-owners do NOT pay the owner.
3. **Agent**: Reseller account — creates subscribers (5,000 IQD each), manages their own subscribers
4. **Subscriber**: VPN user with name, device ID, VPN code, and cloud config URL (not a login account)

Hierarchy: Owner → Sub-Owner → Agent → Subscriber

**Data visibility**: Owner sees only their own agents/subscribers (not sub-owner's). Sub-owner data is viewed via sub-owner detail page. Owner can toggle/delete sub-owner subscribers from detail page.

## Business Logic
- Each subscriber costs agents 5,000 IQD
- Owner creates subscribers for free
- Agents accumulate debt per subscriber; owner/sub-owner records payments to reduce debt
- Agent and sub-owner accounts can be suspended (can't login) or deleted (all records removed)
- Sub-owner payments are distributed proportionally across their agents' outstanding balances
- Owner sets `allowedConfigs` (ws, ws_p80, hu_p80) for sub-owners; sub-owner agents inherit same restriction. Config route enforces this for both agent and direct sub-owner subscribers.

## VPN Configuration
- Server: 5.189.174.9 (mohmmedvpn.com)
- **Reality Config**: VLESS + Reality + TCP on port 8443 (SNI: yahoo.com) — standard VPN
- **WS Config (443)**: VLESS + WebSocket + TLS on port 443 via Nginx (SNI: m.facebook.com) — data freezing
- **WS Config (80)**: VLESS + WebSocket + No TLS on port 80 via Nginx (SNI: 0.facebook.com) — full data freezing (confirmed working with Asiacell Free Social+)
- **HU Config (80)**: VLESS + HTTPUpgrade + No TLS on port 80 via Nginx path /vlesshu (SNI: 0.facebook.com) — full data freezing (confirmed)
- Config format: JSON v2ray config for NPV Tunnel cloud config import
- Config types: WS 443 (Copy WS), WS 80 (Copy WS P80), HTTPUpgrade 80 (Copy HU P80)
- **Per-agent config control**: Owner can toggle which config types (ws, ws_p80, hu_p80) each agent can access via agent detail page. Enforced both UI-side and server-side.

## Key Pages
- `/login` - Authentication
- `/owner` - Owner dashboard with stats
- `/owner/sub-owners` - Sub-owner management (create, suspend, delete, record payments)
- `/owner/sub-owners/:id` - Sub-owner detail (agents, subscribers, transactions, payment recording)
- `/owner/agents` - Agent management (create, suspend, delete, record payments)
- `/owner/agents/:id` - Agent detail page (subscribers, transactions, logs, payment recording)
- `/owner/users` - All subscribers management (unified user+code view)
- `/owner/transactions` - Financial records
- `/owner/logs` - Activity audit log
- `/owner/config-tester` - VPN config testing (owner-exclusive)
- `/sub-owner` - Sub-owner dashboard
- `/sub-owner/agents` - Sub-owner's agents management
- `/sub-owner/agents/:id` - Sub-owner's agent detail
- `/sub-owner/users` - Sub-owner's subscribers
- `/sub-owner/transactions` - Sub-owner's financial history
- `/agent` - Agent dashboard
- `/agent/users` - Agent's subscribers
- `/agent/transactions` - Agent's financial history

## Pricing
- 1 month = 5,000 IQD
- Price scales with duration: 12 months = 60,000 IQD (5,000 × 12)
- Record Payment deducts from agent's outstanding debt

## Database Tables
- `accounts` - Login accounts (owner/sub_owner/agent roles). Columns: id, email, username, passwordHash, role, isActive, createdBy, prefix, allowedConfigs, server_address
- `subscribers` - VPN subscribers with name, device ID, code, config, expiry, agentId
- `transactions` - Financial transactions per agent (purchase/payment)
- `activity_logs` - Audit trail of all actions

## Marzban Integration
- Connected to Marzban panel at localhost:8000
- Two inbounds: VLESS_REALITY (port 8443) and VLESS_WS (port 8880 via Nginx on 443)
- Auto token refresh with retry on 401
- Sync: subscribers list auto-syncs with Marzban (delete/activate/deactivate) every 60 seconds
- Token expiry: 30 days with auto-refresh

## VPS Environment Variables
- `MARZBAN_URL`, `MARZBAN_USERNAME`, `MARZBAN_PASSWORD` — Marzban API connection
- `REALITY_PUBLIC_KEY`, `REALITY_SHORT_ID`, `REALITY_SERVER_NAME` — Reality config
- `VPN_SERVER_DOMAIN`, `VPN_SERVER_PORT` — Server address
- `WS_SNI`, `WS_PORT`, `WS_PATH` — WebSocket config for data freezing
- `OWNER_PASSWORD`, `SESSION_SECRET`, `DATABASE_URL` — App secrets

## API Endpoints
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Current user
- `GET/POST /api/agents` - List/create agents
- `PATCH /api/agents/:id/suspend` - Toggle agent suspension
- `DELETE /api/agents/:id` - Delete agent
- `POST /api/agents/:id/payment` - Record payment
- `GET/POST /api/subscribers` - List/create subscribers
- `PATCH /api/subscribers/:id/toggle` - Toggle subscriber
- `DELETE /api/subscribers/:id` - Delete subscriber
- `GET /api/transactions` - List transactions
- `GET /api/logs` - Activity logs (owner only)
- `GET /api/stats` - Dashboard stats
- `GET /configs/:code.json` - Reality config (default)
- `GET /configs/:code.json?type=ws` - WebSocket config (data freezing)
- `GET /sub/:code` - Subscription link (both configs)

## Security
- Helmet middleware for HTTP security headers
- Rate limiting: 5 login attempts/15min, 15 config requests/15min
- bcryptjs password hashing (12 rounds)
- Session cookies: httpOnly, sameSite=lax, secure in production
- Input sanitization (XSS prevention)
- UUID/code format validation
- dotenv with override: true for VPS deployment

## VPS Deployment
- Domain: mohmmedvpn.com → VPS 5.189.174.9
- SSL via Let's Encrypt (certbot)
- PM2 process manager running dist/index.cjs
- Nginx reverse proxy for WebSocket VPN on port 443
- Update command: `cd /var/www/mohmmedvpn && git pull origin main && npm install --include=dev && npx tsx script/build.ts && pm2 restart mohmmedvpn`

## NPV Tunnel Integration
- Users copy Cloud Config URL from admin panel
- System generates v2ray JSON config
- Users import via: NPV Tunnel → Configs → + → Import Cloud Config
- Two config types: standard (Copy Link) and data-freezing (Copy WS)
