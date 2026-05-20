# Release Checklist

This checklist must be followed for all releases intended for regulated or statistical-confidence use.

## Checklist

- [ ] **CI Green:** Verify that all Continuous Integration (CI) checks have passed.
- [ ] **Current SBOM:** Ensure the Software Bill of Materials (SBOM) is current and accurate.
- [ ] **Cross-Environment Verification Passed:** Verify consistency across different environments (cross-env consistency).
- [ ] **Audit Trail Validated:** Ensure audit trails are validated.
- [ ] **Zero `Math.random` Usage:** Verify that there is no `Math.random` usage in the randomization engine. Cryptographically secure random number generation (CSPRNG) must be used.
- [ ] **Generated Scripts Executed Successfully:** Ensure that all generated scripts (e.g., SAS, STATA, Python, R) have been executed successfully.
