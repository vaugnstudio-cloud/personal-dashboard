# 📊 Personal Dashboard — SOP & Full Instructions

**Owner:** Vaugn Almeida (Vaugn Studio)
**Last updated:** July 2, 2026

---

## 1. Quick Links

| What | Link |
| --- | --- |
| 🌐 **Live dashboard** (use this daily) | https://vaugnstudio-cloud.github.io/personal-dashboard/ |
| 📦 **GitHub repo** (the code) | https://github.com/vaugnstudio-cloud/personal-dashboard |
| 📁 **Local folder** (on your PC) | `C:\Users\vjalm\OneDrive\Documents\Graphic Designer\Claude AI Folder\personal-dashboard` |
| 📄 **Google Sheets script** | [`apps-script/Code.gs`](apps-script/Code.gs) in this repo |
| ➕ **Create a new Google Sheet** | https://sheets.new |
| ⚙️ **GitHub Pages settings** | https://github.com/vaugnstudio-cloud/personal-dashboard/settings/pages |

> 💡 **Bookmark the live dashboard** on your phone and desktop browser. On mobile: open it in Chrome/Safari → Share → **Add to Home Screen** — it behaves like an app.

---

## 2. What each file is (plain English)

```
personal-dashboard/
├── index.html              ← THE WEBSITE ITSELF (see below)
├── SOP.md                  ← this document
├── README.md               ← short overview shown on the GitHub repo page
├── .gitignore              ← tells Git which files to never upload
├── apps-script/
│   └── Code.gs             ← the Google Sheets sync script (you paste this into Google, once)
└── assets/
    ├── css/
    │   └── styles.css      ← ALL the visual design: colors, fonts, cards, animations
    └── js/
        ├── data.js         ← the list of your 19 metrics, their groups, icons & default goals
        ├── store.js        ← saving/loading your numbers (localStorage + backup import/export)
        ├── app.js          ← the brains: renders cards, handles editing, computes hero totals
        └── sheets-sync.js  ← the optional Push/Pull to Google Sheets
```

### ❓ What is `index.html`?

`index.html` is **the homepage of your website** — the single page browsers open first. When someone visits your live URL, GitHub Pages automatically serves `index.html` (that's a universal web convention — "index" = the default page of a folder).

It contains the page **structure** (header, hero, settings drawer) and loads the other files:
- `styles.css` → makes it look good
- the four `.js` files → make it work

You can double-click `index.html` on your PC and it opens the dashboard **offline** — no internet or server needed.

---

## 2.4 Sales Pipeline (CRM) 🧭

The **Sales Pipeline** tab (top navigation) is your CRM — every lead from every channel, tracked from first touch to Won or Lost.

**Daily driver:** press <kbd>N</kbd> to add a lead → fill Business Name + Channel + Follow-Up Date (everything saves as you type) → each morning click the **⚠ Due** chip and clear your follow-ups. Click any status badge to move a deal through the 8 stages. Winning a deal asks (never forces) to add the money to your dashboard's MRR or income. **Leads** and **Active Clients** on the dashboard update automatically from the pipeline.

Full documentation — including the Sales SOP, Follow-Up SOP, Proposal SOP and the Daily/Weekly/Monthly/Quarterly operating rhythm — lives in the **Help Center** (Help button on any page). The pipeline has its own JSON backup: **⋯ menu → Export JSON backup** (do it monthly, same as the dashboard one).

---

## 2.5 Built-in help (fastest way to learn) 🧭

The dashboard teaches itself — click **Help** in the top-right corner:

- **📖 Read Me** — this guide, condensed and styled, right inside the dashboard.
- **🧭 Guide Me** — an interactive spotlight tutorial that walks you through every feature step by step. Choose the **Full tour (~2 min, 12 steps)** or **Quick tour (~1 min, 6 steps)**. It even has you edit a real value mid-tour. Navigate with **Next / Previous**, and press **Escape** anytime to get an exit confirmation.
- First-time visitors on a new browser are offered the tour automatically (one-time welcome card).
- The same options live in **Settings → How to use**.

---

## 3. Daily use (the 60-second routine)

1. Open the **live dashboard**: https://vaugnstudio-cloud.github.io/personal-dashboard/
2. **Click any number** on a card (e.g. `$0` under *Side Income*).
3. Type the new value → press **Enter** (or click anywhere else). ✅ Saved instantly.
4. To change a target, click the small **Goal / Target** number under the big value.
5. Watch the progress bars, the hero stats (Net Monthly Income, Total Saved, MRR, Clients) and the **overall ring** update automatically.

That's it. No save button, no login.

### How progress is measured
- **Normal metrics** (income, subscribers, hours…): progress = value ÷ goal. Hit the goal → green ✓ badge.
- **"Lower is better" metrics** (⚠️ Monthly Expenses, Weight): you're **on track when at or under target**. Going over shows how much you're over.

### Suggested cadence
| When | Do |
| --- | --- |
| **Weekly (Mon, 5 min)** | Update Leads, Clients, Hours Worked, Hours Learned, Weight |
| **Monthly (1st, 10 min)** | Update all Finance numbers, MRR, Views, Watch Hours, Subscribers, Templates Sold, then **Export JSON** backup |
| **Quarterly** | Review and raise your goals 🎯 |

---

## 4. ⚠️ Important: where your data lives

Your numbers are saved in your **browser's localStorage** — private, offline, never uploaded anywhere. This means:

- ✅ Nothing personal is in the public GitHub repo. Ever.
- ⚠️ Data is **per browser, per device**. Your phone and laptop each start at $0 until you enter numbers (or sync — see section 6).
- ⚠️ Clearing browser data/history **erases the dashboard's numbers**. Protect yourself with backups:

### Backup (do this monthly)
1. Click **Settings** (top-right gear) → **Backup** → **Export JSON**.
2. A file like `dashboard-backup-2026-07-02.json` downloads. Store it in your OneDrive.
3. To restore (or move to a new device): Settings → **Import JSON** → pick the file.

---

## 5. Settings reference (gear icon, top-right)

| Setting | What it does |
| --- | --- |
| **Your name** | Changes the greeting ("Good morning, Vaugn.") |
| **Currency** | USD / EUR / GBP / PHP / AUD / CAD — reformats every money value |
| **Weight unit** | lbs or kg |
| **Google Sheets sync** | Paste your Apps Script URL, then Push/Pull (section 6) |
| **Export / Import JSON** | Backup & restore everything |
| **Reset all data** | ⚠️ Wipes this browser back to defaults (asks to confirm) |

---

## 6. Google Sheets sync — one-time setup (~5 min)

This gives you a private spreadsheet copy of your data and lets you move numbers between devices. **Optional** — the dashboard works fully without it.

### Setup
1. Create a new sheet: https://sheets.new (name it e.g. *Dashboard Data*).
2. Menu: **Extensions → Apps Script**.
3. Delete the placeholder code. Open [`apps-script/Code.gs`](https://github.com/vaugnstudio-cloud/personal-dashboard/blob/main/apps-script/Code.gs), copy **all** of it, paste it in. Click 💾 Save.
4. Click **Deploy → New deployment**. Click the ⚙ gear next to "Select type" → choose **Web app**.
   - Description: `dashboard sync`
   - Execute as: **Me**
   - Who has access: **Anyone with the link**
5. Click **Deploy** → **Authorize access** → choose your Google account → (if it warns "unverified app": **Advanced → Go to project**) → **Allow**. This is safe — it's *your own* script on *your own* account; Google shows that warning for any personal script.
6. **Copy the Web app URL** (ends in `/exec`).
7. Open the dashboard → **Settings → Google Sheets sync** → paste the URL (it saves automatically and stays only in your browser).
8. Click **Push to Sheet** → open your Google Sheet → a **Dashboard** tab appears with all 19 metrics. ✅ Done.

### Daily sync use
- **Push to Sheet** = browser ➜ sheet (after updating the dashboard)
- **Pull from Sheet** = sheet ➜ browser (after editing the sheet directly, or on a new device)

### Sync to a second device (e.g. your phone)
1. Do the setup above once on any device and **Push**.
2. On the phone: open the live dashboard → Settings → paste the **same URL** → **Pull from Sheet**.

### 🔒 Security rules
- **Never** paste the Web App URL into the repo, a screenshot, or a public post. It's the only "key".
- The spreadsheet itself stays private to your Google account.
- If the URL ever leaks: Apps Script → Deploy → Manage deployments → **Archive** it, then create a new deployment and update the URL in Settings.

---

## 7. Making changes to the website (edit → publish)

The live site updates automatically whenever you push to GitHub. Workflow:

1. Edit files in the local folder (`personal-dashboard/`) — or just ask Claude Code to do it.
2. Publish (in a terminal, inside the folder):
   ```
   git add -A
   git commit -m "Describe what changed"
   git push
   ```
3. Wait ~1 minute → hard-refresh the live site (**Ctrl+Shift+R**).

### Common edits & where to make them
| I want to… | Edit this |
| --- | --- |
| Add / remove / rename a metric, change default goals or icons | `assets/js/data.js` (the `METRICS` list — copy an existing line) |
| Change colors, fonts, spacing | `assets/css/styles.css` (`:root` tokens at the top) |
| Change how Net Monthly Income is calculated | `assets/js/app.js` (the `HERO` array) |
| Change page title / headline text | `index.html` |

---

## 8. Troubleshooting

| Problem | Fix |
| --- | --- |
| Live site shows $0 everywhere | Normal on a new device/browser — data is per-browser. Import a JSON backup or Pull from Sheet. |
| My numbers vanished | Browser data was cleared. Restore: Settings → Import JSON (or Pull from Sheet). |
| Push/Pull says "Add your Apps Script URL" | Paste the `/exec` URL in Settings first (must start with `https://script.google.com/`). |
| Push/Pull fails or spins | Re-check step 4 of setup: Execute as **Me**, access **Anyone with the link**. Re-deploy and use the NEW URL. |
| Site didn't update after `git push` | Wait 1–2 min, then hard-refresh (Ctrl+Shift+R). Check build: repo → Actions / Settings → Pages. |
| An edit broke the page | In the repo: `git log` to find the last good commit → `git revert <commit>` → push. |
| Goal won't save | Goals must be greater than 0. |

---

## 9. FAQ

**Is my financial data public because the repo is public?**
No. The repo contains only code and default zeros. Your real numbers exist only in your browser and (optionally) your private Google Sheet.

**Can I use it offline?**
Yes — double-click `index.html` in the local folder. (Sheets sync needs internet, everything else works.)

**Can I add a 20th metric?**
Yes — add one line to `METRICS` in `assets/js/data.js`, push, done. It automatically gets a card, progress bar and storage.

**What does "MRR" include in the hero?**
Net Monthly Income = Salary + Side Income + Website Income + Affiliate Income + Retainers + MRR − Monthly Expenses.

---

*Built July 2026 · Vanilla HTML/CSS/JS · Hosted free on GitHub Pages · Designed by Vaugn Studio*
