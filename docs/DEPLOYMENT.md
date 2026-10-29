# Deploying the website to Vercel

The website in `website/` is a standard Next.js 16 app. It needs no environment variables or database to deploy.

## Status

- Production build verified locally (`npm run build` in `website/`, 30 pages prerendered).
- Browser tests pass against the production server (desktop and mobile).
- `website/vercel.json` pins the framework, install command (`npm ci`) and build command.
- Not yet deployed: the Vercel CLI on the development machine is not logged in.

## First deployment (CLI)

```bash
cd website
vercel login              # opens the browser; sign in or create a free Hobby account
vercel link               # create/link a project; accept the detected Next.js settings
vercel deploy --prod      # build on Vercel and publish
```

Or from the repository root: `npm run deploy:web` (after `vercel login` and `vercel link` in `website/`).

## First deployment (Git integration)

1. Push this repository to GitHub.
2. In Vercel: **Add New → Project**, import the repository.
3. Set **Root Directory** to `website`. Framework preset: Next.js (auto-detected).
4. Deploy.

Every push to the default branch then deploys production; pull requests get preview URLs.

## After deploying

1. Open `https://<your-domain>/api/health` — it should return `{"status":"ok", ...}`.
2. Check `/`, `/download`, `/docs`.
3. Optional: set `NEXT_PUBLIC_SITE_URL` to a custom domain, and `CODEFORGE_GITHUB_REPO` once installers are published (see [ENVIRONMENT.md](ENVIRONMENT.md)), then redeploy.

## How the download button goes live

1. Publish the installer to GitHub Releases under tag `v<version>` (see [PACKAGING_AND_RELEASES.md](PACKAGING_AND_RELEASES.md)).
2. Set `CODEFORGE_GITHUB_REPO=owner/name` in Vercel and redeploy once.
3. The site HEAD-checks the installer URL and shows the button only when the file exists (re-checked every 10 minutes).

## Costs

Vercel Hobby (free) covers this site: static pages plus a tiny health endpoint. Installers are hosted on GitHub Releases (free for public repositories), not on Vercel.
