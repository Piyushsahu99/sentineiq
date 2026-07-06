# Sentinel-Q

AI-assisted security operations console — dashboards, alerts, investigations, transactions, telemetry, threat intel, and reports for SOC / risk / exec roles.

**Live app:** https://sentineiq.lovable.app
**Custom domain:** https://sentinel-q.today

## Tech stack

- TanStack Start v1 (React 19, Vite 7, SSR on Cloudflare Workers)
- Tailwind CSS v4
- TanStack Query + Router
- Lovable Cloud (Supabase: Postgres, Auth, RLS, Storage)
- Leaflet + OpenStreetMap (threat map)

## Local development

```bash
bun install
bun dev
```

App runs at http://localhost:8080.

## Project structure

- `src/routes/` — file-based routes (pages + `api/` server routes)
- `src/components/` — UI components (shadcn-based)
- `src/lib/*.functions.ts` — TanStack server functions
- `supabase/migrations/` — database schema + RLS policies

## Seeding demo data

Sign in, pick a role on `/auth/role-select`, then open **Settings** and click **Seed demo data** to populate dashboards for the current user.

## Editing

This project is built with [Lovable](https://lovable.dev). Changes made in Lovable auto-sync to this repo, and pushes to this repo auto-sync back into Lovable.

Project: https://lovable.dev/projects/3ffacc9b-a8e6-4204-ada4-0b663ff10a7c
