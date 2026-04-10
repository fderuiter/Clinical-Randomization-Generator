import {Component} from '@angular/core';
import {RouterLink} from '@angular/router';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="bg-white dark:bg-slate-900">
      <div class="relative isolate px-6 pt-14 lg:px-8">
        <div class="mx-auto max-w-2xl py-32 sm:py-48 lg:py-56">
          <div class="text-center">
            <h1 class="text-5xl font-bold tracking-tight text-gray-900 dark:text-slate-100 sm:text-7xl">Equipose</h1>
            <p class="mt-4 text-xl font-medium text-indigo-600 dark:text-indigo-400">Free Stratified Block Randomization for Clinical Trials</p>
            <p class="mt-6 text-lg leading-8 text-gray-600 dark:text-slate-400">
              Design, simulate, and export statistically sound, reproducible treatment allocation schemas for your clinical trial.
              Equipose uses a seeded Fisher-Yates shuffle for stratified block randomization across multiple sites and
              stratification factors — and exports the exact logic to validated <strong class="text-gray-700 dark:text-slate-300">R</strong>,
              <strong class="text-gray-700 dark:text-slate-300">Python</strong>, or
              <strong class="text-gray-700 dark:text-slate-300">SAS</strong> scripts for integration into your Statistical Analysis Plan.
              100% client-side — no data ever leaves your browser.
            </p>
            <div class="mt-10 flex items-center justify-center gap-x-6">
              <a routerLink="/generator" class="rounded-lg bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-colors">Get started</a>
              <a routerLink="/about" class="text-sm font-semibold leading-6 text-gray-900 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Learn more <span aria-hidden="true">→</span></a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class LandingComponent {}
