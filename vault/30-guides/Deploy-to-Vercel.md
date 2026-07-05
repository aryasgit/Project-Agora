# Guide — Deploy the Console to Vercel

The console (`web/console`) is a plain static Next.js app — the whole exchange
runs client-side (see [[ADR-0003-console-runtime]]), so there is **no backend to
host**. Deployment is a standard Next.js → Vercel flow.

## One-time setup (dashboard)
1. Push the repo to GitHub (already done: `aryasgit/Project-Agora`).
2. On [vercel.com](https://vercel.com) → **Add New… → Project** → import `Project-Agora`.
3. **Set Root Directory = `web/console`.** This is the only non-default step — the Next.js app is in a subfolder, not the repo root.
4. Framework preset auto-detects as **Next.js**. Build command `next build`, output handled automatically.
5. Deploy. Every push to `main` re-deploys.

## Via CLI (alternative)
```bash
npm i -g vercel
cd web/console
vercel            # first run links/creates the project (accept defaults)
vercel --prod     # production deploy
```

## Local dev
```bash
cd web/console
npm install
npm run dev       # http://localhost:3737
npm run build     # verify a production build before pushing
```

## Notes
- No environment variables, no database, no API keys — the simulation is deterministic given a seed and runs in the browser.
- If you later add a live Python-engine backend (FastAPI), that becomes a *separate* service (Render/Fly/Railway) and the console reads it over HTTP — but that is explicitly **not** required for this deploy.

Related: [[Engine-Architecture]], [[ADR-0001-stack]], [[Roadmap]].
