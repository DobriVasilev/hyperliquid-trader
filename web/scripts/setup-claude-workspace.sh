#!/bin/bash

# Setup Claude workspace infrastructure
# This creates all necessary directories and files for Claude CLI integration

set -e  # Exit on error

WORKSPACE_DIR="/tmp/claude-workspace"

echo "=========================================="
echo "Setting up Claude Workspace"
echo "=========================================="
echo ""

# Create directory structure
echo "Creating directory structure at ${WORKSPACE_DIR}..."
mkdir -p "${WORKSPACE_DIR}/feedback-queue"
mkdir -p "${WORKSPACE_DIR}/status"
mkdir -p "${WORKSPACE_DIR}/prompts"
mkdir -p "${WORKSPACE_DIR}/logs"

# Create named pipe for Claude triggering
echo "Creating named pipe for feedback..."
if [ -p "${WORKSPACE_DIR}/feedback-pipe" ]; then
  echo "  ✓ Named pipe already exists"
else
  mkfifo "${WORKSPACE_DIR}/feedback-pipe"
  echo "  ✓ Named pipe created"
fi

# Copy standards template
echo "Copying Claude standards template..."
if [ -f "CLAUDE_STANDARDS_TEMPLATE.md" ]; then
  cp CLAUDE_STANDARDS_TEMPLATE.md "${WORKSPACE_DIR}/"
  echo "  ✓ Standards template copied"
else
  echo "  ⚠ Warning: CLAUDE_STANDARDS_TEMPLATE.md not found"
fi

# Set permissions
echo "Setting permissions..."
chmod 755 "${WORKSPACE_DIR}"
chmod 777 "${WORKSPACE_DIR}/feedback-queue"
chmod 777 "${WORKSPACE_DIR}/status"
chmod 666 "${WORKSPACE_DIR}/feedback-pipe"

# Create test feedback file for validation
echo "Creating test feedback file..."
cat > "${WORKSPACE_DIR}/feedback-queue/test-feedback.json.example" <<'EOF'
{
  "workspaceId": "test-workspace-123",
  "executionId": "test-execution-456",
  "patternType": "swings",
  "version": "1.0.0",
  "timestamp": "2026-01-15T10:30:00Z",
  "context": {
    "patternName": "Swing Detection",
    "category": "Price Action",
    "currentStatus": "beta",
    "description": "Identifies swing highs and lows in price action"
  },
  "session": {
    "id": "session123",
    "name": "BTC 4h - Testing swings",
    "symbol": "BTC",
    "timeframe": "4h",
    "candleCount": 720
  },
  "feedback": [
    {
      "id": "fb1",
      "type": "false_positive",
      "timestamp": "2026-01-15T10:25:00Z",
      "reasoning": "This is a test feedback item for validation",
      "attachments": []
    }
  ],
  "aggregatedSummary": {
    "totalFeedback": 1,
    "falsePositives": 1,
    "falseNegatives": 0,
    "adjustments": 0,
    "commonThemes": ["Test feedback"]
  },
  "instructions": {
    "task": "This is a test feedback file for validation",
    "goals": ["Validate setup"],
    "constraints": ["None"],
    "files": []
  }
}
EOF

echo ""
echo "=========================================="
echo "✓ Claude Workspace Setup Complete!"
echo "=========================================="
echo ""
echo "Directory structure:"
echo "  ${WORKSPACE_DIR}/"
echo "  ├── feedback-queue/     (Drop feedback JSON files here)"
echo "  ├── feedback-pipe       (Named pipe for triggering)"
echo "  ├── status/             (Claude writes progress here)"
echo "  ├── prompts/            (Generated prompts stored here)"
echo "  └── logs/               (Service logs)"
echo ""
echo "Next steps:"
echo "  1. Start feedback watcher: npm run watch:feedback"
echo "  2. Start status watcher: npm run watch:status"
echo "  3. Start Claude worker: ./scripts/claude-worker.sh"
echo "  4. Test with: cp ${WORKSPACE_DIR}/feedback-queue/test-feedback.json.example ${WORKSPACE_DIR}/feedback-queue/test.json"
echo ""
