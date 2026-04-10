<div align="center">
  <h1>Equipose</h1>
  <p>Free, browser-based stratified block randomization tool for clinical trials — <a href="https://equipose.org">equipose.org</a></p>

  ![Angular](https://img.shields.io/badge/Angular-21-DD0031?logo=angular)
  ![NgRx Signals](https://img.shields.io/badge/NgRx_Signals-21-BA2BD2)
  ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38BDF8?logo=tailwindcss)
  ![Vitest](https://img.shields.io/badge/Tested_with-Vitest-6E9F18?logo=vitest)
  ![Playwright](https://img.shields.io/badge/E2E-Playwright-2EAD33?logo=playwright)
</div>

## Overview

Equipose is a free, open-source web utility designed to help biostatisticians and clinical trial managers rapidly design, simulate, and export stratified block randomization schemas for clinical trials.

Built entirely as a client-side Angular application, it ensures that sensitive trial design parameters never leave the user's browser. It supports complex multi-strata designs, variable block sizes, and custom treatment ratios.

> [!WARNING]
> **Clinical Compliance & Scientific Validity**
>
> The schemas generated directly within the Web UI are intended for **simulation and design purposes only**. Due to inherent cross-environment Pseudo-Random Number Generator (PRNG) differences, the web UI output will differ from native statistical software outputs even when using the same seed value.
>
> **For actual clinical enrollment (e.g., 21 CFR Part 11 or ICH E9 compliance), you must download the generated R, Python, or SAS scripts and execute them within your organisation's validated statistical environment.** The downloaded script serves as the auditable source of truth.

---

## Key Features

* **Complex Ratios:** Define custom allocation ratios (e.g., 1:1, 2:1, 3:1:1) across multiple treatment arms.
* **Stratified Block Randomization:** Ensure treatment balance across multiple clinical sites and dynamic stratification factors (e.g., Age, Gender, Region).
* **Dynamic Stratum Caps:** Set specific maximum enrollment caps for unique stratum combinations.
* **Variable Block Sizes:** Randomise across multiple block sizes within the same study to resist unblinding.
* **Math Failsafes:** Built-in validation ensures block sizes are exact multiples of the total allocation ratio.
* **Code Generation:** Instantly export the exact randomization logic to **R**, **Python (pandas/numpy)**, or **SAS** scripts for integration into your Statistical Analysis Plan (SAP).
* **Reproducible:** Every schema carries a random seed that can be re-entered to reproduce the exact same allocation.
* **Zero-Trust Architecture:** 100% client-side execution. No data is stored on or transmitted to external servers.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Angular 21 (Standalone Components, Signals, `@for` Control Flow) |
| **State management** | NgRx SignalStore 21 |
| **Concurrency** | Web Workers (off-main-thread schema generation) |
| **Styling** | Tailwind CSS 4 |
| **PRNG** | `seedrandom` (Alea algorithm) for UI simulation |
| **PDF export** | `jspdf` + `jspdf-autotable` |
| **Unit testing** | Vitest 4 + Angular TestBed (jsdom environment) |
| **E2E testing** | Playwright 1.58 (Chromium) |
| **Linting** | ESLint 9 + `angular-eslint` + strict domain boundary rules |
| **Versioning** | `semantic-release` (Conventional Commits → GitHub Releases) |
| **Deployment** | GitHub Pages (static SPA) at [equipose.org](https://equipose.org) + optional SSR via `@angular/ssr` |

---

## Architecture

This project follows a **Domain-Driven Design** structure with three bounded contexts:

1. **`randomization-engine`** — pure TypeScript algorithm, Web Worker, SSR-safe facade.
2. **`study-builder`** — reactive form, NgRx SignalStore, preset definitions.
3. **`schema-management`** — results grid, PDF/CSV export, code generation modal.

ESLint `no-restricted-imports` rules enforce that the `study-builder` UI can only
talk to the engine through the facade, never through internal service or worker files.

For the full architectural breakdown including Mermaid diagrams, see
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Local Development

**Prerequisites:** Node.js v20 or newer.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/fderuiter/Clinical-Randomization-Generator.git
   cd Clinical-Randomization-Generator
   ```

2. **Install dependencies:**
   ```bash
   npm ci
   ```

3. **Run the development server:**
   ```bash
   npm start
   # or on port 3000:
   npm run dev
   ```
   Navigate to `http://localhost:4200/`. The application hot-reloads on file changes.

---

## Testing

### Unit tests (Vitest)

```bash
npm test -- --watch=false
```

Runs all 216 unit tests across 11 spec files using Vitest in a jsdom environment.

### End-to-end tests (Playwright)

```bash
# Terminal 1 — start the dev server
npm start

# Terminal 2 — run all e2e specs
npx playwright test
```

Playwright tests live in `tests_e2e/` and cover five areas:

| Spec file | What it tests |
|---|---|
| `navigation.spec.ts` | Landing page, header nav, About page, unknown-route redirect |
| `form-validation.spec.ts` | Preset loading, disabled-state buttons, block-size validator, arm/stratum management |
| `schema-generation.spec.ts` | Full end-to-end: configure → generate → blinding toggle |
| `results-operations.spec.ts` | Grid rendering, blinding, pagination, CSV & PDF downloads |
| `code-generator.spec.ts` | R / SAS / Python tab switching, code content, file downloads |

### Linting

```bash
ng lint
```

---

## Deployment

### GitHub Pages (automatic)

Pushes to `main` automatically trigger the `.github/workflows/deploy.yml` workflow,
which builds the Angular app with the correct `--base-href` and deploys to GitHub Pages
at [https://equipose.org](https://equipose.org).

To enable this on a fork:
1. Go to repository **Settings → Pages**.
2. Under **Source**, select **GitHub Actions**.

### SSR server (optional)

The build also produces a Node.js SSR server:

```bash
npm run build
node dist/app/server/server.mjs
```

### Versioning

Releases are automated via `semantic-release`. Merging a `feat:` or `fix:` commit to
`main` automatically bumps `package.json`, updates `CHANGELOG.md`, and creates a
tagged GitHub Release. The new version is stamped into every generated CSV, PDF, and
code script via `src/environments/version.ts`.

---

## License

GNU Affero General Public License v3.0 — see [LICENSE](LICENSE) for details.

