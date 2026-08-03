# Changelog

## 0.4.0 - 2026-08-03

### Features

- Add source-backed representative quotations for 29 additional thinkers, bringing the published coverage to 79 people and 123 sources.
- Record original text, Chinese translation, source locator, attribution context, and verification status for every new quotation.
- Add research utilities for candidate discovery, strict selection, Chinese-text proposals, and pre-publication quotation audits.

### Tests

- Enforce source-tier consistency, translation and translator requirements, and attribution notes for non-primary quotations.

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
