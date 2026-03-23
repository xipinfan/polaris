# E2E and Visual Testing

This project includes Playwright-based end-to-end testing with two layers:

- Interaction tests: simulate real user clicks and form operations.
- Visual regression tests: compare screenshots against baseline snapshots.

## Scope

- Console (web app)
  - Route navigation workflow checks
  - Debug request workflow checks
  - Full-page visual baselines for key routes
- Extension (Chrome/Edge MV3 popup)
  - Popup interaction checks
  - Popup visual baseline

## Commands

Install browser runtime:

```bash
pnpm test:e2e:install
```

Run all E2E tests (compare against your local baseline):

```bash
pnpm test:e2e
```

Capture/refresh local current-state baseline:

```bash
pnpm test:e2e:baseline
```

Update visual snapshots intentionally (same as baseline command):

```bash
pnpm test:e2e:update
```

Run Playwright UI mode:

```bash
pnpm test:e2e:ui
```

Run a single visual page check:

```bash
pnpm test:e2e:page -- --page home
```

Update baseline for a single visual page:

```bash
pnpm test:e2e:page:baseline -- --page settings
```

Supported page keys:

- `home`
- `traffic`
- `proxy-forward`
- `mock`
- `debug`
- `settings`
- `popup` (extension popup visual baseline)

## Snapshot Strategy

- Baselines represent the current UI state, not a design standard.
- Baselines are stored under `.e2e/visual-baseline/` and are local-only by default.
- Recommended flow:
  - first run `pnpm test:e2e:baseline` to capture current state
  - then run `pnpm test:e2e` to catch unintended pixel regressions
  - for local fast iteration, prefer single-page commands

## Stability Notes

- Tests start Core + Console via `scripts/dev/start.mjs`.
- API port is detected dynamically in `e2e/support/polaris.ts` (range `19601-19700`).
- Extension tests load unpacked build output from `apps/extension/dist`.


