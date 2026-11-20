# KRS Plantain Wholesale Billing — Ubuntu Linux Deployment Guide
### കെ.ആർ.എസ് പ്ലാന്റയിൻ മർച്ചന്റ് & കമ്മീഷൻ ഏജന്റ്
**വാഴിച്ചേരി മാർക്കറ്റ്, ആലപ്പുഴ - 688001 | ഫോൺ: 9447304307**

This document covers all options for deploying the billing application on **Ubuntu Linux (20.04 LTS, 22.04 LTS, 24.04 LTS)**.

---

## 🚀 Quick Automated Installation (Recommended)

Copy the project folder to your Ubuntu system, open Terminal, and run:

```bash
cd KRS_Billing
chmod +x scripts/install_ubuntu.sh
./scripts/install_ubuntu.sh
```

The script automatically:
1. Installs Node.js 20 LTS, build tools (`gcc`, `g++`, `make`, `python3`), and `libfuse2`.
2. Installs Malayalam fonts (`fonts-noto-core`, `fonts-smc-*`) for sharp regional text and invoice printing.
3. Compiles `better-sqlite3` native binaries for Linux.
4. Builds production assets and desktop packages (`.deb` & `.AppImage`).
5. Adds a desktop launcher icon in Ubuntu's Application Menu.

---

## 🛠️ Step-by-Step Manual Deployment

If you prefer installing manually step-by-step, follow these instructions:

### Step 1: Install System Prerequisites
```bash
sudo apt update
sudo apt install -y curl git build-essential python3 make g++ libfuse2 fonts-noto-core fonts-smc-* cups printer-driver-gutenprint
```

### Step 2: Install Node.js (v20 LTS)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```
Verify versions:
```bash
node -v   # Should be v20.x or higher
npm -v    # Should be 10.x or higher
```

### Step 3: Install Project Dependencies
```bash
cd KRS_Billing
npm install
```
*(This automatically compiles the local `better-sqlite3` driver on your Linux kernel).*

### Step 4: Build Frontend Assets
```bash
npm run build:frontend
```

### Step 5: Choose the Environment

`KRS_ENV` (or `NODE_ENV`) controls demo data seeding:

| Environment | Command | Demo customers |
|:---|:---|:---|
| **Production** (shop) | `npm start` / `npm run start:server` | ❌ Never seeded |
| **Development** | `npm run dev` | ✅ Seeded when empty |
| **Test** | `npm test` (uses a temp DB) | ✅ Seeded |

- Default banana varieties are always created — billing needs them.
- Sample permanent/walk-in customers are **only** created in development/test.
- A production database starts with an **empty customer list**; add real buyers from the **Customers** tab.
- Existing data is never deleted — seeding only fills empty tables.
- To keep test/staging data separate from shop data, use a custom folder:
  ```bash
  KRS_ENV=test PORT=4568 KRS_DATA_DIR=/tmp/krs-test-db node server/index.js
  ```

---

## 📦 Deployment Methods on Ubuntu

Choose the method that best matches your shop's counter setup:

### Option A: Standalone Desktop Application (Ubuntu Counter PC)

#### 1. Direct Run via NPM:
```bash
npm start
```
*Launches Electron immediately with the embedded Express backend and SQLite database.*
*Runs in **production** mode (`KRS_ENV=production`) with **no demo customers**.*

#### 2. Package as a Native Ubuntu `.deb` Package:
```bash
npm run build:linux
```
This generates installer files inside the `release/` folder:
- `release/krs-banana-wholesale-billing_1.0.0_amd64.deb`
- `release/KRS Banana Wholesale Billing-1.0.0.AppImage`

Install the `.deb` file into Ubuntu system apps:
```bash
sudo dpkg -i release/krs-banana-wholesale-billing_1.0.0_amd64.deb
```
Now you can search for **"KRS Banana Wholesale Billing"** in the Ubuntu App launcher or pin it to the Dock.

#### 3. Run Standalone AppImage:
```bash
chmod +x release/*.AppImage
./release/*.AppImage
```

---

### Option B: 24/7 Web POS Service (Local Shop Network / Multi-Device Access)

If you want the billing system to be accessible across multiple devices (e.g., counter PC, secondary billing laptop, tablet, or mobile phone connected to the shop's Wi-Fi router), run the backend as a background Linux service:

#### 1. Setup Systemd Service:
Edit the service file:
```bash
sudo cp scripts/krs-billing.service /etc/systemd/system/
sudo nano /etc/systemd/system/krs-billing.service
```
Update `User` (e.g. `ubuntu`) and `WorkingDirectory` (e.g. `/home/ubuntu/KRS_Billing`), then save (`Ctrl+O`, `Enter`, `Ctrl+X`).

#### 2. Enable and Start the Service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable krs-billing
sudo systemctl start krs-billing
sudo systemctl status krs-billing
```

#### 3. Access Billing:
- On the Ubuntu PC: `http://localhost:4567`
- On other shop devices over Wi-Fi / LAN: `http://<UBUNTU_IP_ADDRESS>:4567`
  *(Find IP using `hostname -I` or `ip a`)*

> 🏭 The service file sets `NODE_ENV=production` and `KRS_ENV=production`, so the web POS starts with **no demo customers**. Verify with:
> ```bash
> curl http://localhost:4567/api/health
> ```
> The response should show `"environment":"production"`.

#### 4. Optional: Run a Separate Test / Staging Instance
Never mix test data with the shop database. Use a different port and data folder:
```bash
KRS_ENV=test PORT=4568 KRS_DATA_DIR=/tmp/krs-test-db node server/index.js
```
Open `http://localhost:4568`. This instance seeds demo customers and stores its data in `/tmp/krs-test-db`.

To run the automated test suite (isolated temporary database):
```bash
npm test
```

---

## 🖨️ Printer Setup on Ubuntu (Canon PIXMA G3000 Series)

1. Connect the Canon PIXMA G3000 printer via **USB** or connect it to your shop Wi-Fi router.
2. Open **Ubuntu Settings** → **Printers** → Click **Add Printer**.
3. Ubuntu will automatically detect the **Canon PIXMA G3000 series**.
4. Select the driver:
   - For USB / Network: Choose **Canon G3000 series - CUPS+Gutenprint** or **IPP Everywhere**.
5. Set Default Paper Size to **A5** (or A4 Half Size) in Printer Options.
6. Print a test page from Ubuntu Settings to verify.

---

## 💾 Database Location & Backup on Ubuntu

- **Database file location (Desktop Electron App)**:
  `~/.config/krs-banana-wholesale-billing/database/krs_banana_billing.db`
- **Database file location (Headless Web Service)**:
  `~/.krs_billing/krs_banana_billing.db`
- **Custom location**: set `KRS_DATA_DIR=/path/to/folder` for any environment.
  Use this to keep test/staging databases separate from production.

> ℹ️ Switching an existing database to production does **not** remove customers that were created earlier (including demo customers from a previous development run). Seeding only affects empty tables. Start with a fresh `KRS_DATA_DIR` for a clean production database, delete the demo customers in the Customers screen, or use the cleanup command below.

### Remove Demo Customers from an Existing Database
The cleanup tool deletes only the exact demo rows created by the seed (name + phone match). It is a dry run unless `--yes` is passed, and it never deletes bills:

```bash
cd /path/to/KRS_Billing

# Electron desktop app database
export KRS_DATA_DIR="$HOME/.config/krs-banana-wholesale-billing/database"

# Headless web service database instead:
# export KRS_DATA_DIR="$HOME/.krs_billing"

npm run clean:demo              # preview — changes nothing
npm run clean:demo -- --yes     # delete the demo customers
```

Real customers and bills remain. If a demo customer is referenced by an old bill, only the customer link is cleared; the invoice keeps its stored display name.

### Backup Command (Daily Backup):
```bash
cp ~/.config/krs-banana-wholesale-billing/database/krs_banana_billing.db ~/Desktop/krs_backup_$(date +%F).db
```
To automate daily backups at 10 PM, add a cron job with `crontab -e`:
```bash
0 22 * * * cp ~/.config/krs-banana-wholesale-billing/database/krs_banana_billing.db ~/Documents/krs_backup_$(date +\%F).db
```
