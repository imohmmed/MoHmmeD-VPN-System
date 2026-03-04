#!/bin/bash
set -e

echo "========================================="
echo "  MoHmmeD VPN - VPS Deployment Script"
echo "========================================="
echo ""

read -p "Enter PostgreSQL password for mohmmedadmin: " DB_PASSWORD
if [ -z "$DB_PASSWORD" ]; then
    echo "Error: Database password cannot be empty"
    exit 1
fi

SESSION_KEY=$(openssl rand -hex 32)
echo "Generated SESSION_SECRET: $SESSION_KEY"

read -p "Enter owner email [it.mohmmed@yahoo.com]: " OWNER_EMAIL
OWNER_EMAIL=${OWNER_EMAIL:-it.mohmmed@yahoo.com}

read -s -p "Enter owner password: " OWNER_PASS
echo ""
if [ -z "$OWNER_PASS" ]; then
    echo "Error: Owner password cannot be empty"
    exit 1
fi

echo ""
echo "[1/8] Updating system..."
apt update && apt upgrade -y

echo "[2/8] Installing Node.js 20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi
echo "Node.js $(node -v) | npm $(npm -v)"

echo "[3/8] Installing PM2..."
npm install -g pm2

echo "[4/8] Setting up PostgreSQL..."
apt install -y postgresql postgresql-contrib
sudo -u postgres psql -c "CREATE DATABASE mohmmedvpn;" 2>/dev/null || echo "Database already exists"
sudo -u postgres psql -c "CREATE USER mohmmedadmin WITH ENCRYPTED PASSWORD '$DB_PASSWORD';" 2>/dev/null || echo "User already exists"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE mohmmedvpn TO mohmmedadmin;"
sudo -u postgres psql -c "ALTER DATABASE mohmmedvpn OWNER TO mohmmedadmin;"

echo "[5/8] Installing Nginx..."
apt install -y nginx

echo "[6/8] Setting up project..."
mkdir -p /var/www/mohmmedvpn/logs

if [ -d "/var/www/mohmmedvpn/.git" ]; then
    cd /var/www/mohmmedvpn
    git pull origin main
else
    git clone https://github.com/imohmmed/MoHmmeD-VPN-System.git /var/www/mohmmedvpn
    cd /var/www/mohmmedvpn
fi

npm install
npm run build

cat > /var/www/mohmmedvpn/.env <<EOF
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://mohmmedadmin:${DB_PASSWORD}@localhost:5432/mohmmedvpn
SESSION_SECRET=${SESSION_KEY}
OWNER_EMAIL=${OWNER_EMAIL}
OWNER_PASSWORD=${OWNER_PASS}
EOF
chmod 600 /var/www/mohmmedvpn/.env

echo "[7/8] Configuring Nginx..."
cp deploy/nginx.conf /etc/nginx/sites-available/mohmmedvpn
ln -sf /etc/nginx/sites-available/mohmmedvpn /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "[8/8] Setting up SSL with Let's Encrypt..."
apt install -y certbot python3-certbot-nginx
certbot --nginx -d mohmmedvpn.com -d www.mohmmedvpn.com --non-interactive --agree-tos -m "$OWNER_EMAIL"

echo ""
echo "Pushing database schema..."
export DATABASE_URL="postgresql://mohmmedadmin:${DB_PASSWORD}@localhost:5432/mohmmedvpn"
npm run db:push

echo ""
echo "Starting application with PM2..."
cd /var/www/mohmmedvpn
pm2 start deploy/ecosystem.config.cjs --env production \
    --node-args="--env-file=.env"
pm2 save
pm2 startup

echo ""
echo "========================================="
echo "  Deployment Complete!"
echo "========================================="
echo "  Site: https://mohmmedvpn.com"
echo "  Owner: $OWNER_EMAIL"
echo ""
echo "  Useful commands:"
echo "    pm2 logs mohmmedvpn"
echo "    pm2 restart mohmmedvpn"
echo "    pm2 status"
echo "========================================="
