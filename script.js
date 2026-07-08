/**
 * Feature Flag Demo — Application Logic
 *
 * This script connects the Optimizely JavaScript SDK to the demo store UI.
 * It handles three responsibilities:
 *
 * 1. SDK CONNECTION: Initialize the Optimizely SDK with a user-provided
 *    SDK key, manage the connection lifecycle, and persist the key in
 *    localStorage for returning visitors.
 *
 * 2. FLAG EVALUATION: For each of the 5 feature flags, read the SDK's
 *    decision and update the corresponding UI element. Each flag maps
 *    to one function (evaluateDarkMode, evaluatePromoBanner, etc.).
 *
 * 3. USER SIMULATION: Allow changing the user ID and attributes in the
 *    inspector panel to simulate different users visiting the site.
 *    This re-evaluates all flags with the new user context.
 *
 * The SDK polls Optimizely's CDN every 30 seconds for datafile updates.
 * When a new datafile arrives (because someone toggled a flag in
 * app.optimizely.com), the OPTIMIZELY_CONFIG_UPDATE listener fires
 * and re-evaluates all flags automatically.
 */


// ──────────────────────────────────────────────
// State
// ──────────────────────────────────────────────

// The Optimizely SDK client instance. null until connected.
let client = null;

// The current simulated user. In a real app, these come from
// the auth system (e.g., logged-in user ID, subscription tier).
let currentUserId = 'user-123';
let currentAttributes = { plan: 'free', country: 'US' };

// Whether the inspector panel body is collapsed.
let panelCollapsed = false;


// ──────────────────────────────────────────────
// SDK Connection
// ──────────────────────────────────────────────

/**
 * Called when the user clicks "Connect & Launch Demo" on the setup screen.
 * Reads the SDK key from the input, saves it to localStorage, and
 * initializes the SDK.
 */
function connectSDK() {
  const sdkKey = document.getElementById('sdk-key-input').value.trim();
  if (!sdkKey) {
    showError('Please enter your SDK Key');
    return;
  }

  // Show loading state on the button
  const btn = document.getElementById('connect-btn');
  btn.textContent = 'Connecting...';
  btn.disabled = true;
  showError('');

  // Save the key so returning visitors skip the setup screen
  localStorage.setItem('opti_demo_sdk_key', sdkKey);
  initializeSDK(sdkKey);
}

/**
 * Resets the connect button to its default state.
 * Called when SDK initialization fails so the user can try again.
 */
function resetConnectButton() {
  const btn = document.getElementById('connect-btn');
  if (btn) {
    btn.textContent = 'Connect & Launch Demo';
    btn.disabled = false;
  }
}

/**
 * Creates an Optimizely SDK client and waits for it to be ready.
 *
 * The SDK does the following on initialization:
 * 1. Uses the SDK key to fetch the datafile from Optimizely's CDN
 * 2. Parses the datafile (JSON containing all flags, rules, audiences)
 * 3. Starts a background polling loop (every 30 seconds) for updates
 *
 * Once ready, we:
 * - Show the store page (hide setup screen)
 * - Evaluate all 5 flags against the current user
 * - Register a listener for datafile updates so flags re-evaluate
 *   automatically when someone toggles a flag in Optimizely
 */
function initializeSDK(sdkKey) {
  try {
    // Create the SDK client. window.optimizelySdk is provided by
    // the CDN script tag in index.html.
    client = window.optimizelySdk.createInstance({
      sdkKey: sdkKey,
      datafileOptions: {
        autoUpdate: true,       // Poll for datafile changes
        updateInterval: 30000   // Every 30 seconds
      }
    });

    // Wait up to 10 seconds for the SDK to fetch and parse the datafile
    client.onReady({ timeout: 10000 }).then((result) => {
      if (result.success) {
        showApp();
        updateSDKStatus('ready');
        evaluateAllFlags();

        // Listen for datafile updates. When someone toggles a flag in
        // app.optimizely.com, the SDK picks up the new datafile on the
        // next poll. This listener fires, and we re-evaluate all flags.
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

/**
 * Transitions from the setup screen to the store page.
 * Shows the navbar, main content, and inspector panel.
 */
function showApp() {
  document.getElementById('setup-screen').style.display = 'none';
  document.getElementById('navbar').style.display = 'flex';
  document.getElementById('main-content').classList.add('visible');
  document.getElementById('control-panel').style.display = 'block';
}

/**
 * Displays an error message on the setup screen.
 * If the setup screen was replaced (auto-reconnect flow) and an
 * error occurs, clears the saved SDK key and reloads so the user
 * gets a fresh setup screen.
 */
function showError(msg) {
  const el = document.getElementById('setup-error');
  if (!el) {
    // Setup screen was replaced by "Connecting..." (auto-reconnect).
    // Clear the bad key and reload to show the full setup screen.
    if (msg) {
      localStorage.removeItem('opti_demo_sdk_key');
      location.reload();
    }
    return;
  }
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}


// ──────────────────────────────────────────────
// Flag Evaluation
//
// Each flag has its own evaluate function that:
// 1. Calls user.decide('flag_key') to get the SDK's decision
// 2. Updates the corresponding UI element based on the decision
// 3. Updates the inspector panel indicator
//
// All evaluation happens locally in memory using the cached
// datafile. No network calls are made during evaluation.
// ──────────────────────────────────────────────

/**
 * Re-evaluates all 5 flags with the current user context.
 * Called on initial load, when the user changes their simulated
 * identity, and when the SDK receives a datafile update.
 */
function evaluateAllFlags() {
  if (!client) return;

  // Create a user context with the current user ID and attributes.
  // In a real app: client.createUserContext(req.user.id, { plan: req.user.plan })
  const user = client.createUserContext(currentUserId, currentAttributes);
  if (!user) return;

  evaluateDarkMode(user);
  evaluatePromoBanner(user);
  evaluateCheckoutButton(user);
  evaluatePricingDisplay(user);
  evaluateVipSection(user);
  updateDatafileInfo();
  updateRawDatafile();
}

/**
 * Flag: dark_mode (Feature Rollout)
 * Toggles the page between light and dark theme.
 * When ON: adds CSS class "dark-mode" to <body>, which swaps
 * all CSS custom properties (--bg, --text, etc.) to dark values.
 */
function evaluateDarkMode(user) {
  const decision = user.decide('dark_mode');
  updateDecisionDisplay('dark_mode', decision);
  if (decision.enabled) {
    document.body.classList.add('dark-mode');
    updateFlagIndicator('flag-dark', true, 'ON');
  } else {
    document.body.classList.remove('dark-mode');
    updateFlagIndicator('flag-dark', false, 'OFF');
  }
}

/**
 * Flag: promo_banner (Feature Rollout)
 * Shows or hides the promotional banner at the top of the page.
 * When ON: adds CSS class "visible" which sets display: block.
 * When OFF: removes the class, banner returns to display: none.
 */
function evaluatePromoBanner(user) {
  const decision = user.decide('promo_banner');
  updateDecisionDisplay('promo_banner', decision);
  const banner = document.getElementById('promo-banner');

  if (decision.enabled) {
    banner.classList.add('visible');
    updateFlagIndicator('flag-promo', true, 'ON');
  } else {
    banner.classList.remove('visible');
    updateFlagIndicator('flag-promo', false, 'OFF');
  }
}

/**
 * Flag: checkout_button (A/B Experiment)
 * Changes the checkout button style based on the assigned variation.
 *
 * Control (variation with "a" in the key, or "control", or "off"):
 *   Grey "Add to Cart" button
 *
 * Treatment (any other variation key):
 *   Green "Buy Now — Free Shipping!" button
 *
 * The variation key comes from how the experiment is configured in
 * Optimizely. We check for common control patterns (contains "a",
 * equals "control" or "off") to determine which style to show.
 *
 * The badge next to the button shows which variation the user is in,
 * making the A/B split visible during the demo.
 */
function evaluateCheckoutButton(user) {
  const decision = user.decide('checkout_button');
  updateDecisionDisplay('checkout_button', decision);
  const btn = document.getElementById('checkout-btn');
  const badge = document.getElementById('checkout-variation-badge');

  // Flag is off or no variation assigned — show default button
  if (!decision.enabled || !decision.variationKey) {
    btn.className = 'btn-checkout control';
    btn.textContent = 'Add to Cart';
    badge.textContent = '';
    updateFlagIndicator('flag-checkout', false, 'OFF');
    return;
  }

  // Determine if this is the control or treatment variation
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

/**
 * Flag: pricing_display (A/B Experiment with Variables)
 * Shows different pricing based on the flag's variable value.
 *
 * This flag has a variable called "price_text" (string type).
 * The SDK returns the variable value for the assigned variation:
 *   decision.variables['price_text']  →  "$14.99" or "$9.99/mo"
 *
 * Priority:
 * 1. If the variable has a value → use it directly (most flexible)
 * 2. If no variable but we know the variation → use hardcoded fallback
 * 3. If flag is off → show default price ($14.99)
 */
function evaluatePricingDisplay(user) {
  const decision = user.decide('pricing_display');
  updateDecisionDisplay('pricing_display', decision);
  const priceTag = document.getElementById('price-tag');
  const priceSubtitle = document.getElementById('price-subtitle');

  // Flag is off — show default price
  if (!decision.enabled) {
    priceTag.textContent = '$14.99';
    priceSubtitle.textContent = 'per 12oz bag';
    updateFlagIndicator('flag-pricing', false, 'OFF');
    return;
  }

  // Check if the variable has a value (set in Optimizely per variation)
  const priceText = decision.variables && decision.variables['price_text'];
  const vKey = (decision.variationKey || '').toLowerCase();
  const isControl = vKey === 'off' || vKey === 'control' || vKey.includes('a');

  if (priceText) {
    // Variable is set — use it directly. This is the ideal path:
    // the price comes from Optimizely, not from hardcoded logic.
    priceTag.textContent = priceText;
    priceSubtitle.textContent = 'experiment — ' + decision.variationKey;
  } else if (isControl) {
    // Fallback: no variable value, but we're in the control variation
    priceTag.textContent = '$14.99';
    priceSubtitle.textContent = 'per 12oz bag (control)';
  } else {
    // Fallback: no variable value, treatment variation
    priceTag.textContent = '$9.99/mo';
    priceSubtitle.textContent = 'subscription — cancel anytime';
  }

  updateFlagIndicator('flag-pricing', true, decision.variationKey || 'ON', isControl ? 'var-a' : 'var-b');
}

/**
 * Flag: vip_section (Targeted Delivery)
 * Shows or hides the VIP perks section based on audience matching.
 *
 * In Optimizely, this flag has an audience: "Premium Users" where
 * the custom attribute "plan" equals "premium". The SDK matches the
 * user's attributes against this audience condition locally.
 *
 * User with plan="premium" → decision.enabled = true → section visible
 * User with plan="free"    → decision.enabled = false → section hidden
 */
function evaluateVipSection(user) {
  const decision = user.decide('vip_section');
  updateDecisionDisplay('vip_section', decision);
  const section = document.getElementById('vip-section');

  if (decision.enabled) {
    section.classList.add('visible');
    updateFlagIndicator('flag-vip', true, 'ON');
  } else {
    section.classList.remove('visible');
    updateFlagIndicator('flag-vip', false, 'OFF');
  }
}


// ──────────────────────────────────────────────
// Decision Display
//
// Shows the raw decision object the SDK returned for each flag.
// This makes the SDK's output transparent — you can see exactly
// what decision.enabled, decision.variationKey, and
// decision.variables contain.
// ──────────────────────────────────────────────

/**
 * Formats a decision object into a readable JSON string for display.
 * Only includes the fields that matter: enabled, variationKey, variables.
 * @param {Object} decision - The OptimizelyDecision object from user.decide()
 * @returns {string} Formatted JSON string
 */
function formatDecision(decision) {
  const display = {
    enabled: decision.enabled,
    variationKey: decision.variationKey || null,
  };

  // Only include variables if there are any
  if (decision.variables && Object.keys(decision.variables).length > 0) {
    display.variables = decision.variables;
  }

  return JSON.stringify(display, null, 2);
}

/**
 * Updates the decision JSON display for a specific flag.
 * Called by each evaluate function after getting a decision.
 * @param {string} flagKey - The flag key (e.g., "dark_mode")
 * @param {Object} decision - The OptimizelyDecision object
 */
function updateDecisionDisplay(flagKey, decision) {
  const el = document.getElementById('decision-' + flagKey);
  if (el) {
    el.textContent = formatDecision(decision);
  }
}

/**
 * Updates the raw datafile viewer with the full JSON datafile
 * the SDK currently has in memory. Called after initial load
 * and each time the SDK polls a new datafile.
 */
function updateRawDatafile() {
  if (!client) return;
  const el = document.getElementById('raw-datafile');
  if (!el) return;

  try {
    const config = client.getOptimizelyConfig();
    if (config) {
      // getOptimizelyConfig returns a structured object.
      // For the full raw datafile, we access the client's internal
      // config manager. Fall back to the structured config if not available.
      const datafile = client.configManager && client.configManager.get
        ? client.configManager.get()
        : config;
      el.textContent = JSON.stringify(datafile, null, 2);
    }
  } catch (e) {
    el.textContent = 'Could not load raw datafile: ' + e.message;
  }
}


// ──────────────────────────────────────────────
// Inspector Panel — UI Helpers
// ──────────────────────────────────────────────

/**
 * Updates a flag status indicator in the inspector panel.
 * @param {string} elementId - The DOM id of the status span (e.g., "flag-dark")
 * @param {boolean} isOn - Whether the flag is enabled
 * @param {string} label - Text to display (e.g., "ON", "OFF", "variation_1")
 * @param {string} [extraClass] - Optional CSS class for styling (e.g., "var-a", "var-b")
 */
function updateFlagIndicator(elementId, isOn, label, extraClass) {
  const el = document.getElementById(elementId);
  el.textContent = label || (isOn ? 'ON' : 'OFF');
  el.className = 'flag-status ' + (extraClass || (isOn ? 'on' : 'off'));
}

/**
 * Updates the SDK connection status dot and text.
 * Green = connected, Red = error, Yellow = connecting (default).
 */
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

/**
 * Updates the "last updated" timestamp in the status bar.
 * Called when the SDK first connects and each time it polls
 * a new datafile.
 */
function updateLastUpdated() {
  document.getElementById('last-updated').textContent = new Date().toLocaleTimeString();
}

/**
 * Reads the current datafile revision from the SDK and displays it.
 * The revision number increments each time a flag is changed in
 * Optimizely. Useful for confirming the SDK received an update.
 */
function updateDatafileInfo() {
  if (!client) return;
  const config = client.getOptimizelyConfig();
  if (config) {
    document.getElementById('datafile-revision').textContent = config.revision || '—';
  }
}

/**
 * Called when the user changes the simulated user identity.
 * Reads the current values from the User ID input and attribute
 * dropdowns, then re-evaluates all flags with the new context.
 *
 * The "Evaluate" button briefly flashes green to confirm the
 * re-evaluation happened (important when flag decisions don't
 * visibly change — the user knows it worked).
 */
function updateUser() {
  currentUserId = document.getElementById('user-id-input').value.trim() || 'user-123';
  currentAttributes.plan = document.getElementById('user-plan-select').value;
  currentAttributes.country = document.getElementById('user-country-select').value;
  evaluateAllFlags();

  // Visual feedback — button flashes green briefly
  const btn = document.getElementById('evaluate-btn');
  btn.textContent = 'Re-evaluated';
  btn.style.background = '#28a745';
  setTimeout(() => {
    btn.textContent = 'Evaluate';
    btn.style.background = '';
  }, 800);
}

/**
 * Toggles the inspector panel body open/closed.
 * The arrow rotates 180 degrees when collapsed.
 */
function togglePanel() {
  panelCollapsed = !panelCollapsed;
  document.getElementById('panel-body').classList.toggle('collapsed', panelCollapsed);
  document.getElementById('toggle-arrow').classList.toggle('collapsed', panelCollapsed);
}

/**
 * Disconnects from the SDK and clears the saved SDK key.
 * Reloads the page to show the setup screen again.
 */
function disconnect() {
  localStorage.removeItem('opti_demo_sdk_key');
  if (client) {
    client.close();
    client = null;
  }
  location.reload();
}


// ──────────────────────────────────────────────
// Fullscreen JSON Modal
//
// Opens a centered overlay showing JSON content in a readable
// format. Used for expanding decision objects and the raw
// datafile. Closes on X button, backdrop click, or Escape key.
// ──────────────────────────────────────────────

/**
 * Opens the fullscreen modal with JSON content from a source element.
 * @param {string} title - Display title (e.g., flag key or "Raw Datafile")
 * @param {string} sourceId - DOM id of the <pre> element containing the JSON
 */
function openJsonModal(title, sourceId) {
  const source = document.getElementById(sourceId);
  if (!source) return;

  document.getElementById('json-modal-title').textContent = title;
  document.getElementById('json-modal-body').textContent = source.textContent;
  document.getElementById('json-modal').classList.add('visible');
}

/**
 * Closes the fullscreen modal.
 */
function closeJsonModal() {
  document.getElementById('json-modal').classList.remove('visible');
}

/**
 * Closes the modal when clicking the backdrop (outside the content).
 * Clicking inside the modal content does nothing (event doesn't propagate).
 */
function closeModalOnBackdrop(event) {
  if (event.target === document.getElementById('json-modal')) {
    closeJsonModal();
  }
}

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeJsonModal();
});


// ──────────────────────────────────────────────
// Auto-connect on page load
//
// If the user previously connected (SDK key saved in localStorage),
// skip the setup screen and connect automatically. The setup screen
// is replaced with a "Connecting..." message to avoid a flash of
// the full setup form before the store page appears.
// ──────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  const savedKey = localStorage.getItem('opti_demo_sdk_key');
  if (savedKey) {
    document.getElementById('setup-screen').innerHTML =
      '<div class="setup-card" style="text-align:center;"><h1>Connecting...</h1><p>Loading feature flags from Optimizely</p></div>';
    initializeSDK(savedKey);
  }
});
