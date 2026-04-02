<div align="center">
  <img width="1200" height="475" alt="Clinical Randomization Generator Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

  <h1>Clinical Randomization Generator</h1>
  <p>A study-agnostic, client-side randomization schema generator for clinical trials.</p>
</div>

## Overview

The Clinical Randomization Generator is an interactive web utility designed to help biostatisticians and clinical trial managers rapidly design, simulate, and export stratified block randomization schemas.

Built entirely as a client-side Angular application, it ensures that sensitive trial design parameters never leave the user's browser. It supports complex multi-strata designs, variable block sizes, and custom treatment ratios.

> [!WARNING]
> **Clinical Compliance & Scientific Validity** > The schemas generated directly within the Web UI are intended for **simulation and design purposes only**. Due to inherent cross-environment Pseudo-Random Number Generator (PRNG) state mismatches, the web UI output will differ from native statistical software outputs even when using the same seed.
>
> **For actual clinical enrollment (e.g., 21 CFR Part 11 or ICH E9 compliance), you must download the generated R, Python, or SAS scripts and execute them within your organization's validated statistical environment.** The downloaded script serves as the auditable source of truth.

## Key Features

* **Complex Ratios:** Define custom allocation ratios (e.g., 1:1, 2:1, 3:1:1) across multiple treatment arms.
* **Stratified Block Randomization:** Ensure treatment balance across multiple clinical sites and dynamic stratification factors (e.g., Age, Gender, Region).
* **Dynamic Stratum Caps:** Set specific maximum enrollment caps for unique stratum combinations.
* **Math Failsafes:** Built-in validation ensures block sizes are exact multiples of the total allocation ratio.
* **Code Generation:** Instantly export the exact randomization logic to **R**, **Python (pandas/numpy)**, or **SAS** scripts for integration into your Statistical Analysis Plan (SAP).
* **Zero-Trust Architecture:** 100% client-side execution. No data is stored on or transmitted to external servers.

## Tech Stack

* **Framework:** Angular 18+ (Standalone Components, Signals, Control Flow)
* **Styling:** Tailwind CSS
* **Utilities:** `seedrandom` (for UI simulation), `jspdf` & `jspdf-autotable` (for exports)
* **Deployment:** Static hosting via GitHub Pages

## Local Development

**Prerequisites:** Node.js (v20+ recommended)

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/YOUR_USERNAME/clinical-randomization-generator.git](https://github.com/YOUR_USERNAME/clinical-randomization-generator.git)
   cd clinical-randomization-generator
   ```

2. **Install dependencies:**
   ```bash
   npm ci
   ```

3. **Run the development server:**
   ```bash
   npm start
   ```
   Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Deployment (GitHub Pages)

This application is configured to deploy automatically as a static site to GitHub Pages using GitHub Actions.

1. Ensure the repository has GitHub Actions enabled.
2. Navigate to repository **Settings** > **Pages**.
3. Under **Source**, select **GitHub Actions**.
4. Pushes to the `main` branch will automatically trigger the `.github/workflows/deploy.yml` workflow, which builds the Angular app with the correct `--base-href` and copies `index.html` to `404.html` to support Angular's client-side routing.

## Testing

* **Unit Tests:** Run `npm test` to execute the Vitest test suite.
* **E2E Tests:** Run `npx playwright test` to execute end-to-end user flows, including code generation and download validation.

## License

[Insert License Type - e.g., MIT License]