# Changelog

## 0.7.2 - 2026-08-28

### Fixes

- Move the all-questions control out of the detached heading position and integrate it as a lightweight trailing entry beside the featured question cards.
- Preserve a compact collapse action after expansion, a scrollable tail entry on mobile, and non-overlapping geometry at tablet and desktop widths.

### Tests

- Add focused layout coverage for card alignment, spacing, expansion, and the responsive all-questions control.

## 0.7.1 - 2026-08-28

### Fixes

- Keep the active thinker preview visible in immersive mode while navigation, question prompts, filters, and the timeline remain hidden.
- Reposition the interface reveal control beside desktop thinker previews while retaining its compact top-right placement on mobile.

### Tests

- Verify real marker clicks on desktop and mobile, the direct thinker-profile link, and closing the preview without leaving immersive mode.

## 0.7.0 - 2026-08-28

### Features

- Refine the globe-first interface with Apple-inspired liquid-glass controls, softer rounded cards, restrained depth, and a more coherent black-gold visual hierarchy.
- Add a reversible immersive mode that hides navigation, question prompts, filters, timeline, and detail surfaces so the 3D globe can become the sole visual focus.
- Upgrade thinker previews with a compact portrait-led layout, period and keyword context, core-idea summary, direct profile navigation, and comparison controls.

### Fixes

- Separate the globe instruction and relation controls to prevent overlap at desktop and tablet widths.
- Automatically collapse the question dock when thinker, relation, or comparison details are active, reducing visual competition around the globe.

### Tests

- Add responsive geometry, rounded-card, thinker-preview, and immersive-mode E2E coverage and refresh desktop, tablet, and mobile visual snapshots.

## 0.6.0 - 2026-08-28

### Features

- Redesign the homepage and `/explore` as a question-led 3D globe experience with three featured prompts, six complete question cards, progressive previews, compact controls, and a dedicated eight-journey directory.
- Add responsive black-gold question artwork, stable camera presets, question and relation highlighting, deep-link restoration, and preference-only `atlas-visual-state:v2` migration.
- Upgrade typography and interaction sizing across public pages while preserving the existing serif content and sans-serif interface system.

### Accessibility and Performance

- Add reduced-motion intro behavior, keyboard and focus coverage, mobile snap cards, a three-stage detail sheet, WebGL fallback continuity, and an 11px minimum visible-text gate.
- Keep the interactive globe on demand-driven rendering after entry and retain marker budgets, automatic quality fallback, and Windows Edge recovery behavior.

### Security

- Update the transitive `nanoid` dependency to 3.3.18 to resolve the current production dependency advisory.

### Tests and Documentation

- Cover question configuration, artwork budgets, intro timing, state migration, URL behavior, relation filters, responsive layouts, public typography, WebGL recovery, and desktop/mobile visual snapshots.
- Document the six generated illustration prompts, intended use, responsive exports, compression results, and media provenance.

## 0.5.2 - 2026-08-10

### Performance

- Run core review, desktop browser tests, and mobile browser tests in parallel behind the existing required `validate` gate.
- Remove duplicate feature-branch push runs and avoid repeating the full browser suite after a protected merge to `main`.

### Operations

- Keep automatic publication blocked until both parallel browser jobs and dependency review pass, while allowing Production deployment and the lightweight post-merge audit to proceed in parallel.

## 0.5.1 - 2026-08-10

### Fixes

- Restore vertical scrolling on login, registration, and other account pages while preserving the single-screen 3D atlas layout.

### Tests

- Add desktop and mobile short-screen regression coverage for account-page scrolling.

### Documentation

- Replace per-step Git authorization checkpoints and the obsolete manual-approval report with one unified review followed by the guarded automatic release workflow.

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
