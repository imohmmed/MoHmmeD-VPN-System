# MoHmmeD VPN - VPN Subscription Management System

## Overview
A full-stack VPN subscription management platform built for selling NPV Tunnel VPN configurations. Supports three user roles: Owner, Agent (reseller), and Subscriber (merged user+code concept).

## Architecture
- **Frontend**: React + TypeScript + Vite + TailwindCSS + shadcn/ui
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Session-based authentication with bcryptjs

## User Roles
1. **Owner** (it.mohmmed@yahoo.com): Full admin access — manages agents, subscribers, transactions, activity logs
2. **Agent**: Reseller account — creates subscribers (5,000 IQD each), manages their own subscribers
3. **Subscriber**: VPN user with name, device ID, VPN code, and cloud config URL (not a login account)

## Business Logic
- Each subscriber costs agents 5,000 IQD
- Owner creates subscribers for free
- Agents accumulate debt per subscriber; owner records payments to reduce debt
- Agent accounts can be suspended (can't login) or deleted (all records removed)

## VPN Configuration
- Server: 5.189.174.9
- Protocol: VMess over WebSocket (TLS)
- Config format: Base64-encoded vmess:// URL (cloud config for NPV Tunnel)
- Device ID from NPV Tunnel app is embedded in the config path

## Key Pages
- `/login` - Authentication
- `/owner` - Owner dashboard with stats
- `/owner/agents` - Agent management (create, suspend, delete, record payments)
- `/owner/agents/:id` - Agent detail page (subscribers, transactions, logs, payment recording)
- `/owner/users` - All subscribers management (unified user+code view)
- `/owner/transactions` - Financial records
- `/owner/logs` - Activity audit log
- `/agent` - Agent dashboard
- `/agent/users` - Agent's subscribers
- `/agent/transactions` - Agent's financial history

## Pricing
- 1 month = 5,000 IQD
- Price scales with duration: 12 months = 60,000 IQD (5,000 × 12)
- Record Payment deducts from agent's outstanding debt

## Database Tables
- `accounts` - Login accounts (owner/agent roles only)
- `subscribers` - VPN subscribers with name, device ID, code, config, expiry
- `transactions` - Financial transactions per agent
- `activity_logs` - Audit trail of all actions

## API Endpoints
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Current user
- `GET/POST /api/agents` - List/create agents
- `PATCH /api/agents/:id/suspend` - Toggle agent suspension
- `DELETE /api/agents/:id` - Delete agent
- `POST /api/agents/:id/payment` - Record payment
- `GET/POST /api/subscribers` - List/create subscribers
- `PATCH /api/subscribers/:id/deactivate` - Deactivate subscriber
- `DELETE /api/subscribers/:id` - Delete subscriber
- `GET /api/transactions` - List transactions
- `GET /api/logs` - Activity logs (owner only)
- `GET /api/stats` - Dashboard stats

## NPV Tunnel Integration
- Users copy their Device ID from NPV Tunnel app (More tab)
- System generates a vmess:// cloud config URL
- Users import via: NPV Tunnel → Configs → Import Cloud Config
