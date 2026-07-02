# Personal Dashboard + Sales Pipeline CRM

A dark-premium Business Operating System — 19 life/business metrics **plus a full Sales Pipeline CRM** in one place. Pure HTML/CSS/JS, no build step, no backend required.

**Live:** https://vaugnstudio-cloud.github.io/personal-dashboard/

**📘 Full instructions / SOP:** [SOP.md](SOP.md) — daily routine, backups, Google Sheets setup, editing & troubleshooting.

**🧭 Built-in help:** click **Help** (top-right on the dashboard) for an in-app guide (*Read Me*) or an interactive spotlight tutorial (*Guide Me* — full ~2 min or quick ~1 min tour). First-time visitors are offered the tour automatically.

![Dark premium dashboard tracking 19 personal metrics with goals and progress bars](#)

## What it tracks

| Section | Metrics |
| --- | --- |
| **Finance** | Current Salary, Side Income, Savings, Monthly Expenses, Emergency Fund |
| **Business** | MRR, Clients, Leads, Retainers, Website Income, Affiliate Income |
| **Content & Products** | Products, Templates Sold, Subscribers, Views, Watch Hours |
| **Health & Learning** | Weight, Hours Learned, Hours Worked |

Plus a computed hero: **Net Monthly Income**, **Total Saved**, **MRR**, **Active Clients**, and an overall progress ring across all goals.

## 🧭 Sales Pipeline (CRM)

The `Sales Pipeline` tab is a full CRM for every lead — website, cold email, LinkedIn, Instagram, referrals, returning clients, product customers:

- **19-field lead records** (business, contact, problem noticed, best offer, deal value…) in a fast table with status badges, R·C·P indicators, inline editing and a detail drawer
- **8 pipeline stages** with smart nudges (Contacted auto-fills dates; a reply advances the status)
- **Stats bar**: Pipeline Value · Due Today · Open Leads · Win Rate · Won This Month
- **Search (`/`), filter chips, column manager, sorting, bulk actions, undo, keyboard shortcuts (`N`, `↑↓`, `Enter`, `J/K`)**
- **Dashboard sync**: Leads & Active Clients auto-compute from the pipeline ("Auto · Pipeline" badge); winning a deal offers — never forces — adding the value to MRR or income
- **Follow-up digest** on load when follow-ups are due
- **Help Center** (Help button): searchable docs, Quick/Complete guides, SOPs, definitions, FAQ

## How it works

- **Click any value or goal** on a card to edit it. Enter (or click away) saves.
- Everything is stored in your **browser's localStorage** — instant, offline, private. Nothing is sent anywhere.
- Progress bars, hero totals and the overall ring **recalculate automatically** on every edit.
- "Lower is better" metrics (Monthly Expenses, Weight) count being **at or under target** as on-track.
- **Settings** (gear, top-right): currency, weight unit, your name, JSON export/import backup, reset.

## Run locally

Just open `index.html` in a browser. That's it — no install, no server needed.

## Optional: Google Sheets sync (safe for a public repo)

You can mirror your data to a private Google Sheet with two-way Push/Pull. It works via a tiny **Google Apps Script Web App you deploy under your own account** — so this public repo never contains any API key or personal data. The Web App URL is stored only in your browser.

1. Create a new [Google Sheet](https://sheets.new).
2. **Extensions → Apps Script**, delete the default code, paste in [`apps-script/Code.gs`](apps-script/Code.gs), save.
3. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone with the link**
4. Copy the Web App URL (ends in `/exec`).
5. In the dashboard: **Settings → Google Sheets sync**, paste the URL.
6. Click **Push to Sheet** to write your current numbers, or **Pull from Sheet** after editing the sheet directly.

> The "Anyone with the link" setting applies to the script endpoint only, and the URL is unguessable and never published. Your spreadsheet itself stays private. Don't share the URL and don't commit it anywhere.

## Stack

Vanilla HTML + CSS + JS. Fonts: [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) & [Inter](https://fonts.google.com/specimen/Inter). Hosted on GitHub Pages.

---

Designed & tracked by [Vaugn Studio](https://vaugn-portfolio.vercel.app).
