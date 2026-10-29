# Database decision

**CodeForge 0.1 has no database, on purpose.**

## Why

| Feature | Where its data lives | Needs a database? |
| --- | --- | --- |
| Editing, explorer, search, Git, terminal | The user's own files and Git repositories | No |
| Settings, recent folders, window position | `%APPDATA%\CodeForge\settings.json` / `state.json` (validated with zod, atomic writes) | No |
| Website pages, docs, release notes | Source code, prerendered | No |
| Download availability | `brand/release-manifest.json` + a HEAD check of the published file | No |

A local editor must work offline and must not require an account to open a file. Adding a hosted database now would add cost, a secret to manage and a failure point without serving any feature.

## When to add one

Add persistent cloud storage when you build a feature that genuinely needs shared, server-side data, for example:

- user accounts and sign-in on the website,
- settings sync across machines,
- cloud-saved snippets or projects,
- a feedback/bug-report form with an inbox.

## Recommended approach when that happens

1. **Database:** managed PostgreSQL — Neon via the Vercel Marketplace (free tier, connection pooling, `DATABASE_URL` injected into the Vercel project automatically).
2. **ORM and migrations:** Drizzle ORM + drizzle-kit (TypeScript-first, SQL migrations committed to `website/drizzle/`).
3. **Access layer:** server-only module (`website/src/server/db.ts`, `import "server-only"`), queries only from Route Handlers / Server Actions — never from the desktop app directly.
4. **Auth:** Auth.js (`AUTH_SECRET`, OAuth credentials as Vercel secrets). Every table holding user data gets a `user_id` foreign key; every query filters by the signed-in user (data isolation), enforced in one helper.
5. **Desktop ↔ cloud:** the desktop app would call the website's HTTPS API with a token stored via Electron `safeStorage`, and sync only with explicit user consent.
6. **Operations:** Neon point-in-time restore for backups; run `drizzle-kit migrate` in the deploy step; add `DATABASE_URL` to `.env.example` and to `src/lib/env.ts` validation (required only when the feature is enabled).
