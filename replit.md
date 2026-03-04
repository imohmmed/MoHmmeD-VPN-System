# MoHmmeD VPN - VPN Subscription Management System

## Overview
A full-stack VPN subscription management platform built for selling NPV Tunnel VPN configurations. Supports three user roles: Owner, Agent (reseller), and User.

## Architecture
- **Frontend**: React + TypeScript + Vite + TailwindCSS + shadcn/ui
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Session-based authentication with bcryptjs

## User Roles
1. **Owner** (it.mohmmed@yahoo.com): Full admin access — manages agents, users, codes, transactions, activity logs
2. **Agent**: Reseller account — generates VPN codes (5,000 IQD each), manages their own users
3. **User**: End subscriber (for reference/tracking only, managed by owner/agent)

## Business Logic
- Each VPN code costs agents 5,000 IQD
- Owner generates codes for free
- Agents accumulate debt per code; owner records payments to reduce debt
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
- `/owner/users` - All users management
- `/owner/codes` - All VPN codes
- `/owner/transactions` - Financial records
- `/owner/logs` - Activity audit log
- `/agent` - Agent dashboard
- `/agent/codes` - Agent's VPN codes (with cost warning)
- `/agent/users` - Agent's users
- `/agent/transactions` - Agent's financial history

## Database Tables
- `accounts` - All user accounts (owner/agent/user)
- `vpn_codes` - Generated VPN codes with config data
- `transactions` - Financial transactions per agent
- `activity_logs` - Audit trail of all actions

## NPV Tunnel Integration
- Users copy their Device ID from NPV Tunnel app (More tab)
- System generates a vmess:// cloud config URL
- Users import via: NPV Tunnel → Configs → Import Cloud Config
