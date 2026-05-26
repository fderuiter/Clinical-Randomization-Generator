# ADR 0001 — SAS Script Static Validation Strategy

**Document ID:** EQUIPOSE-ADR-0001  
**Status:** Accepted  
**Date:** 2026-05-20  
**Deciders:** Equipose Maintainers  
**Related:** `docs/SAS_Stata_Exception_Report.md`, CI job `sas_static_validation`

---

## Context

Equipose exports SAS (`.sas`) randomization scripts as part of its 21 CFR Part 11–compliant
artefact set (see `docs/SAS_Stata_Exception_Report.md`). Full mathematical execution
of these scripts in CI is not feasible because SAS Institute requires a paid commercial
licence that cannot be embedded in a public GitHub Actions runner.

Issue [#309](https://github.com/fderuiter/Equipose/issues/309) requires that, at minimum,
an automated **syntax-level check** is performed on every generated SAS fixture so that
regressions in code generation are caught in CI without a licensed runtime.

---

## Options Considered

### Option A — Containerised SAS Execution (Rejected)

Spin up a Docker container with a licensed SAS installation; execute the generated
`.sas` file; assert output.

**Rejected because:**
- SAS Institute licensing terms prohibit redistribution of the SAS runtime in public CI.
- A confidential SAS CI licence is not available to this open-source project.
- Even the open-source `SAS Viya` variant requires a cloud subscription and cannot be
  run offline in an ephemeral GitHub Actions runner.

### Option B — Third-Party Open-Source SAS Parser (Not adopted at this stage)

Use `@sasjs/lint` (Node.js) or a similar community parser for structural checks.

**Not adopted at this stage because:**
- `@sasjs/lint` is targeted at enterprise SASjs framework conventions and generates
  false positives for standard Base-SAS programs.
- Adds a third-party dependency with SAS-specific logic that would need ongoing
  maintenance alignment.
- A tailored, lightweight validator (Option C) provides equivalent coverage for the
  specific patterns that Equipose generates.

Re-evaluate if a broadly adopted, framework-agnostic Base-SAS linter becomes available.

### Option C — Tailored Static Syntax Validator (Accepted)

Implement a lightweight Node.js script (`scripts/validate-sas-syntax.mjs`) that
performs targeted static analysis on the `.sas` artefacts exported by the
`code_generation_fixtures` CI job. The checks are aligned to the exact structural
patterns that `CodeGeneratorService.generateSas()` emits.

**Accepted because:**
- Zero new runtime dependencies.
- Runs in any Node.js ≥ 18 environment without a SAS installation.
- Covers all failure modes that have been observed in code-generation regressions:
  unclosed comment blocks, unmatched `DATA`/`RUN`, unmatched `PROC`/`QUIT`,
  unbalanced `%MACRO`/`%MEND`, and missing required header fields.
- Directly executable in a new `sas_static_validation` CI job.

---

## Decision

Implement **Option C**. The validator (`scripts/validate-sas-syntax.mjs`) is run in CI
after the fixture export job (`code_generation_fixtures`) downloads the exported artefacts
and validates every `.sas` file present.

---

## Validation Checks Implemented

| Check | Rule |
|---|---|
| Required header fields | All five mandatory comment fields must be present: `Randomization Schema Generation in SAS`, `Protocol:`, `App Version:`, `Generated At:`, `PRNG Algorithm:` |
| ISO 8601 timestamp | `Generated At:` value must match `YYYY-MM-DDTHH:MM:SS` |
| Seed statement | `%let seed =` must appear with a numeric value |
| Comment balance | Every `/*` must have a matching `*/` |
| DATA step balance | Each `data <name>;` must be closed by a `run;` |
| PROC step balance | Each `proc <name>` must be closed by `run;` or `quit;` |
| Macro balance | Each `%macro <name>` must be closed by a matching `%mend` |

---

## Consequences

### Positive

- Syntax regressions in `CodeGeneratorService.generateSas()` are automatically caught
  in CI without a SAS licence.
- The validation strategy is documented and traceable.
- The `docs/SAS_Stata_Exception_Report.md` §4.1 references the concrete automated check.

### Negative / Limitations

- Does **not** verify mathematical correctness of the generated algorithm (runtime
  execution is still required for that — see exception report).
- The validator is tailored to Equipose's output patterns; it is not a general-purpose
  SAS linter.

### Future Options

- If SAS Institute makes a freely distributable, CI-compatible runtime available, the
  `sas_static_validation` job can be replaced with a full execution check and
  `docs/SAS_Stata_Exception_Report.md` can be closed.
- If a broadly adopted open-source Base-SAS parser emerges, revisit Option B.

---

## References

- `docs/SAS_Stata_Exception_Report.md` — formal exception for mathematical execution
- `scripts/validate-sas-syntax.mjs` — the implemented validator
- `.github/workflows/ci.yml` — `sas_static_validation` CI job
- 21 CFR Part 11 – Electronic Records; Electronic Signatures (FDA, 2003)
- ICH E9 – Statistical Principles for Clinical Trials (1998)
