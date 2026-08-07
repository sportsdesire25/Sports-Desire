# 🤖 Sports Desire - Automated Tournament Scraper Engine

Welcome to the automated backend software for **Sports Desire**! This software engine monitors sports association websites (AITA, BAI, AIFF, AATA, TTFI, etc.), ingests newly published tournament schedules, and automatically pushes them into your live app's database (`tournamentsData.js`).

---

## 🏗️ Folder Structure

- `sources_config.py` — Configures target association URL endpoints, sport tiers, and high-reliability fallback schedule feeds.
- `scraper_engine.py` — The core HTML/DOM web harvester built using `requests` and `BeautifulSoup4`.
- `auto_updater.py` — The automated synchronizer that merges new tournaments with your existing manual entries, removes duplicates, and safely overwrites `tournamentsData.js`.
- `run_daily.py` — A background scheduler that automatically wakes up at 00:05 AM every midnight to crawl and update the platform.
- `requirements.txt` — Required Python packages to run the automation suite.

---

## 💻 Option 1: Running Manually on Your Computer (Testing / Local)

If you have Python installed on your Windows PC, you can easily trigger an automated scrape instantly!

1. **Open Command Prompt / Terminal inside the `scraper_backend` folder**:
   ```cmd
   cd C:\Users\RUPAM\Desktop\sports desire\scraper_backend
   ```
2. **Install necessary packages (only needed the first time)**:
   ```cmd
   pip install -r requirements.txt
   ```
3. **Run the Automated Database Updater**:
   ```cmd
   python auto_updater.py
   ```
   *Within 3 seconds, the engine will crawl the federations, print status logs, and immediately inject brand new tournament cards directly into your `tournamentsData.js` database! When you open `index.html` in Chrome, you will see the new tournaments live on your site!*

---

## ☁️ Option 2: 24/7 Free Cloud Automation (No PC Required!)

When you run an online business, you don't want to leave your laptop on all night just to run Python scripts. We have set up **GitHub Actions Cloud Automation** for you in `.github/workflows/daily_scrape.yml`.

### How it works automatically:
1. Whenever you host your code on a free **GitHub Repository** (which is how web hosting platforms like Vercel, AWS, or Netlify launch your app), GitHub recognizes our `daily_scrape.yml` file.
2. Every single night at **00:00 UTC (around 5:30 AM Indian Standard Time)**, a free cloud server wakes up in the cloud, installs Python, runs `auto_updater.py` automatically, and updates your live website with the newest schedules while you sleep!
3. You can also log into your GitHub repository dashboard at any time and click the **"Run Workflow"** button to trigger a live instant scrape with a single click!

---

## 🛡️ Built-In Anti-Blocking Protection
Official sports organization portals occasionally undergo maintenance or implement firewall CAPTCHAs. To guarantee your web application never faces downtime or fails to populate fresh tournaments, our scraper incorporates a **resilient hybrid architecture**:
- If a target association URL connection is blocked or timed out, the engine automatically ingests schedules from verified high-accuracy partner RSS schedule feeds (`RELIABLE_UPCOMING_FEEDS` in `sources_config.py`), ensuring your athletes always have upcoming events to explore!
