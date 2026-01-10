// TradingView Bridge Popup Script
const API_BASE = 'https://dobri.org/api/extension';

const statusEl = document.getElementById('status');
const apiKeyInput = document.getElementById('apiKey');
const saveBtn = document.getElementById('saveBtn');
const settingsSection = document.getElementById('settingsSection');
const assetEl = document.getElementById('asset');
const riskEl = document.getElementById('risk');
const leverageEl = document.getElementById('leverage');
const walletEl = document.getElementById('wallet');

// Load saved API key on popup open
chrome.storage.sync.get(['tvBridgeApiKey'], async (result) => {
  if (result.tvBridgeApiKey) {
    apiKeyInput.value = result.tvBridgeApiKey;
    await checkConnection(result.tvBridgeApiKey);
  }
});

// Save button click
saveBtn.addEventListener('click', async () => {
  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) {
    showStatus('Please enter an API key', false);
    return;
  }

  if (!apiKey.startsWith('tv_')) {
    showStatus('Invalid API key format', false);
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Connecting...';

  try {
    // Test the connection
    const success = await checkConnection(apiKey);

    if (success) {
      // Save the API key
      chrome.storage.sync.set({ tvBridgeApiKey: apiKey }, () => {
        saveBtn.textContent = 'Saved!';
        setTimeout(() => {
          saveBtn.textContent = 'Save & Connect';
          saveBtn.disabled = false;
        }, 1500);
      });
    } else {
      saveBtn.textContent = 'Save & Connect';
      saveBtn.disabled = false;
    }
  } catch (e) {
    showStatus('Connection failed', false);
    saveBtn.textContent = 'Save & Connect';
    saveBtn.disabled = false;
  }
});

async function checkConnection(apiKey) {
  try {
    const response = await fetch(`${API_BASE}/settings`, {
      headers: { 'x-api-key': apiKey }
    });

    if (!response.ok) {
      showStatus('Invalid API key', false);
      settingsSection.style.display = 'none';
      return false;
    }

    const data = await response.json();

    showStatus('Connected', true);
    settingsSection.style.display = 'block';

    assetEl.textContent = data.asset || 'BTC';
    riskEl.textContent = `$${(data.risk || 1).toFixed(2)}`;
    leverageEl.textContent = `${data.leverage || 25}x`;
    walletEl.textContent = data.walletNickname || 'Unknown';

    return true;
  } catch (e) {
    showStatus('Connection failed', false);
    settingsSection.style.display = 'none';
    return false;
  }
}

function showStatus(message, connected) {
  statusEl.textContent = message;
  statusEl.className = `status ${connected ? 'connected' : 'disconnected'}`;
}
