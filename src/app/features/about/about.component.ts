import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {APP_VERSION} from '../../../environments/version';
import {SeoService} from '../../core/services/seo.service';

@Component({
  selector: 'app-about',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white dark:bg-slate-900 py-16 sm:py-20">
      <div class="mx-auto max-w-7xl px-6 lg:px-8">

        <!-- Header -->
        <div class="mx-auto max-w-2xl lg:mx-0">
          <div class="flex items-center gap-2 mb-3">
            <span class="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-700">
              {{ appVersion }}
            </span>
            <a href="https://github.com/fderuiter/Clinical-Randomization-Generator/blob/main/CHANGELOG.md"
               target="_blank" rel="noopener noreferrer"
               class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
              Changelog →
            </a>
          </div>
          <h2 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-slate-100 sm:text-4xl">About Equipose</h2>
          <p class="mt-6 text-lg leading-8 text-gray-600 dark:text-slate-400">
            Equipose is a free, open-source tool designed to help biostatisticians, clinical trial managers, and contract
            research organisations (CROs) rapidly design, simulate, and export stratified block randomization schemas for
            clinical trials. It runs entirely in your browser - no server, no sign-up, no data ever transmitted externally.
          </p>

          <!-- Compliance notice -->
          <div class="mt-8 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-500 p-4 rounded-r-md" role="alert">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-yellow-400 dark:text-yellow-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-yellow-700 dark:text-yellow-300">
                  <strong>Important Notice:</strong> This tool utilizes a zero trust architecture and is <strong>not 21 CFR Part 11 compliant</strong>. For 21 CFR Part 11 compliance, users must maintain a record of their generated code for the study instead of using the sample generated schema. The generated schema provided by this application is <strong>not to be used in production for any study</strong>, despite its validity, due to the zero trust infrastructure of the program.
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Feature cards (6) -->
        <div class="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
          <dl class="grid max-w-xl grid-cols-1 gap-x-8 gap-y-12 lg:max-w-none lg:grid-cols-3">
            @for (f of features; track f.title) {
              <div class="flex flex-col" [attr.data-testid]="f.testId">
                <dt class="text-base font-semibold leading-7 text-gray-900 dark:text-slate-100">
                  <div class="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 dark:bg-indigo-500 shadow-sm">
                    <svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="f.icon" />
                    </svg>
                  </div>
                  {{ f.title }}
                </dt>
                <dd class="mt-1 flex flex-auto flex-col text-base leading-7 text-gray-600 dark:text-slate-400">
                  <p class="flex-auto">{{ f.desc }}</p>
                </dd>
              </div>
            }
          </dl>
        </div>

        <!-- What is stratified block randomization -->
        <div class="mx-auto mt-20 max-w-2xl lg:mx-0">
          <h3 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-slate-100">What is Stratified Block Randomization?</h3>
          <p class="mt-4 text-base leading-7 text-gray-600 dark:text-slate-400">
            Stratified block randomization is a statistical method used in clinical trial design to ensure that treatment
            groups are balanced across key prognostic factors - such as clinical site, age group, disease severity, or
            region. By first stratifying subjects into homogeneous subgroups (strata) and then applying block randomization
            within each stratum, the method guarantees that each treatment arm receives a proportional share of subjects
            with similar baseline characteristics. This improves the statistical power of the trial and reduces the risk
            of confounding.
          </p>
          <p class="mt-4 text-base leading-7 text-gray-600 dark:text-slate-400">
            Variable block sizes are recommended to prevent investigators from predicting upcoming allocations, thereby
            protecting allocation concealment and maintaining the integrity of the blind.
          </p>
        </div>

        <!-- Who it is for -->
        <div class="mx-auto mt-16 max-w-2xl lg:mx-0">
          <h3 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-slate-100">Who Is Equipose For?</h3>
          <ul class="mt-4 space-y-3 text-base leading-7 text-gray-600 dark:text-slate-400 list-disc list-inside">
            <li><strong class="text-gray-800 dark:text-slate-300">Biostatisticians</strong> designing randomization schemas and drafting Statistical Analysis Plans (SAPs).</li>
            <li><strong class="text-gray-800 dark:text-slate-300">Clinical Trial Managers</strong> who need a quick, reproducible simulation of allocation sequences.</li>
            <li><strong class="text-gray-800 dark:text-slate-300">Contract Research Organisations (CROs)</strong> validating randomization logic before implementation in IRT/IVRS systems.</li>
            <li><strong class="text-gray-800 dark:text-slate-300">Academic researchers</strong> running investigator-initiated trials with limited budget for specialised software.</li>
          </ul>
        </div>

        <!-- Zero trust privacy -->
        <div class="mx-auto mt-16 max-w-2xl lg:mx-0">
          <h3 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-slate-100">Zero-Trust Privacy</h3>
          <p class="mt-4 text-base leading-7 text-gray-600 dark:text-slate-400">
            Equipose is built on a zero-trust architecture. Every computation - from randomization to code generation -
            runs entirely inside your browser using WebAssembly-class JavaScript. No protocol identifiers, study names,
            treatment arm labels, or randomization outputs are ever sent to any server. There are no cookies, no analytics
            trackers, and no accounts. Your trial design data stays on your machine.
          </p>
        </div>

        <!-- Technology Stack -->
        <div class="mx-auto mt-16 max-w-2xl lg:mx-0">
          <h3 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-slate-100">Technology Stack</h3>
          <p class="mt-4 text-base leading-7 text-gray-600 dark:text-slate-400">
            Equipose is built entirely with open-source, industry-standard tooling:
          </p>
          <dl class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            @for (tech of techStack; track tech.name) {
              <div class="flex items-start gap-3 rounded-lg bg-gray-50 dark:bg-slate-800 px-4 py-3">
                <span class="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-indigo-500"></span>
                <div>
                  <span class="font-medium text-gray-900 dark:text-slate-100 text-sm">{{ tech.name }}</span>
                  <span class="text-gray-500 dark:text-slate-400 text-sm"> — {{ tech.role }}</span>
                </div>
              </div>
            }
          </dl>
        </div>

        <!-- Cite Equipose -->
        <div class="mx-auto mt-16 max-w-2xl lg:mx-0">
          <h3 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-slate-100">Cite Equipose</h3>
          <p class="mt-4 text-base leading-7 text-gray-600 dark:text-slate-400">
            If you use Equipose in your research or clinical trial documentation, please cite it as follows:
          </p>

          <!-- APA -->
          <div class="mt-6">
            <p class="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">APA</p>
            <div class="rounded-lg bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-4 py-3">
              <p class="text-sm text-gray-700 dark:text-slate-300 font-mono leading-relaxed">
                de Ruiter, F. ({{ citationYear }}). <em>Equipose: Free stratified block randomization tool for clinical trials</em> ({{ appVersion }}) [Software]. https://equipose.org
              </p>
            </div>
          </div>

          <!-- BibTeX -->
          <div class="mt-4">
            <p class="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">BibTeX</p>
            <div class="rounded-lg bg-gray-900 dark:bg-slate-950 border border-gray-700 dark:border-slate-600 px-4 py-3 overflow-x-auto">
              <pre class="text-xs text-green-400 dark:text-green-300 leading-relaxed font-mono whitespace-pre">{{ bibtex }}</pre>
            </div>
          </div>
        </div>

      </div>
    </div>
  `
})
export class AboutComponent {
  readonly appVersion = APP_VERSION;
  readonly citationYear = new Date().getFullYear();
  readonly bibtex: string;

  constructor() {
    inject(SeoService).setPage({
      title: 'About Equipose — Stratified Block Randomization Tool',
      description: 'Learn about Equipose, the free open-source stratified block randomization tool for clinical trials. Built for biostatisticians, CROs, and academic researchers.',
      canonicalPath: '/about',
    });

    this.bibtex =
`@software{deruiter_equipose_${this.citationYear},
  author    = {de Ruiter, Frederick},
  title     = {Equipose: Free Stratified Block Randomization Tool for Clinical Trials},
  year      = {${this.citationYear}},
  version   = {${APP_VERSION}},
  url       = {https://equipose.org},
  note      = {Open-source web application}
}`;
  }

  readonly features = [
    {
      title: 'Stratified Block Randomization',
      testId: 'feature-stratified-block',
      desc: 'Ensure balance across multiple sites and stratification factors using a seeded Fisher-Yates shuffle algorithm for deterministic, reproducible outputs.',
      icon: 'M12 3v18M5 6l7-3 7 3M3 10l2 6a4 4 0 004 0l2-6M13 10l2 6a4 4 0 004 0l2-6',
    },
    {
      title: 'Custom Ratios & Block Sizes',
      testId: 'feature-custom-ratios',
      desc: 'Define custom treatment arm ratios (2:1, 3:1:1) and variable or fixed block sizes, with per-site or per-stratum overrides.',
      icon: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    },
    {
      title: 'Monte Carlo Simulation',
      testId: 'feature-monte-carlo',
      desc: 'Run thousands of simulations to validate balance properties and verify allocation concealment under different block configurations.',
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    },
    {
      title: 'Code Generation',
      testId: 'feature-code-generation',
      desc: 'Export your randomization schema logic to R, Python, SAS, or Stata scripts for validation and integration into your Statistical Analysis Plan.',
      icon: 'M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5',
    },
    {
      title: 'Schema Verification',
      testId: 'feature-schema-verification',
      desc: 'Upload an exported JSON schema and the tool re-runs the algorithm to perform a strict row-by-row reproducibility check against the original.',
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    },
    {
      title: 'Zero-Trust Privacy',
      testId: 'feature-zero-trust',
      desc: 'Every computation runs entirely in your browser using a Web Worker. No study data, treatment labels, or outputs are ever sent to any external server.',
      icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    },
  ];

  readonly techStack = [
    { name: 'Angular 19', role: 'SPA framework with signals and standalone components' },
    { name: 'Tailwind CSS v4', role: 'Utility-first CSS with dark mode' },
    { name: 'Angular Service Worker', role: 'Offline-capable Progressive Web App (PWA)' },
    { name: 'Web Workers', role: 'Non-blocking randomization computation' },
    { name: 'Seeded Fisher-Yates', role: 'Deterministic, reproducible shuffle algorithm' },
    { name: 'Pocock-Simon minimization', role: 'Covariate-adaptive allocation algorithm' },
    { name: 'ECharts', role: 'Interactive schema analytics charts' },
    { name: 'ExcelJS', role: 'Multi-sheet Excel schema export' },
  ];
}
