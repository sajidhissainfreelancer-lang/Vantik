# Rnexa

Portfolio + admin site for **Sajid Hussain**, freelance web developer.
React + Vite on the frontend, Supabase for data and login, deployed on Render.

- Public site: hero, live client counters, an industry-by-industry sample-site gallery
  (gym, restaurant, car dealership, real estate, salon, clinic, education, e‑commerce,
  logistics) — each with real photography, a trust-badge marquee, stats, feature cards,
  a gallery and pricing tiers, laid out like a proper sales page — plus services, about
  and contact sections with scroll-in animation and 3D hover effects.
- **22 switchable design styles** (Minimalism, Maximalism, Futuristic, Vector Art,
  Collage Art, Retro, Pop Art, Glassmorphism, Neumorphism, Cyberpunk, Clay, Pixel Art,
  Editorial, Y2K, Swiss Design, Surreal, Bohemian, Victorian, Graffiti, Aurora,
  Handwritten, Liquid Glass) — pick one from `/admin` and your whole public site
  re-themes instantly (colors, fonts, corners, shadows, a few signature effects).
  The sample industry demo sites keep their own per-industry branding regardless,
  since those represent separate client businesses, not Rnexa itself. Every theme's
  button and accent-text colors are checked against its own background so none of
  them go unreadable (an earlier version had this bug on a few pastel themes — fixed).
- `/admin` is a full **business dashboard**, not just a content editor:
  - **Overview** — revenue and client snapshot at a glance, plus the homepage counters
  - **Clients** — a private CRM: leads, active work, completed and lost clients,
    tagged by product line (Website / SaaS Tool / Both)
  - **Invoices** — your accountant's view: amounts, paid / pending / overdue status,
    running totals, one-click "mark paid"
  - **Projects** — the portfolio pieces shown on the public homepage
  - **Theme** — the 22-style picker
  - Every list (Clients, Invoices, Projects) has a **CSV export** button — instant
    downloadable reports, no server involved.
- Responsive top to bottom — grids, type and images all step down for phones.

## 1. Run it locally

```bash
npm install
npm run dev
```

The `.env` file already has your Supabase project's URL and anon key in it
(see `.env.example` for the format). `.env` is git-ignored on purpose — see the
security note at the bottom.

## 2. Set up Supabase (one-time)

1. Open your Supabase project → **SQL Editor** → New query.
2. Paste the contents of `supabase/schema.sql` and run it — every time this file
   changes, it's safe to re-run top-to-bottom (tables use `if not exists`, policies
   are dropped and recreated). This creates:
   - `settings` — the counters + active theme shown on the public homepage.
   - `projects` — the portfolio pieces shown under "Recent client work."
   - `clients` — your private CRM. **No public-read policy at all** — only a
     signed-in session can see this table.
   - `invoices` — your private billing record. Same lockdown as `clients`.
   - Row Level Security on all four: `settings`/`projects` are publicly readable
     (so the site works) but only writable when signed in; `clients`/`invoices`
     are neither readable nor writable by anyone who isn't signed in — not even
     with the public anon key.
3. Create yourself an admin login: **Authentication → Users → Add user**, enter
   an email and password. That's what you sign in with at `/admin/login` —
   there's no public sign-up form, on purpose.

## 3. Push to GitHub

```bash
git init
git add .
git commit -m "Rnexa — initial build"
git branch -M main
git remote add origin https://github.com/<your-username>/rnexa.git
git push -u origin main
```

## 4. Deploy on Render

This repo includes a `render.yaml`, so Render can pick up the build settings
automatically ("New +" → "Blueprint" → select the repo). If you'd rather set
it up by hand instead:

1. **New +** → **Static Site** → connect the `rnexa` repo.
2. Build command: `npm install && npm run build`
3. Publish directory: `dist`
4. **Environment** tab → add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. **Redirects/Rewrites** tab → add a rewrite rule so React Router works on
   refresh/direct links: source `/*` → destination `/index.html`, type `Rewrite`.
   (`render.yaml` already sets this for you if you deploy via Blueprint.)

## Editing things after launch

| Want to change... | Where |
|---|---|
| Your site's whole visual style | `/admin` → Theme tab (22 presets) |
| "19+ clients" / "21 projects" numbers | `/admin` → Overview tab |
| Track a client, lead, or invoice | `/admin` → Clients / Invoices tabs |
| Download a Clients, Invoices or Projects report | `/admin` → that tab → Export CSV |
| Add a real client project to the homepage | `/admin` → Projects tab |
| The sample industry demo sites (gym, car, etc.), their photos, pricing | `src/data/industries.js` — plain data, no build tooling needed to understand it |
| Your name, WhatsApp number, email | `src/data/site.js` |
| Your photo | replace `public/sajid.jpg` |
| The gold-R logo mark | `src/components/Brand.jsx` |
| Add / tweak a design theme's colors, font, radius | `src/styles/themes.css` (and `src/data/themes.js` for the admin picker label) |

## Project structure

```
src/
  components/     Navbar, Footer, Brand (logo mark), TiltCard, Reveal, BrowserFrame, ProtectedRoute
  data/           site.js (your details), industries.js (sample-site content), themes.js (theme registry)
  lib/            supabaseClient.js, AuthContext.jsx, ThemeContext.jsx, useSiteData.js, csv.js
  pages/          Home.jsx, IndustryDemo.jsx, NotFound.jsx
  pages/admin/    Login.jsx, Dashboard.jsx (tab shell)
  pages/admin/tabs/  OverviewTab, ClientsTab, InvoicesTab, ProjectsTab, ThemeTab
supabase/
  schema.sql      run this every time it changes — safe to re-run top-to-bottom
```

## A note on the Supabase anon key

`VITE_SUPABASE_ANON_KEY` is meant to be public — it ships inside the built
JavaScript bundle, the same way it would for any Supabase + Vite app. What
actually keeps your data safe is the **Row Level Security** policies in
`supabase/schema.sql`. Don't disable RLS on any table.

## Security — what's actually protecting this site

**The honest limit first:** if someone gets into your GitHub, Render, or
Supabase account directly, they can change your live site — that's what those
accounts control, and no amount of code can prevent it. What this project
does instead is (a) make sure nothing in the code is exploitable, and
(b) make sure a leaked *public* key alone can't do any damage. The account
security itself is on you — see the checklist below.

**What's already built in:**
- Every table has Row Level Security enabled. `clients` and `invoices` have
  **no public-read policy at all** — the anon key literally cannot see them,
  signed in or not, only an authenticated session can.
- The admin panel has no public sign-up. Admin users are created manually in
  the Supabase dashboard, so there's no registration form for anyone to abuse.
- The `SUPABASE_SERVICE_ROLE_KEY` — the one key that bypasses RLS entirely —
  is never used anywhere in this codebase. Keep it that way; never add it to
  a frontend `.env` file or commit it anywhere.
- `.env` is git-ignored, so your local Supabase keys won't accidentally end
  up in the GitHub repo.

**Do these yourself — they matter more than any code:**
1. Turn on **two-factor authentication** on GitHub, Render, and Supabase.
   This one step stops almost every real-world account takeover.
2. Use a **unique password** for each of the three, ideally from a password
   manager — reused passwords are how most accounts actually get breached.
3. In Supabase → **Authentication → Users**, only ever create login accounts
   for people who should have admin access — right now, just you.
4. If you ever suspect a key leaked (e.g. accidentally committed to a public
   repo), rotate it immediately in Supabase → **Settings → API** — old keys
   stop working the moment you regenerate.
5. Periodically check GitHub → **Settings → Password and authentication** →
   "Sessions" and Render/Supabase's account activity logs for anything you
   don't recognize.
