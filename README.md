# KRS Plantain Merchant & Commission Agent
### കെ.ആർ.എസ് പ്ലാന്റയിൻ മർച്ചന്റ് & കമ്മീഷൻ ഏജന്റ്
**വാഴിച്ചേരി മാർക്കറ്റ്, ആലപ്പുഴ - 688001 | Ph: +91 94473 04307**

An offline-first standalone desktop billing and Point-of-Sale (POS) application tailored for Kerala wholesale plantain trade.

Built with **Electron**, **React (Vite)**, **Tailwind CSS**, **Node.js + Express**, and **SQLite (better-sqlite3)**.

---

## 🍌 Key Features

### 1. Authentic KRS Signboard Branding & Custom Logo
- **Theme**: Styled in the signature **Emerald Jade / Plantain Green** palette (`#156b46`) matching the physical KRS outdoor signboard.
- **Banana Tree Emblem**: Hand-stamped Kerala banana tree with bunch (വാഴക്കുല & വാഴച്ചുണ്ട്) featured on the desktop header and printed invoices.
- **Bilingual Interface**: Seamless toggle between **English** and **മലയാളം** for screen UI and printed receipts.

### 2. A4 Half Size Invoicing & Dynamic UPI QR Code
- **A4 Half Size (A5: 148 × 210 mm) Default**: Optimized for continuous ink-tank printers like **Canon PIXMA G3000 series**.
- **Dynamic "Scan & Pay" QR Code**: Pre-fills the exact bill amount, invoice number, and HDFC Vyapar UPI VPA (`Vyapar.178760240373@hdfcbank`). Scannable by Google Pay, PhonePe, Paytm, BHIM, and all UPI apps.
- **Order Notice**: Replaced generic terms with **"🍃 Banana Leaves are sold based on order"** / **"🍃 വാഴയിലകൾ ഓർഡർ അനുസരിച്ച് നൽകുന്നതാണ്"**.

### 3. Stem & Bunch Waste Live Calculations
$$\text{Total Stem Waste (kg)} = \text{Bunches} \times \text{Waste per Bunch (kg)}$$
$$\text{Net Weight (Billable Weight)} = \text{Gross Weight} - \text{Total Stem Waste}$$
$$\text{Line Subtotal (₹)} = \text{Net Weight} \times \text{Editable Rate per kg}$$
- Rate per kg and Stem waste per bunch auto-fill on variety selection and remain immediately editable per row.

### 4. Varieties (Default Kerala Varieties)
| English Name | Malayalam Name | Default Rate/kg | Default Stem Waste/Bunch |
|:---|:---|:---:|:---:|
| **Ethan** | ഏത്തൻ | ₹48.00 | 0.50 kg |
| **Robusta** | റോബസ്റ്റ | ₹30.00 | 0.60 kg |
| **Poovan** | പൂവൻ | ₹36.00 | 0.40 kg |
| **Njalipoovan** | ഞാലിപ്പൂവൻ | ₹52.00 | 0.35 kg |
| **Palayankodan** | പാളയൻകോടൻ | ₹24.00 | 0.45 kg |

---

## ⌨️ POS Keyboard Shortcuts
- `F1`: POS Billing Screen
- `F2`: Bills History
- `F3`: Customers Directory (with frequent walk-ins promotion)
- `F4`: Banana Varieties Configuration
- `Alt + A`: Add Line Item row
- `Alt + C`: Clear current bill
- `F9` or `Ctrl + S`: Save & Print Invoice

---

## 🐧 Ubuntu Linux Deployment
To deploy this application on **Ubuntu Linux (20.04 / 22.04 / 24.04 LTS)**:
- Run the automated installer:
  ```bash
  chmod +x scripts/install_ubuntu.sh
  ./scripts/install_ubuntu.sh
  ```
- Or see full step-by-step instructions in [UBUNTU_DEPLOYMENT.md](file:///Users/archulal/bannana-sellling/KRS_Billing/UBUNTU_DEPLOYMENT.md) for desktop (`.deb` / `.AppImage`), Canon PIXMA G3000 printer configuration, and 24/7 background systemd service setup.

