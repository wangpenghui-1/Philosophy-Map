# Changelog

## 0.5.1 - 2026-08-10

### Fixes

- Restore vertical scrolling on login, registration, and other account pages while preserving the single-screen 3D atlas layout.

### Tests

- Add desktop and mobile short-screen regression coverage for account-page scrolling.

### Documentation

- Replace per-step Git authorization checkpoints with one unified review followed by the guarded automatic release workflow.

## 0.5.0 - 2026-08-10

### Features

- Add production-ready accounts, learning progress, grounded AI conversations, long-term memory controls, editorial workflows, and operational status surfaces.
- Add PostgreSQL shadow import, versioned knowledge data, relation and journey workbenches, audit trails, and user-owned RLS policies.
- Add OpenAI-first grounded answers with DeepSeek fallback, citation validation, shared rate limiting, usage accounting, and safe extractive fallback.

### Security

- Run the application through a least-privilege PostgreSQL role and extend RLS to conversation and memory child records.
- Harden cookies, CSRF checks, response headers, Sentry redaction, service probes, and production environment validation.
- Keep media uploads disabled in production under the zero-cost policy while preserving all existing static media.

### Operations

- Add migration, backup, restore-drill, release-manifest, monitoring, and production acceptance tooling.
- Preserve versioned static snapshots so public reading remains available when database or AI services are unavailable.

### Tests

- Cover grounded-answer fallbacks, permission boundaries, RLS isolation, media write shutdown, production readiness, and desktop/mobile admin behavior.

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
