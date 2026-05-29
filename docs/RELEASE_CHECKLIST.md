# Release Checklist for Regulated and Statistical-Confidence Use

This checklist must be completed for any release that is intended for regulated or statistical-confidence use (e.g., 21 CFR Part 11 or ICH E9 compliance).

## Pre-Release Verification

- [ ] **CI Green:** Ensure that all Continuous Integration (CI) checks, including unit tests, end-to-end (E2E) tests, and linters, pass on the target release branch without any overrides or ignored failures.
- [ ] **SBOM Current:** Ensure the Software Bill of Materials (SBOM) is updated, current, and reflects the exact dependencies built into the release artifact.
- [ ] **Cross-Env Verification Passed:** Verify that generated scripts produce statistically equivalent randomization schemas across multiple target environments (e.g., Windows, macOS, Linux) when utilizing the same seed and parameters.
- [ ] **Audit Trail Validated:** Confirm that the application correctly logs necessary audit trail information for schemas and that metadata generated (including seeds and timestamp details) is accurate and tamper-evident.
- [ ] **No `Math.random` in Engine:** Verify that `Math.random()` is not used within any core randomization engine or algorithm logic. Cryptographically secure random number generation (CSPRNG) must be used.
- [ ] **Generated Scripts Executed Successfully:** Execute sample generated code artifacts (R, Python, SAS, STATA) in their respective native, validated statistical environments to ensure they run successfully without errors and produce expected outputs.

## Post-Release
- [ ] Document completion of this checklist in the release notes or a dedicated compliance artifact.
- [ ] Cryptographically verify the release artifacts (e.g., using Cosign or GitHub CLI) to ensure the build provenance and SBOM attestations are valid.
