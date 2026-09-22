# Vantik

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
  since those represent separate client businesses, not Vantik itself.
- `/admin` — a password-protected panel to change the design theme, update the
  "clients / projects" counters, and add, edit or delete real client projects that
  appear on the homepage.
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
2. Paste the contents of `supabase/schema.sql` and run it. This creates:
   - `settings` — the single row that stores your "clients / projects" counters.
   - `projects` — the list of real client projects shown on the homepage.
   - Row Level Security policies: anyone can *read* both tables (so the public
     site works), but only a signed-in user can *write* to them.
3. Create yourself an admin login: **Authentication → Users → Add user**, enter
   an email and password. That's what you sign in with at `/admin/login` —
   there's no public sign-up form, on purpose.

## 3. Push to GitHub

```bash
git init
git add .
git commit -m "Vantik — initial build"
git branch -M main
git remote add origin https://github.com/<your-username>/vantik.git
git push -u origin main
```

## 4. Deploy on Render

This repo includes a `render.yaml`, so Render can pick up the build settings
automatically ("New +" → "Blueprint" → select the repo). If you'd rather set
it up by hand instead:

1. **New +** → **Static Site** → connect the `vantik` repo.
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
| Your site's whole visual style | `/admin` → Website design style (22 presets) |
| "19+ clients" / "21 projects" numbers | `/admin` → Homepage counters |
| Add a real client project to the homepage | `/admin` → Add a client project |
| The sample industry demo sites (gym, car, etc.), their photos, pricing | `src/data/industries.js` — plain data, no build tooling needed to understand it |
| Your name, WhatsApp number, email | `src/data/site.js` |
| Your photo | replace `public/sajid.jpg` |
| Add / tweak a design theme's colors, font, radius | `src/styles/themes.css` (and `src/data/themes.js` for the admin picker label) |

## Project structure

```
src/
  components/     Navbar, Footer, TiltCard (3D hover effect), BrowserFrame, ProtectedRoute
  data/           site.js (your details), industries.js (sample-site content)
  lib/            supabaseClient.js, AuthContext.jsx, useSiteData.js
  pages/          Home.jsx, IndustryDemo.jsx, NotFound.jsx
  pages/admin/    Login.jsx, Dashboard.jsx
supabase/
  schema.sql      run this once in the Supabase SQL editor
```

## A note on the Supabase anon key

`VITE_SUPABASE_ANON_KEY` is meant to be public — it ships inside the built
JavaScript bundle, the same way it would for any Supabase + Vite app. What
actually keeps your data safe is the **Row Level Security** policies in
`supabase/schema.sql`: anyone can read `settings` and `projects`, but only a
signed-in user (you) can write to them. Don't disable RLS on these tables.
