#!/bin/bash
set -euo pipefail

# Set up automated backups for Neon database
# Run as: sudo ./07-setup-backups.sh

echo "=== Setting Up Automated Backups ==="

# Create backup directory
mkdir -p /var/backups/trading-app
chown dobri:dobri /var/backups/trading-app

# Create log directory
mkdir -p /var/log/trading-app
chown dobri:dobri /var/log/trading-app

# Create backup script
cat > /usr/local/bin/backup-trading-app.sh << 'SCRIPT'
#!/bin/bash
set -euo pipefail

# Backup script for trading app (Neon database)
BACKUP_DIR="/var/backups/trading-app"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.tar.gz"
APP_DIR="/home/dobri/systems-trader/web"

echo "Starting backup at $(date)"

# Create temporary directory
TMP_DIR=$(mktemp -d)
trap "rm -rf ${TMP_DIR}" EXIT

# Get database URL from .env file
if [ -f "${APP_DIR}/.env" ]; then
    DATABASE_URL=$(grep "^DATABASE_URL=" "${APP_DIR}/.env" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
else
    echo "ERROR: .env file not found"
    exit 1
fi

if [ -z "${DATABASE_URL}" ]; then
    echo "ERROR: DATABASE_URL not found in .env"
    exit 1
fi

# Backup database from Neon
echo "Backing up database from Neon..."
if pg_dump "${DATABASE_URL}" -F c -f "${TMP_DIR}/database.dump" 2>/dev/null; then
    echo "Database backup successful"
else
    echo "WARNING: Database backup failed (may need pg_dump installed)"
    echo "Continuing with config backup only..."
fi

# Backup .env file (contains secrets - encrypt it!)
echo "Backing up configuration..."
cp "${APP_DIR}/.env" "${TMP_DIR}/"

# Backup prisma schema
cp "${APP_DIR}/prisma/schema.prisma" "${TMP_DIR}/"

# Create backup info file
cat > "${TMP_DIR}/backup_info.txt" << EOF
Backup Date: $(date)
Hostname: $(hostname)
App Directory: ${APP_DIR}
Database: Neon PostgreSQL
EOF

# Create compressed archive
echo "Creating archive..."
tar -czf "${BACKUP_FILE}" -C "${TMP_DIR}" .

# Remove backups older than 30 days
echo "Cleaning old backups..."
find "${BACKUP_DIR}" -name "backup_*.tar.gz" -mtime +30 -delete

# Get backup size
BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)

echo "Backup complete: ${BACKUP_FILE} (${BACKUP_SIZE})"
echo "Backup finished at $(date)"
SCRIPT

chmod +x /usr/local/bin/backup-trading-app.sh

# Create systemd timer for daily backups at 2 AM
cat > /etc/systemd/system/trading-app-backup.service << 'EOF'
[Unit]
Description=Trading App Backup

[Service]
Type=oneshot
User=root
ExecStart=/usr/local/bin/backup-trading-app.sh
StandardOutput=append:/var/log/trading-app/backup.log
StandardError=append:/var/log/trading-app/backup.log
EOF

cat > /etc/systemd/system/trading-app-backup.timer << 'EOF'
[Unit]
Description=Trading App Backup Timer
Requires=trading-app-backup.service

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

# Enable timer
systemctl daemon-reload
systemctl enable trading-app-backup.timer
systemctl start trading-app-backup.timer

# Install pg_dump if not present (needed for Neon backup)
if ! command -v pg_dump &> /dev/null; then
    echo "Installing PostgreSQL client for pg_dump..."
    apt-get update -qq
    apt-get install -y -qq postgresql-client
fi

# Run first backup now
echo "Running initial backup..."
/usr/local/bin/backup-trading-app.sh

echo ""
echo "=== Backup Setup Complete ==="
echo ""
echo "Backups will run daily at 2:00 AM"
echo "Backup location: /var/backups/trading-app/"
echo "Backups are kept for 30 days"
echo ""
echo "Commands:"
echo "  Manual backup: sudo /usr/local/bin/backup-trading-app.sh"
echo "  Check timer:   systemctl list-timers trading-app-backup.timer"
echo "  View log:      tail -f /var/log/trading-app/backup.log"
echo ""
echo "To restore from backup:"
echo "  1. Extract: tar -xzf /var/backups/trading-app/backup_YYYYMMDD_HHMMSS.tar.gz -C /tmp/restore"
echo "  2. Restore DB: pg_restore -d \"\$DATABASE_URL\" /tmp/restore/database.dump"
echo "  3. Restore .env if needed"
