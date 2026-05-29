# Security Policy

## Supported Versions

Use this section to tell people about which versions of your project are
currently being supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 5.1.x   | :white_check_mark: |
| 5.0.x   | :x:                |
| 4.0.x   | :white_check_mark: |
| < 4.0   | :x:                |

## Reporting a Vulnerability

Use this section to tell people how to report a vulnerability.

Tell them where to go, how often they can expect to get an update on a
reported vulnerability, what to expect if the vulnerability is accepted or
declined, etc.

## GitHub Actions SHA Pinning
To ensure the integrity of our software supply chain, all GitHub Actions must use immutable SHA-256 hashes instead of mutable tags (e.g., `@v2`).

### Mandatory Process for Adding and Rotating Action SHAs
1. **Find the SHA**: Identify the full 40-character SHA-256 hash associated with the desired version tag of the GitHub Action.
2. **Update the Workflow**: Replace the version tag in the `uses:` directive with the SHA. (e.g., `uses: actions/checkout@<SHA> # v4`).
3. **Verify Compliance**: Push your changes. The CI linting check will automatically fail the build if any mutable tags are detected. Egress controls (`harden-runner`) block unauthorized network requests.
4. **Rotating/Updating**: When a new version is required, locate the new SHA for that release, update the workflow file, and submit a PR.

## Verifying Release Artifacts (SLSA & SBOM)

All official releases are accompanied by cryptographically signed SLSA Build Provenance and SBOM (Software Bill of Materials) attestations, adhering to SLSA Level 3 requirements. These use keyless OIDC signatures via Sigstore.

### 1. Verifying via GitHub CLI (Recommended)

You can verify the integrity and provenance of the release artifacts using the [GitHub CLI](https://cli.github.com/):

```bash
# Verify the SLSA Build Provenance
gh attestation verify sbom.json --owner fderuiter --repo Clinical-Randomization-Generator
```

### 2. Verifying via Cosign

The attestations can also be verified using [Cosign](https://github.com/sigstore/cosign):

```bash
# Verify the attestation bundle
cosign verify-blob-attestation sbom.json \
  --bundle build-provenance.intoto.jsonl \
  --certificate-identity-regexp "^https://github.com/.*/.github/workflows/ci.yml.*" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com"
```
