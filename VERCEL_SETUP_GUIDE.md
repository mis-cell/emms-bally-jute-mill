# ⚡ EMMS — Supabase + GitHub + Vercel Setup Guide
## Electric Meter Monitoring System | Bally Jute Mill

---

## 📁 PROJECT FILES

```
emms-vercel/
├── public/
│   └── index.html          ← Full frontend (same UI as before)
├── api/
│   └── index.js            ← Vercel serverless backend (all CRUD + logic)
├── supabase_schema.sql     ← Run this in Supabase SQL Editor
├── vercel.json             ← Vercel deployment config
├── package.json
├── .gitignore
└── SETUP_GUIDE.md          ← This file
```

---

## STEP 1 — Create Supabase Project

1. Go to **https://supabase.com** → Sign up free
2. Click **"New Project"**
3. Fill in:
   - **Name**: `emms-bally-jute-mill`
   - **Database Password**: choose a strong password (save it)
   - **Region**: pick closest to you (e.g. Southeast Asia)
4. Click **"Create new project"** — wait ~2 minutes

---

## STEP 2 — Run the SQL Schema

1. In your Supabase dashboard, click **"SQL Editor"** (left sidebar)
2. Click **"New query"**
3. Open `supabase_schema.sql` from this package
4. Copy the **entire contents** and paste into the SQL editor
5. Click **"Run"** (or press Ctrl+Enter)
6. You should see: `Success. No rows returned`
7. Check **Table Editor** — you should see 8 tables created with sample data

---

## STEP 3 — Get Your Supabase Keys

1. In Supabase dashboard → **Settings** (gear icon) → **API**
2. Copy these two values:
   - **Project URL** → looks like `https://xxxxxxxxxxxx.supabase.co`
   - **service_role key** → under "Project API keys" → `service_role` (click reveal)
     ⚠️ Keep this secret — it has full database access

---

## STEP 4 — Push to GitHub

1. Create a new repository at **https://github.com/new**
   - Name: `emms-bally-jute-mill`
   - Visibility: **Private** (recommended)
   - Do NOT add README/gitignore (we have our own)

2. Open terminal in your project folder and run:
```bash
cd emms-vercel
git init
git add .
git commit -m "Initial commit — EMMS Bally Jute Mill"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/emms-bally-jute-mill.git
git push -u origin main
```

---

## STEP 5 — Deploy to Vercel

1. Go to **https://vercel.com** → Sign up / Login with GitHub
2. Click **"Add New Project"**
3. Click **"Import"** next to your `emms-bally-jute-mill` repository
4. Configure:
   - **Framework Preset**: Other
   - **Root Directory**: `./` (leave as is)
   - **Build Command**: leave empty
   - **Output Directory**: `public`
5. **Environment Variables** — add these 3:

| Name | Value |
|------|-------|
| `SUPABASE_URL` | Your Supabase Project URL |
| `SUPABASE_SERVICE_KEY` | Your Supabase service_role key |
| `RESEND_API_KEY` | (optional) Your Resend.com API key for emails |

6. Click **"Deploy"**
7. Wait ~1 minute → Vercel gives you a URL like `https://emms-bally-jute-mill.vercel.app`

---

## STEP 6 — Test the App

Open your Vercel URL and login:

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `Admin@1234` |
| Super Admin | `superadmin` | `Superadmin@1234` |
| User | `user1` | `User@1234` |

---

## STEP 7 — (Optional) Email Alerts via Resend

1. Go to **https://resend.com** → Sign up free (100 emails/day free)
2. Add and verify your domain, OR use their test domain
3. Create an API key → copy it
4. In Vercel dashboard → Your project → **Settings → Environment Variables**
5. Add `RESEND_API_KEY` = your key
6. In the app → **Settings page** → add supervisor emails
7. Redeploy: Vercel dashboard → **Deployments → Redeploy**

---

## UPDATING THE APP

Any time you change files:
```bash
git add .
git commit -m "Update: describe what changed"
git push
```
Vercel auto-deploys every push to `main`. Done.

---

## USER ROLES & PERMISSIONS

| Feature | User | Super Admin | Admin |
|---------|------|-------------|-------|
| View Dashboard | ✅ | ✅ | ✅ |
| Add Readings | ✅ | ✅ | ✅ |
| Edit Readings | ❌ | ✅ | ✅ |
| Delete Readings | ❌ | ❌ | ✅ |
| Add/Edit Workers | ❌ | ✅ | ✅ |
| Delete Workers | ❌ | ❌ | ✅ |
| Add/Edit Meters | ❌ | ✅ | ✅ |
| Delete Meters | ❌ | ❌ | ✅ |
| View All Reports | ✅ | ✅ | ✅ |
| Download CSV | ✅ | ✅ | ✅ |
| Manage Users | ❌ | ❌ | ✅ |
| Settings | ❌ | ✅ | ✅ |

---

## SUPABASE TABLES CREATED

| Table | Purpose |
|-------|---------|
| `users` | Login credentials & roles |
| `workers` | 500 worker records |
| `meters` | 500 sub-meter allocation |
| `meter_readings` | Monthly readings |
| `master_meter_readings` | Main meter readings |
| `anomalies` | Auto-detected anomalies |
| `alert_log` | Email alert history |
| `settings` | App configuration |

---

## TROUBLESHOOTING

**"Invalid credentials"**
→ Make sure you ran the full SQL schema including the INSERT INTO users section

**API returns errors**
→ Check Vercel → your project → **Functions** tab → click on `/api/index` → View logs

**Supabase connection failed**
→ Double-check your `SUPABASE_URL` (no trailing slash) and `SUPABASE_SERVICE_KEY` in Vercel env vars

**Changes not showing**
→ Always `git push` after changes — Vercel auto-deploys from GitHub

---

## ARCHITECTURE

```
Browser → Vercel CDN (index.html)
        → Vercel Serverless Function (/api/index.js)
             → Supabase PostgreSQL (REST API)
             → Resend.com (email alerts)
```

**Free tier limits:**
- Supabase: 500MB DB, 2GB bandwidth/month — plenty for 500 meters
- Vercel: 100GB bandwidth, 100,000 function calls/month — more than enough
- Resend: 100 emails/day free

---

*EMMS — Bally Jute Mill | Production-Ready Enterprise ERP*
