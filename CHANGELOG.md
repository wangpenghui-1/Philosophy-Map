# Changelog

## 0.3.0 - 2026-08-03

### Features

- Migrate the production runtime from Vinext and Cloudflare Workers to native Next.js on Vercel.
- Add GitHub quality gates, Vercel deployment configuration, and a long-term deployment runbook.

### Fixes

- Preserve representative quotations and their source links when regenerating the 210-person release.
- Isolate Playwright production servers from stale local development processes.
- Re-probe WebGL2 after a disposed canvas loses its rendering context.

### Performance

- Split Three.js, React Three Fiber, and post-processing dependencies to keep every client chunk below 500 KB.

### Documentation

- Document the `main`-based production workflow, Preview deployments, environment variables, and rollback procedure.
