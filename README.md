# Feature Experimentation Demo

A single-page demo site that shows how Optimizely Feature Flags work from the customer's perspective. Built for a mentorship session on feature flag architecture.

**Live demo:** [https://your-username.github.io/feature-experimentation-demo](https://your-username.github.io/feature-experimentation-demo)

## What This Demo Shows

The demo is a fake e-commerce page ("Opti Coffee") with **5 feature flags** controlling visible UI elements, each demonstrating a different use case:

| Flag Key | Use Case | What Changes |
|----------|----------|-------------|
| `dark_mode` | **Feature Rollout** | Toggles the entire page between light and dark theme |
| `promo_banner` | **Feature Rollout** | Shows/hides a promotional banner |
| `checkout_button` | **A/B Experiment** | Users get different button styles (grey "Add to Cart" vs green "Buy Now") |
| `pricing_display` | **A/B Experiment with Variables** | Users see different pricing ($14.99 one-time vs $9.99/mo subscription) |
| `vip_section` | **Targeted Delivery** | Only users with `plan: premium` see the VIP perks section |

## Setup

### 1. Create Flags in Optimizely

Go to [app.optimizely.com](https://app.optimizely.com) and create a **Feature Experimentation** project.

Create the following 5 feature flags:

#### `dark_mode`
- Type: Simple on/off rollout
- No variations needed
- Toggle ON/OFF to switch between light and dark theme

#### `promo_banner`
- Type: Simple on/off rollout
- No variations needed
- Just toggle ON/OFF to show/hide the banner

#### `checkout_button`
- Type: A/B Experiment with 2 variations
- Variation A (control): default button
- Variation B: new button style
- Set traffic allocation to 50/50

#### `pricing_display`
- Type: A/B Experiment with variables
- Add a variable: `price_text` (string type)
- Variation A: `price_text` = `$14.99`
- Variation B: `price_text` = `$9.99/mo`
- Set traffic allocation to 50/50

#### `vip_section`
- Type: Targeted delivery
- Create an audience: `Premium Users` where `plan` equals `premium`
- Deliver to the `Premium Users` audience only

### 2. Get Your SDK Key

In Optimizely: **Settings** → **Environments** → Copy the **SDK Key** for your environment (e.g., Production).

### 3. Open the Demo

Open `index.html` in a browser (or visit the GitHub Pages URL), paste your SDK Key, and click **Connect & Launch Demo**.

## How to Demo

1. Open the demo site in one browser tab
2. Open [app.optimizely.com](https://app.optimizely.com) in another tab
3. Toggle `dark_mode` ON → the entire page switches to dark theme within ~30 seconds
4. Toggle `promo_banner` ON → a promotional banner appears at the top
5. Change the **User ID** in the control panel → see how different users get different A/B test variations (checkout button, pricing)
6. Change **plan** from `free` to `premium` → the VIP section appears (targeted delivery)
7. Toggle flags OFF → UI elements revert instantly

## Hosting on GitHub Pages

```bash
# 1. Create a new GitHub repo
gh repo create feature-experimentation-demo --public

# 2. Push the code
git init
git add .
git commit -m "Initial commit: feature flag demo site"
git remote add origin https://github.com/YOUR_USERNAME/feature-experimentation-demo.git
git branch -M main
git push -u origin main

# 3. Enable GitHub Pages
# Go to repo Settings → Pages → Source: Deploy from branch → Branch: main → Save
```

Your site will be live at `https://YOUR_USERNAME.github.io/feature-experimentation-demo/`

## Tech Stack

- Single HTML file (no build tools)
- Vanilla JavaScript
- [Optimizely JavaScript SDK](https://www.npmjs.com/package/@optimizely/optimizely-sdk) via CDN
- Hosted on GitHub Pages (free static hosting)
