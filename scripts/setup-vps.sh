#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# One-time VPS setup script — run this ONCE on a fresh server.
# The workflow will push code via rsync on every deploy — no git clone needed.
#
# Usage: ssh root@YOUR_SERVER_IP 'bash -s' < scripts/setup-vps.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

echo "==> Installing Docker..."
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

echo "==> Installing Docker Compose plugin..."
apt-get install -y docker-compose-plugin

echo "==> Creating /var/www/naderk directory..."
mkdir -p /var/www/naderk
mkdir -p /var/www/naderk-dev   # optional staging directory

echo ""
echo "========================================================="
echo "  NEXT STEPS — complete these manually on the server:"
echo "========================================================="
echo ""
echo "1. Create BackEnd production env file:"
echo "   nano /var/www/naderk/BackEnd/.env.production"
echo "   (copy contents from BackEnd/.env.example and fill in real values)"
echo ""
echo "2. Create Frontend production env file:"
echo "   nano /var/www/naderk/FrontEnd/fronend/.env.production"
echo "   (copy contents from FrontEnd/fronend/.env.example and fill in real values)"
echo ""
echo "3. Run your first deploy from GitHub:"
echo "   GitHub → Actions → Deploy Naderk → Run workflow"
echo "   Pick: service=both, branch=main, environment=prod"
echo ""
echo "4. After the first deploy, start infrastructure:"
echo "   cd /var/www/naderk"
echo "   docker compose up -d db redis livekit"
echo ""
echo "5. (Optional) Set up Nginx:"
echo "   apt-get install -y nginx certbot python3-certbot-nginx"
echo "   cp /var/www/naderk/scripts/nginx.conf /etc/nginx/sites-available/naderk"
echo "   ln -s /etc/nginx/sites-available/naderk /etc/nginx/sites-enabled/"
echo "   nginx -t && systemctl reload nginx"
echo "========================================================="
