let client = null;
let currentUserId = 'user-123';
let currentAttributes = { plan: 'free', country: 'US' };
let panelCollapsed = false;

// ── Setup / Connect ──

function connectSDK() {
  const sdkKey = document.getElementById('sdk-key-input').value.trim();
  if (!sdkKey) {
    showError('Please enter your SDK Key');
    return;
  }

  const btn = document.getElementById('connect-btn');
  btn.textContent = 'Connecting...';
  btn.disabled = true;
  showError('');
  localStorage.setItem('opti_demo_sdk_key', sdkKey);
  initializeSDK(sdkKey);
}

function resetConnectButton() {
  const btn = document.getElementById('connect-btn');
  if (btn) {
    btn.textContent = 'Connect & Launch Demo';
    btn.disabled = false;
  }
}

function initializeSDK(sdkKey) {
  try {
    client = window.optimizelySdk.createInstance({
      sdkKey: sdkKey,
      datafileOptions: {
        autoUpdate: true,
        updateInterval: 30000
      }
    });

    client.onReady({ timeout: 10000 }).then((result) => {
      if (result.success) {
        showApp();
        updateSDKStatus('ready');
        evaluateAllFlags();

        client.notificationCenter.addNotificationListener(
          window.optimizelySdk.enums.NOTIFICATION_TYPES.OPTIMIZELY_CONFIG_UPDATE,
          () => {
            evaluateAllFlags();
            updateLastUpdated();
          }
        );
      } else {
        updateSDKStatus('error');
        resetConnectButton();
        showError('SDK failed to initialize. Check your SDK Key and that flags exist in your project.');
      }
    }).catch(() => {
      updateSDKStatus('error');
      resetConnectButton();
      showError('Connection timeout. Check your SDK Key.');
    });
  } catch (e) {
    resetConnectButton();
    showError('Error: ' + e.message);
  }
}

function showApp() {
  document.getElementById('setup-screen').style.display = 'none';
  document.getElementById('navbar').style.display = 'flex';
  document.getElementById('main-content').classList.add('visible');
  document.getElementById('control-panel').style.display = 'block';
}

function showError(msg) {
  const el = document.getElementById('setup-error');
  if (!el) {
    if (msg) {
      localStorage.removeItem('opti_demo_sdk_key');
      location.reload();
    }
    return;
  }
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}

// ── Flag Evaluation ──

function evaluateAllFlags() {
  if (!client) return;

  const user = client.createUserContext(currentUserId, currentAttributes);
  if (!user) return;

  evaluateDarkMode(user);
  evaluatePromoBanner(user);
  evaluateCheckoutButton(user);
  evaluatePricingDisplay(user);
  evaluateVipSection(user);
  updateDatafileInfo();
}

function evaluateDarkMode(user) {
  const decision = user.decide('dark_mode');
  if (decision.enabled) {
    document.body.classList.add('dark-mode');
    updateFlagIndicator('flag-dark', true, 'ON');
  } else {
    document.body.classList.remove('dark-mode');
    updateFlagIndicator('flag-dark', false, 'OFF');
  }
}

function evaluatePromoBanner(user) {
  const decision = user.decide('promo_banner');
  const banner = document.getElementById('promo-banner');

  if (decision.enabled) {
    banner.classList.add('visible');
    updateFlagIndicator('flag-promo', true, 'ON');
  } else {
    banner.classList.remove('visible');
    updateFlagIndicator('flag-promo', false, 'OFF');
  }
}

function evaluateCheckoutButton(user) {
  const decision = user.decide('checkout_button');
  const btn = document.getElementById('checkout-btn');
  const badge = document.getElementById('checkout-variation-badge');

  if (!decision.enabled || !decision.variationKey) {
    btn.className = 'btn-checkout control';
    btn.textContent = 'Add to Cart';
    badge.textContent = '';
    updateFlagIndicator('flag-checkout', false, 'OFF');
    return;
  }

  const vKey = decision.variationKey.toLowerCase();
  const isControl = vKey === 'off' || vKey === 'control' || vKey.includes('a');

  if (isControl) {
    btn.className = 'btn-checkout control';
    btn.textContent = 'Add to Cart';
    badge.textContent = 'You are in: ' + decision.variationKey + ' (Control)';
    badge.style.background = '#cce5ff';
    badge.style.color = '#004085';
    updateFlagIndicator('flag-checkout', true, decision.variationKey, 'var-a');
  } else {
    btn.className = 'btn-checkout variation';
    btn.textContent = 'Buy Now — Free Shipping!';
    badge.textContent = 'You are in: ' + decision.variationKey + ' (Treatment)';
    badge.style.background = '#fff3cd';
    badge.style.color = '#856404';
    updateFlagIndicator('flag-checkout', true, decision.variationKey, 'var-b');
  }
}

function evaluatePricingDisplay(user) {
  const decision = user.decide('pricing_display');
  const priceTag = document.getElementById('price-tag');
  const priceSubtitle = document.getElementById('price-subtitle');

  if (!decision.enabled) {
    priceTag.textContent = '$14.99';
    priceSubtitle.textContent = 'per 12oz bag';
    updateFlagIndicator('flag-pricing', false, 'OFF');
    return;
  }

  const priceText = decision.variables && decision.variables['price_text'];
  const vKey = (decision.variationKey || '').toLowerCase();
  const isControl = vKey === 'off' || vKey === 'control' || vKey.includes('a');

  if (priceText) {
    priceTag.textContent = priceText;
    priceSubtitle.textContent = 'experiment — ' + decision.variationKey;
  } else if (isControl) {
    priceTag.textContent = '$14.99';
    priceSubtitle.textContent = 'per 12oz bag (control)';
  } else {
    priceTag.textContent = '$9.99/mo';
    priceSubtitle.textContent = 'subscription — cancel anytime';
  }

  updateFlagIndicator('flag-pricing', true, decision.variationKey || 'ON', isControl ? 'var-a' : 'var-b');
}

function evaluateVipSection(user) {
  const decision = user.decide('vip_section');
  const section = document.getElementById('vip-section');

  if (decision.enabled) {
    section.classList.add('visible');
    updateFlagIndicator('flag-vip', true, 'ON');
  } else {
    section.classList.remove('visible');
    updateFlagIndicator('flag-vip', false, 'OFF');
  }
}

// ── UI Helpers ──

function updateFlagIndicator(elementId, isOn, label, extraClass) {
  const el = document.getElementById(elementId);
  el.textContent = label || (isOn ? 'ON' : 'OFF');
  el.className = 'flag-status ' + (extraClass || (isOn ? 'on' : 'off'));
}

function updateSDKStatus(status) {
  const dot = document.getElementById('sdk-status-dot');
  const text = document.getElementById('sdk-status-text');

  if (status === 'ready') {
    dot.className = 'status-dot green';
    text.textContent = 'Connected';
    updateLastUpdated();
  } else if (status === 'error') {
    dot.className = 'status-dot red';
    text.textContent = 'Error';
  }
}

function updateLastUpdated() {
  document.getElementById('last-updated').textContent = new Date().toLocaleTimeString();
}

function updateDatafileInfo() {
  if (!client) return;
  const config = client.getOptimizelyConfig();
  if (config) {
    document.getElementById('datafile-revision').textContent = config.revision || '—';
  }
}

function updateUser() {
  currentUserId = document.getElementById('user-id-input').value.trim() || 'user-123';
  currentAttributes.plan = document.getElementById('user-plan-select').value;
  currentAttributes.country = document.getElementById('user-country-select').value;
  evaluateAllFlags();

  const btn = document.getElementById('evaluate-btn');
  btn.textContent = 'Re-evaluated';
  btn.style.background = '#28a745';
  setTimeout(() => {
    btn.textContent = 'Evaluate';
    btn.style.background = '';
  }, 800);
}

function togglePanel() {
  panelCollapsed = !panelCollapsed;
  document.getElementById('panel-body').classList.toggle('collapsed', panelCollapsed);
  document.getElementById('toggle-arrow').classList.toggle('collapsed', panelCollapsed);
}

function disconnect() {
  localStorage.removeItem('opti_demo_sdk_key');
  if (client) {
    client.close();
    client = null;
  }
  location.reload();
}

// ── Auto-connect if SDK key is saved ──
window.addEventListener('DOMContentLoaded', () => {
  const savedKey = localStorage.getItem('opti_demo_sdk_key');
  if (savedKey) {
    document.getElementById('setup-screen').innerHTML =
      '<div class="setup-card" style="text-align:center;"><h1>Connecting...</h1><p>Loading feature flags from Optimizely</p></div>';
    initializeSDK(savedKey);
  }
});
