import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {RouterLink} from '@angular/router';
import {SeoService} from '../../core/services/seo.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="bg-white dark:bg-slate-900">

      <!-- ── Hero Section ──────────────────────────────────────────────── -->
      <div class="relative isolate overflow-hidden px-6 pt-14 lg:px-8">

        <!-- Subtle background grid pattern -->
        <div class="absolute inset-0 -z-10" aria-hidden="true">
          <svg class="absolute inset-0 h-full w-full stroke-gray-200 dark:stroke-slate-700/60 [mask-image:radial-gradient(100%_100%_at_top_center,white,transparent)]"
               fill="none">
            <defs>
              <pattern id="hero-grid" width="60" height="60" x="50%" y="-1" patternUnits="userSpaceOnUse">
                <path d="M.5 60V.5H60" fill="none"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" stroke-width="0" fill="url(#hero-grid)"/>
          </svg>
          <!-- Radial gradient blob -->
          <div class="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/4 w-[900px] h-[600px] rounded-full bg-gradient-to-br from-indigo-100/60 via-purple-50/40 to-transparent dark:from-indigo-950/30 dark:via-slate-900/20 dark:to-transparent blur-3xl"></div>
        </div>

        <div class="mx-auto max-w-2xl py-28 sm:py-40 lg:py-52">
          <div class="text-center">
            <h1 class="text-5xl font-bold tracking-tight text-gray-900 dark:text-slate-100 sm:text-7xl">Equipose</h1>
            <p class="mt-4 text-xl font-medium text-indigo-600 dark:text-indigo-400">Free Stratified Block Randomization for Clinical Trials</p>
            <p class="mt-6 text-lg leading-8 text-gray-600 dark:text-slate-400">
              Design, simulate, and export statistically sound, reproducible treatment allocation schemas for your clinical trial.
              Equipose uses a seeded Fisher-Yates shuffle for stratified block randomization across multiple sites and
              stratification factors — and exports the exact logic to validated <strong class="text-gray-700 dark:text-slate-300">R</strong>,
              <strong class="text-gray-700 dark:text-slate-300">Python</strong>,
              <strong class="text-gray-700 dark:text-slate-300">SAS</strong>, or
              <strong class="text-gray-700 dark:text-slate-300">Stata</strong> scripts for integration into your Statistical Analysis Plan.
              100% client-side — no data ever leaves your browser.
            </p>

            <!-- CTAs -->
            <div class="mt-10 flex items-center justify-center gap-x-6">
              <a routerLink="/generator"
                 class="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-colors">
                Get started
              </a>
              <a routerLink="/about" class="text-sm font-semibold leading-6 text-gray-900 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                Learn more <span aria-hidden="true">→</span>
              </a>
            </div>

            <!-- Trust strip -->
            <div class="mt-8 flex flex-wrap items-center justify-center gap-3" role="list" aria-label="Key features">
              @for (badge of trustBadges; track badge.label) {
                <span role="listitem"
                      class="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-700">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="badge.icon" />
                  </svg>
                  {{ badge.label }}
                </span>
              }
            </div>
          </div>
        </div>
      </div>

      <!-- ── How it works ───────────────────────────────────────────────── -->
      <div class="bg-indigo-50 dark:bg-slate-800/50 border-y border-indigo-100 dark:border-slate-700">
        <div class="mx-auto max-w-4xl px-6 py-12 lg:px-8">
          <p class="text-center text-xs font-semibold uppercase tracking-widest text-indigo-500 dark:text-indigo-400 mb-8">How it works</p>
          <ol class="grid grid-cols-1 sm:grid-cols-3 gap-6" role="list">
            @for (step of steps; track step.n) {
              <li class="flex flex-col items-center text-center gap-3">
                <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-600 dark:bg-indigo-500 text-white font-bold text-lg shadow-md" aria-hidden="true">
                  {{ step.n }}
                </div>
                <div>
                  <p class="font-semibold text-gray-900 dark:text-slate-100">{{ step.title }}</p>
                  <p class="mt-1 text-sm text-gray-600 dark:text-slate-400 leading-relaxed">{{ step.desc }}</p>
                </div>
                @if (!$last) {
                  <div class="hidden sm:block absolute translate-x-full" aria-hidden="true"></div>
                }
              </li>
            }
          </ol>
        </div>
      </div>

      <!-- ── Feature Grid ───────────────────────────────────────────────── -->
      <div class="mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <div class="mx-auto max-w-2xl text-center mb-12">
          <h2 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-slate-100">Everything you need for compliant randomization</h2>
          <p class="mt-4 text-base text-gray-600 dark:text-slate-400">A complete toolkit for biostatisticians, CROs, and clinical trial teams — built entirely in the browser.</p>
        </div>
        <dl class="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          @for (feature of features; track feature.title) {
            <div class="flex flex-col">
              <dt class="text-base font-semibold leading-7 text-gray-900 dark:text-slate-100">
                <div class="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 dark:bg-indigo-500 shadow-sm">
                  <svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="feature.icon" />
                  </svg>
                </div>
                {{ feature.title }}
              </dt>
              <dd class="mt-1 flex flex-auto flex-col text-base leading-7 text-gray-600 dark:text-slate-400">
                <p class="flex-auto">{{ feature.desc }}</p>
              </dd>
            </div>
          }
        </dl>

        <!-- Bottom CTA -->
        <div class="mt-16 text-center">
          <a routerLink="/generator"
             class="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-indigo-500 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Start generating your schema
          </a>
        </div>
      </div>

    </div>
  `
})
export class LandingComponent {
  constructor() {
    inject(SeoService).setPage({
      title: 'Equipose — Clinical Trial Randomization Tool',
      description: 'Free, browser-based stratified block randomization for clinical trials. Generate, simulate, and export balanced treatment allocation schemas to R, Python, SAS, or Stata. 100% client-side.',
      canonicalPath: '/',
    });
  }

  readonly trustBadges = [
    { label: '100% Client-Side', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
    { label: 'No Sign-Up Required', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { label: 'R · Python · SAS · Stata Export', icon: 'M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5' },
    { label: 'Open Source · MIT', icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
    { label: 'Zero Data Transmitted', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
  ];

  readonly steps = [
    { n: 1, title: 'Configure', desc: 'Define your trial parameters: sites, stratification factors, treatment arms, block sizes, and subject count.' },
    { n: 2, title: 'Generate', desc: 'Click "Generate Schema" — the engine runs entirely in a Web Worker using a seeded Fisher-Yates algorithm.' },
    { n: 3, title: 'Export', desc: 'Download your schema as Excel or JSON, and get validated R, Python, SAS, or Stata code for your SAP.' },
  ];

  readonly features = [
    {
      title: 'Stratified Block Randomization',
      desc: 'Ensure balance across multiple sites and stratification factors using a seeded Fisher-Yates shuffle for deterministic, reproducible outputs.',
      icon: 'M12 3v18M5 6l7-3 7 3M3 10l2 6a4 4 0 004 0l2-6M13 10l2 6a4 4 0 004 0l2-6',
    },
    {
      title: 'Custom Ratios & Block Sizes',
      desc: 'Define custom treatment arm ratios (2:1, 3:1:1) and variable or fixed block sizes per site or stratum for maximum design flexibility.',
      icon: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    },
    {
      title: 'Monte Carlo Simulation',
      desc: 'Run thousands of simulations to validate balance properties and estimate the probability of arm imbalance under different block configurations.',
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    },
    {
      title: 'Code Generation',
      desc: 'Export your randomization logic to R, Python, SAS, or Stata scripts for validation and integration into your Statistical Analysis Plan (SAP).',
      icon: 'M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5',
    },
    {
      title: 'Schema Verification',
      desc: 'Upload a previously exported JSON schema and the tool will re-run the algorithm and perform a strict row-by-row reproducibility check.',
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    },
    {
      title: 'Zero-Trust Privacy',
      desc: 'Every computation runs entirely in your browser. No study data, subject IDs, or allocation sequences are ever transmitted to any server.',
      icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    },
  ];
}
