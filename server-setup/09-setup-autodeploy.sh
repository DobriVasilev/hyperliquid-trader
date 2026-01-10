#!/bin/bash
set -euo pipefail

# Set up automatic deployment from GitHub webhooks
# Run as: sudo ./09-setup-autodeploy.sh

echo "=== Setting Up Auto-Deploy from GitHub ==="

# Create deploy script
cat > /usr/local/bin/deploy-trading-app.sh << 'SCRIPT'
#!/bin/bash
set -euo pipefail

APP_DIR="/home/dobri/systems-trader"
WEB_DIR="${APP_DIR}/web"
LOG_FILE="/var/log/trading-app/deploy.log"

echo "========================================" >> "$LOG_FILE"
echo "Deploy started at $(date)" >> "$LOG_FILE"

cd "$APP_DIR"

# Pull latest changes
echo "Pulling from GitHub..." >> "$LOG_FILE"
git fetch origin >> "$LOG_FILE" 2>&1
git reset --hard origin/master >> "$LOG_FILE" 2>&1

# Install dependencies if package.json changed
cd "$WEB_DIR"
echo "Installing dependencies..." >> "$LOG_FILE"
npm ci --production=false >> "$LOG_FILE" 2>&1

# Generate Prisma client
echo "Generating Prisma client..." >> "$LOG_FILE"
npx prisma generate >> "$LOG_FILE" 2>&1

# Build the app
echo "Building Next.js app..." >> "$LOG_FILE"
npm run build >> "$LOG_FILE" 2>&1

# Restart the app
echo "Restarting app..." >> "$LOG_FILE"
pm2 restart trading-app >> "$LOG_FILE" 2>&1

echo "Deploy completed at $(date)" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"
SCRIPT

chmod +x /usr/local/bin/deploy-trading-app.sh
chown dobri:dobri /usr/local/bin/deploy-trading-app.sh

# Create webhook server (simple Node.js script)
mkdir -p /home/dobri/deploy-webhook
cat > /home/dobri/deploy-webhook/server.js << 'WEBHOOK'
const http = require('http');
const crypto = require('crypto');
const { exec } = require('child_process');

const PORT = 9000;
const SECRET = process.env.WEBHOOK_SECRET || '';

function verifySignature(payload, signature) {
    if (!SECRET) return true; // No secret configured, accept all
    const hmac = crypto.createHmac('sha256', SECRET);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/deploy') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const signature = req.headers['x-hub-signature-256'] || '';

            // Verify webhook signature if secret is set
            if (SECRET && !verifySignature(body, signature)) {
                console.log('Invalid signature, rejecting');
                res.writeHead(401);
                res.end('Unauthorized');
                return;
            }

            try {
                const payload = JSON.parse(body);

                // Only deploy on push to master/main
                const ref = payload.ref || '';
                if (ref === 'refs/heads/master' || ref === 'refs/heads/main') {
                    console.log(`Received push to ${ref}, deploying...`);

                    // Run deploy script
                    exec('/usr/local/bin/deploy-trading-app.sh', (error, stdout, stderr) => {
                        if (error) {
                            console.error('Deploy failed:', error);
                        } else {
                            console.log('Deploy completed successfully');
                        }
                    });

                    res.writeHead(200);
                    res.end('Deploying...');
                } else {
                    console.log(`Push to ${ref}, ignoring`);
                    res.writeHead(200);
                    res.end('Ignored (not master/main)');
                }
            } catch (e) {
                console.error('Error parsing webhook:', e);
                res.writeHead(400);
                res.end('Bad Request');
            }
        });
    } else if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200);
        res.end('OK');
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`Deploy webhook server listening on port ${PORT}`);
});
WEBHOOK

chown -R dobri:dobri /home/dobri/deploy-webhook

# Create systemd service for webhook server
cat > /etc/systemd/system/deploy-webhook.service << 'EOF'
[Unit]
Description=GitHub Deploy Webhook Server
After=network.target

[Service]
Type=simple
User=dobri
WorkingDirectory=/home/dobri/deploy-webhook
ExecStart=/usr/bin/node /home/dobri/deploy-webhook/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
# Add WEBHOOK_SECRET here for security (optional but recommended)
# Environment=WEBHOOK_SECRET=your-secret-here

[Install]
WantedBy=multi-user.target
EOF

# Update Caddy to proxy webhook endpoint
# Add this to Caddyfile manually or via script
echo ""
echo "NOTE: Add this to your Caddyfile for the webhook endpoint:"
echo ""
echo "    # In the dobri.org block, add:"
echo "    handle /webhook/deploy {"
echo "        reverse_proxy localhost:9000 {"
echo "            header_up Host {host}"
echo "        }"
echo "        rewrite * /deploy"
echo "    }"
echo ""

# Enable and start the webhook service
systemctl daemon-reload
systemctl enable deploy-webhook
systemctl start deploy-webhook

echo ""
echo "=== Auto-Deploy Setup Complete ==="
echo ""
echo "Webhook server running on port 9000 (internal only)"
echo ""
echo "Next steps:"
echo "1. Update Caddyfile to proxy /webhook/deploy to localhost:9000"
echo "2. Go to GitHub repo → Settings → Webhooks → Add webhook"
echo "3. Set Payload URL: https://dobri.org/webhook/deploy"
echo "4. Set Content type: application/json"
echo "5. Set Secret: (optional, for security)"
echo "6. Select 'Just the push event'"
echo "7. Click 'Add webhook'"
echo ""
echo "To test: git push to master branch"
echo "View deploy logs: tail -f /var/log/trading-app/deploy.log"
echo ""
