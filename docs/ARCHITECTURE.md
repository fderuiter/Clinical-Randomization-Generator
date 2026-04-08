# Architecture Overview — Clinical Randomization Generator

> **Version:** v1.1.0  
> **Stack:** Angular 21 · NgRx Signals · Web Workers · Vitest · Playwright · Tailwind CSS

---

## Table of Contents

1. [What the Application Does](#1-what-the-application-does)
2. [Repository Layout](#2-repository-layout)
3. [Domain-Driven Design Structure](#3-domain-driven-design-structure)
4. [Application Bootstrap & Routing](#4-application-bootstrap--routing)
5. [Component Tree](#5-component-tree)
6. [Randomization Engine](#6-randomization-engine)
7. [Web Worker Communication](#7-web-worker-communication)
8. [State Management — NgRx SignalStore](#8-state-management--ngrx-signalstore)
9. [Full Data-Flow: Form → Results](#9-full-data-flow-form--results)
10. [Data Model](#10-data-model)
11. [Code Generation Service](#11-code-generation-service)
12. [ESLint Architectural Boundaries](#12-eslint-architectural-boundaries)
13. [Testing Strategy](#13-testing-strategy)
14. [Build, Tooling & Versioning](#14-build-tooling--versioning)

---

## 1. What the Application Does

The Clinical Randomization Generator is a browser-only Angular SPA that produces
**statistically sound, reproducible, stratified-block randomization schemas** for
clinical trials. A researcher fills in a configuration form (treatment arms, strata,
sites, block sizes, subject-ID mask, optional seed) and the tool:

1. Runs a seeded **Fisher-Yates shuffle** algorithm inside a **Web Worker** to keep
   the UI fully responsive.
2. Displays the resulting schema in a paginated, blindable results grid.
3. Exports the schema to **CSV** or **PDF**.
4. Generates equivalent **R / SAS / Python** scripts so the trial statistician can
   reproduce the exact allocation on a validated, 21 CFR Part 11-capable system.

> **Compliance notice:** The in-browser schema is marked *DRAFT*. For regulated
> studies, only the exported code scripts should be used in production.

---

## 2. Repository Layout

```
clinical-randomization-generator/
├── docs/
│   └── ARCHITECTURE.md          ← you are here
│
├── src/
│   ├── main.ts                  Bootstrap: bootstrapApplication(App, appConfig)
│   ├── index.html               Single HTML entry point
│   ├── styles.css               Tailwind base + Google Material Icons import
│   ├── setup-vitest.ts          Vitest global setup (Angular TestBed init)
│   │
│   ├── environments/
│   │   └── version.ts           Auto-generated: export const APP_VERSION
│   │
│   └── app/
│       ├── app.ts               Root component (header nav + <router-outlet>)
│       ├── app.config.ts        ApplicationConfig: router, HttpClient
│       ├── app.routes.ts        Route table → 3 routes
│       ├── app.spec.ts          Smoke test: App component renders
│       │
│       ├── features/            Thin, non-domain page components
│       │   ├── landing/
│       │   │   └── landing.component.ts   Hero page with "Get Started" CTA
│       │   └── about/
│       │       └── about.component.ts     Feature overview + 21 CFR notice
│       │
│       └── domain/              All business logic — Domain-Driven Design
│           │
│           ├── core/
│           │   └── models/
│           │       └── randomization.model.ts   Shared interfaces (single source of truth)
│           │
│           ├── randomization-engine/        Bounded context 1
│           │   ├── core/
│           │   │   ├── randomization-algorithm.ts          Pure PRNG function
│           │   │   ├── randomization-algorithm.spec.ts     Unit tests
│           │   │   └── randomization-algorithm-parity.spec.ts  Golden-master parity tests
│           │   ├── worker/
│           │   │   ├── randomization-engine.worker.ts      Web Worker entry point
│           │   │   └── worker-protocol.ts                  Typed message interfaces
│           │   ├── randomization.service.ts                SSR/fallback Observable wrapper
│           │   ├── randomization.service.spec.ts
│           │   ├── randomization-engine.facade.ts          Single UI entry point
│           │   └── randomization-engine.facade.spec.ts
│           │
│           ├── study-builder/               Bounded context 2
│           │   ├── store/
│           │   │   ├── study-builder.store.ts              NgRx SignalStore
│           │   │   └── study-builder.store.spec.ts
│           │   └── components/
│           │       ├── generator.component.ts              Page shell + layout
│           │       ├── generator.component.spec.ts
│           │       ├── config-form.component.ts            Reactive form + presets
│           │       ├── config-form.component.html
│           │       └── config-form.component.spec.ts
│           │
│           └── schema-management/           Bounded context 3
│               ├── services/
│               │   ├── code-generator.service.ts           R / SAS / Python emitters
│               │   └── code-generator.service.spec.ts
│               └── components/
│                   ├── results-grid.component.ts           Paginated results + exports
│                   ├── results-grid.component.html
│                   ├── results-grid.component.spec.ts
│                   ├── code-generator-modal.component.ts   Language-tab modal
│                   ├── code-generator-modal.component.html
│                   └── code-generator-modal.component.spec.ts
│
├── tests_e2e/                   Playwright end-to-end tests
│   ├── navigation.spec.ts
│   ├── form-validation.spec.ts
│   ├── schema-generation.spec.ts
│   ├── results-operations.spec.ts
│   └── code-generator.spec.ts
│
├── generate-version.js          Pre-build script: writes src/environments/version.ts
├── angular.json                 Angular CLI workspace config
├── eslint.config.js             ESLint + angular-eslint + boundary rules
├── playwright.config.ts         Playwright project config
├── tsconfig.json                TypeScript base config
├── vitest.config.ts             Vitest config (jsdom environment)
├── .releaserc.json              semantic-release config
└── package.json
```

---

## 3. Domain-Driven Design Structure

The `src/app/domain/` tree is organised around three bounded contexts that each own their code and have strict import rules enforced by ESLint.

```mermaid
graph TD
    subgraph "Shared Kernel"
        MODEL["domain/core/models\nrandomization.model.ts\n──────────────────────\nTreatmentArm\nStratificationFactor\nStratumCap\nRandomizationConfig\nGeneratedSchema\nRandomizationResult"]
    end

    subgraph "Bounded Context 1 — Randomization Engine"
        ALGO["core/\nrandomization-algorithm.ts\n(pure TS, zero Angular)"]
        WORKER["worker/\nrandomization-engine.worker.ts\nworker-protocol.ts"]
        SVC["randomization.service.ts\n(Observable wrapper / SSR)"]
        FACADE["randomization-engine.facade.ts\n★ sole public API ★"]
        ALGO --> WORKER
        ALGO --> SVC
        WORKER --> FACADE
        SVC --> FACADE
    end

    subgraph "Bounded Context 2 — Study Builder"
        STORE["store/\nstudy-builder.store.ts\n(NgRx SignalStore)"]
        FORM["components/\nconfig-form.component\ngenerator.component"]
        STORE --> FORM
    end

    subgraph "Bounded Context 3 — Schema Management"
        CODEGEN["services/\ncode-generator.service.ts"]
        GRID["components/\nresults-grid.component\ncode-generator-modal.component"]
        CODEGEN --> GRID
    end

    MODEL --> ALGO
    MODEL --> SVC
    MODEL --> WORKER
    MODEL --> STORE
    MODEL --> CODEGEN

    FACADE --> FORM
    FACADE --> GRID
```

**Dependency rules (enforced by ESLint `no-restricted-imports`):**

| Consumer | Allowed | Forbidden |
|---|---|---|
| `study-builder/**` | `RandomizationEngineFacade`, `domain/core/models` | `randomization.service`, `core/**` (algorithm), `worker/**` |
| `randomization-engine/core/**` | `domain/core/models`, `seedrandom` | Any `@angular/*` package |

---

## 4. Application Bootstrap & Routing

```mermaid
flowchart LR
    MAIN["main.ts\nbootstrapApplication(App, appConfig)"]
    CONFIG["app.config.ts\nprovideRouter(routes)\nprovideHttpClient(withFetch)\nprovideBrowserGlobalErrorListeners"]
    ROUTES["app.routes.ts"]
    APP["App (root component)\n<header> + <router-outlet>"]

    MAIN --> CONFIG
    CONFIG --> ROUTES
    ROUTES --> APP

    ROUTES -- "/" --> LANDING["LandingComponent\nfeatures/landing/"]
    ROUTES -- "/about" --> ABOUT["AboutComponent\nfeatures/about/"]
    ROUTES -- "/generator" --> GEN["GeneratorComponent\ndomain/study-builder/components/"]
    ROUTES -- "**" --> REDIR["redirectTo: ''"]
```

`appConfig` uses the **standalone component API** (no `NgModule`). `HttpClient` is
provided via `withFetch()` for compatibility with the Angular `@angular/ssr` SSR
adapter (the app ships an SSR server in `dist/app/server/server.mjs`).

---

## 5. Component Tree

```mermaid
graph TD
    ROOT["App\napp.ts\nrouter-outlet"]

    ROOT --> LANDING["LandingComponent\n/"]
    ROOT --> ABOUT["AboutComponent\n/about"]
    ROOT --> GEN["GeneratorComponent\n/generator"]

    GEN --> FORM["ConfigFormComponent\nReactive FormGroup\nPresets · Arms · Strata\nBlock sizes · Seed · Mask"]
    GEN --> RGRID["ResultsGridComponent\nPagination · Blinding toggle\nCSV export · PDF export"]
    GEN --> MODAL["CodeGeneratorModalComponent\nR / SAS / Python tabs\nCopy · Download"]

    FORM -- "injects" --> FACADE
    FORM -- "injects" --> STORE["StudyBuilderStore\nNgRx SignalStore"]
    RGRID -- "injects" --> FACADE
    MODAL -- "injects" --> FACADE
    MODAL -- "injects" --> CGSVC["CodeGeneratorService"]
    GEN -- "injects" --> FACADE

    FACADE["RandomizationEngineFacade\nconfig · results · isGenerating\nerror · showCodeGenerator\ncodeLanguage"]
```

All components are **standalone** (no `NgModule`). `ChangeDetectionStrategy.OnPush`
is used on `GeneratorComponent` and `App`. The `RandomizationEngineFacade` is
`providedIn: 'root'`, making it a singleton shared across all components without
manual provider registration.

---

## 6. Randomization Engine

The randomization engine is split into three layers to satisfy two conflicting
requirements: **(a)** the algorithm must run inside a Web Worker (no Angular), and
**(b)** the rest of the app is Angular.

```mermaid
graph LR
    subgraph "Main Thread (Angular)"
        FACADE2["RandomizationEngineFacade"]
        SVC2["RandomizationService\n(Observable wrapper)"]
    end

    subgraph "Worker Thread"
        WORKER2["randomization-engine.worker.ts"]
        ALGO2["generateRandomizationSchema()\npure TypeScript + seedrandom"]
        WORKER2 --> ALGO2
    end

    subgraph "SSR / Worker-unavailable fallback"
        SVC2 --> ALGO2
    end

    FACADE2 -- "new Worker(...) in browser" --> WORKER2
    FACADE2 -- "fallback subscribe()" --> SVC2
```

### The Core Algorithm (`randomization-algorithm.ts`)

The single exported function `generateRandomizationSchema(config)`:

1. **Resolves seed** — uses `config.seed` if provided, otherwise generates a random
   string and attaches it to a copy of the config (non-mutating).
2. **Cartesian product** — iterates `config.strata` to build every combination of
   stratum levels (e.g. `{sex: M, age: <65}`, `{sex: M, age: ≥65}`, …).
3. **Validates block sizes** — throws if any block size is not an exact multiple of
   the total arm ratio sum.
4. **Generates blocks** — for each _(site × stratum combo)_ pair, while
   `stratumSubjectCount < cap`, picks a random block size, fills the block with arms
   weighted by ratio, then applies a **Fisher-Yates shuffle** driven by the
   `seedrandom` PRNG.
5. **Formats subject IDs** — replaces `[SiteID]`, `[StratumCode]`, and `[001]`
   (with arbitrary padding) tokens in `subjectIdMask`.
6. Returns a `RandomizationResult` object with `schema[]` rows and `metadata`.

> **Parity guarantee:** The golden-master tests in
> `randomization-algorithm-parity.spec.ts` assert that `generateRandomizationSchema`
> produces the exact same field-by-field output as the decommissioned legacy
> `RandomizationService` for five diverse configurations. Any change to the PRNG
> consumption order will break these tests and must be rejected.

---

## 7. Web Worker Communication

The Facade owns the Worker lifecycle and uses a **promise-map pattern** to correlate
async responses to their originating calls.

```mermaid
sequenceDiagram
    participant UI as ConfigFormComponent
    participant FAC as RandomizationEngineFacade (main thread)
    participant WRK as randomization-engine.worker.ts (worker thread)

    UI->>FAC: facade.generateSchema(config)
    FAC->>FAC: isGenerating.set(true) · error.set(null) · results.set(null)
    FAC->>FAC: id = random correlation ID
    FAC->>FAC: pendingCallbacks.set(id, {resolve, reject})
    FAC->>WRK: postMessage({ id, command: 'START_GENERATION', payload: config })

    Note over WRK: Worker thread executes<br/>generateRandomizationSchema(config)

    alt Success
        WRK-->>FAC: postMessage({ id, type: 'GENERATION_SUCCESS', payload: result })
        FAC->>FAC: pendingCallbacks.get(id).resolve(result)
        FAC->>FAC: results.set(result) · isGenerating.set(false)
    else Error thrown in worker
        WRK-->>FAC: postMessage({ id, type: 'GENERATION_ERROR', payload: { error } })
        FAC->>FAC: pendingCallbacks.get(id).reject(payload)
        FAC->>FAC: error.set(message) · isGenerating.set(false)
    end

    FAC-->>UI: Signals update → Angular re-renders
```

**SSR / Worker-unavailable fallback:** When `PLATFORM_ID` is not `'browser'` (SSR)
or when `new Worker(...)` throws, the Facade calls
`RandomizationService.generateSchema(config).subscribe(...)` synchronously on the
main thread. This keeps the app functional in environments that block worker
construction.

### Worker Protocol Types (`worker-protocol.ts`)

```
WorkerCommand<T>  { id: string; command: WorkerCommandType; payload: T }
WorkerResponse<T> { id: string; type: WorkerResponseType;  payload: T }

GenerationCommand        = WorkerCommand<RandomizationConfig>
GenerationSuccessResponse = WorkerResponse<RandomizationResult>
GenerationErrorResponse   = WorkerResponse<{ error: { error: string } }>
```

---

## 8. State Management — NgRx SignalStore

All mutable state that crosses the boundary between the form and the results grid
lives in two places:

| Store | Location | Responsibility |
|---|---|---|
| `StudyBuilderStore` | `domain/study-builder/store/` | Strata signal → reactive Cartesian combinations; preset definitions; `buildConfig()` helper |
| `RandomizationEngineFacade` | `domain/randomization-engine/` | `config`, `results`, `isGenerating`, `error`, `showCodeGenerator`, `codeLanguage` |

```mermaid
stateDiagram-v2
    [*] --> Idle : app boot

    Idle --> Generating : facade.generateSchema(config)\nisGenerating = true

    Generating --> HasResults : GENERATION_SUCCESS\nresults = result\nisGenerating = false

    Generating --> HasError : GENERATION_ERROR\nerror = message\nisGenerating = false

    HasResults --> Idle : form value changes\nfacade.clearResults()

    HasError --> Idle : form value changes\nfacade.clearResults()

    HasResults --> CodeModalOpen : facade.openCodeGenerator(config, lang)\nshowCodeGenerator = true

    CodeModalOpen --> HasResults : facade.closeCodeGenerator()\nshowCodeGenerator = false
```

### `StudyBuilderStore` internals

```mermaid
flowchart TD
    STATE["withState\nstrata: StratumFormValue[]"]
    COMPUTED["withComputed\nstrataCombinations: string[][]
    (Cartesian product of all stratum levels)"]
    METHODS["withMethods\nsetStrata(strata)\ngetPreset(type)\nbuildConfig(formValue)"]

    STATE --> COMPUTED
    STATE --> METHODS

    FORM2["ConfigFormComponent\nstrata FormArray valueChanges"]
    FORM2 -- "store.setStrata(s)" --> STATE
    COMPUTED -- "store.strataCombinations()" --> FORM2
    FORM2 -- "store.buildConfig(form.value)" --> RANDCONFIG["RandomizationConfig\n→ facade.generateSchema()"]
```

The `strataCombinations` computed signal replaces the imperative
`updateStratumCaps()` call that previously lived inside the component; Angular
re-evaluates it automatically whenever the `strata` signal changes.

---

## 9. Full Data-Flow: Form → Results

```mermaid
flowchart TD
    USER["User fills form\n(arms, strata, sites, blocks, seed)"]
    PRESET["or: clicks a Preset button"]

    USER --> FORM3["ConfigFormComponent\nFormGroup + FormArray"]
    PRESET --> STORE3["StudyBuilderStore.getPreset()\n→ patchValue() + clear()/push()"]
    STORE3 --> FORM3

    FORM3 -- "strata valueChanges" --> STORE3
    STORE3 -- "strataCombinations()" --> CAPS["syncStratumCaps()\nRebuild stratumCaps FormArray\nfrom Cartesian product"]
    CAPS --> FORM3

    FORM3 -- "onSubmit()\nform.valid" --> BUILDCONFIG["store.buildConfig(form.value)\nparse comma-separated strings\nmap to typed RandomizationConfig"]
    BUILDCONFIG --> FACADE3["facade.generateSchema(config)"]

    FACADE3 --> WORKER3["Web Worker\ngenerateRandomizationSchema(config)"]
    WORKER3 --> FACADE3
    FACADE3 -- "results signal" --> GRID["ResultsGridComponent\npaginatedData computed signal\n20 rows per page"]
    FACADE3 -- "isGenerating signal" --> SPINNER["Loading spinner (generator.component)"]
    FACADE3 -- "error signal" --> ERRMSG["Error banner (generator.component)"]

    GRID -- "exportCsv()" --> CSV["Blob download\nrandomization_&lt;id&gt;_blinded|unblinded.csv"]
    GRID -- "exportPdf()" --> PDF["jsPDF download\nrandomization_&lt;id&gt;_blinded|unblinded.pdf"]

    FORM3 -- "onGenerateCode(lang)" --> CODEMODALOPEN["facade.openCodeGenerator(config, lang)"]
    CODEMODALOPEN --> MODAL3["CodeGeneratorModalComponent\nCodeGeneratorService.generateR/SAS/Python()"]
    MODAL3 -- "downloadCode()" --> SCRIPT["Text file download\nrandomization_code.R|.sas|.py"]
```

---

## 10. Data Model

All interfaces live in a single file: `domain/core/models/randomization.model.ts`.
This is the **shared kernel** — every other module imports from here; nothing
re-declares these types.

```mermaid
classDiagram
    class RandomizationConfig {
        +string protocolId
        +string studyName
        +string phase
        +TreatmentArm[] arms
        +string[] sites
        +StratificationFactor[] strata
        +number[] blockSizes
        +StratumCap[] stratumCaps
        +string seed
        +string subjectIdMask
    }

    class TreatmentArm {
        +string id
        +string name
        +number ratio
    }

    class StratificationFactor {
        +string id
        +string name
        +string[] levels
    }

    class StratumCap {
        +string[] levels
        +number cap
    }

    class RandomizationResult {
        +ResultMetadata metadata
        +GeneratedSchema[] schema
    }

    class ResultMetadata {
        +string protocolId
        +string studyName
        +string phase
        +string seed
        +string generatedAt
        +StratificationFactor[] strata
        +RandomizationConfig config
    }

    class GeneratedSchema {
        +string subjectId
        +string site
        +Record~string,string~ stratum
        +string stratumCode
        +number blockNumber
        +number blockSize
        +string treatmentArm
        +string treatmentArmId
    }

    RandomizationConfig "1" --> "*" TreatmentArm : arms
    RandomizationConfig "1" --> "*" StratificationFactor : strata
    RandomizationConfig "1" --> "*" StratumCap : stratumCaps
    RandomizationResult "1" --> "1" ResultMetadata : metadata
    RandomizationResult "1" --> "*" GeneratedSchema : schema
    ResultMetadata "1" --> "1" RandomizationConfig : config
    ResultMetadata "1" --> "*" StratificationFactor : strata
```

### Subject ID Mask tokens

| Token | Replacement |
|---|---|
| `[SiteID]` | The raw site identifier string |
| `[StratumCode]` | First 3 chars of each stratum level, uppercased, joined with `-` |
| `[001]` | Subject counter padded to 3 digits |
| `[0001]` | Subject counter padded to 4 digits (or any `[0…1]` pattern) |

Example: mask `[SiteID]-[StratumCode]-[001]` → `US01-<65-F-003`

---

## 11. Code Generation Service

`CodeGeneratorService` (`domain/schema-management/services/`) emits standalone
scripts in three languages. Each script is **self-contained**: it re-encodes the
full configuration as literals (sites, arms, strata, caps, block sizes) and uses the
language-native PRNG seeded from a 31-bit hash of the web app's `seedrandom` seed.

> **Important:** R, SAS, and Python each use a different PRNG algorithm
> (Mersenne-Twister, Mersenne-Twister, PCG64 respectively). The generated scripts
> will produce a statistically valid and balanced schema with the same parameters,
> but the **exact subject-by-subject sequence** will differ from the web tool's
> output. For a byte-identical reproduction, execute the web tool's algorithm
> directly (the exported scripts include this caveat as a comment).

```mermaid
flowchart LR
    CONFIG2["RandomizationConfig"]
    HASH["hashCode(seed)\n→ 31-bit integer\n(compatible with all three\nPRNG seed ranges)"]
    CONFIG2 --> HASH

    HASH --> R["generateR()\nset.seed(N)\nexpand.grid() strata\nFisher-Yates via sample()"]
    HASH --> SAS["generateSas()\n%let seed = N;\ncall streaminit(seed)\nDATA step blocks"]
    HASH --> PY["generatePython()\nnp.random.default_rng(N)\nitertools.product() strata\nrng.shuffle(block)"]

    R --> MODAL4["CodeGeneratorModalComponent\nactiveTab signal\nDownload / Copy buttons"]
    SAS --> MODAL4
    PY --> MODAL4
```

Each generated script includes:
- Protocol ID, study name, app version, and generation timestamp as comments
- Block-math failsafe that aborts if a block size is not a multiple of the total ratio
- QC tables (overall treatment balance, site-level balance, block size distribution)
- Commented-out CSV export line

---

## 12. ESLint Architectural Boundaries

Boundaries are enforced at lint time using `no-restricted-imports` patterns in
`eslint.config.js`. Violations are build errors in CI.

```mermaid
graph LR
    SB["domain/study-builder/**"]
    RE_FACADE["RandomizationEngineFacade ✅"]
    RE_SVC["randomization.service ❌"]
    RE_CORE["randomization-engine/core/** ❌"]
    RE_WORKER["randomization-engine/worker/** ❌"]
    RE_MODELS["domain/core/models ✅"]

    SB --> RE_FACADE
    SB -. blocked .-> RE_SVC
    SB -. blocked .-> RE_CORE
    SB -. blocked .-> RE_WORKER
    SB --> RE_MODELS

    ALGO_FILE["randomization-engine/core/**"]
    ANGULAR["@angular/* ❌"]
    ALGO_FILE -. blocked .-> ANGULAR

    NOTE1["Rule: study-builder sees only the\nFacade, never the engine internals"]
    NOTE2["Rule: core algorithm is pure TS;\nno Angular = safe in Workers + SSR"]
```

---

## 13. Testing Strategy

```mermaid
graph BT
    E2E["E2E (Playwright)\ntests_e2e/ — 5 spec files\nChromium only\nRequires ng serve @ :4200\n~37 user-journey tests"]
    UNIT["Unit (Vitest + Angular TestBed)\nsrc/**/*.spec.ts — 11 spec files\n216 tests\nDirect DOM/class testing"]
    PARITY["Golden-Master Parity\nrandomization-algorithm-parity.spec.ts\n8 tests across 5 configs\nFixed seeds → deepEqual assertion"]

    PARITY --> UNIT
    UNIT --> E2E
```

### Unit test files

| File | Tests | What it covers |
|---|---|---|
| `app.spec.ts` | 1 | App component renders without error |
| `randomization-algorithm.spec.ts` | 13 | Algorithm correctness, edge cases, throws |
| `randomization-algorithm-parity.spec.ts` | 8 | Output matches decommissioned legacy service |
| `randomization.service.spec.ts` | 7 | Observable wrapper, error paths |
| `randomization-engine.facade.spec.ts` | 22 | Worker dispatch, SSR fallback, signal updates |
| `study-builder.store.spec.ts` | 19 | SignalStore: strata, Cartesian combinations, presets, buildConfig |
| `config-form.component.spec.ts` | 29 | Reactive form init, preset loading, add/remove arms & strata, validation |
| `generator.component.spec.ts` | 15 | Error/loading/results conditional rendering |
| `results-grid.component.spec.ts` | 24 | Pagination, blinding toggle, CSV/PDF export |
| `code-generator-modal.component.spec.ts` | 11 | Tab switching, download, copy |
| `code-generator.service.spec.ts` | 67 | R/SAS/Python code content, seed hashing |

### E2E test files

| File | What it covers |
|---|---|
| `navigation.spec.ts` | Landing page, header nav, About page, logo link, 404 redirect |
| `form-validation.spec.ts` | Preset loading, disabled buttons, block-size validator, add arm/stratum |
| `schema-generation.spec.ts` | Full end-to-end: Complex preset → generate → blinding toggle |
| `results-operations.spec.ts` | Grid rendering, blinding, pagination, CSV/PDF downloads |
| `code-generator.spec.ts` | All 3 languages: tab switching, code content, file downloads |

### Running tests

```bash
# Unit tests (Vitest via Angular CLI)
npm test -- --watch=false

# E2E tests (requires dev server running first)
ng serve --port 4200 &
npx playwright test
```

---

## 14. Build, Tooling & Versioning

### Build pipeline

```mermaid
flowchart LR
    PRE["prebuild / pretest / prestart\ngenerate-version.js\n→ src/environments/version.ts\nexport const APP_VERSION = 'v1.1.0'"]
    BUILD["ng build\n@angular/build (esbuild)\nAOT compilation\nStandalone component API"]
    WORKER_BUNDLE["Worker chunking\nrandomization-engine.worker.ts\n→ worker-*.js (separate chunk)\nmultithreading confirmed"]
    DIST["dist/\nclinical-randomization-generator/\n  browser/   ← static SPA\n  server/    ← SSR Node.js server"]

    PRE --> BUILD --> WORKER_BUNDLE --> DIST
```

The Angular CLI uses **esbuild** (via `@angular/build`). The Web Worker is
automatically split into its own chunk (`worker-*.js`) because it is referenced via
`new URL('./worker/...', import.meta.url)` — the esbuild-specific dynamic import
form that Angular recognises as a Worker entry point.

### Vitest configuration

Vitest runs in the **jsdom** environment (configured in `vitest.config.ts`) with
Angular's `TestBed` bootstrapped in `src/setup-vitest.ts`. Mocking uses Vitest's
`vi.fn()` / `vi.spyOn()` API.

### Release process (semantic-release)

Commits on `main` following the **Conventional Commits** specification
(`feat:`, `fix:`, `chore(release):`) trigger an automated release via the
`.releaserc.json` pipeline:

```
Conventional Commit → semantic-release
  → @semantic-release/commit-analyzer   (determine bump: major/minor/patch)
  → @semantic-release/release-notes-generator
  → @semantic-release/changelog          (update CHANGELOG.md)
  → @semantic-release/npm               (bump package.json, npmPublish: false)
  → @semantic-release/git               (commit CHANGELOG + package.json)
  → @semantic-release/github            (create GitHub Release + tag)
```

The new `APP_VERSION` is then picked up at the next `ng build` via
`generate-version.js` and stamped into every CSV, PDF, and generated script
produced by the application.

### Key scripts

| Command | Description |
|---|---|
| `npm start` | `ng serve` on default port 4200 |
| `npm run dev` | `ng serve --port=3000` |
| `npm run build` | Production build |
| `npm test -- --watch=false` | Run all Vitest unit tests once |
| `ng lint` | ESLint (TS + Angular template rules + boundary rules) |
| `npx playwright test` | Run all E2E tests (server must be running) |
