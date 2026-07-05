# Vaugn Studio

**The freelancer's business operating system.** A dark-premium dashboard + sales pipeline CRM + reports that runs entirely in your browser — no accounts, no subscriptions, no backend. Pure HTML/CSS/JS.

**To run it:** double-click `index.html`. See `START-HERE.txt` for the 2-minute setup.

## What's inside

| Surface | What it does |
| --- | --- |
| **📊 Dashboard** | 19 metrics across Finance, Business, Content & Health — each with a goal and progress bar. Click any number to edit; hero stats (Net Monthly Income, Total Saved, MRR, Active Clients) compute themselves. |
| **🧭 Sales Pipeline** | A real CRM: 19-field lead records, 8 colored stages, follow-up dates that turn red when late, win rate, deal values, bulk actions, keyboard shortcuts. Marks a deal Won → asks to update your dashboard money. |
| **📈 Reports** | Charts (revenue, funnel, channel performance), a period-based generated report, and a built-in insights engine that reads your data and tells you what to fix next. |

**It teaches itself:** interactive guided tours (2-min or 1-min), a searchable Help Center with real sales SOPs, and first-visit onboarding.

## Principles

- **Private by design.** Everything lives in your browser's localStorage. Nothing is uploaded — ever. Optional Google Sheets sync runs on *your own* Google account.
- **Fast.** Zero dependencies, no build step, loads instantly, works offline.
- **Opinionated.** One layout, one theme, no configuration maze. Simple enough for 5 minutes a day, powerful enough to run a business.

## Run it

Open `index.html` in a browser. That's the whole install.

To host it online free: fork/upload this folder to a GitHub repo → Settings → Pages → deploy from `main`. Done in 5 minutes.

## Optional: Google Sheets sync

Two-way sync (dashboard metrics + pipeline leads) to a private sheet via a tiny Apps Script you deploy under your own account — no API keys anywhere. Full walkthrough in the in-app **Help Center → Google Sheets Sync**, script in [`apps-script/Code.gs`](apps-script/Code.gs).

## ⚠️ Back up your data

Everything lives in your browser (localStorage) — private and offline, but **clearing your browser erases it**. Once a month, open **Settings → Backup** and export the two JSON files, or set up Google Sheets sync for automatic backup. The app also reminds you if it's been a while.

## License

Personal / single-business use. Don't resell or redistribute the code. See [LICENSE.md](LICENSE.md).

## Stack

Vanilla HTML/CSS/JS · [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) & [Inter](https://fonts.google.com/specimen/Inter) · localStorage-first · optional Google Apps Script sync.
