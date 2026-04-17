# 🏨 SpectatorBot — WhatsApp Hotel Management

A zero-cost WhatsApp bot for managing hotel operations. Staff manage bookings, checkouts, payments, and reports entirely through WhatsApp commands.

## Tech Stack

| Component      | Technology                      |
|---------------|----------------------------------|
| Bot Gateway   | Twilio WhatsApp API              |
| Backend       | Node.js + Express                |
| Database      | Firebase Firestore (free tier)   |
| File Storage  | Firebase Storage (free tier)     |
| Excel Export  | ExcelJS                          |
| Scheduler     | node-cron (daily 8 AM alerts)    |
| Hosting       | Railway / Render (free tier)     |

---

## Setup Guide

### 1. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (e.g., "spectatorbot")
3. Enable **Firestore Database** (start in test mode)
4. Enable **Storage**
5. Go to **Project Settings → Service Accounts → Generate new private key**
6. Save the JSON file as `firebase-service-account.json` in the project root

### 2. Twilio Setup

1. Sign up at [twilio.com](https://www.twilio.com/)
2. Activate the **WhatsApp Sandbox** (Messaging → Try it Out → WhatsApp)
3. Note your:
   - Account SID
   - Auth Token
   - WhatsApp sandbox number (e.g., `whatsapp:+14155238886`)

### 3. Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your actual credentials:

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
FIREBASE_STORAGE_BUCKET=spectatorbot.appspot.com
OWNER_WHATSAPP=whatsapp:+91XXXXXXXXXX
```

### 4. Install & Seed

```bash
npm install

# Edit src/seed.js to add your rooms and staff phone numbers
node src/seed.js
```

### 5. Run Locally

```bash
npm run dev
```

Use [ngrok](https://ngrok.com/) to expose your local server:

```bash
ngrok http 3000
```

Set your ngrok URL as the Twilio webhook:
`https://xxxx.ngrok.io/webhook`

### 6. Deploy to Railway/Render

**Railway:**
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

**Render:**
- Connect your GitHub repo
- Set environment variables in dashboard
- Deploy

Set the deployed URL as your Twilio webhook:
`https://your-app.railway.app/webhook`

---

## Commands Reference

### Bookings
| Command | Example |
|---------|---------|
| `/book` | `/book 101 1 12Apr 15Apr 1200 cash` |
| `/edit` | `/edit AG-0041 amount 1500` |
| `/cancel` | `/cancel AG-0041` |

### Room Info
| Command | Example |
|---------|---------|
| `/status` | `/status 101` |
| `/available` | `/available today` |

### Checkout
| Command | Example |
|---------|---------|
| `/checkout` | `/checkout 101 cash` |
| `/confirm` | `/confirm AG-0041` |

### Guest ID
| Command | Example |
|---------|---------|
| `/id` | `/id AG-0041` + attach photo |

### Reports
| Command | Description |
|---------|-------------|
| `/report today` | Today's revenue & occupancy |
| `/report month` | Monthly summary |
| `/report excel` | Download Excel file |
| `/pending` | List unpaid bookings |

### Help
| Command | Description |
|---------|-------------|
| `/help` | Show all commands |

---

## Project Structure

```
spectatorbot/
├── src/
│   ├── index.js              # Express server + webhook
│   ├── seed.js               # Firestore initialization
│   ├── handlers/
│   │   ├── booking.js        # /book, /edit, /cancel
│   │   ├── checkout.js       # /checkout, /confirm
│   │   ├── help.js           # /help
│   │   ├── idUpload.js       # /id + photo
│   │   ├── reports.js        # /report, /pending
│   │   └── status.js         # /status, /available
│   ├── services/
│   │   ├── firebase.js       # Firestore + Storage init
│   │   ├── scheduler.js      # node-cron daily alerts
│   │   └── twilio.js         # WhatsApp messaging
│   └── utils/
│       ├── dates.js          # Date parsing + formatting
│       └── parser.js         # Command parser
├── .env.example
├── package.json
└── README.md
```

---

## Validation Rules

- **Double booking prevention** — overlapping dates on same room are blocked
- **Room capacity** — single rooms max 1 guest, double rooms max 2
- **Staff whitelist** — only authorized phone numbers can use the bot
- **Payment modes** — only `cash`, `upi`, `online` accepted
- **Date formats** — `12Apr`, `12/04`, `12-04`, `2024-04-12`, `today`, `tomorrow`

---

## Daily Alerts (8 AM IST)

The bot automatically sends morning alerts to the owner with:
- Rooms due for checkout today
- Pending payment reminders

No message is sent if there's nothing to report.
