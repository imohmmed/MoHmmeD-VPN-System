# MoHmmeD VPN - VPS Deployment Guide

## Prerequisites

- Ubuntu/Debian VPS (e.g. 5.189.174.9)
- Domain `mohmmedvpn.com` with DNS A record pointing to your VPS IP
- Root SSH access

## DNS Settings (Do This First!)

Go to your domain registrar and add these DNS records:

| Type | Name | Value |
|------|------|-------|
| A | @ | 5.189.174.9 |
| A | www | 5.189.174.9 |

Wait for DNS propagation (5-30 minutes) before running the setup script.

## Quick Deploy (Automated)

SSH into your VPS:

```bash
ssh root@5.189.174.9
```

Clone and run the setup script:

```bash
git clone https://github.com/imohmmed/MoHmmeD-VPN-System.git /var/www/mohmmedvpn
cd /var/www/mohmmedvpn
chmod +x deploy/setup.sh
bash deploy/setup.sh
```

The script will ask you for:
1. Database password (choose a strong one)
2. Owner email (default: it.mohmmed@yahoo.com)
3. Owner password (for first login)

It will automatically:
- Install Node.js 20, PostgreSQL, Nginx, PM2
- Create the database and user
- Build the project
- Generate a secure SESSION_SECRET
- Configure Nginx with SSL (Let's Encrypt)
- Push the database schema
- Start the app with PM2

## Manual Deployment

### 1. Install Dependencies

```bash
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs nginx postgresql certbot python3-certbot-nginx
npm install -g pm2
```

### 2. Setup Database

```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE mohmmedvpn;
CREATE USER mohmmedadmin WITH ENCRYPTED PASSWORD 'your_strong_password';
GRANT ALL PRIVILEGES ON DATABASE mohmmedvpn TO mohmmedadmin;
ALTER DATABASE mohmmedvpn OWNER TO mohmmedadmin;
\q
```

### 3. Clone & Build

```bash
git clone https://github.com/imohmmed/MoHmmeD-VPN-System.git /var/www/mohmmedvpn
cd /var/www/mohmmedvpn
npm install
npm run build
```

### 4. Create .env File

```bash
nano /var/www/mohmmedvpn/.env
```

Add:
```
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://mohmmedadmin:your_strong_password@localhost:5432/mohmmedvpn
SESSION_SECRET=PASTE_OUTPUT_OF_openssl_rand_-hex_32
OWNER_EMAIL=it.mohmmed@yahoo.com
OWNER_PASSWORD=your_owner_password
```

Secure the file:
```bash
chmod 600 /var/www/mohmmedvpn/.env
```

### 5. Push Database Schema

```bash
cd /var/www/mohmmedvpn
export $(cat .env | xargs)
npm run db:push
```

### 6. Configure Nginx

```bash
cp deploy/nginx.conf /etc/nginx/sites-available/mohmmedvpn
ln -sf /etc/nginx/sites-available/mohmmedvpn /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

### 7. SSL Certificate

```bash
certbot --nginx -d mohmmedvpn.com -d www.mohmmedvpn.com --agree-tos -m it.mohmmed@yahoo.com
```

### 8. Start Application

```bash
cd /var/www/mohmmedvpn
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup
```

## Useful Commands

```bash
pm2 status                    # Check app status
pm2 logs mohmmedvpn           # View live logs
pm2 restart mohmmedvpn        # Restart app
pm2 stop mohmmedvpn           # Stop app
```

## Updating the App

```bash
cd /var/www/mohmmedvpn
git pull origin main
npm install
npm run build
pm2 restart mohmmedvpn
```

## Troubleshooting

- **502 Bad Gateway**: App crashed. Run `pm2 logs mohmmedvpn` to see the error
- **SSL not working**: Make sure DNS A records point to 5.189.174.9 before running certbot
- **Database error**: Verify DATABASE_URL in `.env` matches your PostgreSQL credentials
- **App won't start**: Check `.env` has all required variables (DATABASE_URL, SESSION_SECRET)
- **Renew SSL**: `certbot renew` (auto-renew is set up by default)
